import { sql } from 'drizzle-orm';
import type { DbExecutor } from '../client.js';
import { aggregateDailyStats } from '../schema.js';
import { CONTENT_LEVELS } from '../../domain/types.js';

// Repository bộ đếm tổng hợp ẩn danh theo ngày (T098a, FR-038, SC-011). Bảng KHÔNG có khóa ngoại tới
// người dùng và không lưu IP/định danh; chỉ tăng bộ đếm theo `(day, metric)` với danh sách metric cố định.

/** Metric của luồng dùng thử; `trial_placement_level_<mức>` được sinh từ các mức placement ước tính. */
export const TRIAL_METRICS = [
  'trial_content_loaded',
  'trial_lesson_completed',
  'trial_placement_completed',
  'trial_placement_level_none',
  ...CONTENT_LEVELS.map((level) => `trial_placement_level_${level}` as const),
] as const;

export type TrialMetric = (typeof TRIAL_METRICS)[number];

/** Metric của vòng đời tài khoản: số tài khoản bị xóa cứng sau 30 ngày chờ (T112, FR-003). */
export const ACCOUNT_METRICS = ['accounts_purged'] as const;

export type AccountMetric = (typeof ACCOUNT_METRICS)[number];

const ALLOWED = new Set<string>([...TRIAL_METRICS, ...ACCOUNT_METRICS]);

/** Metric của kết quả placement dùng thử theo mức ước tính (`none` hoặc một mức nội dung). */
export function placementLevelMetric(level: 'none' | (typeof CONTENT_LEVELS)[number]): TrialMetric {
  return `trial_placement_level_${level}` as TrialMetric;
}

/**
 * Tăng bộ đếm `(day, metric)` thêm `amount` (mặc định 1) bằng upsert nguyên tử, an toàn khi nhiều
 * request đồng thời. Từ chối metric ngoài danh sách cố định để bảng không bị dùng làm kho dữ liệu tùy ý.
 */
export async function incrementMetric(
  db: DbExecutor,
  day: string,
  metric: string,
  amount = 1,
): Promise<void> {
  if (!ALLOWED.has(metric)) {
    throw new Error(`Metric không nằm trong danh sách cho phép: ${metric}`);
  }
  await db
    .insert(aggregateDailyStats)
    .values({ day, metric, value: amount })
    .onConflictDoUpdate({
      target: [aggregateDailyStats.day, aggregateDailyStats.metric],
      set: { value: sql`${aggregateDailyStats.value} + ${amount}` },
    });
}

/** Giá trị bộ đếm trong một ngày (0 nếu chưa có) – dùng cho báo cáo và kiểm thử. */
export async function readMetric(db: DbExecutor, day: string, metric: string): Promise<number> {
  const rows = await db
    .select({ value: aggregateDailyStats.value })
    .from(aggregateDailyStats)
    .where(sql`${aggregateDailyStats.day} = ${day} AND ${aggregateDailyStats.metric} = ${metric}`);
  return rows[0]?.value ?? 0;
}
