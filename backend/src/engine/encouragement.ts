import {
  ENCOURAGEMENT_CATALOG,
  STREAK_MIN_DAYS,
  type EncouragementState,
  type EncouragementText,
} from '../domain/encouragement.js';
import type { Language, LocalDate } from '../domain/types.js';
import { diffDays } from './clock.js';

// Chọn lời khích lệ ở màn hình "Hôm nay" (spec 007, FR-026…FR-031): hàm thuần, chỉ dùng tín hiệu từ dữ liệu
// đã ghi (không đọc tốc độ trả lời, không so sánh với người học khác). Xem encouragement-catalog.md §1–§2.

export interface EncouragementSignals {
  planStatus: 'open' | 'completed';
  planItemsTotal: number;
  planItemsDone: number;
  /** Chuỗi ngày học hiện tại (`currentStreakDays`). */
  streakDays: number;
  /** Vắng ≥ `GAP_THRESHOLD_DAYS` ngày (kế hoạch hôm nay được lập lại sau khoảng nghỉ). */
  afterGap: boolean;
  /** `isOnTrack`: null khi không có mốc mục tiêu. */
  onTrack: boolean | null;
}

/**
 * Đúng MỘT trạng thái, ưu tiên từ trên xuống:
 * day_completed > welcome_back > in_progress > streak (≥ 3 ngày) > behind_target > not_started.
 */
export function pickEncouragementState(signals: EncouragementSignals): EncouragementState {
  if (signals.planStatus === 'completed') return 'day_completed';
  if (signals.afterGap && signals.planItemsDone === 0) return 'welcome_back';
  if (signals.planItemsDone > 0 && signals.planItemsDone < signals.planItemsTotal) {
    return 'in_progress';
  }
  if (signals.streakDays >= STREAK_MIN_DAYS) return 'streak';
  if (signals.onTrack === false) return 'behind_target';
  return 'not_started';
}

/** Băm FNV-1a 32-bit, tất định giữa các lần chạy và các máy. */
function hash32(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const EPOCH: LocalDate = '1970-01-01';

export interface VariantInput {
  userId: string;
  state: EncouragementState;
  language: Language;
  localDate: LocalDate;
  streakDays: number;
}

/**
 * Biến thể ổn định trong ngày, đổi giữa các ngày:
 * `idx = (hash32(userId:state) + dayOrdinal(localDate)) mod |variants|`. Mỗi ngày idx tăng 1 nên hai ngày
 * liền kề cùng trạng thái luôn khác câu (|variants| ≥ 3). Thiếu bản dịch thì dùng `vi`; `{n}` = số ngày chuỗi.
 */
export function pickVariant(
  input: VariantInput,
  catalog: Record<EncouragementState, readonly EncouragementText[]> = ENCOURAGEMENT_CATALOG,
): string {
  const variants = catalog[input.state];
  const ordinal = diffDays(EPOCH, input.localDate);
  const idx = (((hash32(`${input.userId}:${input.state}`) + ordinal) % variants.length) + variants.length) %
    variants.length;
  const text = variants[idx]!;
  return (text[input.language] || text.vi).replaceAll('{n}', String(input.streakDays));
}
