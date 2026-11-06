import { addDays, diffDays } from './clock.js';
import { isPausedOn, MAX_REVIEW_SHARE, type PausePeriod } from './daily-plan.js';
import type { LocalDate } from '../domain/types.js';

// Tính toán tiến độ thuần hàm (research R7, R11; FR-027, FR-028): chuỗi ngày học, ngày vắng và đánh giá
// "đúng tiến độ" so với mốc thời gian mục tiêu. Không phụ thuộc HTTP/CSDL/đồng hồ.

/**
 * Chuỗi ngày học hiện tại (R11): số ngày địa phương liên tiếp có hoạt động học, tính ngược từ hôm nay.
 *
 * - Hôm nay chưa học thì chuỗi chưa đứt (người học còn cả ngày): bắt đầu đếm từ hôm qua.
 * - Ngày thuộc giai đoạn tạm dừng được bỏ qua: không cộng vào chuỗi và cũng không làm đứt chuỗi, nên đúng
 *   cả khi tạm dừng/tiếp tục nhiều lần.
 * - Ngày địa phương lấy từ `study_records.local_date` đã lưu lúc xảy ra, nên đổi múi giờ không làm đứt chuỗi
 *   (kể cả khi "hôm nay" theo múi giờ mới lùi trước ngày học gần nhất).
 */
export function currentStreakDays(
  activeDays: ReadonlySet<LocalDate>,
  today: LocalDate,
  pausePeriods: readonly PausePeriod[],
): number {
  if (activeDays.size === 0) return 0;
  const days = [...activeDays];
  const earliest = days.reduce((a, b) => (a < b ? a : b));
  const latest = days.reduce((a, b) => (a > b ? a : b));

  // Đổi múi giờ về phía tây có thể làm "hôm nay" lùi trước ngày học gần nhất đã lưu: lấy ngày học gần
  // nhất làm mốc để chuỗi đã tính không bị đứt.
  const anchor = latest > today ? latest : today;
  let cursor = anchor;
  if (!activeDays.has(anchor) && !isPausedOn(anchor, pausePeriods)) cursor = addDays(anchor, -1);

  let streak = 0;
  while (cursor >= earliest) {
    if (activeDays.has(cursor)) streak += 1;
    else if (!isPausedOn(cursor, pausePeriods)) break;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export interface OnTrackInput {
  /** Tổng phút ước lượng của các đơn vị mục tiêu còn lại (chưa học/đang học, chưa thành thạo). */
  remainingMinutes: number;
  /** Quỹ thời gian mỗi ngày đã khai báo `B`. */
  dailyMinutes: number;
  today: LocalDate;
  targetDate: LocalDate | null;
}

/**
 * "Đúng tiến độ" so với mốc mục tiêu (FR-028); null khi không có mốc.
 *
 * Ước lượng số ngày cần để học hết phần còn lại với phần quỹ thời gian dành cho bài mới (`1 − 60%` ôn tập,
 * R7), rồi so với số ngày còn lại đến mốc. Mốc đã qua mà vẫn còn nội dung → chậm tiến độ. Chỉ dùng để
 * đánh giá, KHÔNG làm kế hoạch ngày vượt quỹ thời gian.
 */
export function isOnTrack(input: OnTrackInput): boolean | null {
  const { remainingMinutes, dailyMinutes, today, targetDate } = input;
  if (!targetDate) return null;
  if (remainingMinutes <= 0) return true;
  const daysLeft = diffDays(today, targetDate);
  if (daysLeft <= 0) return false;
  const newContentMinutesPerDay = dailyMinutes * (1 - MAX_REVIEW_SHARE);
  if (newContentMinutesPerDay <= 0) return false;
  return Math.ceil(remainingMinutes / newContentMinutesPerDay) <= daysLeft;
}

/**
 * Phân bổ thời gian một phiên ôn hỗn hợp cho Kanji (research K8, FR-017): phiên ôn gồm cả từ vựng/ngữ pháp
 * lẫn Kanji nên phần Kanji được ước lượng theo tỷ lệ số câu lượt chính Kanji / tổng số câu lượt chính của
 * phiên. Phiên không có câu nào (`totalPrimary = 0`) → 0 giây; phiên toàn Kanji → toàn bộ thời gian.
 * Đây là ước lượng (không phải đồng hồ thực), spec FR-017/SC-007 đã ghi rõ.
 */
export function allocateKanjiSeconds(
  sessionSeconds: number,
  kanjiPrimary: number,
  totalPrimary: number,
): number {
  if (totalPrimary <= 0 || kanjiPrimary <= 0 || sessionSeconds <= 0) return 0;
  const ratio = Math.min(1, kanjiPrimary / totalPrimary);
  return sessionSeconds * ratio;
}
