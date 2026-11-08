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
// 0002/0003 (Kanji) trên dữ liệu 001 có sẵn (spec 003, T008); nâng cấp 0004 (tổ chức/lớp học) trên dữ liệu
// 001 + 003 và các ràng buộc của nó (spec 004, T011).

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
    // 0004 (tổ chức/lớp học) cũng được áp dụng vì thư mục migration mặc định chứa đủ; nâng cấp riêng 0004 có bộ test bên dưới.
    expect(result.applied).toEqual([
      '0002_kanji_skill.sql',
      '0003_kanji.sql',
      '0004_org_classes.sql',
    ]);

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

// --- Nâng cấp 0004 (tổ chức, lớp học) trên dữ liệu 001 + 003 (spec 004, T011, data-model §9) ---

const EXCLUSION = '23P01';

describe('nâng cấp migration tổ chức/lớp học (0004) trên dữ liệu 001 + 003', () => {
  const dbName = `jl_org_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
  let admin: pg.Client;
  let upgraded: pg.Pool;
  let upToKanji: string;
  let learner: string;
  const before: Record<string, unknown[]> = {};

  beforeAll(async () => {
    const base = requireDatabaseUrl();
    admin = new pg.Client({ connectionString: urlForDatabase(base, 'postgres') });
    await admin.connect();
    await admin.query(
      `CREATE DATABASE ${dbName} TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'`,
    );
    // Thư mục chỉ chứa 0001–0003 để dựng CSDL ở trạng thái của hệ thống 001 + 003.
    upToKanji = mkdtempSync(path.join(tmpdir(), 'mig-0003-'));
    for (const f of readdirSync(MIGRATIONS_DIR).filter((n) => /^000[1-3]_/.test(n))) {
      copyFileSync(path.join(MIGRATIONS_DIR, f), path.join(upToKanji, f));
    }
    await runMigrations(urlForDatabase(base, dbName), upToKanji);
    upgraded = new pg.Pool({ connectionString: urlForDatabase(base, dbName) });
  });

  afterAll(async () => {
    await upgraded?.end();
    await admin?.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
    await admin?.end();
    if (upToKanji) rmSync(upToKanji, { recursive: true, force: true });
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
  const newUser = async () =>
    (
      await uq(`INSERT INTO users (email, password_hash) VALUES ($1, 'h') RETURNING id`, [
        `m-${randomUUID()}@example.com`,
      ])
    ).rows[0].id as string;
  const newOrg = async () =>
    (await uq(`INSERT INTO organizations (name) VALUES ('Trung tâm') RETURNING id`)).rows[0]
      .id as string;
  const newClass = async (orgId: string) =>
    (
      await uq(`INSERT INTO classes (organization_id, name) VALUES ($1, 'Lớp') RETURNING id`, [
        orgId,
      ])
    ).rows[0].id as string;

  const SNAPSHOT_QUERIES: Record<string, string> = {
    users: `SELECT id, email, role, status FROM users ORDER BY id`,
    learning_profiles: `SELECT user_id, display_name, skills::text[] AS skills, daily_minutes FROM learning_profiles ORDER BY user_id`,
    learning_paths: `SELECT id, user_id, status, reason FROM learning_paths ORDER BY id`,
    daily_plans: `SELECT id, user_id, local_date::text AS local_date, budget_minutes FROM daily_plans ORDER BY id`,
    review_schedules: `SELECT user_id, item_id, facet, due_date::text AS due_date FROM review_schedules ORDER BY user_id, item_id, facet`,
    placement_results: `SELECT id, user_id, estimated_level, is_current FROM placement_results ORDER BY id`,
    admin_action_logs: `SELECT id, action, target_type FROM admin_action_logs ORDER BY id`,
  };

  it('dữ liệu 001/003 giữ nguyên sau 0004; cột liên kết mới của dòng cũ là NULL', async () => {
    // Người học cũ có lộ trình, kế hoạch, lịch ôn, kết quả placement và nhật ký admin.
    learner = await newUser();
    await uq(
      `INSERT INTO learning_profiles (user_id, display_name, skills) VALUES ($1, 'Cũ', ARRAY['vocabulary','kanji']::skill[])`,
      [learner],
    );
    await uq(
      `INSERT INTO learning_paths (user_id, reason, generated_from) VALUES ($1, 'onboarding', '{}')`,
      [learner],
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
    await uq(
      `INSERT INTO review_schedules (user_id, item_id, interval_days, ease, due_date) VALUES ($1, $2, 1, 2.50, '2026-01-06')`,
      [learner, item],
    );
    await uq(
      `INSERT INTO daily_plans (user_id, local_date, budget_minutes, estimated_minutes) VALUES ($1, '2026-01-05', 10, 5)`,
      [learner],
    );
    await uq(
      `INSERT INTO placement_results (user_id, answers, estimated_level, score) VALUES ($1, '[]', 'N5', 12)`,
      [learner],
    );
    await uq(
      `INSERT INTO admin_action_logs (actor_id, action, target_type) VALUES ($1, 'unit.update', 'unit')`,
      [learner],
    );
    for (const [name, sql] of Object.entries(SNAPSHOT_QUERIES)) {
      before[name] = (await uq(sql)).rows;
      expect(before[name]!.length, name).toBeGreaterThan(0);
    }

    const result = await runMigrations(urlForDatabase(requireDatabaseUrl(), dbName));
    expect(result.applied).toEqual(['0004_org_classes.sql']);

    for (const [name, sql] of Object.entries(SNAPSHOT_QUERIES)) {
      expect((await uq(sql)).rows, `${name} không đổi sau 0004`).toEqual(before[name]);
    }
    expect((await uq(`SELECT class_placement_request_id FROM placement_results`)).rows).toEqual([
      { class_placement_request_id: null },
    ]);
    expect((await uq(`SELECT organization_id FROM admin_action_logs`)).rows).toEqual([
      { organization_id: null },
    ]);
    // Người học cũ không bị gắn vào tổ chức nào.
    expect((await uq(`SELECT count(*)::int AS n FROM organization_members`)).rows[0].n).toBe(0);
  });

  it('giấy phép chồng ngày bị từ chối (exclusion), cho phép khi đã thu hồi hoặc không chồng', async () => {
    const org = await newOrg();
    const other = await newOrg();
    const insert = (orgId: string, from: string, to: string, revoked = false) =>
      upgradeCode(
        `INSERT INTO seat_licenses (organization_id, starts_on, ends_on, revoked_at)
         VALUES ($1, $2, $3, ${revoked ? 'now()' : 'NULL'})`,
        [orgId, from, to],
      );
    expect(await insert(org, '2026-01-01', '2026-06-30')).toBeUndefined();
    expect(await insert(org, '2026-06-30', '2026-12-31')).toBe(EXCLUSION); // trùng ngày biên
    expect(await insert(org, '2026-03-01', '2026-04-01')).toBe(EXCLUSION);
    expect(await insert(org, '2026-07-01', '2026-12-31')).toBeUndefined(); // liền kề, không chồng
    expect(await insert(other, '2026-03-01', '2026-04-01')).toBeUndefined(); // tổ chức khác
    // Giấy phép đã thu hồi không tham gia ràng buộc.
    expect(await insert(org, '2026-03-01', '2026-04-01', true)).toBeUndefined();
    // CHECK ends_on >= starts_on, grace_days 0–60, max_reassignments >= 0.
    expect(await insert(org, '2027-02-01', '2027-01-01')).toBe(CHECK);
    expect(
      await upgradeCode(
        `INSERT INTO seat_licenses (organization_id, starts_on, ends_on, grace_days)
         VALUES ($1, '2030-01-01', '2030-02-01', 61)`,
        [org],
      ),
    ).toBe(CHECK);
    expect(
      await upgradeCode(
        `INSERT INTO seat_licenses (organization_id, starts_on, ends_on, max_reassignments)
         VALUES ($1, '2031-01-01', '2031-02-01', -1)`,
        [org],
      ),
    ).toBe(CHECK);
  });

  it('một tài khoản một seat; một tài khoản một tổ chức', async () => {
    const org = await newOrg();
    const license = (
      await uq(
        `INSERT INTO seat_licenses (organization_id, starts_on, ends_on) VALUES ($1, '2026-01-01', '2026-12-31') RETURNING id`,
        [org],
      )
    ).rows[0].id as string;
    const user = await newUser();
    const seat = () =>
      upgradeCode(`INSERT INTO seats (license_id, holder_user_id) VALUES ($1, $2)`, [
        license,
        user,
      ]);
    expect(await seat()).toBeUndefined();
    expect(await seat()).toBe(UNIQUE);
    // Seat trống không giới hạn số lượng.
    expect(
      await upgradeCode(`INSERT INTO seats (license_id) VALUES ($1)`, [license]),
    ).toBeUndefined();
    expect(
      await upgradeCode(`INSERT INTO seats (license_id) VALUES ($1)`, [license]),
    ).toBeUndefined();

    const orgB = await newOrg();
    const member = (orgId: string) =>
      upgradeCode(
        `INSERT INTO organization_members (user_id, organization_id, is_teacher, joined_at) VALUES ($1, $2, true, now())`,
        [user, orgId],
      );
    expect(await member(org)).toBeUndefined();
    expect(await member(orgB)).toBe(UNIQUE);
    // Dòng của học viên (cờ vai trò đều false) không bị chặn ở mức CSDL; việc dòng chỉ tồn tại khi còn
    // thành viên lớp đang hoạt động hoặc còn vai trò do `endMembership` bảo đảm (kiểm ở T053).
    const learnerRow = await newUser();
    expect(
      await upgradeCode(
        `INSERT INTO organization_members (user_id, organization_id, joined_at) VALUES ($1, $2, now())`,
        [learnerRow, org],
      ),
    ).toBeUndefined();
  });

  it('thành viên lớp: một lớp đang hoạt động, CHECK left_at ⇔ end_reason, nhiều giai đoạn đã đóng', async () => {
    const org = await newOrg();
    const classA = await newClass(org);
    const classB = await newClass(org);
    const user = await newUser();
    const open = (classId: string) =>
      upgradeCode(
        `INSERT INTO class_memberships (class_id, user_id, organization_id, joined_at, consent_at)
         VALUES ($1, $2, $3, now(), now())`,
        [classId, user, org],
      );
    const closed = (classId: string) =>
      upgradeCode(
        `INSERT INTO class_memberships (class_id, user_id, organization_id, joined_at, consent_at, left_at, end_reason)
         VALUES ($1, $2, $3, now(), now(), now(), 'removed')`,
        [classId, user, org],
      );
    expect(await open(classA)).toBeUndefined();
    expect(await open(classB)).toBe(UNIQUE);
    expect(await closed(classA)).toBeUndefined();
    expect(await closed(classB)).toBeUndefined();
    // left_at và end_reason phải cùng NULL hoặc cùng có giá trị.
    expect(
      await upgradeCode(
        `INSERT INTO class_memberships (class_id, user_id, organization_id, joined_at, consent_at, left_at)
         VALUES ($1, $2, $3, now(), now(), now())`,
        [classA, await newUser(), org],
      ),
    ).toBe(CHECK);
    expect(
      await upgradeCode(
        `INSERT INTO class_memberships (class_id, user_id, organization_id, joined_at, consent_at, end_reason)
         VALUES ($1, $2, $3, now(), now(), 'removed')`,
        [classA, await newUser(), org],
      ),
    ).toBe(CHECK);
  });

  it('kết quả placement của lớp không được là kết quả hiện hành (CHECK) và mỗi yêu cầu một kết quả/người', async () => {
    const org = await newOrg();
    const cls = await newClass(org);
    const request = (
      await uq(`INSERT INTO class_placement_requests (class_id) VALUES ($1) RETURNING id`, [cls])
    ).rows[0].id as string;
    // Chỉ một yêu cầu mở mỗi lớp.
    expect(
      await upgradeCode(`INSERT INTO class_placement_requests (class_id) VALUES ($1)`, [cls]),
    ).toBe(UNIQUE);
    const user = await newUser();
    const result = (isCurrent: boolean) =>
      upgradeCode(
        `INSERT INTO placement_results (user_id, answers, estimated_level, score, is_current, class_placement_request_id)
         VALUES ($1, '[]', 'N4', 10, $2, $3)`,
        [user, isCurrent, request],
      );
    expect(await result(true)).toBe(CHECK);
    expect(await result(false)).toBeUndefined();
    expect(await result(false)).toBe(UNIQUE);
  });

  it('lời mời: một lời mời chờ mỗi (tổ chức, email) không phân biệt hoa thường; học viên cần lớp', async () => {
    const org = await newOrg();
    const cls = await newClass(org);
    const invite = (email: string, status = 'pending', kind = 'teacher', classId?: string) =>
      upgradeCode(
        `INSERT INTO invitations (organization_id, class_id, kind, email, token_hash, status, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, now() + interval '14 days')`,
        [org, classId ?? null, kind, email, randomUUID(), status],
      );
    expect(await invite('An@Example.com')).toBeUndefined();
    expect(await invite('an@example.com')).toBe(UNIQUE);
    expect(await invite('an@example.com', 'revoked')).toBeUndefined();
    expect(await invite('an@example.com', 'expired')).toBeUndefined();
    // kind = student ⇔ class_id NOT NULL.
    expect(await invite('hs@example.com', 'pending', 'student')).toBe(CHECK);
    expect(await invite('hs@example.com', 'pending', 'student', cls)).toBeUndefined();
    expect(await invite('gv@example.com', 'pending', 'teacher', cls)).toBe(CHECK);
  });

  it('quỹ thời gian chỉ 5/10/15/30 phút ở lộ trình lớp và ghi đè cá nhân; mốc ngày hợp lệ', async () => {
    const org = await newOrg();
    const cls = await newClass(org);
    const path = (minutes: number, endsOn = '2026-06-30', skills = '{vocabulary}') =>
      upgradeCode(
        `INSERT INTO class_paths (class_id, start_level, target_level, skills, starts_on, ends_on, daily_minutes)
         VALUES ($1, 'N5', 'N4', $2::skill[], '2026-01-01', $3, $4)
         ON CONFLICT (class_id) DO UPDATE SET daily_minutes = EXCLUDED.daily_minutes`,
        [cls, skills, endsOn, minutes],
      );
    expect(await path(7)).toBe(CHECK);
    expect(await path(20)).toBe(CHECK);
    expect(await path(10, '2026-01-01')).toBe(CHECK); // ends_on phải sau starts_on
    expect(await path(10, '2026-06-30', '{}')).toBe(CHECK); // ít nhất một kỹ năng
    for (const m of [5, 10, 15, 30]) expect(await path(m), String(m)).toBeUndefined();

    const user = await newUser();
    const membership = (
      await uq(
        `INSERT INTO class_memberships (class_id, user_id, organization_id, joined_at, consent_at)
         VALUES ($1, $2, $3, now(), now()) RETURNING id`,
        [cls, user, org],
      )
    ).rows[0].id as string;
    const override = (minutes: number | null, shift = 0) =>
      upgradeCode(
        `INSERT INTO class_learner_overrides (membership_id, daily_minutes, shift_days) VALUES ($1, $2, $3)
         ON CONFLICT (membership_id) DO UPDATE SET daily_minutes = EXCLUDED.daily_minutes, shift_days = EXCLUDED.shift_days`,
        [membership, minutes, shift],
      );
    expect(await override(12)).toBe(CHECK);
    expect(await override(10, 61)).toBe(CHECK);
    expect(await override(null, -60)).toBeUndefined();
    expect(await override(15, 60)).toBeUndefined();
  });

  it('tạm dừng lớp: tối đa một khoảng mở mỗi phạm vi; khoảng kết thúc phải sau ngày bắt đầu', async () => {
    const org = await newOrg();
    const cls = await newClass(org);
    const pause = (startedOn: string, endedOn: string | null) =>
      upgradeCode(
        `INSERT INTO class_pause_periods (class_id, started_on, ended_on) VALUES ($1, $2, $3)`,
        [cls, startedOn, endedOn],
      );
    expect(await pause('2026-02-01', '2026-02-01')).toBe(CHECK);
    expect(await pause('2026-02-01', '2026-02-08')).toBeUndefined();
    expect(await pause('2026-03-01', null)).toBeUndefined();
    expect(await pause('2026-04-01', null)).toBe(UNIQUE);
  });

  it('mã tham gia: duy nhất; bật mã phải có mã; số ngày vắng 1–14', async () => {
    const org = await newOrg();
    const a = await newClass(org);
    const b = await newClass(org);
    expect(
      await upgradeCode(
        `UPDATE classes SET join_code = 'ABCD2345', join_code_enabled = true WHERE id = $1`,
        [a],
      ),
    ).toBeUndefined();
    expect(await upgradeCode(`UPDATE classes SET join_code = 'ABCD2345' WHERE id = $1`, [b])).toBe(
      UNIQUE,
    );
    expect(
      await upgradeCode(`UPDATE classes SET join_code_enabled = true WHERE id = $1`, [b]),
    ).toBe(CHECK);
    expect(
      await upgradeCode(`UPDATE classes SET absence_threshold_days = 0 WHERE id = $1`, [b]),
    ).toBe(CHECK);
    expect(
      await upgradeCode(`UPDATE classes SET absence_threshold_days = 15 WHERE id = $1`, [b]),
    ).toBe(CHECK);
  });

  it('thứ tự đơn vị trong lộ trình lớp hoán đổi được trong một câu lệnh (UNIQUE hoãn)', async () => {
    const org = await newOrg();
    const cls = await newClass(org);
    const topic = (await uq(`SELECT id FROM topics LIMIT 1`)).rows[0].id as string;
    const mkUnit = async () =>
      (
        await uq(
          `INSERT INTO learning_units (kind, title, level, topic_id, difficulty, est_minutes)
           VALUES ('vocabulary', '{"vi":"t","en":"t"}', 'N5', $1, 1, 5) RETURNING id`,
          [topic],
        )
      ).rows[0].id as string;
    const u1 = await mkUnit();
    const u2 = await mkUnit();
    await uq(
      `INSERT INTO class_path_units (class_id, unit_id, position) VALUES ($1, $2, 1), ($1, $3, 2)`,
      [cls, u1, u2],
    );
    // Hoán đổi vị trí trong một câu UPDATE không vi phạm UNIQUE (class_id, position).
    await uq(`UPDATE class_path_units SET position = 3 - position WHERE class_id = $1`, [cls]);
    const { rows } = await uq(
      `SELECT unit_id, position FROM class_path_units WHERE class_id = $1 ORDER BY position`,
      [cls],
    );
    expect(rows).toEqual([
      { unit_id: u2, position: 1 },
      { unit_id: u1, position: 2 },
    ]);
    // Trùng vị trí thật sự bị từ chối khi kết thúc câu lệnh.
    expect(
      await upgradeCode(`UPDATE class_path_units SET position = 1 WHERE class_id = $1`, [cls]),
    ).toBe(UNIQUE);
  });

  it('bài giao: mỗi đơn vị một bài giao còn hiệu lực, giao lại được sau khi hủy', async () => {
    const org = await newOrg();
    const cls = await newClass(org);
    const unit = (await uq(`SELECT id FROM learning_units LIMIT 1`)).rows[0].id as string;
    const assign = (cancelled: boolean) =>
      upgradeCode(
        `INSERT INTO class_assignments (class_id, batch_id, unit_id, due_on, cancelled_at)
         VALUES ($1, $2, $3, '2026-02-01', ${cancelled ? 'now()' : 'NULL'})`,
        [cls, randomUUID(), unit],
      );
    expect(await assign(false)).toBeUndefined();
    expect(await assign(false)).toBe(UNIQUE);
    expect(await assign(true)).toBeUndefined();
  });

  it('xóa tài khoản: cascade dữ liệu thuộc chính người đó, đặt NULL các tham chiếu "ai làm"', async () => {
    const org = await newOrg();
    const cls = await newClass(org);
    const teacher = await newUser();
    const student = await newUser();
    await uq(
      `INSERT INTO organization_members (user_id, organization_id, is_teacher, joined_at) VALUES ($1, $2, true, now())`,
      [teacher, org],
    );
    await uq(`INSERT INTO class_teachers (class_id, user_id) VALUES ($1, $2)`, [cls, teacher]);
    await uq(`UPDATE classes SET created_by = $2 WHERE id = $1`, [cls, teacher]);
    await uq(
      `INSERT INTO class_memberships (class_id, user_id, organization_id, joined_at, consent_at)
       VALUES ($1, $2, $3, now(), now())`,
      [cls, student, org],
    );
    await uq(
      `INSERT INTO join_code_attempts (user_id, failures, window_started_at) VALUES ($1, 2, now())`,
      [student],
    );

    await uq(`DELETE FROM users WHERE id = $1`, [teacher]);
    await uq(`DELETE FROM users WHERE id = $1`, [student]);

    for (const [table, clause] of [
      ['organization_members', `user_id = '${teacher}'`],
      ['class_teachers', `user_id = '${teacher}'`],
      ['class_memberships', `user_id = '${student}'`],
      ['join_code_attempts', `user_id = '${student}'`],
    ] as const) {
      const { rows } = await uq(`SELECT count(*)::int AS n FROM ${table} WHERE ${clause}`);
      expect(rows[0].n, table).toBe(0);
    }
    // Dữ liệu tổ chức không bị xóa theo người dùng; tham chiếu "ai làm" về NULL.
    expect((await uq(`SELECT created_by FROM classes WHERE id = $1`, [cls])).rows).toEqual([
      { created_by: null },
    ]);
  });
});
