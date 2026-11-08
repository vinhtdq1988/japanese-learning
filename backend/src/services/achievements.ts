import type { DbExecutor } from '../db/client.js';
import {
  insertAchievements,
  listEarnedCodes,
  markDayCelebrated,
  type NewAchievementRow,
} from '../db/repositories/achievements.js';
import { getProfile } from '../db/repositories/profiles.js';
import {
  countItemsLearned,
  hasEarlierCompletedLesson,
  hasEarlierPerfectLesson,
  listActiveDays,
  listPausePeriods,
} from '../db/repositories/progress.js';
import {
  countPrimaryResults,
  getUnitProgressStatus,
  type SessionRow,
} from '../db/repositories/sessions.js';
import {
  ACHIEVEMENT_CATALOG,
  achievementByCode,
  type AchievementKind,
} from '../domain/achievements.js';
import { localize } from '../domain/i18n.js';
import type { Language, LocalDate } from '../domain/types.js';
import { evaluate } from '../engine/achievements.js';
import { localToday } from '../engine/clock.js';
import type { PausePeriod } from '../engine/daily-plan.js';
import { currentStreakDays, goalRatio } from '../engine/progress.js';
import type { ServiceDeps } from './deps.js';
import {
  rankForContext,
  resolveLearningContext,
  type LearningContext,
} from './learning-context.js';

// Dịch vụ thành tựu (spec 005, data-model §3). Chạy BÊN TRONG giao dịch `completeSession`, chỉ ở lần hoàn thành
// phiên đầu tiên: so sánh chỉ số TRƯỚC và SAU lần hoàn thành rồi ghi nhận idempotent. Chỉ tính chỉ số của loại
// còn mốc chưa đạt (research E5) để giữ chi phí của `complete` nhỏ.

export interface AchievementEarnedDto {
  code: string;
  kind: AchievementKind;
  threshold?: number;
  name: string;
  description: string;
}

export interface CelebrationsDto {
  dayCompleted: boolean;
  achievements: AchievementEarnedDto[];
}

/** Dữ liệu cần nạp NGOÀI giao dịch (ngữ cảnh học dùng kết nối thường): xem `prepareAchievementContext`. */
export interface AchievementContext {
  learning: LearningContext | null;
}

/** Trạng thái "trước" chụp TRƯỚC khi đánh dấu phiên/đơn vị hoàn thành. */
export interface PreCompletionState {
  earned: ReadonlySet<string>;
  itemsBefore: number;
  /** Trạng thái tiến độ của đơn vị trước `markUnitCompleted` (undefined = chưa có dòng). */
  unitStatusBefore: 'in_progress' | 'completed' | 'mastered' | undefined;
}

const hasUnearned = (earned: ReadonlySet<string>, kind: AchievementKind): boolean =>
  ACHIEVEMENT_CATALOG.some((a) => a.kind === kind && !earned.has(a.code));

/**
 * Nạp ngữ cảnh học (nguồn cá nhân/lớp) ngoài giao dịch, chỉ khi còn mốc `streak`/`goal_progress` chưa đạt
 * (đọc tập mã đã đạt chỉ là gợi ý: bản ghi chỉ thêm, không bao giờ mất, nên đọc lại trong giao dịch không đổi
 * quyết định "cần ngữ cảnh").
 */
export async function prepareAchievementContext(
  deps: ServiceDeps,
  userId: string,
): Promise<AchievementContext> {
  const earned = await listEarnedCodes(deps.db, userId);
  if (!hasUnearned(earned, 'streak') && !hasUnearned(earned, 'goal_progress')) {
    return { learning: null };
  }
  return { learning: await resolveLearningContext(deps, userId) };
}

/** Chụp trạng thái "trước" của lần hoàn thành phiên; gọi trước `markSessionCompleted`/`markUnitCompleted`. */
export async function snapshotBeforeCompletion(
  tx: DbExecutor,
  userId: string,
  session: SessionRow,
): Promise<PreCompletionState> {
  const earned = await listEarnedCodes(tx, userId);
  const isNewLesson = session.kind !== 'review';
  const itemsBefore =
    isNewLesson && session.unitId && hasUnearned(earned, 'items_learned')
      ? await countItemsLearned(tx, userId)
      : 0;
  const unitStatusBefore =
    isNewLesson && session.unitId && hasUnearned(earned, 'goal_progress')
      ? await getUnitProgressStatus(tx, userId, session.unitId)
      : undefined;
  return { earned, itemsBefore, unitStatusBefore };
}

export interface CompletionInput {
  userId: string;
  session: SessionRow;
  before: PreCompletionState;
  context: AchievementContext;
  /** Lần hoàn thành này vừa đưa kế hoạch ngày sang `completed` (nhánh `markPlanCompleted`). */
  dayJustCompleted: boolean;
  /** Ngày địa phương của kế hoạch vừa hoàn thành (khóa chặn chúc mừng ngày lần hai). */
  planLocalDate: LocalDate | null;
  now: Date;
}

/**
 * Đánh giá và ghi nhận thành tựu sau khi phiên đã được đánh dấu hoàn thành (và `unit_progress`/kế hoạch đã cập
 * nhật). Trả `undefined` khi không có gì để chúc mừng. Chỉ mốc THẬT SỰ được chèn bởi giao dịch này mới được
 * chúc mừng (SC-003), nên hai cửa sổ cùng vượt một mốc chỉ một bên nhận lời chúc.
 */
export async function evaluateOnSessionCompletion(
  tx: DbExecutor,
  deps: ServiceDeps,
  input: CompletionInput,
): Promise<CelebrationsDto | undefined> {
  const { userId, session, before, context, now } = input;
  const { earned } = before;
  const profile = await getProfile(tx, userId);
  if (!profile) return undefined;

  const isNewLesson = session.kind !== 'review';
  const ctx = context.learning;

  // Chuỗi ngày: "trước" = bỏ ngày hôm nay (hoạt động của phiên này), "sau" = đầy đủ.
  let streakBefore = 0;
  let streakAfter = 0;
  if (hasUnearned(earned, 'streak')) {
    const today = localToday(deps.clock, profile.timezone);
    const [activeDays, pauses] = await Promise.all([
      listActiveDays(tx, userId),
      ctx?.source === 'class' ? Promise.resolve(ctx.pauses) : listPausePeriods(tx, userId),
    ]);
    ({ streakBefore, streakAfter } = streakAround(activeDays, today, pauses));
  }

  // Tổng số mục đã học: chỉ bài học mới mới thêm mục (phiên ôn không đổi số mục).
  let itemsAfter = 0;
  if (isNewLesson && session.unitId && hasUnearned(earned, 'items_learned')) {
    itemsAfter = await countItemsLearned(tx, userId);
  }

  // Tiến độ mục tiêu: cùng phép tính với `GET /progress` (`goalRatio`).
  let goalDone = 0;
  let goalTotal = 0;
  let delta = 0;
  if (isNewLesson && ctx && hasUnearned(earned, 'goal_progress')) {
    const ranked = await rankForContext({ db: tx, contentCache: deps.contentCache }, userId, ctx, {
      includeMastered: true,
    });
    const goal = goalRatio(ranked);
    goalDone = goal.done;
    goalTotal = goal.total;
    const wasDone =
      before.unitStatusBefore === 'completed' || before.unitStatusBefore === 'mastered';
    const inScope = session.unitId !== null && ranked.some((r) => r.unit.id === session.unitId);
    delta = inScope && !wasDone ? 1 : 0;
  }

  const hasEarlierLesson = !earned.has('first_lesson')
    ? await hasEarlierCompletedLesson(tx, userId, session.id)
    : false;
  let isPerfect = false;
  let hadEarlierPerfect = false;
  if (!earned.has('perfect_lesson')) {
    if (isNewLesson) {
      const { correct, total } = await countPrimaryResults(tx, [session.id]);
      isPerfect = total > 0 && correct === total;
    }
    hadEarlierPerfect = await hasEarlierPerfectLesson(tx, userId, session.id);
  }

  const verdict = evaluate({
    earned,
    isNewLesson,
    streakBefore,
    streakAfter,
    itemsBefore: before.itemsBefore,
    itemsAfter: isNewLesson ? itemsAfter : before.itemsBefore,
    goalDone,
    goalTotal,
    delta,
    hasEarlierLesson,
    isPerfect,
    hadEarlierPerfect,
  });

  // Ghi theo thứ tự danh mục cố định giữa các giao dịch để hai phiên đồng thời không khóa chéo nhau.
  const celebrateSet = new Set(verdict.celebrate);
  const rows: NewAchievementRow[] = ACHIEVEMENT_CATALOG.filter(
    (a) => celebrateSet.has(a.code) || verdict.silent.includes(a.code),
  ).map((a) => ({ code: a.code, source: celebrateSet.has(a.code) ? 'earned' : 'silent' }));
  const inserted = await insertAchievements(tx, userId, rows, now);
  const celebrated = verdict.celebrate.filter((code) => inserted.has(code));

  const dayCompleted =
    input.dayJustCompleted && input.planLocalDate
      ? await markDayCelebrated(tx, userId, input.planLocalDate, now)
      : false;

  if (!dayCompleted && celebrated.length === 0) return undefined;
  return {
    dayCompleted,
    achievements: celebrated.map((code) => toEarnedDto(code, profile.language)),
  };
}

function streakAround(
  activeDays: ReadonlySet<LocalDate>,
  today: LocalDate,
  pauses: readonly PausePeriod[],
): { streakBefore: number; streakAfter: number } {
  const withoutToday = new Set(activeDays);
  withoutToday.delete(today);
  return {
    streakBefore: currentStreakDays(withoutToday, today, pauses),
    streakAfter: currentStreakDays(activeDays, today, pauses),
  };
}

function toEarnedDto(code: string, language: Language): AchievementEarnedDto {
  const def = achievementByCode(code);
  if (!def) throw new Error(`Mã thành tựu không thuộc danh mục: ${code}`);
  return {
    code: def.code,
    kind: def.kind,
    ...(def.threshold !== undefined ? { threshold: def.threshold } : {}),
    name: localize(def.name, language),
    description: localize(def.description, language),
  };
}
