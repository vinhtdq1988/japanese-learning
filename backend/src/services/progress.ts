import { getActivePath } from '../db/repositories/paths.js';
import { getProfile } from '../db/repositories/profiles.js';
import {
  countCompletedUnits,
  countReviewResults,
  getTopicNames,
  hasAnyStudyData,
  listActiveDays,
  listPausePeriods,
  listUserIntervals,
} from '../db/repositories/progress.js';
import { listWeakTopicStats } from '../db/repositories/topic-stats.js';
import { localize } from '../domain/i18n.js';
import { unionDurationSeconds } from '../domain/intervals.js';
import { localToday } from '../engine/clock.js';
import { currentStreakDays, isOnTrack } from '../engine/progress.js';
import { upcomingUnits, type ScopeNotice } from '../engine/path.js';
import type { ServiceDeps } from './deps.js';
import { secondsToMinutes } from './lesson-session.js';
import { paramsOfPath, rankForUser } from './path.js';

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
  weakTopics: { topicId: string; name: string; accuracy: number }[];
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
    weakTopics: [],
  };
}

/** `GET /progress`: tóm tắt tiến độ của người học (FR-027 → FR-029). */
export async function getProgress(deps: ServiceDeps, userId: string): Promise<ProgressDto> {
  const [profile, path] = await Promise.all([
    getProfile(deps.db, userId),
    getActivePath(deps.db, userId),
  ]);
  // Chưa hoàn tất onboarding thì chưa có lộ trình lẫn lịch sử học: trả trạng thái trống.
  if (!profile || !path || profile.onboardingState !== 'completed') return emptySummary();

  const today = localToday(deps.clock, profile.timezone);
  const params = paramsOfPath(path);
  const [intervals, review, activeDays, pauses, lessonsCompleted, hasData, weak, ranked] =
    await Promise.all([
      listUserIntervals(deps.db, userId),
      countReviewResults(deps.db, userId),
      listActiveDays(deps.db, userId),
      listPausePeriods(deps.db, userId),
      countCompletedUnits(deps.db, userId),
      hasAnyStudyData(deps.db, userId),
      listWeakTopicStats(deps.db, userId),
      rankForUser(deps, userId, profile, params, { includeMastered: true }),
    ]);

  const done = ranked.filter((r) => r.status === 'completed' || r.status === 'mastered').length;
  const remaining = upcomingUnits(ranked);
  const remainingMinutes = remaining.reduce((sum, u) => sum + u.estMinutes, 0);

  const names = await getTopicNames(
    deps.db,
    weak.map((w) => w.topicId),
  );

  return {
    isEmpty: !hasData,
    totalMinutes: secondsToMinutes(unionDurationSeconds(intervals)),
    lessonsCompleted,
    reviewAccuracy: review.total > 0 ? round3(review.correct / review.total) : null,
    currentStreakDays: currentStreakDays(activeDays, today, pauses),
    goal: {
      completionRatio: ranked.length > 0 ? round3(done / ranked.length) : 0,
      onTrack: isOnTrack({
        remainingMinutes,
        dailyMinutes: profile.dailyMinutes ?? 0,
        today,
        targetDate: profile.targetDate,
      }),
      targetDate: profile.targetDate,
      scopeNotice: params.scopeNotice,
    },
    weakTopics: weak.map((w) => ({
      topicId: w.topicId,
      name: localize(names.get(w.topicId), profile.language),
      accuracy: round3(w.accuracy ?? 0),
    })),
  };
}
