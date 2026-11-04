import { addDays } from './clock.js';
import type { LocalDate } from '../domain/types.js';

// Engine lặp lại ngắt quãng thuần hàm (research R6, FR-023, FR-025, SC-005): biến thể SM-2 cho kết quả
// nhị phân (đúng/sai). Không phụ thuộc HTTP/CSDL/đồng hồ; ngày địa phương do người gọi truyền vào.

/** `ease` khởi tạo cho mục mới học. */
export const INITIAL_EASE = 2.3;
export const MIN_EASE = 1.3;
export const MAX_EASE = 2.8;
/** Mục khó: số lần quên tối thiểu và ngưỡng độ chính xác gần đây (R6, FR-014). */
export const HARD_MIN_LAPSES = 3;
export const HARD_ACCURACY_THRESHOLD = 0.6;
/** Trần `ease` của mục khó. */
export const HARD_EASE_CAP = 2.0;
/** Số câu lượt chính gần nhất của một mục dùng để tính "độ chính xác gần đây". */
export const RECENT_ACCURACY_WINDOW = 10;

/** Trạng thái lịch ôn của một (người học, mục). */
export interface SrsState {
  intervalDays: number;
  ease: number;
  repetitions: number;
  lapses: number;
  isHard: boolean;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * Cập nhật lịch ôn sau một câu trả lời lượt chính.
 *
 * - `previous = null` là mục chưa có lịch. Lần đầu trả lời đúng: `interval=1`, `ease=2.3`, `repetitions=1`.
 * - Đúng: `repetitions += 1`; `interval = repetitions==2 ? 3 : round(interval × ease)`;
 *   `ease = min(2.8, ease + 0.05)`.
 * - Sai: `lapses += 1`; `repetitions = 0`; `interval = 1`; `ease = max(1.3, ease − 0.2)`.
 * - Mục khó (`lapses ≥ 3` và độ chính xác gần đây < 60%): `ease ≤ 2.0` và `isHard = true`.
 *
 * `recentAccuracy` ∈ [0, 1] là độ chính xác trên các câu lượt chính gần nhất của chính mục này, đã gồm
 * câu vừa trả lời; `null` nếu chưa có dữ liệu (không bao giờ là mục khó).
 */
export function nextSrsState(
  previous: SrsState | null,
  isCorrect: boolean,
  recentAccuracy: number | null,
): SrsState {
  let next: SrsState;
  if (!previous) {
    next = isCorrect
      ? { intervalDays: 1, ease: INITIAL_EASE, repetitions: 1, lapses: 0, isHard: false }
      : {
          intervalDays: 1,
          ease: Math.max(MIN_EASE, round2(INITIAL_EASE - 0.2)),
          repetitions: 0,
          lapses: 1,
          isHard: false,
        };
  } else if (isCorrect) {
    const repetitions = previous.repetitions + 1;
    next = {
      intervalDays:
        repetitions === 2 ? 3 : Math.max(1, Math.round(previous.intervalDays * previous.ease)),
      ease: Math.min(MAX_EASE, round2(previous.ease + 0.05)),
      repetitions,
      lapses: previous.lapses,
      isHard: previous.isHard,
    };
  } else {
    next = {
      intervalDays: 1,
      ease: Math.max(MIN_EASE, round2(previous.ease - 0.2)),
      repetitions: 0,
      lapses: previous.lapses + 1,
      isHard: previous.isHard,
    };
  }

  const isHard =
    next.lapses >= HARD_MIN_LAPSES &&
    recentAccuracy !== null &&
    recentAccuracy < HARD_ACCURACY_THRESHOLD;
  return { ...next, isHard, ease: isHard ? Math.min(next.ease, HARD_EASE_CAP) : next.ease };
}

/** Ngày đến hạn: ngày địa phương của người học + `interval` ngày. */
export function dueDateAfter(localDate: LocalDate, intervalDays: number): LocalDate {
  return addDays(localDate, intervalDays);
}

/** Độ chính xác trên danh sách kết quả (true = đúng); `null` khi rỗng. */
export function accuracyOf(results: readonly boolean[]): number | null {
  if (results.length === 0) return null;
  return results.filter(Boolean).length / results.length;
}
