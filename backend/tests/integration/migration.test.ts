import { randomUUID } from 'node:crypto';
import { copyFileSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { is } from 'drizzle-orm';
import { PgTable, getTableConfig } from 'drizzle-orm/pg-core';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { DbHandle } from '../../src/db/client.js';
import { runMigrations } from '../../src/db/migrate.js';
import * as schema from '../../src/db/schema.js';
import { openTestDb, requireDatabaseUrl, resetDatabase } from './helpers.js';

// Kiểm tra migration `0001_init.sql` (T008) và schema Drizzle (T009) trên PostgreSQL thật; nâng cấp
// 0002/0003 (Kanji) trên dữ liệu 001 có sẵn (spec 003, T008).

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

const q = (text: string, params: unknown[] = []) => handle.pool.query(text, params);

/** Bắt lỗi ràng buộc CSDL và trả mã SQLSTATE (23505 unique, 23514 check, 23503 FK). */
async function failureCode(text: string, params: unknown[] = []): Promise<string | undefined> {
  try {
    await q(text, params);
    return undefined;
  } catch (err) {
    return (err as { code?: string }).code;
  }
}

const UNIQUE = '23505';
const CHECK = '23514';

async function insertUser(email = `u-${randomUUID()}@example.com`): Promise<string> {
  const { rows } = await q(
    `INSERT INTO users (email, password_hash) VALUES ($1, 'hash') RETURNING id`,
    [email],
  );
  return rows[0].id as string;
}

async function insertTopic(): Promise<string> {
  const { rows } = await q(
    `INSERT INTO topics (skill, name, level) VALUES ('vocabulary', '{"vi":"a","en":"a"}', 'N5') RETURNING id`,
  );
  return rows[0].id as string;
}

async function insertUnit(
  topicId: string,
  over: { level?: string; tier?: string; est?: number; difficulty?: number } = {},
): Promise<string> {
  const { rows } = await q(
    `INSERT INTO learning_units (kind, title, level, topic_id, difficulty, tier, est_minutes)
     VALUES ('vocabulary', '{"vi":"t","en":"t"}', $1, $2, $3, $4, $5) RETURNING id`,
    [over.level ?? 'N5', topicId, over.difficulty ?? 1, over.tier ?? 'core', over.est ?? 5],
  );
  return rows[0].id as string;
}

/** Dựng chuỗi người dùng → phiên học → bài tập tối thiểu để thử các ràng buộc bản ghi học. */
async function insertLessonFixture() {
  const userId = await insertUser();
  const topicId = await insertTopic();
  const unitId = await insertUnit(topicId);
  const exercise = await q(
    `INSERT INTO exercises (unit_id, type, prompt, payload, feedback_correct, feedback_incorrect)
     VALUES ($1, 'multiple_choice', '{}', '{}', '{}', '{}') RETURNING id`,
    [unitId],
  );
  const session = await q(
    `INSERT INTO lesson_sessions (user_id, kind, unit_id, snapshot) VALUES ($1, 'new_unit', $2, '{}') RETURNING id`,
    [userId, unitId],
  );
  return {
    userId,
    topicId,
    unitId,
    exerciseId: exercise.rows[0].id as string,
    sessionId: session.rows[0].id as string,
  };
}

const answer = (
  f: Awaited<ReturnType<typeof insertLessonFixture>>,
  eventId: string,
  retry: boolean,
) =>
  q(
    `INSERT INTO study_records
       (user_id, client_event_id, session_id, exercise_id, topic_id, is_correct, submitted_answer,
        context, is_retry, local_date)
     VALUES ($1, $2, $3, $4, $5, true, '0', 'lesson', $6, '2026-01-05')`,
    [f.userId, eventId, f.sessionId, f.exerciseId, f.topicId, retry],
  );

describe('migration runner', () => {
  it('chạy lại không áp dụng lại migration đã có', async () => {
    const result = await runMigrations(requireDatabaseUrl());
    expect(result.applied).toEqual([]);
    expect(result.skipped).toContain('0001_init.sql');
  });
});

describe('schema Drizzle khớp migration', () => {
  it('mỗi bảng/cột của schema.ts có trong CSDL và ngược lại', async () => {
    const tables = Object.values(schema).filter((v) => is(v, PgTable)) as unknown as PgTable[];
    expect(tables.length).toBeGreaterThanOrEqual(22);

    const { rows } = await q(
      `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'`,
    );
    const dbColumns = new Map<string, Set<string>>();
    for (const r of rows) {
      if (!dbColumns.has(r.table_name)) dbColumns.set(r.table_name, new Set());
      dbColumns.get(r.table_name)!.add(r.column_name);
    }

    const drizzleNames = new Set<string>();
    for (const table of tables) {
      const cfg = getTableConfig(table);
      drizzleNames.add(cfg.name);
      const dbCols = dbColumns.get(cfg.name);
      expect(dbCols, `bảng ${cfg.name} thiếu trong CSDL`).toBeDefined();
      const drizzleCols = new Set(cfg.columns.map((c) => c.name));
      expect([...drizzleCols].sort(), `cột của ${cfg.name}`).toEqual([...dbCols!].sort());
    }
    const dbOnly = [...dbColumns.keys()].filter(
      (t) => !drizzleNames.has(t) && t !== 'schema_migrations',
    );
    expect(dbOnly, 'bảng có trong CSDL nhưng thiếu trong schema.ts').toEqual([]);
  });

  it('đọc/ghi qua Drizzle đúng kiểu (citext, date, jsonb, mảng enum)', async () => {
    const { db } = handle;
    const [user] = await db
      .insert(schema.users)
      .values({ email: 'Mixed.Case@Example.com', passwordHash: 'h' })
      .returning();
    expect(user!.role).toBe('learner');
    expect(user!.status).toBe('active');
    expect(user!.fromTrial).toBe(false);
    await db.insert(schema.learningProfiles).values({ userId: user!.id, displayName: 'An' });
    const [profile] = await db.select().from(schema.learningProfiles);
    expect(profile!.skills).toEqual(['vocabulary', 'grammar']);
    expect(profile!.language).toBe('vi');
    expect(profile!.onboardingState).toBe('not_started');
    const [topic] = await db
      .insert(schema.topics)
      .values({ skill: 'grammar', level: 'N5', name: { vi: 'Trợ từ', en: 'Particles' } })
      .returning();
    expect(topic!.name).toEqual({ vi: 'Trợ từ', en: 'Particles' });
    await db.insert(schema.dailyPlans).values({
      userId: user!.id,
      localDate: '2026-01-05',
      budgetMinutes: 10,
      estimatedMinutes: 10,
    });
    const [plan] = await db.select().from(schema.dailyPlans);
    expect(plan!.localDate).toBe('2026-01-05'); // chuỗi, không bị lệch múi giờ
    await db
      .insert(schema.aggregateDailyStats)
      .values({ day: '2026-01-05', metric: 'x', value: 3 });
    const [stat] = await db.select().from(schema.aggregateDailyStats);
    expect(stat!.value).toBe(3);
  });
});

describe('ràng buộc tài khoản', () => {
  it('email không phân biệt hoa thường (citext UNIQUE)', async () => {
    await insertUser('An@Example.com');
    expect(
      await failureCode(`INSERT INTO users (email, password_hash) VALUES ('an@example.COM', 'h')`),
    ).toBe(UNIQUE);
  });

  it('hồ sơ hoàn tất onboarding phải có mục tiêu và thời gian; JLPT cần target_level', async () => {
    const userId = await insertUser();
    await q(`INSERT INTO learning_profiles (user_id, display_name) VALUES ($1, 'An')`, [userId]);
    const complete = (set: string) =>
      failureCode(
        `UPDATE learning_profiles SET onboarding_state = 'completed', ${set} WHERE user_id = $1`,
        [userId],
      );
    expect(await complete(`daily_minutes = 10`)).toBe(CHECK); // thiếu goal_type
    expect(await complete(`goal_type = 'work'`)).toBe(CHECK); // thiếu daily_minutes
    expect(await complete(`goal_type = 'jlpt', daily_minutes = 10`)).toBe(CHECK); // thiếu target_level
    expect(
      await complete(`goal_type = 'jlpt', daily_minutes = 10, target_level = 'N4'`),
    ).toBeUndefined();
  });

  it('daily_minutes chỉ ∈ {5,10,15,30}, tên hiển thị 1–60 ký tự, kỹ năng không rỗng', async () => {
    const userId = await insertUser();
    expect(
      await failureCode(
        `INSERT INTO learning_profiles (user_id, display_name, daily_minutes) VALUES ($1, 'An', 20)`,
        [userId],
      ),
    ).toBe(CHECK);
    expect(
      await failureCode(`INSERT INTO learning_profiles (user_id, display_name) VALUES ($1, '')`, [
        userId,
      ]),
    ).toBe(CHECK);
    expect(
      await failureCode(`INSERT INTO learning_profiles (user_id, display_name) VALUES ($1, $2)`, [
        userId,
        'x'.repeat(61),
      ]),
    ).toBe(CHECK);
    expect(
      await failureCode(
        `INSERT INTO learning_profiles (user_id, display_name, skills) VALUES ($1, 'An', '{}')`,
        [userId],
      ),
    ).toBe(CHECK);
  });

  it('chỉ một giai đoạn tạm dừng đang mở mỗi người học', async () => {
    const userId = await insertUser();
    const other = await insertUser();
    await q(`INSERT INTO pause_periods (user_id, started_on) VALUES ($1, '2026-01-01')`, [userId]);
    expect(
      await failureCode(
        `INSERT INTO pause_periods (user_id, started_on) VALUES ($1, '2026-01-02')`,
        [userId],
      ),
    ).toBe(UNIQUE);
    // Đóng giai đoạn rồi mở giai đoạn mới thì được; người khác không bị ảnh hưởng.
    await q(`UPDATE pause_periods SET ended_on = '2026-01-03' WHERE user_id = $1`, [userId]);
    expect(
      await failureCode(
        `INSERT INTO pause_periods (user_id, started_on) VALUES ($1, '2026-01-10')`,
        [userId],
      ),
    ).toBeUndefined();
    expect(
      await failureCode(
        `INSERT INTO pause_periods (user_id, started_on) VALUES ($1, '2026-01-10')`,
        [other],
      ),
    ).toBeUndefined();
  });
});

describe('ràng buộc nội dung', () => {
  it('est_minutes ∈ {5,10,15} (FR-017)', async () => {
    const topicId = await insertTopic();
    for (const bad of [0, 7, 20, 30]) {
      expect(
        await failureCode(
          `INSERT INTO learning_units (kind, title, level, topic_id, difficulty, est_minutes) VALUES ('vocabulary','{}','N5',$1,1,$2)`,
          [topicId, bad],
        ),
        `est ${bad}`,
      ).toBe(CHECK);
    }
    for (const ok of [5, 10, 15]) await insertUnit(topicId, { est: ok });
  });

  it("tier='foundation' chỉ hợp lệ với level N5", async () => {
    const topicId = await insertTopic();
    await expect(insertUnit(topicId, { tier: 'foundation', level: 'N4' })).rejects.toMatchObject({
      code: CHECK,
    });
    await expect(insertUnit(topicId, { tier: 'foundation', level: 'N5' })).resolves.toBeTruthy();
    await expect(insertUnit(topicId, { tier: 'core', level: 'N3' })).resolves.toBeTruthy();
  });

  it('độ khó 1–5 và goal_tags thuộc tập cho phép', async () => {
    const topicId = await insertTopic();
    await expect(insertUnit(topicId, { difficulty: 0 })).rejects.toMatchObject({ code: CHECK });
    await expect(insertUnit(topicId, { difficulty: 6 })).rejects.toMatchObject({ code: CHECK });
    expect(
      await failureCode(
        `INSERT INTO learning_units (kind, title, level, topic_id, difficulty, est_minutes, goal_tags) VALUES ('vocabulary','{}','N5',$1,1,5,'{khac}')`,
        [topicId],
      ),
    ).toBe(CHECK);
    expect(
      await failureCode(
        `INSERT INTO learning_units (kind, title, level, topic_id, difficulty, est_minutes, goal_tags) VALUES ('vocabulary','{}','N5',$1,1,5,'{jlpt,work}')`,
        [topicId],
      ),
    ).toBeUndefined();
  });

  it('câu placement: correct_choice nằm trong choices; mảng tên đủ vi + en', async () => {
    const topicId = await insertTopic();
    const insert = (correct: number) =>
      failureCode(
        `INSERT INTO placement_questions (level, skill, topic_id, prompt, choices, correct_choice) VALUES ('N5','vocabulary',$1,'{"ja":"q"}','["a","b","c","d"]',$2)`,
        [topicId, correct],
      );
    expect(await insert(4)).toBe(CHECK);
    expect(await insert(-1)).toBe(CHECK);
    expect(await insert(3)).toBeUndefined();
    expect(
      await failureCode(
        `INSERT INTO topics (skill, name, level) VALUES ('grammar','{"vi":"chỉ vi"}','N5')`,
      ),
    ).toBe(CHECK);
  });

  it('mỗi người học chỉ có một kết quả placement hiện hành', async () => {
    const userId = await insertUser();
    const insert = (current: boolean) =>
      failureCode(
        `INSERT INTO placement_results (user_id, answers, estimated_level, score, is_current) VALUES ($1, '[]', 'N5', 10, $2)`,
        [userId, current],
      );
    expect(await insert(true)).toBeUndefined();
    expect(await insert(true)).toBe(UNIQUE);
    expect(await insert(false)).toBeUndefined(); // kết quả cũ giữ làm lịch sử
  });
});

describe('ràng buộc kế hoạch và lộ trình', () => {
  it('chỉ một lộ trình active mỗi người học; superseded không giới hạn', async () => {
    const userId = await insertUser();
    const insert = (status: string) =>
      failureCode(
        `INSERT INTO learning_paths (user_id, status, reason, generated_from) VALUES ($1, $2, 'onboarding', '{}')`,
        [userId, status],
      );
    expect(await insert('active')).toBeUndefined();
    expect(await insert('active')).toBe(UNIQUE);
    expect(await insert('superseded')).toBeUndefined();
    expect(await insert('superseded')).toBeUndefined();
  });

  it('kế hoạch ngày: duy nhất theo (user, ngày) và estimated ≤ budget (FR-012)', async () => {
    const userId = await insertUser();
    const insert = (date: string, budget: number, est: number) =>
      failureCode(
        `INSERT INTO daily_plans (user_id, local_date, budget_minutes, estimated_minutes) VALUES ($1, $2, $3, $4)`,
        [userId, date, budget, est],
      );
    expect(await insert('2026-01-05', 10, 11)).toBe(CHECK);
    expect(await insert('2026-01-05', 10, 10)).toBeUndefined();
    expect(await insert('2026-01-05', 15, 5)).toBe(UNIQUE);
    expect(await insert('2026-01-06', 15, 5)).toBeUndefined();
  });

  it('mục kế hoạch: est_minutes 1–15 và đủ trường theo loại', async () => {
    const userId = await insertUser();
    const topicId = await insertTopic();
    const unitId = await insertUnit(topicId);
    const plan = await q(
      `INSERT INTO daily_plans (user_id, local_date, budget_minutes, estimated_minutes) VALUES ($1,'2026-01-05',30,30) RETURNING id`,
      [userId],
    );
    const planId = plan.rows[0].id as string;
    const item = (est: number, type: string, unit: string | null, review: string | null) =>
      failureCode(
        `INSERT INTO daily_plan_items (plan_id, type, unit_id, review_item_ids, est_minutes) VALUES ($1,$2,$3,$4,$5)`,
        [planId, type, unit, review, est],
      );
    expect(await item(0, 'new_unit', unitId, null)).toBe(CHECK);
    expect(await item(16, 'new_unit', unitId, null)).toBe(CHECK);
    expect(await item(15, 'new_unit', unitId, null)).toBeUndefined();
    expect(await item(5, 'new_unit', null, null)).toBe(CHECK); // thiếu unit_id
    expect(await item(5, 'review_batch', null, null)).toBe(CHECK); // thiếu danh sách mục ôn
    expect(await item(5, 'review_batch', null, `{${randomUUID()}}`)).toBeUndefined();
  });
});

describe('ràng buộc ghi bản ghi học tập idempotent (FR-041)', () => {
  it('trùng (user, client_event_id) bị chặn ở study_records', async () => {
    const f = await insertLessonFixture();
    const eventId = randomUUID();
    await answer(f, eventId, false);
    await expect(answer(f, eventId, true)).rejects.toMatchObject({ code: UNIQUE });
  });

  it('một câu trả lời lượt chính cho mỗi (phiên, bài tập); câu hỏi lại is_retry không bị chặn', async () => {
    const f = await insertLessonFixture();
    await answer(f, randomUUID(), false);
    await expect(answer(f, randomUUID(), false)).rejects.toMatchObject({ code: UNIQUE });
    await expect(answer(f, randomUUID(), true)).resolves.toBeTruthy();
  });

  it('ON CONFLICT DO NOTHING trả 0 dòng khi trùng client_event_id (nền tảng của duplicate=true)', async () => {
    const f = await insertLessonFixture();
    const eventId = randomUUID();
    const insert = () =>
      q(
        `INSERT INTO study_records (user_id, client_event_id, session_id, exercise_id, topic_id, is_correct, submitted_answer, context, local_date)
         VALUES ($1,$2,$3,$4,$5,true,'0','lesson','2026-01-05') ON CONFLICT DO NOTHING RETURNING id`,
        [f.userId, eventId, f.sessionId, f.exerciseId, f.topicId],
      );
    expect((await insert()).rowCount).toBe(1);
    expect((await insert()).rowCount).toBe(0);
  });

  it('study_intervals: trùng client_event_id bị chặn; duration ∈ (0, 1800]', async () => {
    const f = await insertLessonFixture();
    const insert = (eventId: string, seconds: number) =>
      failureCode(
        `INSERT INTO study_intervals (user_id, client_event_id, session_id, started_at, duration_seconds, local_date) VALUES ($1,$2,$3,now(),$4,'2026-01-05')`,
        [f.userId, eventId, f.sessionId, seconds],
      );
    const eventId = randomUUID();
    expect(await insert(eventId, 60)).toBeUndefined();
    expect(await insert(eventId, 60)).toBe(UNIQUE);
    expect(await insert(randomUUID(), 0)).toBe(CHECK);
    expect(await insert(randomUUID(), 1801)).toBe(CHECK);
    expect(await insert(randomUUID(), 1800)).toBeUndefined();
  });

  it('review_schedules: ease ∈ [1.30, 2.80]; topic_stats: bias −2..+2 và tối đa 20 kết quả', async () => {
    const f = await insertLessonFixture();
    const item = await q(
      `INSERT INTO content_items (unit_id, kind, japanese, meaning) VALUES ($1,'vocabulary','水','{}') RETURNING id`,
      [f.unitId],
    );
    const itemId = item.rows[0].id as string;
    const review = (ease: number) =>
      failureCode(
        `INSERT INTO review_schedules (user_id, item_id, interval_days, ease, due_date) VALUES ($1,$2,1,$3,'2026-01-06') ON CONFLICT (user_id, item_id, facet) DO UPDATE SET ease = EXCLUDED.ease`,
        [f.userId, itemId, ease],
      );
    expect(await review(1.29)).toBe(CHECK);
    expect(await review(2.81)).toBe(CHECK);
    expect(await review(1.3)).toBeUndefined();
    expect(await review(2.8)).toBeUndefined();
    const stats = (bias: number, results: string) =>
      failureCode(
        `INSERT INTO topic_stats (user_id, topic_id, difficulty_bias, recent_results) VALUES ($1,$2,$3,$4) ON CONFLICT (user_id, topic_id) DO UPDATE SET difficulty_bias = EXCLUDED.difficulty_bias, recent_results = EXCLUDED.recent_results`,
        [f.userId, f.topicId, bias, results],
      );
    expect(await stats(3, '{}')).toBe(CHECK);
    expect(await stats(-3, '{}')).toBe(CHECK);
    expect(await stats(-2, `{${Array(21).fill(1).join(',')}}`)).toBe(CHECK);
    expect(await stats(-2, `{${Array(20).fill(1).join(',')}}`)).toBeUndefined();
  });
});

describe('xóa vĩnh viễn tài khoản (FR-003)', () => {
  it('xóa user cascade dữ liệu cá nhân, giữ thống kê tổng hợp và nhật ký admin (actor → NULL)', async () => {
    const f = await insertLessonFixture();
    await answer(f, randomUUID(), false);
    await q(`INSERT INTO learning_profiles (user_id, display_name) VALUES ($1, 'An')`, [f.userId]);
    await q(
      `INSERT INTO auth_sessions (user_id, refresh_token_hash, expires_at) VALUES ($1, 'h', now() + interval '30 days')`,
      [f.userId],
    );
    await q(
      `INSERT INTO learning_paths (user_id, reason, generated_from) VALUES ($1, 'onboarding', '{}')`,
      [f.userId],
    );
    await q(
      `INSERT INTO aggregate_daily_stats (day, metric, value) VALUES ('2026-01-05', 'users_purged', 1)`,
    );
    await q(
      `INSERT INTO admin_action_logs (actor_id, action, target_type) VALUES ($1, 'unit.update', 'unit')`,
      [f.userId],
    );

    await q(`DELETE FROM users WHERE id = $1`, [f.userId]);

    for (const table of [
      'learning_profiles',
      'auth_sessions',
      'learning_paths',
      'lesson_sessions',
      'study_records',
    ]) {
      const { rows } = await q(`SELECT count(*)::int AS n FROM ${table}`);
      expect(rows[0].n, table).toBe(0);
    }
    expect((await q(`SELECT count(*)::int AS n FROM aggregate_daily_stats`)).rows[0].n).toBe(1);
    const logs = await q(`SELECT actor_id FROM admin_action_logs`);
    expect(logs.rows).toEqual([{ actor_id: null }]);
    // Nội dung dùng chung không bị xóa theo người học.
    expect((await q(`SELECT count(*)::int AS n FROM exercises`)).rows[0].n).toBe(1);
  });
});

// --- Nâng cấp 0002/0003 trên dữ liệu 001 (spec 003, data-model §5) ---

const MIGRATIONS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../src/db/migrations',
);

/** URL tới CSDL khác trên cùng máy chủ (đổi tên CSDL ở cuối chuỗi kết nối). */
function urlForDatabase(baseUrl: string, name: string): string {
  const url = new URL(baseUrl);
  url.pathname = `/${name}`;
  return url.toString();
}

describe('nâng cấp migration Kanji (0002, 0003) trên dữ liệu 001', () => {
  const dbName = `jl_upgrade_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
  let admin: pg.Client;
  let upgraded: pg.Pool;
  let onlyInit: string;

  beforeAll(async () => {
    const base = requireDatabaseUrl();
    admin = new pg.Client({ connectionString: urlForDatabase(base, 'postgres') });
    await admin.connect();
    await admin.query(
      `CREATE DATABASE ${dbName} TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'`,
    );
    // Thư mục chỉ chứa 0001 để dựng CSDL ở trạng thái của hệ thống 001.
    onlyInit = mkdtempSync(path.join(tmpdir(), 'mig-0001-'));
    for (const f of readdirSync(MIGRATIONS_DIR).filter((n) => n.startsWith('0001_'))) {
      copyFileSync(path.join(MIGRATIONS_DIR, f), path.join(onlyInit, f));
    }
    await runMigrations(urlForDatabase(base, dbName), onlyInit);
    upgraded = new pg.Pool({ connectionString: urlForDatabase(base, dbName) });
  });

  afterAll(async () => {
    await upgraded?.end();
    await admin?.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
    await admin?.end();
    if (onlyInit) rmSync(onlyInit, { recursive: true, force: true });
  });

  const uq = (text: string, params: unknown[] = []) => upgraded.query(text, params);
  const upgradeCode = async (text: string, params: unknown[] = []) => {
    try {
      await uq(text, params);
      return undefined;
    } catch (err) {
      return (err as { code?: string }).code;
    }
  };

  it('dữ liệu 001 giữ nguyên với facet = item sau khi chạy 0002, 0003', async () => {
    // Dữ liệu 001: người học có lịch ôn, bài tập, bản ghi học, kế hoạch có gói ôn.
    const user = (
      await uq(
        `INSERT INTO users (email, password_hash) VALUES ('up@example.com', 'h') RETURNING id`,
      )
    ).rows[0].id as string;
    await uq(
      `INSERT INTO learning_profiles (user_id, display_name, skills) VALUES ($1, 'Up', ARRAY['vocabulary','grammar']::skill[])`,
      [user],
    );
    const topic = (
      await uq(
        `INSERT INTO topics (skill, name, level) VALUES ('vocabulary', '{"vi":"a","en":"a"}', 'N5') RETURNING id`,
      )
    ).rows[0].id as string;
    const unit = (
      await uq(
        `INSERT INTO learning_units (kind, title, level, topic_id, difficulty, est_minutes)
         VALUES ('vocabulary', '{"vi":"t","en":"t"}', 'N5', $1, 1, 5) RETURNING id`,
        [topic],
      )
    ).rows[0].id as string;
    const item = (
      await uq(
        `INSERT INTO content_items (unit_id, kind, japanese, meaning) VALUES ($1, 'vocabulary', '水', '{}') RETURNING id`,
        [unit],
      )
    ).rows[0].id as string;
    const exercise = (
      await uq(
        `INSERT INTO exercises (unit_id, item_id, type, prompt, payload, feedback_correct, feedback_incorrect)
         VALUES ($1, $2, 'multiple_choice', '{}', '{}', '{}', '{}') RETURNING id`,
        [unit, item],
      )
    ).rows[0].id as string;
    const session = (
      await uq(
        `INSERT INTO lesson_sessions (user_id, kind, unit_id, snapshot) VALUES ($1, 'new_unit', $2, '{}') RETURNING id`,
        [user, unit],
      )
    ).rows[0].id as string;
    await uq(
      `INSERT INTO study_records (user_id, client_event_id, session_id, exercise_id, item_id, topic_id, is_correct, submitted_answer, context, local_date)
       VALUES ($1, $2, $3, $4, $5, $6, true, '0', 'lesson', '2026-01-05')`,
      [user, randomUUID(), session, exercise, item, topic],
    );
    await uq(
      `INSERT INTO review_schedules (user_id, item_id, interval_days, ease, due_date) VALUES ($1, $2, 1, 2.50, '2026-01-06')`,
      [user, item],
    );
    const plan = (
      await uq(
        `INSERT INTO daily_plans (user_id, local_date, budget_minutes, estimated_minutes) VALUES ($1, '2026-01-05', 10, 5) RETURNING id`,
        [user],
      )
    ).rows[0].id as string;
    await uq(
      `INSERT INTO daily_plan_items (plan_id, type, review_item_ids, est_minutes) VALUES ($1, 'review_batch', ARRAY[$2]::uuid[], 5)`,
      [plan, item],
    );

    const result = await runMigrations(urlForDatabase(requireDatabaseUrl(), dbName));
    expect(result.applied).toEqual(['0002_kanji_skill.sql', '0003_kanji.sql']);

    expect((await uq(`SELECT facet FROM review_schedules`)).rows).toEqual([{ facet: 'item' }]);
    expect((await uq(`SELECT facet FROM exercises`)).rows).toEqual([{ facet: 'item' }]);
    expect((await uq(`SELECT facet FROM study_records`)).rows).toEqual([{ facet: 'item' }]);
    expect((await uq(`SELECT review_facets FROM daily_plan_items`)).rows).toEqual([
      { review_facets: null },
    ]);
    expect(
      (await uq(`SELECT skills::text[] AS skills, kanji_selected_at FROM learning_profiles`)).rows,
    ).toEqual([{ skills: ['vocabulary', 'grammar'], kanji_selected_at: null }]);
    expect((await uq(`SELECT topic_id, kanji_details FROM content_items`)).rows).toEqual([
      { topic_id: null, kanji_details: null },
    ]);
    // Khóa chính mới (user, item, facet): cho phép thêm khía cạnh khác của cùng mục, chặn trùng cặp.
    const insertReading = () =>
      upgradeCode(
        `INSERT INTO review_schedules (user_id, item_id, facet, interval_days, ease, due_date)
         VALUES ($1, $2, 'reading', 1, 2.50, '2026-01-06')`,
        [user, item],
      );
    expect(await insertReading()).toBeUndefined();
    expect(await insertReading()).toBe(UNIQUE);
  });

  it('CHECK placement không nhận Kanji; CHECK mục Kanji một chiều cho phép bản nháp', async () => {
    const topic = (await uq(`SELECT id FROM topics WHERE skill = 'vocabulary' LIMIT 1`)).rows[0]
      .id as string;
    expect(
      await upgradeCode(
        `INSERT INTO placement_questions (level, skill, topic_id, prompt, choices, correct_choice)
         VALUES ('N5', 'kanji', $1, '{"ja":"q"}', '["a","b"]', 0)`,
        [topic],
      ),
    ).toBe(CHECK);

    const kanjiTopic = (
      await uq(
        `INSERT INTO topics (skill, name, level) VALUES ('kanji', '{"vi":"s","en":"n"}', 'N5') RETURNING id`,
      )
    ).rows[0].id as string;
    const unit = (await uq(`SELECT id FROM learning_units LIMIT 1`)).rows[0].id as string;
    const details = JSON.stringify({ onReadings: ['サン'], kunReadings: [], strokeCount: 3 });
    // Từ vựng có kanji_details hoặc topic_id → bị CHECK từ chối.
    expect(
      await upgradeCode(
        `INSERT INTO content_items (unit_id, kind, japanese, meaning, kanji_details)
         VALUES ($1, 'vocabulary', '山', '{}', $2)`,
        [unit, details],
      ),
    ).toBe(CHECK);
    expect(
      await upgradeCode(
        `INSERT INTO content_items (unit_id, kind, japanese, meaning, topic_id)
         VALUES ($1, 'vocabulary', '山', '{}', $2)`,
        [unit, kanjiTopic],
      ),
    ).toBe(CHECK);
    // Kanji thiếu kanji_details/topic_id (bản nháp) PHẢI được chấp nhận.
    expect(
      await upgradeCode(
        `INSERT INTO content_items (unit_id, kind, japanese, meaning) VALUES ($1, 'kanji', '三', '{}')`,
        [unit],
      ),
    ).toBeUndefined();
    expect(
      await upgradeCode(
        `INSERT INTO content_items (unit_id, kind, japanese, meaning, kanji_details, topic_id)
         VALUES ($1, 'kanji', '二', '{}', $2, $3)`,
        [unit, details, kanjiTopic],
      ),
    ).toBeUndefined();
  });

  it('review_facets phải cùng độ dài review_item_ids', async () => {
    const user = (await uq(`SELECT id FROM users LIMIT 1`)).rows[0].id as string;
    const plan = (
      await uq(
        `INSERT INTO daily_plans (user_id, local_date, budget_minutes, estimated_minutes) VALUES ($1, '2026-01-09', 10, 5) RETURNING id`,
        [user],
      )
    ).rows[0].id as string;
    const ids = `{${randomUUID()},${randomUUID()}}`;
    const insert = (facets: string | null) =>
      upgradeCode(
        `INSERT INTO daily_plan_items (plan_id, type, review_item_ids, review_facets, est_minutes)
         VALUES ($1, 'review_batch', $2::uuid[], $3::review_facet[], 5)`,
        [plan, ids, facets],
      );
    expect(await insert('{meaning}')).toBe(CHECK);
    expect(await insert('{meaning,reading}')).toBeUndefined();
    expect(await insert(null)).toBeUndefined();
  });
});
