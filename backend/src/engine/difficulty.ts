// Engine thống kê mảng và độ khó thích ứng thuần hàm (research R7, FR-013, FR-029). Không phụ thuộc
// HTTP/CSDL/đồng hồ: dịch vụ đọc `topic_stats`, gọi các hàm dưới đây rồi ghi lại.
//
// - Mức câu trả lời (`recordAnswer`, T084): cửa sổ trượt 20 kết quả gần nhất của mảng → `accuracy`, cờ
//   `is_weak` (độ chính xác < 60% với ≥ 8 câu; tự bỏ cờ khi ≥ 70%). Câu hỏi lại cuối phiên (`is_retry`)
//   KHÔNG được tính.
// - Mức phiên (`applySessionAccuracy`, T091): đếm số phiên liên tiếp độ chính xác < 60% / > 90% của mảng
//   và điều chỉnh `difficulty_bias` trong [−2, +2]; bias được `rankUnits` dùng khi chọn đơn vị kế tiếp.

/** Số kết quả gần nhất giữ lại cho mỗi mảng. */
export const TOPIC_WINDOW = 20;
/** Số câu tối thiểu trong cửa sổ trước khi được gắn cờ điểm yếu. */
export const WEAK_MIN_ANSWERS = 8;
/** Độ chính xác dưới mức này (với đủ số câu) → mảng yếu. */
export const WEAK_BELOW = 0.6;
/** Độ chính xác từ mức này trở lên → bỏ cờ điểm yếu (có độ trễ để cờ không nhấp nháy quanh 60%). */
export const RECOVER_AT = 0.7;

/** Phiên có độ chính xác dưới mức này (theo mảng) được tính là phiên "thấp". */
export const LOW_SESSION_BELOW = 0.6;
/** Phiên có độ chính xác trên mức này (theo mảng) được tính là phiên "cao". */
export const HIGH_SESSION_ABOVE = 0.9;
/** Số phiên thấp/cao liên tiếp để bắt đầu điều chỉnh độ khó. */
export const STREAK_TO_ADJUST = 2;
/** Giới hạn `difficulty_bias` (FR-013). */
export const BIAS_LIMIT = 2;
/**
 * Số câu lượt chính tối thiểu của một mảng trong phiên để phiên đó được tính vào chuỗi thấp/cao.
 * Phiên ôn tập chỉ chạm 1–2 câu mỗi mảng; một câu đúng/sai không đủ để kết luận.
 */
export const MIN_SESSION_ANSWERS = 3;

/** Thống kê một mảng của một người học (khớp bảng `topic_stats`). */
export interface TopicStatState {
  /** Tối đa `TOPIC_WINDOW` kết quả gần nhất, cũ → mới (1 = đúng, 0 = sai). */
  recentResults: (0 | 1)[];
  /** Tỷ lệ đúng trong `recentResults`; null khi chưa có câu nào. */
  accuracy: number | null;
  isWeak: boolean;
  /** −2..+2: âm = ưu tiên đơn vị dễ hơn, dương = khó hơn. */
  difficultyBias: number;
  consecutiveLow: number;
  consecutiveHigh: number;
}

export const EMPTY_TOPIC_STATS: Readonly<TopicStatState> = Object.freeze({
  recentResults: [],
  accuracy: null,
  isWeak: false,
  difficultyBias: 0,
  consecutiveLow: 0,
  consecutiveHigh: 0,
});

/** Độ chính xác của danh sách kết quả 0/1; null khi rỗng. */
export function accuracyOfResults(results: readonly number[]): number | null {
  if (results.length === 0) return null;
  return results.reduce<number>((sum, r) => sum + r, 0) / results.length;
}

/**
 * Cờ điểm yếu mới (FR-029): đặt khi độ chính xác < 60% với ≥ 8 câu; bỏ khi ≥ 70%; ở khoảng giữa
 * [60%, 70%) giữ nguyên cờ hiện có.
 */
export function nextWeakFlag(wasWeak: boolean, accuracy: number | null, answered: number): boolean {
  if (accuracy === null) return false;
  if (accuracy >= RECOVER_AT) return false;
  if (accuracy < WEAK_BELOW && answered >= WEAK_MIN_ANSWERS) return true;
  return wasWeak;
}

/**
 * Ghi một câu trả lời lượt chính vào thống kê mảng. Câu hỏi lại cuối phiên (`isRetry`) không được tính:
 * trả lại đúng trạng thái cũ.
 */
export function recordAnswer(
  state: TopicStatState,
  isCorrect: boolean,
  isRetry = false,
): TopicStatState {
  if (isRetry) return state;
  const recentResults = [...state.recentResults, isCorrect ? 1 : 0].slice(-TOPIC_WINDOW) as (
    0 | 1
  )[];
  const accuracy = accuracyOfResults(recentResults);
  return {
    ...state,
    recentResults,
    accuracy,
    isWeak: nextWeakFlag(state.isWeak, accuracy, recentResults.length),
  };
}

const clampBias = (bias: number): number => Math.max(-BIAS_LIMIT, Math.min(BIAS_LIMIT, bias));

/**
 * Áp dụng độ chính xác của MỘT phiên (của riêng mảng này) vào chuỗi thấp/cao và `difficulty_bias`.
 *
 * - `sessionAccuracy < 60%` → `consecutiveLow += 1`, `consecutiveHigh = 0`; `> 90%` → ngược lại;
 *   trong khoảng [60%, 90%] cả hai chuỗi về 0.
 * - Từ khi chuỗi đạt `STREAK_TO_ADJUST` (2 phiên) thì mỗi phiên cùng chiều tiếp theo điều chỉnh bias thêm 1
 *   bậc (thấp: −1, cao: +1), bị chặn trong [−2, +2]. Bộ đếm chuỗi giữ nguyên để quan sát được.
 * - Phiên có ít hơn `MIN_SESSION_ANSWERS` câu của mảng này không đủ căn cứ nên bị bỏ qua (không đổi gì).
 */
export function applySessionAccuracy(
  state: TopicStatState,
  sessionAccuracy: number,
  answered: number,
): TopicStatState {
  if (answered < MIN_SESSION_ANSWERS) return state;

  if (sessionAccuracy < LOW_SESSION_BELOW) {
    const consecutiveLow = state.consecutiveLow + 1;
    return {
      ...state,
      consecutiveLow,
      consecutiveHigh: 0,
      difficultyBias:
        consecutiveLow >= STREAK_TO_ADJUST
          ? clampBias(state.difficultyBias - 1)
          : state.difficultyBias,
    };
  }
  if (sessionAccuracy > HIGH_SESSION_ABOVE) {
    const consecutiveHigh = state.consecutiveHigh + 1;
    return {
      ...state,
      consecutiveLow: 0,
      consecutiveHigh,
      difficultyBias:
        consecutiveHigh >= STREAK_TO_ADJUST
          ? clampBias(state.difficultyBias + 1)
          : state.difficultyBias,
    };
  }
  return { ...state, consecutiveLow: 0, consecutiveHigh: 0 };
}

export interface TopicAnswerResult {
  topicId: string;
  isCorrect: boolean;
}

export interface TopicSessionAccuracy {
  accuracy: number;
  answered: number;
}

/** Gom kết quả lượt chính của một phiên theo mảng: độ chính xác và số câu mỗi mảng. */
export function sessionAccuracyByTopic(
  results: readonly TopicAnswerResult[],
): Map<string, TopicSessionAccuracy> {
  const counts = new Map<string, { correct: number; total: number }>();
  for (const r of results) {
    const c = counts.get(r.topicId) ?? { correct: 0, total: 0 };
    c.total += 1;
    if (r.isCorrect) c.correct += 1;
    counts.set(r.topicId, c);
  }
  return new Map(
    [...counts].map(([topicId, c]) => [
      topicId,
      { accuracy: c.correct / c.total, answered: c.total },
    ]),
  );
}
