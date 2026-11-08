import type { I18nText } from './types.js';

// Danh mục thành tựu cố định (spec 005, research E3, contracts/achievement-catalog.md). Là hằng số trong mã
// (không phải nội dung học); `code` là hợp đồng ổn định, KHÔNG đổi nghĩa hay tái sử dụng mã đã phát hành —
// thêm/đổi ngưỡng = thêm mã mới. Không phụ thuộc CSDL nên engine và kiểm thử dùng được.

/** Loại thành tựu: quyết định chỉ số được so với ngưỡng. */
export const ACHIEVEMENT_KINDS = [
  'first_lesson',
  'perfect_lesson',
  'streak',
  'items_learned',
  'goal_progress',
] as const;
export type AchievementKind = (typeof ACHIEVEMENT_KINDS)[number];

export interface AchievementDef {
  /** Mã ổn định, khóa tham chiếu của bản ghi đã đạt (`earned_achievements.achievement_code`). */
  code: string;
  kind: AchievementKind;
  /** Ngày (streak), số mục (items_learned), phần trăm (goal_progress); vắng với hai thành tựu một lần. */
  threshold?: number;
  /** Tên ngắn (≤ 30 ký tự) để vừa thẻ chúc mừng. */
  name: I18nText;
  /** Mô tả một câu. */
  description: I18nText;
}

const streak = (threshold: number, vi: [string, string], en: [string, string]): AchievementDef => ({
  code: `streak_${threshold}`,
  kind: 'streak',
  threshold,
  name: { vi: vi[0], en: en[0] },
  description: { vi: vi[1], en: en[1] },
});

const items = (threshold: number, vi: [string, string], en: [string, string]): AchievementDef => ({
  code: `items_${threshold}`,
  kind: 'items_learned',
  threshold,
  name: { vi: vi[0], en: en[0] },
  description: { vi: vi[1], en: en[1] },
});

const goal = (threshold: number, vi: [string, string], en: [string, string]): AchievementDef => ({
  code: `goal_${threshold}`,
  kind: 'goal_progress',
  threshold,
  name: { vi: vi[0], en: en[0] },
  description: { vi: vi[1], en: en[1] },
});

/** 16 mốc theo thứ tự trình bày (FR-014): một lần → streak → items → goal, ngưỡng tăng dần trong từng loại. */
export const ACHIEVEMENT_CATALOG: readonly AchievementDef[] = [
  {
    code: 'first_lesson',
    kind: 'first_lesson',
    name: { vi: 'Bài học đầu tiên', en: 'First lesson' },
    description: {
      vi: 'Bạn vừa hoàn thành bài học đầu tiên – khởi đầu tốt đẹp!',
      en: 'You just finished your first lesson – a great start!',
    },
  },
  {
    code: 'perfect_lesson',
    kind: 'perfect_lesson',
    name: { vi: 'Bài học hoàn hảo', en: 'Perfect lesson' },
    description: {
      vi: 'Mọi câu đều đúng ngay lần đầu. Xuất sắc!',
      en: 'Every answer right on the first try. Excellent!',
    },
  },
  streak(
    3,
    ['Chuỗi 3 ngày', 'Bạn đã học 3 ngày liên tiếp.'],
    ['3-day streak', 'You have studied 3 days in a row.'],
  ),
  streak(
    7,
    ['Chuỗi 7 ngày', 'Một tuần học đều đặn, rất tuyệt!'],
    ['7-day streak', 'A full week of steady study. Great job!'],
  ),
  streak(
    14,
    ['Chuỗi 14 ngày', 'Hai tuần liền không bỏ ngày nào.'],
    ['14-day streak', 'Two weeks in a row without a gap.'],
  ),
  streak(
    30,
    ['Chuỗi 30 ngày', 'Một tháng học liên tục – thói quen đã thành hình.'],
    ['30-day streak', 'A whole month of study – the habit is formed.'],
  ),
  streak(
    60,
    ['Chuỗi 60 ngày', 'Hai tháng bền bỉ, thật đáng nể.'],
    ['60-day streak', 'Two months of persistence. Impressive.'],
  ),
  streak(
    100,
    ['Chuỗi 100 ngày', '100 ngày học liên tiếp – một cột mốc lớn!'],
    ['100-day streak', '100 days in a row – a major milestone!'],
  ),
  items(
    50,
    ['Đã học 50 mục', 'Bạn đã học 50 từ vựng, ngữ pháp và Kanji.'],
    ['50 items learned', 'You have learned 50 words, grammar points and kanji.'],
  ),
  items(
    100,
    ['Đã học 100 mục', 'Đã 100 mục trong vốn tiếng Nhật của bạn.'],
    ['100 items learned', '100 items are now part of your Japanese.'],
  ),
  items(
    250,
    ['Đã học 250 mục', '250 mục – vốn kiến thức đang đầy lên thấy rõ.'],
    ['250 items learned', '250 items – your knowledge is clearly growing.'],
  ),
  items(
    500,
    ['Đã học 500 mục', '500 mục đã học. Nền tảng rất vững!'],
    ['500 items learned', '500 items learned. A solid foundation!'],
  ),
  goal(
    25,
    ['Đi được 1/4 chặng đường', 'Bạn đã hoàn thành 25% mục tiêu.'],
    ['A quarter of the way', 'You have completed 25% of your goal.'],
  ),
  goal(
    50,
    ['Đã đi được nửa chặng', 'Bạn đã hoàn thành 50% mục tiêu.'],
    ['Halfway there', 'You have completed 50% of your goal.'],
  ),
  goal(
    75,
    ['Sắp về đích', 'Bạn đã hoàn thành 75% mục tiêu.'],
    ['Almost there', 'You have completed 75% of your goal.'],
  ),
  goal(
    100,
    ['Hoàn thành mục tiêu!', 'Bạn đã hoàn thành toàn bộ lộ trình mục tiêu.'],
    ['Goal reached!', 'You have completed your entire goal path.'],
  ),
];

const BY_CODE: ReadonlyMap<string, AchievementDef> = new Map(
  ACHIEVEMENT_CATALOG.map((a) => [a.code, a]),
);

/** Tra mốc theo mã; `undefined` nếu mã không thuộc danh mục. */
export function achievementByCode(code: string): AchievementDef | undefined {
  return BY_CODE.get(code);
}

/** Thứ tự loại khi trình bày: first_lesson → perfect_lesson → streak → items → goal (FR-014). */
const KIND_ORDER: Record<AchievementKind, number> = {
  first_lesson: 0,
  perfect_lesson: 1,
  streak: 2,
  items_learned: 3,
  goal_progress: 4,
};

/** So sánh để sắp mốc theo thứ tự trình bày: theo loại, cùng loại theo ngưỡng tăng dần. */
export function compareAchievementOrder(a: AchievementDef, b: AchievementDef): number {
  const byKind = KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
  if (byKind !== 0) return byKind;
  return (a.threshold ?? 0) - (b.threshold ?? 0);
}
