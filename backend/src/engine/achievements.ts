import { ACHIEVEMENT_CATALOG } from '../domain/achievements.js';

// Đánh giá thành tựu thuần hàm (spec 005, data-model §3.2, research E1/E2): so sánh chỉ số TRƯỚC và SAU lần
// hoàn thành phiên để quyết định mốc nào được chúc mừng (`celebrate`) và mốc nào chỉ ghi âm thầm (`silent`).
// Không I/O, không phụ thuộc đồng hồ; không đụng `daily-plan.ts`, `path.ts`, `srs.ts`, `difficulty.ts`.

export interface EvaluateInput {
  /** Mã thành tựu người học đã đạt (mốc có trong tập này bị bỏ qua). */
  earned: ReadonlySet<string>;
  /** Phiên vừa hoàn thành là bài học mới (`kind ≠ review`). */
  isNewLesson: boolean;
  streakBefore: number;
  streakAfter: number;
  itemsBefore: number;
  itemsAfter: number;
  /** Số đơn vị mục tiêu đã xong SAU lần hoàn thành này và tổng số đơn vị mục tiêu. */
  goalDone: number;
  goalTotal: number;
  /** 1 nếu chính phiên này đưa một đơn vị trong phạm vi từ chưa-xong thành xong; ngược lại 0. */
  delta: number;
  /** Có bài học mới nào khác đã hoàn thành trước phiên này. */
  hasEarlierLesson: boolean;
  /** Phiên này là bài học mới và mọi câu lượt chính đều đúng (`total > 0`). */
  isPerfect: boolean;
  /** Có bài học mới nào khác đã hoàn thành với mọi câu lượt chính đúng. */
  hadEarlierPerfect: boolean;
}

export interface EvaluateResult {
  /** Mã mốc cần chúc mừng, theo thứ tự trình bày (FR-014). */
  celebrate: string[];
  /** Mã mốc đã vượt từ trước (người học cũ, đổi mục tiêu…) chỉ ghi nhận, không chúc mừng. */
  silent: string[];
}

/** Mốc ngưỡng `T` của một chỉ số đếm: âm thầm nếu `T ≤ before`, chúc mừng nếu `before < T ≤ after`. */
function judgeCounter(
  threshold: number,
  before: number,
  after: number,
): 'silent' | 'celebrate' | null {
  if (threshold <= before) return 'silent';
  if (threshold <= after) return 'celebrate';
  return null;
}

/**
 * Tỷ lệ mục tiêu so bằng số nguyên (`done·100` với `T·total`) để 100% không dính sai số số thực.
 * `goalTotal = 0` (không có đơn vị mục tiêu) thì bỏ qua.
 */
function judgeGoal(
  threshold: number,
  input: Pick<EvaluateInput, 'goalDone' | 'goalTotal' | 'delta'>,
): 'silent' | 'celebrate' | null {
  const { goalDone, goalTotal, delta } = input;
  if (goalTotal <= 0) return null;
  const limit = threshold * goalTotal;
  const beforeDone = goalDone - delta;
  if (beforeDone * 100 >= limit) return 'silent';
  if (goalDone * 100 >= limit) return 'celebrate';
  return null;
}

/**
 * Quyết định thành tựu cho một lần hoàn thành phiên. Một mốc không bao giờ vừa `silent` vừa `celebrate`;
 * mốc đã trong `earned` bị bỏ qua; kết quả theo thứ tự danh mục (= thứ tự trình bày).
 */
export function evaluate(input: EvaluateInput): EvaluateResult {
  const celebrate: string[] = [];
  const silent: string[] = [];

  for (const def of ACHIEVEMENT_CATALOG) {
    if (input.earned.has(def.code)) continue;
    let verdict: 'silent' | 'celebrate' | null = null;
    switch (def.kind) {
      case 'streak':
        verdict = judgeCounter(def.threshold ?? 0, input.streakBefore, input.streakAfter);
        break;
      case 'items_learned':
        verdict = judgeCounter(def.threshold ?? 0, input.itemsBefore, input.itemsAfter);
        break;
      case 'goal_progress':
        verdict = judgeGoal(def.threshold ?? 0, input);
        break;
      case 'first_lesson':
        if (input.hasEarlierLesson) verdict = 'silent';
        else if (input.isNewLesson) verdict = 'celebrate';
        break;
      case 'perfect_lesson':
        if (input.hadEarlierPerfect) verdict = 'silent';
        else if (input.isNewLesson && input.isPerfect) verdict = 'celebrate';
        break;
    }
    if (verdict === 'celebrate') celebrate.push(def.code);
    else if (verdict === 'silent') silent.push(def.code);
  }
  return { celebrate, silent };
}
