import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { DbHandle } from '../../src/db/client.js';
import { adminActionLogs, learningProfiles, users } from '../../src/db/schema.js';
import { verifyPassword } from '../../src/services/password.js';
import { createAdmin, generatePassword } from '../../src/seed/create-admin.js';
import { seedContent, seedDevAdmin } from '../../src/seed/index.js';
import { openTestDb, resetDatabase } from './helpers.js';

// `pnpm seed` (T026) và `pnpm admin:create` (T026a) trên PostgreSQL thật.

let handle: DbHandle;

beforeAll(() => {
  handle = openTestDb();
});
afterAll(async () => {
  await handle.close();
});
beforeEach(async () => {
  await resetDatabase(handle);
});

const count = async (table: string, where = 'true'): Promise<number> =>
  (await handle.pool.query(`SELECT count(*)::int AS n FROM ${table} WHERE ${where}`)).rows[0].n;

describe('seedContent', () => {
  it('nạp mảng, đơn vị N5–N3 (kể cả Kanji), bài tập và bộ placement 20 câu đang kích hoạt', async () => {
    const summary = await seedContent(handle.db);
    expect(summary).toMatchObject({
      topicsInserted: 20,
      unitsInserted: 21,
      unitsSkipped: 0,
      placementInserted: 20,
      placementActivated: true,
    });
    expect(await count('topics')).toBe(20);
    expect(await count('learning_units', "status = 'active'")).toBe(21);
    expect(await count('content_items')).toBeGreaterThanOrEqual(14 * 3);
    expect(await count('exercises')).toBeGreaterThanOrEqual(14 * 4);
    expect(await count('placement_questions', 'is_active')).toBe(20);
    // 8 N5, 6 N4, 6 N3
    const byLevel = await handle.pool.query(
      `SELECT level::text AS level, count(*)::int AS n FROM placement_questions WHERE is_active GROUP BY level ORDER BY level::text`,
    );
    expect(byLevel.rows).toEqual([
      { level: 'N3', n: 6 },
      { level: 'N4', n: 6 },
      { level: 'N5', n: 8 },
    ]);
  });

  it('thỏa quy tắc nội dung ở mức CSDL: đơn vị 5 phút và foundation cho mỗi kind', async () => {
    await seedContent(handle.db);
    for (const kind of ['vocabulary', 'grammar']) {
      expect(
        await count('learning_units', `kind = '${kind}' AND level = 'N5' AND est_minutes = 5`),
      ).toBeGreaterThanOrEqual(1);
      expect(
        await count(
          'learning_units',
          `kind = '${kind}' AND tier = 'foundation' AND est_minutes = 5`,
        ),
      ).toBeGreaterThanOrEqual(1);
    }
    // Tập dùng thử: 1 từ vựng + 1 ngữ pháp, tổng ≤ 10 phút.
    const trial = await handle.pool.query(
      `SELECT kind::text AS kind, est_minutes FROM learning_units WHERE is_trial ORDER BY kind::text`,
    );
    expect(trial.rows.map((r) => r.kind)).toEqual(['grammar', 'vocabulary']);
    expect(trial.rows.reduce((s, r) => s + r.est_minutes, 0)).toBeLessThanOrEqual(10);
  });

  it('nạp 7 bài Kanji (27 chữ) và 6 chủ đề Kanji với chi tiết, chủ đề riêng và khía cạnh (spec 003)', async () => {
    await seedContent(handle.db);
    expect(await count('topics', "skill = 'kanji'")).toBe(6);
    expect(await count('learning_units', "kind = 'kanji' AND status = 'active'")).toBe(7);
    expect(await count('content_items', "kind = 'kanji'")).toBe(27);
    // Mọi chữ Kanji có chủ đề thuộc kỹ năng Kanji, chi tiết đầy đủ và reading NULL.
    expect(
      await count(
        'content_items i JOIN topics t ON t.id = i.topic_id',
        "i.kind = 'kanji' AND t.skill = 'kanji' AND i.kanji_details IS NOT NULL AND i.reading IS NULL",
      ),
    ).toBe(27);
    // Mục khác Kanji không có kanji_details/topic_id.
    expect(
      await count(
        'content_items',
        "kind <> 'kanji' AND (kanji_details IS NOT NULL OR topic_id IS NOT NULL)",
      ),
    ).toBe(0);
    // Mỗi chữ có đủ bài tập cho ba khía cạnh; bài tập khác Kanji có facet item.
    const covered = await handle.pool.query(
      `SELECT i.id, count(DISTINCT e.facet)::int AS n
         FROM content_items i JOIN exercises e ON e.item_id = i.id
        WHERE i.kind = 'kanji' AND e.facet IN ('meaning','reading','word') GROUP BY i.id`,
    );
    expect(covered.rows).toHaveLength(27);
    expect(covered.rows.every((r) => r.n === 3)).toBe(true);
    expect(
      await count(
        'exercises e JOIN learning_units u ON u.id = e.unit_id',
        "u.kind <> 'kanji' AND e.facet <> 'item'",
      ),
    ).toBe(0);
    // Từ ví dụ có kanjiReading; mỗi bài Kanji có goal_tags không rỗng và nằm ngoài tập dùng thử.
    const withReading = await handle.pool.query(
      `SELECT count(*)::int AS n FROM content_items i, jsonb_array_elements(i.examples) ex
        WHERE i.kind = 'kanji' AND ex ? 'kanjiReading'`,
    );
    expect(withReading.rows[0].n).toBeGreaterThanOrEqual(27);
    expect(await count('learning_units', "kind = 'kanji' AND cardinality(goal_tags) = 0")).toBe(0);
    expect(await count('learning_units', "kind = 'kanji' AND is_trial")).toBe(0);
  });

  it('seed lại hai lần không nhân bản bài Kanji (idempotent)', async () => {
    await seedContent(handle.db);
    const again = await seedContent(handle.db);
    expect(again).toMatchObject({ topicsInserted: 0, unitsInserted: 0, unitsSkipped: 21 });
    expect(await count('learning_units', "kind = 'kanji'")).toBe(7);
    expect(await count('content_items', "kind = 'kanji'")).toBe(27);
  });

  it('bài tập gắn đúng mục (item_id) khi khai báo, và đáp án nằm trong payload', async () => {
    await seedContent(handle.db);
    const { rows } = await handle.pool.query(
      `SELECT e.type, e.payload, i.japanese
         FROM exercises e JOIN content_items i ON i.id = e.item_id
        WHERE i.japanese = 'おはようございます'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe('multiple_choice');
    expect(rows[0].payload.correct_index).toBe(0);
    expect(rows[0].payload.choices).toHaveLength(4);
  });

  it('chạy lại an toàn: không nhân đôi và không ghi đè nội dung admin đã sửa', async () => {
    await seedContent(handle.db);
    await handle.pool.query(
      `UPDATE learning_units SET title = jsonb_set(title, '{vi}', '"Tiêu đề do admin sửa"') WHERE is_trial AND kind = 'vocabulary'`,
    );
    const again = await seedContent(handle.db);
    expect(again).toMatchObject({
      topicsInserted: 0,
      unitsInserted: 0,
      unitsSkipped: 21,
      placementInserted: 0,
      placementActivated: false,
    });
    expect(await count('learning_units')).toBe(21);
    expect(await count('placement_questions')).toBe(20);
    expect(await count('learning_units', `title->>'vi' = 'Tiêu đề do admin sửa'`)).toBe(1);
  });

  it('không tự kích hoạt bộ placement nếu đã có bộ hiện hành do admin chọn', async () => {
    await seedContent(handle.db);
    await handle.pool.query(`DELETE FROM placement_questions WHERE position > 1`);
    const again = await seedContent(handle.db);
    // Bộ hiện hành (1 câu) giữ nguyên; các câu bổ sung được nạp nhưng không kích hoạt.
    expect(again.placementActivated).toBe(false);
    expect(await count('placement_questions', 'is_active')).toBe(1);
  });
});

describe('admin:create', () => {
  it('tạo admin mới với hồ sơ, mật khẩu argon2id và ghi nhật ký user.grant_admin (actor null)', async () => {
    const result = await createAdmin(handle.db, 'Admin@Example.com', 'mat-khau-dai-123');
    expect(result.outcome).toBe('created');
    const [user] = await handle.db.select().from(users).where(eq(users.id, result.userId));
    expect(user).toMatchObject({ role: 'admin', status: 'active', email: 'Admin@Example.com' });
    expect(user!.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(await verifyPassword(user!.passwordHash, 'mat-khau-dai-123')).toBe(true);
    expect(await verifyPassword(user!.passwordHash, 'sai')).toBe(false);
    const [profile] = await handle.db
      .select()
      .from(learningProfiles)
      .where(eq(learningProfiles.userId, result.userId));
    expect(profile!.displayName).toBe('Admin');

    const logs = await handle.db.select().from(adminActionLogs);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      actorId: null,
      action: 'user.grant_admin',
      targetType: 'user',
      targetId: result.userId,
    });
  });

  it('nâng quyền tài khoản có sẵn, giữ nguyên mật khẩu cũ', async () => {
    const [learner] = await handle.db
      .insert(users)
      .values({ email: 'learner@example.com', passwordHash: 'hash-cu' })
      .returning();
    const result = await createAdmin(handle.db, 'LEARNER@example.com', 'mat-khau-moi-123');
    expect(result).toEqual({ userId: learner!.id, outcome: 'promoted' });
    const [after] = await handle.db.select().from(users).where(eq(users.id, learner!.id));
    expect(after!.role).toBe('admin');
    expect(after!.passwordHash).toBe('hash-cu');
  });

  it('chạy lại với admin sẵn có: không đổi gì nhưng vẫn ghi nhật ký mỗi lần chạy', async () => {
    await createAdmin(handle.db, 'a@example.com', 'mat-khau-dai-123');
    const second = await createAdmin(handle.db, 'a@example.com', 'mat-khau-dai-123');
    expect(second.outcome).toBe('unchanged');
    expect(await count('users')).toBe(1);
    expect(await count('admin_action_logs', "action = 'user.grant_admin'")).toBe(2);
  });

  it('từ chối tài khoản bị vô hiệu hóa / chờ xóa, email sai, mật khẩu ngắn hoặc thiếu mật khẩu khi tạo mới', async () => {
    await handle.db
      .insert(users)
      .values({ email: 'off@example.com', passwordHash: 'h', status: 'disabled' });
    await expect(createAdmin(handle.db, 'off@example.com', 'mat-khau-dai-123')).rejects.toThrow(
      /disabled/,
    );
    await handle.db.insert(users).values({
      email: 'del@example.com',
      passwordHash: 'h',
      status: 'pending_deletion',
      deletionRequestedAt: new Date(),
    });
    await expect(createAdmin(handle.db, 'del@example.com', 'mat-khau-dai-123')).rejects.toThrow(
      /pending_deletion/,
    );
    await expect(createAdmin(handle.db, 'khong-phai-email', 'mat-khau-dai-123')).rejects.toThrow();
    await expect(createAdmin(handle.db, 'new@example.com', 'ngan')).rejects.toThrow(/ít nhất 8/);
    await expect(createAdmin(handle.db, 'new@example.com')).rejects.toThrow(/mật khẩu/);
    expect(await count('admin_action_logs')).toBe(0);
    expect(await count('users', "role = 'admin'")).toBe(0);
  });

  it('seedDevAdmin tạo admin dev rồi giữ nguyên ở lần sau', async () => {
    const env = {
      SEED_ADMIN_EMAIL: 'dev-admin@example.com',
      SEED_ADMIN_PASSWORD: 'dev-mat-khau-1',
    };
    expect(await seedDevAdmin(handle.db, env)).toEqual({
      email: 'dev-admin@example.com',
      outcome: 'created',
    });
    expect(await seedDevAdmin(handle.db, env)).toEqual({
      email: 'dev-admin@example.com',
      outcome: 'unchanged',
    });
    expect(await count('admin_action_logs')).toBe(1);
  });

  it('generatePassword sinh mật khẩu ngẫu nhiên đủ dài', () => {
    const a = generatePassword();
    expect(a.length).toBeGreaterThanOrEqual(20);
    expect(generatePassword()).not.toBe(a);
  });
});
