import { getActivePath } from '../db/repositories/paths.js';
import {
  findPlan,
  getUnitTitles,
  insertPlanIfAbsent,
  insertPlanItems,
  listPlanItems,
  previousPlanKind,
  type DailyPlanRow,
} from '../db/repositories/plans.js';
import { getProfile, type ProfileRow } from '../db/repositories/profiles.js';
import { latestActiveDay, listPausePeriods } from '../db/repositories/progress.js';
import { listDueReviewItems } from '../db/repositories/review.js';
import {
  countPrimaryResults,
  listPlanSessionIds,
  listSessionIntervals,
} from '../db/repositories/sessions.js';
import { unionDurationSeconds } from '../domain/intervals.js';
import { localize } from '../domain/i18n.js';
import { AppError, type Language } from '../domain/types.js';
import { localToday } from '../engine/clock.js';
import {
  GAP_NOTICE,
  hasLearningGap,
  packReviewBatches,
  planDailyPlan,
  rankDueItems,
} from '../engine/daily-plan.js';
import { levelIndex, upcomingUnits, type PathParams } from '../engine/path.js';
import type { CatalogUnit } from './content-cache.js';
import type { ServiceDeps } from './deps.js';
import type { SessionSummaryDto } from './lesson-session.js';
import { notOnboarded, paramsOfPath, rankForUser } from './path.js';

// Dịch vụ kế hoạch ngày (T050, R7, FR-012): sinh lười khi mở lần đầu trong ngày địa phương, lưu lại
// nên idempotent theo `(user_id, local_date)` và không đổi khi nội dung đổi trong ngày.

/** Mã thông báo gắn vào kế hoạch (`DailyPlan.notice`). */
export const PLAN_NOTICES = {
  /** Đã học hết nội dung phù hợp và không có bài ôn đến hạn. */
  contentExhausted: 'content_exhausted',
  /** Còn nội dung nhưng không đơn vị nào vừa quỹ thời gian hôm nay. */
  noFittingUnit: 'no_fitting_unit',
  /** Kế hoạch được lập lại ở mức xử lý được sau khoảng nghỉ ≥ 2 ngày (FR-015); không hiển thị "nợ". */
  replannedAfterGap: GAP_NOTICE,
} as const;

export interface PlanItemDto {
  id: string;
  type: 'new_unit' | 'review_batch';
  title: string;
  estMinutes: number;
  status: 'pending' | 'in_progress' | 'completed';
  itemCount: number | null;
}

export interface DailyPlanDto {
  id: string;
  localDate: string;
  budgetMinutes: number;
  estimatedMinutes: number;
  status: 'open' | 'completed';
  items: PlanItemDto[];
  notice: string | null;
  /** Chỉ có khi ngày đã hoàn thành: kết quả tổng hợp của mọi phiên trong kế hoạch (US2.3). */
  summary?: SessionSummaryDto;
}

/** Tóm tắt kết quả của các phiên thuộc một kế hoạch ngày: đúng/tổng (lượt chính) và thời gian học. */
async function planSummary(
  deps: Pick<ServiceDeps, 'db'>,
  plan: DailyPlanRow,
): Promise<SessionSummaryDto> {
  const sessionIds = await listPlanSessionIds(deps.db, plan.id);
  const [{ correct, total }, intervals] = await Promise.all([
    countPrimaryResults(deps.db, sessionIds),
    listSessionIntervals(deps.db, sessionIds),
  ]);
  return {
    correct,
    total,
    minutesSpent: Math.round((unionDurationSeconds(intervals) / 60) * 10) / 10,
    dayCompleted: true,
  };
}

const REVIEW_TITLE: Record<Language, string> = { vi: 'Ôn tập', en: 'Review' };

async function toDto(
  deps: Pick<ServiceDeps, 'db'>,
  plan: DailyPlanRow,
  language: Language,
): Promise<DailyPlanDto> {
  const items = await listPlanItems(deps.db, plan.id);
  const titles = await getUnitTitles(
    deps.db,
    items.flatMap((i) => (i.unitId ? [i.unitId] : [])),
  );
  return {
    id: plan.id,
    localDate: plan.localDate,
    budgetMinutes: plan.budgetMinutes,
    estimatedMinutes: plan.estimatedMinutes,
    status: plan.status,
    notice: plan.notice,
    ...(plan.status === 'completed' ? { summary: await planSummary(deps, plan) } : {}),
    items: items.map((i) => ({
      id: i.id,
      type: i.type,
      title:
        i.type === 'review_batch'
          ? REVIEW_TITLE[language]
          : localize(i.unitId ? titles.get(i.unitId) : undefined, language),
      estMinutes: i.estMinutes,
      status: i.status,
      itemCount: i.type === 'review_batch' ? (i.reviewItemIds?.length ?? 0) : null,
    })),
  };
}

async function generatePlan(
  deps: ServiceDeps,
  userId: string,
  profile: ProfileRow,
  params: PathParams,
  localDate: string,
): Promise<void> {
  const ranked = await rankForUser(deps, userId, profile, params);
  const upcoming = upcomingUnits(ranked);
  const previousKind = await previousPlanKind(deps.db, userId, localDate);
  // Mục ôn đến hạn xếp theo ưu tiên (mục khó, quá hạn lâu nhất); mục không vừa quỹ hôm nay không bị
  // sửa `due_date` nên tiếp tục được ưu tiên ở ngày sau (T078, R7).
  const rankedDue = rankDueItems(await listDueReviewItems(deps.db, userId, localDate), localDate);
  const rankedIds = rankedDue.map((i) => i.itemId);

  const result = planDailyPlan({
    budgetMinutes: profile.dailyMinutes ?? 0,
    paused: profile.paused,
    newUnits: upcoming.map((u) => ({ unitId: u.id, estMinutes: u.estMinutes })),
    packReview: (minutes) =>
      packReviewBatches(rankedIds, minutes, deps.config.REVIEW_SECONDS_PER_ITEM),
    previousKind,
  });
  if (!result) throw new AppError(409, 'PATH_PAUSED', 'Lộ trình đang tạm dừng');

  // Khoảng nghỉ (T092, FR-015): kế hoạch đã bị chặn bởi 60% quỹ cho ôn nên luôn xử lý được; mục quá hạn
  // dư giữ nguyên `due_date` gốc nên tự được ưu tiên ở các ngày sau. Chỉ báo cho người học, không có "nợ".
  const [lastActive, pauses] = await Promise.all([
    latestActiveDay(deps.db, userId),
    listPausePeriods(deps.db, userId),
  ]);
  const afterGap = hasLearningGap(lastActive, localDate, pauses);

  const notice =
    result.items.length > 0
      ? afterGap
        ? PLAN_NOTICES.replannedAfterGap
        : null
      : upcoming.length === 0
        ? PLAN_NOTICES.contentExhausted
        : PLAN_NOTICES.noFittingUnit;

  await deps.db.transaction(async (tx) => {
    const inserted = await insertPlanIfAbsent(tx, {
      userId,
      localDate,
      budgetMinutes: profile.dailyMinutes ?? 0,
      estimatedMinutes: result.estimatedMinutes,
      status: 'open',
      notice,
    });
    // Yêu cầu đồng thời khác đã tạo kế hoạch ngày này: dùng bản đó.
    if (!inserted) return;
    await insertPlanItems(
      tx,
      result.items.map((item, position) => ({
        planId: inserted.id,
        type: item.type,
        unitId: item.type === 'new_unit' ? item.unitId : null,
        reviewItemIds: item.type === 'review_batch' ? item.itemIds : null,
        estMinutes: item.estMinutes,
        position,
        status: 'pending' as const,
      })),
    );
  });
}

/**
 * `GET /today`: kế hoạch của ngày địa phương hiện tại. Sinh một lần rồi lưu; gọi lại trả đúng bản đã lưu.
 * 409 `PATH_PAUSED` khi lộ trình đang tạm dừng (không có kế hoạch, không có ngày bỏ lỡ).
 */
export async function getTodayPlan(deps: ServiceDeps, userId: string): Promise<DailyPlanDto> {
  const [profile, path] = await Promise.all([
    getProfile(deps.db, userId),
    getActivePath(deps.db, userId),
  ]);
  if (!profile || !path || profile.onboardingState !== 'completed') throw notOnboarded();
  if (profile.paused) throw new AppError(409, 'PATH_PAUSED', 'Lộ trình đang tạm dừng');

  const localDate = localToday(deps.clock, profile.timezone);
  let plan = await findPlan(deps.db, userId, localDate);
  if (!plan) {
    await generatePlan(deps, userId, profile, paramsOfPath(path), localDate);
    plan = await findPlan(deps.db, userId, localDate);
  }
  return toDto(deps, plan!, profile.language);
}

// --- Học thêm (T065, US2.5) ---

export type ExhaustionSuggestion = 'raise_level' | 'add_skill' | 'content_exhausted';

/**
 * Gợi ý khi hết đơn vị phù hợp: còn nội dung ở trình độ cao hơn trong N5–N3 → nâng trình độ; còn nội dung
 * ở kỹ năng người học chưa chọn → thêm kỹ năng; ngược lại đã hết nội dung hiện có.
 */
export function suggestAfterExhaustion(
  params: Pick<PathParams, 'levelRange'>,
  skills: readonly string[],
  catalog: readonly Pick<CatalogUnit, 'kind' | 'level'>[],
): ExhaustionSuggestion {
  const ceiling = levelIndex(params.levelRange[1]);
  if (catalog.some((u) => skills.includes(u.kind) && levelIndex(u.level) > ceiling)) {
    return 'raise_level';
  }
  if (catalog.some((u) => !skills.includes(u.kind))) return 'add_skill';
  return 'content_exhausted';
}

const EXHAUSTED_MESSAGES: Record<ExhaustionSuggestion, string> = {
  raise_level:
    'Bạn đã học hết nội dung phù hợp ở trình độ hiện tại; có thể nâng trình độ để học tiếp',
  add_skill:
    'Bạn đã học hết nội dung của các kỹ năng đã chọn; có thể thêm kỹ năng khác để học tiếp',
  content_exhausted: 'Bạn đã học hết nội dung hiện có trong phiên bản này',
};

/**
 * `POST /today/extra`: đơn vị kế tiếp (qua `rankUnits`) ngoài kế hoạch hôm nay, KHÔNG ghi đè kế hoạch
 * mặc định. Trả `id` là id đơn vị; client bắt đầu học bằng `POST /sessions {planItemId: id}`.
 * Hết nội dung phù hợp → 404 `CONTENT_EXHAUSTED` kèm gợi ý trong `fields.suggestion`.
 */
export async function getExtraUnit(deps: ServiceDeps, userId: string): Promise<PlanItemDto> {
  const [profile, path] = await Promise.all([
    getProfile(deps.db, userId),
    getActivePath(deps.db, userId),
  ]);
  if (!profile || !path || profile.onboardingState !== 'completed') throw notOnboarded();
  if (profile.paused) throw new AppError(409, 'PATH_PAUSED', 'Lộ trình đang tạm dừng');

  const params = paramsOfPath(path);
  const ranked = await rankForUser(deps, userId, profile, params);
  const plan = await findPlan(deps.db, userId, localToday(deps.clock, profile.timezone));
  const planned = new Set(
    plan
      ? (await listPlanItems(deps.db, plan.id)).flatMap((i) => (i.unitId ? [i.unitId] : []))
      : [],
  );

  const next = ranked.find(
    (r) => (r.status === 'pending' || r.status === 'in_progress') && !planned.has(r.unit.id),
  );
  if (!next) {
    const suggestion = suggestAfterExhaustion(
      params,
      profile.skills,
      await deps.contentCache.activeUnits(),
    );
    throw new AppError(404, 'CONTENT_EXHAUSTED', EXHAUSTED_MESSAGES[suggestion], { suggestion });
  }
  return {
    id: next.unit.id,
    type: 'new_unit',
    title: localize(next.unit.title, profile.language),
    estMinutes: next.unit.estMinutes,
    status: next.status === 'in_progress' ? 'in_progress' : 'pending',
    itemCount: null,
  };
}
