import type { DbExecutor } from '../db/client.js';
import {
  deleteUnitProgress,
  getActivePath,
  insertPath,
  loadTopicStats,
  loadUnitProgress,
  setUnitProgress,
  supersedeActivePath,
  type LearningPathRow,
} from '../db/repositories/paths.js';
import {
  clearCurrentPlacement,
  markPlacementCurrent,
  getPlacementById,
  type PlacementResultRow,
} from '../db/repositories/placement.js';
import { getProfile, updateProfile, type ProfileRow } from '../db/repositories/profiles.js';
import { getItemKind, setItemMastered as setScheduleMastered } from '../db/repositories/review.js';
import {
  closePausePeriod,
  hasCompletedUnitSession,
  openPausePeriod,
} from '../db/repositories/progress.js';
import { localize } from '../domain/i18n.js';
import { AppError, type Language, type Level } from '../domain/types.js';
import { localToday } from '../engine/clock.js';
import {
  buildPathParams,
  CONTENT_CEILING,
  fromGeneratedFrom,
  levelIndex,
  rankUnits,
  toGeneratedFrom,
  upcomingUnits,
  type GeneratedFrom,
  type PathParams,
  type PathProfileInput,
  type RankedUnit,
  type ScopeNotice,
} from '../engine/path.js';
import type { CatalogUnit, ContentCache } from './content-cache.js';
import type { ServiceDeps } from './deps.js';

// Dịch vụ lộ trình (T049, T051, R7). Lộ trình chỉ lưu tham số sinh (`learning_paths.generated_from`);
// thứ tự đơn vị luôn được `rankUnits` tính động từ nội dung `active` hiện hành (SC-008).

/** Phụ thuộc chỉ đọc: chạy được cả với kết nối thường lẫn trong giao dịch. */
export interface ReadDeps {
  db: DbExecutor;
  contentCache: ContentCache;
}

export type PathReason =
  'onboarding' | 'rebuild_request' | 'goal_change' | 'level_change' | 'placement_retake';

export interface PathSummaryDto {
  id: string;
  totalUnits: number;
  completedUnits: number;
  startLevel: Level;
  reason: PathReason;
  scopeNotice: ScopeNotice | null;
  message: string | null;
}

export interface PathItemDto {
  unitId: string;
  title: string;
  kind: string;
  level: string;
  estMinutes: number;
  status: 'pending' | 'in_progress' | 'completed' | 'mastered';
}

export interface PathDetailDto extends PathSummaryDto {
  items: PathItemDto[];
}

export function notOnboarded(): AppError {
  return new AppError(404, 'NOT_FOUND', 'Chưa có lộ trình: hãy hoàn tất onboarding trước');
}

/** Đầu vào engine từ hồ sơ đã onboarding (các trường bắt buộc đã được kiểm tra khi hoàn tất). */
export function profileToPathInput(profile: ProfileRow): PathProfileInput {
  return {
    currentLevel: profile.currentLevel,
    goalType: profile.goalType,
    targetLevel: profile.targetLevel,
    targetDate: profile.targetDate,
    skills: profile.skills,
    prioritizedSkill: profile.prioritizedSkill,
  };
}

/** Tham số lộ trình từ hồ sơ + kết quả placement hiện hành được chọn (nếu có). */
export function paramsFor(profile: ProfileRow, placement: PlacementResultRow | null): PathParams {
  return buildPathParams(
    profileToPathInput(profile),
    placement
      ? {
          id: placement.id,
          estimatedLevel: placement.estimatedLevel,
          weakTopics: placement.weakTopics,
        }
      : null,
  );
}

/**
 * Tạo lộ trình mới: đặt bản `active` cũ thành `superseded` rồi chèn bản mới. KHÔNG đụng `unit_progress`,
 * `study_records`, `review_schedules`, `topic_stats` (lịch sử và lịch ôn giữ nguyên, US1.6/US5.2).
 */
export async function createPath(
  db: DbExecutor,
  userId: string,
  reason: PathReason,
  params: PathParams,
): Promise<LearningPathRow> {
  await supersedeActivePath(db, userId);
  return insertPath(db, {
    userId,
    status: 'active',
    reason,
    generatedFrom: toGeneratedFrom(params) as unknown as Record<string, unknown>,
  });
}

export function paramsOfPath(path: LearningPathRow): PathParams {
  return fromGeneratedFrom(path.generatedFrom as unknown as GeneratedFrom);
}

/** Danh sách đơn vị đã xếp hạng cho người học (tính động, không lưu). */
export async function rankForUser(
  deps: ReadDeps,
  userId: string,
  profile: ProfileRow,
  params: PathParams,
  options: { includeMastered?: boolean } = {},
): Promise<RankedUnit<CatalogUnit>[]> {
  const [units, progress, stats] = await Promise.all([
    deps.contentCache.activeUnits(),
    loadUnitProgress(deps.db, userId),
    loadTopicStats(deps.db, userId),
  ]);
  return rankUnits(params, profileToPathInput(profile), units, progress, stats, options);
}

function summarize(
  path: LearningPathRow,
  params: PathParams,
  ranked: readonly RankedUnit<CatalogUnit>[],
): PathSummaryDto {
  return {
    id: path.id,
    totalUnits: ranked.length,
    completedUnits: ranked.filter((r) => r.status === 'completed' || r.status === 'mastered')
      .length,
    startLevel: params.startLevel,
    reason: path.reason,
    scopeNotice: params.scopeNotice,
    message: null,
  };
}

/** Tóm tắt lộ trình `path` (đã tồn tại) của người học. */
export async function summarizePath(
  deps: ReadDeps,
  userId: string,
  profile: ProfileRow,
  path: LearningPathRow,
): Promise<PathSummaryDto> {
  const params = paramsOfPath(path);
  const ranked = await rankForUser(deps, userId, profile, params, { includeMastered: true });
  return summarize(path, params, ranked);
}

/** `GET /path`: lộ trình hiện tại kèm thứ tự đơn vị tính động tại thời điểm gọi. */
export async function getPathDetail(deps: ReadDeps, userId: string): Promise<PathDetailDto> {
  const profile = await getProfile(deps.db, userId);
  const path = await getActivePath(deps.db, userId);
  if (!profile || !path) throw notOnboarded();

  const params = paramsOfPath(path);
  const ranked = await rankForUser(deps, userId, profile, params, { includeMastered: true });
  const language: Language = profile.language;
  return {
    ...summarize(path, params, ranked),
    items: ranked.map((r) => ({
      unitId: r.unit.id,
      title: localize(r.unit.title, language),
      kind: r.unit.kind,
      level: r.unit.level,
      estMinutes: r.unit.estMinutes,
      status: r.status,
    })),
  };
}

/**
 * `POST /path/rebuild` (FR-016, US1.6): sinh lộ trình mới, giữ nguyên lịch sử học và lịch ôn.
 * - Có `placementResultId` (làm lại placement rồi chọn xây dựng lại): dùng kết quả đó, `reason='placement_retake'`.
 * - Bỏ trống: xây dựng lại theo hồ sơ hiện tại và kết quả placement lộ trình cũ đang dùng, `reason='rebuild_request'`.
 */
export async function rebuildPath(
  deps: ReadDeps,
  userId: string,
  options: { placementResultId?: string } = {},
): Promise<PathSummaryDto> {
  const profile = await getProfile(deps.db, userId);
  if (!profile || profile.onboardingState !== 'completed') throw notOnboarded();

  return deps.db.transaction(async (tx) => {
    let placement: PlacementResultRow | null;
    let reason: PathReason;
    if (options.placementResultId) {
      placement = (await getPlacementById(tx, userId, options.placementResultId)) ?? null;
      if (!placement) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy kết quả kiểm tra');
      if (!placement.isCurrent) {
        await clearCurrentPlacement(tx, userId);
        await markPlacementCurrent(tx, placement.id);
      }
      reason = 'placement_retake';
    } else {
      const previous = await getActivePath(tx, userId);
      const previousId = previous ? paramsOfPath(previous).placementResultId : null;
      placement = previousId ? ((await getPlacementById(tx, userId, previousId)) ?? null) : null;
      reason = 'rebuild_request';
    }

    const params = paramsFor(profile, placement);
    const path = await createPath(tx, userId, reason, params);
    return summarizePath({ db: tx, contentCache: deps.contentCache }, userId, profile, path);
  });
}

// --- Ghi đè của người học (T093, FR-016, Nguyên tắc III) ---

async function requireOnboardedProfile(db: DbExecutor, userId: string): Promise<ProfileRow> {
  const profile = await getProfile(db, userId);
  if (!profile || profile.onboardingState !== 'completed') throw notOnboarded();
  return profile;
}

/**
 * `POST /path/pause`: tạm dừng lộ trình. Mở giai đoạn `pause_periods` và đặt `paused=true` trong cùng
 * giao dịch; gọi lại khi đang tạm dừng không làm gì. Khi đang tạm dừng không sinh kế hoạch ngày và
 * không có "ngày bỏ lỡ" (R7).
 */
export async function pausePath(deps: ServiceDeps, userId: string): Promise<void> {
  const profile = await requireOnboardedProfile(deps.db, userId);
  if (profile.paused) return;
  const today = localToday(deps.clock, profile.timezone);
  await deps.db.transaction(async (tx) => {
    await openPausePeriod(tx, userId, today);
    await updateProfile(tx, userId, { paused: true }, deps.clock.now());
  });
}

/** `POST /path/resume`: tiếp tục lộ trình – đóng giai đoạn tạm dừng và đặt `paused=false` (cùng giao dịch). */
export async function resumePath(deps: ServiceDeps, userId: string): Promise<void> {
  const profile = await requireOnboardedProfile(deps.db, userId);
  if (!profile.paused) return;
  const today = localToday(deps.clock, profile.timezone);
  await deps.db.transaction(async (tx) => {
    await closePausePeriod(tx, userId, today);
    await updateProfile(tx, userId, { paused: false }, deps.clock.now());
  });
}

export interface MasterResultDto {
  /** Số đơn vị còn có thể học (chưa học hoặc đang học dở, chưa thành thạo) trong khoảng trình độ lộ trình. */
  remainingUnits: number;
  /** Chỉ có khi `remainingUnits = 0`. */
  suggestion?: 'raise_level' | 'content_exhausted';
}

/**
 * `PUT /path/units/{unitId}/master`: đánh dấu / bỏ đánh dấu đã thành thạo (FR-016). Đơn vị `mastered` bị
 * loại khỏi bài sắp tới (`rankUnits`) nhưng lịch ôn của các mục vẫn giữ nguyên. Bỏ đánh dấu trả đơn vị về
 * `completed` nếu từng hoàn thành một phiên, ngược lại về "chưa học". Khi không còn đơn vị nào để học thì
 * gợi ý: `raise_level` nếu khoảng trình độ lộ trình chưa chạm trần N3, ngược lại `content_exhausted`.
 */
export async function setUnitMastered(
  deps: ServiceDeps,
  userId: string,
  unitId: string,
  mastered: boolean,
): Promise<MasterResultDto> {
  const profile = await requireOnboardedProfile(deps.db, userId);
  const path = await getActivePath(deps.db, userId);
  if (!path) throw notOnboarded();

  const unit = (await deps.contentCache.activeUnits()).find((u) => u.id === unitId);
  if (!unit) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy đơn vị học này');

  const now = deps.clock.now();
  await deps.db.transaction(async (tx) => {
    if (mastered) {
      await setUnitProgress(tx, userId, unitId, 'mastered', now);
      return;
    }
    const current = (await loadUnitProgress(tx, userId)).get(unitId);
    if (current !== 'mastered') return;
    if (await hasCompletedUnitSession(tx, userId, unitId)) {
      await setUnitProgress(tx, userId, unitId, 'completed', now);
    } else {
      await deleteUnitProgress(tx, userId, unitId);
    }
  });

  const params = paramsOfPath(path);
  const remainingUnits = upcomingUnits(await rankForUser(deps, userId, profile, params)).length;
  if (remainingUnits > 0) return { remainingUnits };
  return {
    remainingUnits,
    suggestion:
      levelIndex(params.levelRange[1]) < levelIndex(CONTENT_CEILING)
        ? 'raise_level'
        : 'content_exhausted',
  };
}

export interface ItemMasterResultDto {
  itemId: string;
  mastered: boolean;
}

/**
 * `PUT /path/items/{itemId}/master` (research K7, FR-010): đánh dấu / bỏ đánh dấu một chữ Kanji đã thành thạo.
 * Đặt `mastered_at` cho mọi cặp (chữ, khía cạnh) nên chữ rời khỏi gói ôn; bỏ đánh dấu thì lịch tiếp tục từ
 * `due_date` đã lưu. Idempotent. 404 khi chưa onboarding hoặc người học chưa học chữ (không có lịch ôn);
 * 422 khi mục không phải Kanji (từ vựng/ngữ pháp giữ nguyên hành vi 001).
 */
export async function setItemMastered(
  deps: ServiceDeps,
  userId: string,
  itemId: string,
  mastered: boolean,
): Promise<ItemMasterResultDto> {
  await requireOnboardedProfile(deps.db, userId);
  const kind = await getItemKind(deps.db, itemId);
  if (kind === null) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy chữ này');
  if (kind !== 'kanji') {
    throw new AppError(422, 'VALIDATION_FAILED', 'Chỉ đánh dấu thành thạo được với chữ Kanji', {
      itemId: 'mục không phải chữ Kanji',
    });
  }
  const touched = await setScheduleMastered(deps.db, userId, itemId, mastered, deps.clock.now());
  if (touched === 0) throw new AppError(404, 'NOT_FOUND', 'Bạn chưa học chữ này');
  return { itemId, mastered };
}
