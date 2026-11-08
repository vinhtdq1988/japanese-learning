import {
  countCompletedUnits,
  countKanjiCharactersLearned,
  countKanjiLessonsCompleted,
  countKanjiReviewResults,
  countReviewResults,
  getTopicNames,
  getTopicSkills,
  hasAnyStudyData,
  hasKanjiStudyData,
  listActiveDays,
  listKanjiLessonIntervals,
  listPausePeriods,
  listReviewSessionKanjiShares,
  listUserIntervals,
} from '../db/repositories/progress.js';
import { listWeakTopicStats } from '../db/repositories/topic-stats.js';
import { localize } from '../domain/i18n.js';
import { unionDurationSeconds } from '../domain/intervals.js';
import type { Skill } from '../domain/types.js';
import { localToday } from '../engine/clock.js';
import {
  allocateKanjiSeconds,
  currentStreakDays,
  goalRatio,
  isOnTrack,
} from '../engine/progress.js';
import { upcomingUnits, type ScopeNotice } from '../engine/path.js';
import type { ServiceDeps } from './deps.js';
import { secondsToMinutes } from './lesson-session.js';
import { rankForContext, resolveLearningContext } from './learning-context.js';

// Dịch vụ tóm tắt tiến độ (T085, FR-026 → FR-029): chế độ xem TÍNH TOÁN từ dữ liệu đã ghi, không lưu.

export interface ProgressDto {
  /** true khi chưa có lịch sử học (trạng thái trống thân thiện). */
  isEmpty: boolean;
  /** Tổng thời gian học (phút) = độ dài hợp các khoảng thời gian, chồng nhau chỉ tính một lần. */
  totalMinutes: number;
  /** Số đơn vị đã hoàn thành (`unit_progress`). */
  lessonsCompleted: number;
  /** Độ chính xác ôn tập (câu lượt chính trong ngữ cảnh ôn); null khi chưa ôn lần nào. */
  reviewAccuracy: number | null;
  currentStreakDays: number;
  goal: {
    /** Tỷ lệ đơn vị mục tiêu đã xong (hoàn thành hoặc thành thạo), chỉ tính đơn vị `active`. */
    completionRatio: number;
    /** null khi không có mốc thời gian mục tiêu. */
    onTrack: boolean | null;
    targetDate: string | null;
    scopeNotice: ScopeNotice | null;
  };
  /**
   * Khối Kanji (research K8); null khi người học không chọn Kanji và chưa có dữ liệu học Kanji. Các trường tổng
   * ở trên đã bao gồm Kanji.
   */
  kanji: KanjiProgressDto | null;
  weakTopics: { topicId: string; name: string; skill: Skill; accuracy: number }[];
}

export interface KanjiProgressDto {
  /** Số chữ có ít nhất một khía cạnh đã lên lịch ôn (và bài chứa chữ đã hoàn thành). */
  charactersLearned: number;
  lessonsCompleted: number;
  /** Phút học Kanji; phần của phiên ôn hỗn hợp là ước lượng theo tỷ lệ câu Kanji (FR-017). */
  minutes: number;
  /** Đúng/tổng câu ôn Kanji (gộp các khía cạnh); null khi chưa ôn Kanji. */
  reviewAccuracy: number | null;
}

const round3 = (value: number): number => Math.round(value * 1000) / 1000;

function emptySummary(): ProgressDto {
  return {
    isEmpty: true,
    totalMinutes: 0,
    lessonsCompleted: 0,
    reviewAccuracy: null,
    currentStreakDays: 0,
    goal: { completionRatio: 0, onTrack: null, targetDate: null, scopeNotice: null },
    kanji: null,
    weakTopics: [],
  };
}

/** `GET /progress`: tóm tắt tiến độ của người học (FR-027 → FR-029). */
export async function getProgress(deps: ServiceDeps, userId: string): Promise<ProgressDto> {
  const ctx = await resolveLearningContext(deps, userId);
  // Chưa hoàn tất onboarding thì chưa có lộ trình lẫn lịch sử học: trả trạng thái trống.
  if (!ctx) return emptySummary();
  const { profile, params } = ctx;

  const today = localToday(deps.clock, profile.timezone);
  const [intervals, review, activeDays, pauses, lessonsCompleted, hasData, weak, ranked] =
    await Promise.all([
      listUserIntervals(deps.db, userId),
      countReviewResults(deps.db, userId),
      listActiveDays(deps.db, userId),
      // Trong lớp chỉ khoảng tạm dừng của lớp áp dụng (research O9).
      ctx.source === 'class' ? Promise.resolve(ctx.pauses) : listPausePeriods(deps.db, userId),
      countCompletedUnits(deps.db, userId),
      hasAnyStudyData(deps.db, userId),
      listWeakTopicStats(deps.db, userId),
      rankForContext(deps, userId, ctx, { includeMastered: true }),
    ]);

  const goal = goalRatio(ranked);
  const remaining = upcomingUnits(ranked);
  const remainingMinutes = remaining.reduce((sum, u) => sum + u.estMinutes, 0);

  const weakIds = weak.map((w) => w.topicId);
  const [names, topicSkills, kanji] = await Promise.all([
    getTopicNames(deps.db, weakIds),
    getTopicSkills(deps.db, weakIds),
    kanjiProgress(deps, userId, profile.skills.includes('kanji')),
  ]);

  return {
    isEmpty: !hasData,
    totalMinutes: secondsToMinutes(unionDurationSeconds(intervals)),
    lessonsCompleted,
    reviewAccuracy: review.total > 0 ? round3(review.correct / review.total) : null,
    currentStreakDays: currentStreakDays(activeDays, today, pauses),
    goal: {
      completionRatio: goal.ratio,
      onTrack: isOnTrack({
        remainingMinutes,
        dailyMinutes: profile.dailyMinutes ?? 0,
        today,
        targetDate: profile.targetDate,
      }),
      targetDate: profile.targetDate,
      scopeNotice: params.scopeNotice,
    },
    kanji,
    weakTopics: weak.map((w) => ({
      topicId: w.topicId,
      name: localize(names.get(w.topicId), profile.language),
      skill: topicSkills.get(w.topicId) ?? 'vocabulary',
      accuracy: round3(w.accuracy ?? 0),
    })),
  };
}

/**
 * Khối Kanji của tiến độ (research K8): số chữ, số bài, phút và độ chính xác ôn. Null khi người học không chọn
 * Kanji và chưa có dữ liệu Kanji nào (người học không chọn Kanji thấy tiến độ như cũ).
 */
async function kanjiProgress(
  deps: ServiceDeps,
  userId: string,
  selected: boolean,
): Promise<KanjiProgressDto | null> {
  if (!selected && !(await hasKanjiStudyData(deps.db, userId))) return null;
  const [characters, lessons, lessonIntervals, shares, review] = await Promise.all([
    countKanjiCharactersLearned(deps.db, userId),
    countKanjiLessonsCompleted(deps.db, userId),
    listKanjiLessonIntervals(deps.db, userId),
    listReviewSessionKanjiShares(deps.db, userId),
    countKanjiReviewResults(deps.db, userId),
  ]);
  // Phiên bài Kanji: hợp khoảng thời gian; phiên ôn hỗn hợp: phân bổ theo tỷ lệ câu Kanji (ước lượng).
  const seconds =
    unionDurationSeconds(lessonIntervals) +
    shares.reduce(
      (sum, s) =>
        sum +
        allocateKanjiSeconds(unionDurationSeconds(s.intervals), s.kanjiPrimary, s.totalPrimary),
      0,
    );
  return {
    charactersLearned: characters,
    lessonsCompleted: lessons,
    minutes: secondsToMinutes(seconds),
    reviewAccuracy: review.total > 0 ? round3(review.correct / review.total) : null,
  };
}
