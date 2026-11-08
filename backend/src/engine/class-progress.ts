import { addDays, diffDays } from './clock.js';
import { isPausedOn, type PausePeriod } from './daily-plan.js';
import { accuracyOfResults, nextWeakFlag, TOPIC_WINDOW } from './difficulty.js';
import type { ClassAlert } from '../domain/org-types.js';
import type { LocalDate } from '../domain/types.js';

// Engine tiến độ LỚP (spec 004, research O10, FR-027, FR-028): tỷ lệ hoàn thành, tỷ lệ mong đợi theo ngày làm
// việc, trạng thái so với mốc và cảnh báo (FR-031). Hàm thuần, không chạm CSDL/đồng hồ. Tái dùng `isPausedOn`
// của engine kế hoạch ngày (kiểu `PausePeriod` giữ nguyên).

/** Số ngày tối đa duyệt khi đếm ngày làm việc (chặn mốc kết thúc quá xa). */
const MAX_SPAN_DAYS = 3660;
/** Sai số số học khi so tỷ lệ với biên `margin`. */
const EPSILON = 1e-9;

/**
 * Tỷ lệ hoàn thành = số đơn vị bắt buộc đã hoàn thành/thành thạo ÷ số đơn vị bắt buộc. `null` khi tập bắt buộc
 * rỗng (không chia cho 0). Đơn vị hoàn thành nằm ngoài tập bắt buộc (đã miễn, không còn `active`) bị bỏ qua.
 */
export function completionRatio(
  requiredIds: readonly string[],
  completedIds: ReadonlySet<string>,
): number | null {
  if (requiredIds.length === 0) return null;
  let done = 0;
  for (const id of requiredIds) if (completedIds.has(id)) done += 1;
  return done / requiredIds.length;
}

export interface ExpectedRatioInput {
  startsOn: LocalDate;
  endsOn: LocalDate;
  /** Dời mốc riêng của học viên (dương = muộn hơn, âm = sớm hơn). */
  shiftDays: number;
  /** Khoảng tạm dừng áp dụng (cả lớp + riêng học viên). */
  pauses: readonly PausePeriod[];
  today: LocalDate;
}

/**
 * Tỷ lệ mong đợi `E(today)` = (số ngày làm việc ĐÃ QUA từ `starts_on'` đến `min(today, ends_on')`) ÷ (tổng số
 * ngày làm việc trong `[starts_on', ends_on')`), "ngày làm việc" = không thuộc khoảng tạm dừng; `starts_on'` và
 * `ends_on'` là hai mốc sau khi dời. Ngày đã qua là ngày trọn vẹn TRƯỚC hôm nay. `E = 0` tới hết ngày bắt đầu,
 * `E = 1` từ ngày kết thúc; mọi ngày đều tạm dừng thì `E` là 0 trước ngày kết thúc và 1 từ đó (không chia cho 0).
 */
export function expectedRatio(input: ExpectedRatioInput): number {
  const start = addDays(input.startsOn, input.shiftDays);
  const end = addDays(input.endsOn, input.shiftDays);
  if (input.today >= end) return 1;
  if (input.today <= start) return 0;

  const span = Math.min(diffDays(start, end), MAX_SPAN_DAYS);
  const elapsed = diffDays(start, input.today);
  let total = 0;
  let past = 0;
  for (let i = 0; i < span; i++) {
    if (isPausedOn(addDays(start, i), input.pauses)) continue;
    total += 1;
    if (i < elapsed) past += 1;
  }
  if (total === 0) return 0;
  return past / total;
}

export type ClassProgressStatus = 'on_track' | 'behind' | 'ahead' | 'paused';

export interface ProgressStatusInput {
  completionRatio: number | null;
  expectedRatio: number;
  /** Biên dung sai trong [0, 1] (`CLASS_PROGRESS_MARGIN_PCT` ÷ 100). */
  margin: number;
  /** Hôm nay thuộc khoảng tạm dừng. */
  paused: boolean;
  /** Có bài giao quá hạn chưa xong. */
  hasOverdueAssignment: boolean;
}

/**
 * Trạng thái so với mốc (FR-028): `paused` ưu tiên trên mọi trạng thái; `behind` nếu thấp hơn mong đợi quá
 * `margin` hoặc có bài giao quá hạn; `ahead` nếu cao hơn quá `margin`; còn lại `on_track`. Lớp không có đơn vị
 * bắt buộc (tỷ lệ `null`) coi là `on_track` trừ khi có bài giao quá hạn.
 */
export function progressStatus(input: ProgressStatusInput): ClassProgressStatus {
  if (input.paused) return 'paused';
  if (input.hasOverdueAssignment) return 'behind';
  const ratio = input.completionRatio;
  if (ratio === null) return 'on_track';
  if (ratio < input.expectedRatio - input.margin - EPSILON) return 'behind';
  if (ratio > input.expectedRatio + input.margin + EPSILON) return 'ahead';
  return 'on_track';
}

export interface AlertsInput {
  progressStatus: ClassProgressStatus;
  /** Số ngày trọn vẹn không học tính đến hôm qua (đã loại ngày tạm dừng). */
  absentDays: number;
  /** Ngưỡng vắng của lớp (`absence_threshold_days`, 1–14). */
  threshold: number;
  hasOverdueAssignment: boolean;
  /** Hôm nay thuộc khoảng tạm dừng. */
  paused: boolean;
}

/**
 * Cảnh báo dẫn xuất khi đọc (FR-031, research O10), thứ tự cố định `absent → behind → overdue_assignment`.
 * Học viên đang tạm dừng KHÔNG có cảnh báo nào. `needAttention = alerts.length > 0`.
 */
export function computeAlerts(input: AlertsInput): ClassAlert[] {
  if (input.paused || input.progressStatus === 'paused') return [];
  const alerts: ClassAlert[] = [];
  if (input.absentDays >= input.threshold) alerts.push('absent');
  if (input.progressStatus === 'behind') alerts.push('behind');
  if (input.hasOverdueAssignment) alerts.push('overdue_assignment');
  return alerts;
}

/** Học viên đã có bản ghi học nào kể từ khi vào lớp chưa; `false` ⇒ giao diện hiện "chưa bắt đầu" thay vì số 0. */
export function hasStarted(recordCount: number): boolean {
  return recordCount > 0;
}

/** Đã hoàn thành 100% đơn vị bắt buộc (biên "đã hoàn thành lộ trình"); `null` ⇒ `false`. */
export function pathCompleted(ratio: number | null): boolean {
  return ratio !== null && ratio >= 1;
}

/**
 * Phát lại các kết quả lượt chính (cũ → mới, đã giới hạn trong cửa sổ kể từ khi vào lớp) qua CÙNG quy tắc
 * `nextWeakFlag` của engine độ khó để biết mảng có bị gắn cờ yếu không (research O11). Trả kèm độ chính xác và
 * số câu trong cửa sổ.
 */
export function replayWeakFlag(results: readonly (0 | 1)[]): {
  weak: boolean;
  accuracy: number | null;
  answers: number;
} {
  let weak = false;
  const recent: number[] = [];
  for (const r of results) {
    recent.push(r);
    if (recent.length > TOPIC_WINDOW) recent.shift();
    weak = nextWeakFlag(weak, accuracyOfResults(recent), recent.length);
  }
  return { weak, accuracy: accuracyOfResults(recent), answers: recent.length };
}
