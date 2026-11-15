import { performance } from 'node:perf_hooks';
import { buildApp } from '../../src/app.js';
import { registerApiRoutes } from '../../src/api/routes.js';
import { loadConfig } from '../../src/config.js';
import { createDb } from '../../src/db/client.js';
import { runMigrations } from '../../src/db/migrate.js';
import { FakeClock } from '../../src/engine/clock.js';
import { InMemoryJobQueue } from '../../src/jobs/boss.js';
import { InMemoryEmailSender } from '../../src/services/email.js';
import { seedContent } from '../../src/seed/index.js';
import { ContractClient, newcomerOnboarding, registerUser } from '../contract/client.js';
import { resetDatabase } from '../integration/helpers.js';

// Đo hiệu năng `GET /today` và `GET /path` (spec 008, T002, SC-007, bất biến I9): 200 lần gọi mỗi điểm cuối,
// tài khoản N4 / 15 phút mỗi ngày, in p50/p95. Chạy hai lần trên CÙNG máy để so sánh: CSDL chỉ có thư viện
// baseline (33 đơn vị) rồi CSDL có toàn bộ nội dung; `GET /today` p95 không được chậm hơn quá 10%.
//
// Gọi qua `app.inject` (không qua mạng, không kiểm tra hợp đồng) nên số đo là chi phí của ứng dụng + CSDL.
// Điểm đo:
//   - `today_generate`: mỗi lần gọi là một NGÀY MỚI (đồng hồ giả tiến 1 ngày) nên kế hoạch được sinh lại,
//     tức tính `rankUnits` + gói ôn + ghi kế hoạch — đường đắt nhất và là điều SC-007 quan tâm;
//   - `today_cached`: cùng ngày, chỉ đọc kế hoạch đã có;
//   - `path`: `GET /path` không lọc.
//
// CẢNH BÁO: script XÓA SẠCH mọi bảng nghiệp vụ của CSDL được trỏ tới rồi seed lại. Chỉ trỏ vào CSDL dành riêng
// (tên chứa "test", "load" hoặc "golden").
//
// Chạy (từ `backend/`):
//   Baseline : LOAD_DATABASE_URL=postgres://… CONTENT_RELEASES=000-baseline npx tsx tests/load/measure-today.ts --label baseline
//   Đầy đủ   : LOAD_DATABASE_URL=postgres://… CONTENT_RELEASES=all          npx tsx tests/load/measure-today.ts --label full
// Tùy chọn: `--calls <N>` (mặc định 200), `--warmup <N>` (mặc định 10), `--json` (in thêm một dòng JSON).

const databaseUrl = process.env.LOAD_DATABASE_URL ?? '';
const dbName = databaseUrl.split('/').pop()?.split('?')[0] ?? '';
if (!databaseUrl || !/(test|load|golden)/i.test(dbName)) {
  console.error(
    'Cần đặt LOAD_DATABASE_URL trỏ vào CSDL dành riêng (tên chứa "test", "load" hoặc "golden"): script xóa sạch dữ liệu.',
  );
  process.exit(2);
}

function argValue(name: string, fallback: string): string {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}
const label = argValue('--label', 'run');
const calls = Number(argValue('--calls', '200'));
const warmup = Number(argValue('--warmup', '10'));
const asJson = process.argv.includes('--json');

/** Phân vị theo cách xếp hạng gần nhất trên mảng đã sắp. */
function percentile(sorted: readonly number[], p: number): number {
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx]!;
}

interface Stats {
  name: string;
  calls: number;
  p50: number;
  p95: number;
  max: number;
}

async function measure(
  name: string,
  once: () => Promise<number>,
  before: () => void = () => {},
): Promise<Stats> {
  for (let i = 0; i < warmup; i++) {
    before();
    await once();
  }
  const samples: number[] = [];
  for (let i = 0; i < calls; i++) {
    before();
    const start = performance.now();
    const status = await once();
    samples.push(performance.now() - start);
    if (status !== 200) throw new Error(`${name}: HTTP ${status} ở lần gọi ${i + 1}`);
  }
  samples.sort((a, b) => a - b);
  return {
    name,
    calls: samples.length,
    p50: percentile(samples, 50),
    p95: percentile(samples, 95),
    max: samples[samples.length - 1]!,
  };
}

await runMigrations(databaseUrl);
const handle = createDb(databaseUrl);
await resetDatabase(handle);

const seedStart = performance.now();
const summary = await seedContent(handle.db);
const seedMs = performance.now() - seedStart;

const clock = new FakeClock('2026-03-02T08:00:00Z');
const config = {
  ...loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: databaseUrl,
    JWT_SECRET: 'load-secret-load-secret-load-secret-123456',
    SMTP_URL: 'smtp://localhost:1025',
    APP_BASE_URL: 'http://localhost:8080',
    RATE_LIMIT_AUTH_PER_MIN: '100000',
    RATE_LIMIT_TRIAL_PER_MIN: '100000',
    RATE_LIMIT_TRIAL_GRADE_PER_MIN: '100000',
  }),
  // Đồng hồ giả tiến theo ngày nên token mặc định (15 phút) sẽ hết hạn: nâng TTL để một token dùng suốt lần đo.
  ACCESS_TOKEN_TTL_SECONDS: 3 * 365 * 24 * 60 * 60,
};
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
  const api = new ContractClient(app);
  const user = await registerUser(api);
  const onboarded = await api.post('/onboarding/complete', {
    token: user.accessToken,
    body: newcomerOnboarding({
      currentLevel: 'N4',
      goalType: 'jlpt',
      targetLevel: 'N3',
      dailyMinutes: 15,
      skills: ['vocabulary', 'grammar', 'kanji'],
      timezone: 'Asia/Ho_Chi_Minh',
    }),
  });
  if (onboarded.status !== 200) {
    throw new Error(`Onboarding thất bại: ${JSON.stringify(onboarded.body)}`);
  }

  const get = async (url: string): Promise<number> =>
    (await api.raw('GET', url, { token: user.accessToken })).status;

  const results: Stats[] = [];
  // Mỗi lần gọi một ngày mới ⇒ `GET /today` phải sinh kế hoạch (đường đắt nhất).
  results.push(
    await measure(
      'today_generate',
      () => get('/today'),
      () => clock.advanceDays(1),
    ),
  );
  // Cùng ngày: đọc kế hoạch đã sinh.
  results.push(await measure('today_cached', () => get('/today')));
  results.push(await measure('path', () => get('/path')));

  const { rows } = await handle.pool.query<{ active: number }>(
    `SELECT count(*)::int AS active FROM learning_units WHERE status = 'active'`,
  );
  const active = rows[0]?.active ?? 0;

  console.log(`\n[${label}] CONTENT_RELEASES=${process.env.CONTENT_RELEASES ?? '(mặc định)'}`);
  console.log(
    `Đơn vị đang hoạt động: ${active} | seed: ${summary.unitsInserted} đơn vị mới trong ${Math.round(seedMs)} ms`,
  );
  console.log(
    `Số lần gọi mỗi điểm đo: ${calls} (khởi động ${warmup}); tài khoản N4, 15 phút/ngày\n`,
  );
  console.log('| Điểm đo | p50 (ms) | p95 (ms) | tối đa (ms) |');
  console.log('|---|---|---|---|');
  for (const r of results) {
    console.log(`| ${r.name} | ${r.p50.toFixed(1)} | ${r.p95.toFixed(1)} | ${r.max.toFixed(1)} |`);
  }
  if (asJson) console.log(JSON.stringify({ label, activeUnits: active, results }));
} finally {
  await app.close();
  await handle.close();
}
