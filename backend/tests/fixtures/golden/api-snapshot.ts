/* eslint-disable @typescript-eslint/no-explicit-any */
import { buildApp } from '../../../src/app.js';
import { registerApiRoutes } from '../../../src/api/routes.js';
import { loadConfig } from '../../../src/config.js';
import { createDb } from '../../../src/db/client.js';
import { runMigrations } from '../../../src/db/migrate.js';
import { FakeClock, addDays } from '../../../src/engine/clock.js';
import { InMemoryJobQueue } from '../../../src/jobs/boss.js';
import { InMemoryEmailSender } from '../../../src/services/email.js';
import { seedContent } from '../../../src/seed/index.js';
import { ContractClient, registerUser } from '../../contract/client.js';
import { loadLearnerProfiles, type LearnerProfileFixture } from '../learner-profiles/index.js';

// Chụp phản hồi dịch vụ `GET /path`, `GET /progress`, `GET /today` (ngày đầu) của từng hồ sơ đại diện CŨ
// (spec 004, T002, SC-012). Dùng chung cho script sinh chuẩn (`generate-api-pre-org.ts`, chạy trên mã CHƯA
// sửa dịch vụ) và kiểm thử hồi quy sau khi thêm `resolveLearningContext`: hai bên PHẢI chụp đúng một cách.
//
// Phạm vi: hồ sơ khai báo, placement, lộ trình, tiến độ trống/có lịch ôn tồn đọng và kế hoạch ngày đầu.
// KHÔNG nạp `history` (kết quả làm bài theo mảng): độ khó thích ứng đã được golden engine
// (`plans-pre-org.json`) phủ ở mức hàm thuần.

export interface ProfileApiSnapshot {
  path: { status: number; body: unknown };
  progress: { status: number; body: unknown };
  today: { status: number; body: unknown };
}

export type ApiSnapshot = Record<string, ProfileApiSnapshot>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Thay mọi chuỗi UUID bằng nhãn thứ tự xuất hiện (`<id:1>`, `<id:2>`…) trong MỘT phản hồi để chuẩn so sánh
 * không phụ thuộc id ngẫu nhiên nhưng vẫn bắt được thay đổi quan hệ id (cùng id ⇒ cùng nhãn).
 */
export function normalizeIds(value: unknown, seen = new Map<string, string>()): unknown {
  if (typeof value === 'string') {
    if (!UUID_RE.test(value)) return value;
    if (!seen.has(value)) seen.set(value, `<id:${seen.size + 1}>`);
    return seen.get(value);
  }
  if (Array.isArray(value)) return value.map((v) => normalizeIds(v, seen));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, normalizeIds(v, seen)]),
    );
  }
  return value;
}

export interface SnapshotContext {
  api: ContractClient;
  clock: FakeClock;
  pool: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }> };
}

/** Đặt đồng hồ giả vào 08:00 giờ Việt Nam của ngày địa phương `localDate`. */
function setLocalMorning(clock: FakeClock, localDate: string): void {
  clock.set(`${localDate}T01:00:00Z`);
}

async function placementResultFor(
  ctx: SnapshotContext,
  token: string,
  correctByPosition: boolean[],
): Promise<string> {
  const { rows } = await ctx.pool.query(
    'SELECT id, correct_choice FROM placement_questions WHERE is_active ORDER BY position',
  );
  const answers = rows.map((r: any, i: number) => ({
    questionId: r.id,
    choice: correctByPosition[i] ? r.correct_choice : (r.correct_choice + 1) % 4,
  }));
  const res = await ctx.api.post('/placement/submit', { token, body: { answers } });
  if (res.status !== 200) throw new Error(`placement/submit lỗi: ${JSON.stringify(res.body)}`);
  return res.body.id as string;
}

/** Nạp một hồ sơ cũ thành người học thật rồi chụp ba phản hồi dịch vụ. */
export async function captureProfile(
  ctx: SnapshotContext,
  fixture: LearnerProfileFixture,
): Promise<ProfileApiSnapshot> {
  const { api, clock, pool } = ctx;
  setLocalMorning(clock, fixture.asOf);
  const user = await registerUser(api);
  const token = user.accessToken;
  const p = fixture.profile;

  const placementResultId = fixture.placement
    ? await placementResultFor(ctx, token, fixture.placement.correctByPosition)
    : null;
  const onboarding = await api.post('/onboarding/complete', {
    token,
    body: {
      currentLevel: p.currentLevel,
      goalType: p.goalType,
      ...(p.targetLevel ? { targetLevel: p.targetLevel } : {}),
      dailyMinutes: p.dailyMinutes,
      targetDate: p.targetDate,
      skills: p.skills,
      timezone: p.timezone,
      ...(placementResultId ? { placementResultId } : {}),
    },
  });
  if (onboarding.status !== 200) {
    throw new Error(`${fixture.id}: onboarding lỗi ${JSON.stringify(onboarding.body)}`);
  }
  const profilePatch: Record<string, unknown> = {};
  if (p.prioritizedSkill) profilePatch.prioritizedSkill = p.prioritizedSkill;
  if (p.language !== 'vi') profilePatch.language = p.language;
  if (Object.keys(profilePatch).length > 0) {
    const patched = await api.patch('/me', { token, body: profilePatch });
    if (patched.status !== 200) throw new Error(`${fixture.id}: PATCH /me lỗi`);
  }

  // Tồn đọng ôn: dùng mục nội dung thật (khóa ngoại) theo thứ tự cố định; thiếu mục thì dừng ở số mục có.
  if (fixture.reviewBacklog.length > 0) {
    const userId = (await pool.query('SELECT id FROM users WHERE email = $1', [user.email])).rows[0]
      .id as string;
    const items = (
      await pool.query(
        `SELECT ci.id FROM content_items ci JOIN learning_units u ON u.id = ci.unit_id
          WHERE u.status = 'active' AND ci.kind <> 'kanji'
          ORDER BY u.level, u.sequence, ci.id`,
      )
    ).rows as { id: string }[];
    let next = 0;
    for (const group of fixture.reviewBacklog) {
      for (let i = 0; i < group.count && next < items.length; i++, next++) {
        await pool.query(
          `INSERT INTO review_schedules (user_id, item_id, interval_days, ease, due_date, is_hard)
           VALUES ($1, $2, 1, 2.50, $3, $4)`,
          [userId, items[next]!.id, addDays(fixture.asOf, -group.daysOverdue), group.isHard],
        );
      }
    }
  }
  if (p.paused) await api.post('/path/pause', { token });

  const snap = async (url: string) => {
    const res = await api.get(url, { token, validateResponse: false });
    return { status: res.status, body: normalizeIds(res.body) };
  };
  return {
    path: await snap('/path'),
    progress: await snap('/progress'),
    today: await snap('/today'),
  };
}

/** Chụp mọi hồ sơ cũ trên CSDL đã migrate (xóa sạch dữ liệu trước khi chụp). */
export async function captureAllProfiles(databaseUrl: string): Promise<ApiSnapshot> {
  await runMigrations(databaseUrl);
  const handle = createDb(databaseUrl);
  try {
    const { rows } = await handle.pool.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations'`,
    );
    if (rows.length > 0) {
      const list = rows.map((r: any) => `"${r.tablename}"`).join(', ');
      await handle.pool.query(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
    }
    const clock = new FakeClock('2026-01-05T01:00:00Z');
    const config = loadConfig({
      NODE_ENV: 'test',
      DATABASE_URL: databaseUrl,
      JWT_SECRET: 'golden-secret-golden-secret-golden-secret-12',
      SMTP_URL: 'smtp://localhost:1025',
      APP_BASE_URL: 'http://localhost:8080',
      RATE_LIMIT_AUTH_PER_MIN: '100000',
    });
    const app = await buildApp(
      {
        config,
        db: handle.db,
        clock,
        emailSender: new InMemoryEmailSender(),
        jobQueue: new InMemoryJobQueue(),
      },
      { logger: false, registerRoutes: registerApiRoutes },
    );
    await app.ready();
    try {
      await seedContent(handle.db);
      const ctx: SnapshotContext = { api: new ContractClient(app), clock, pool: handle.pool };
      const snapshot: ApiSnapshot = {};
      for (const fixture of loadLearnerProfiles()) {
        snapshot[fixture.id] = await captureProfile(ctx, fixture);
      }
      return snapshot;
    } finally {
      await app.close();
    }
  } finally {
    await handle.close();
  }
}
