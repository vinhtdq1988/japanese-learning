import { omitNulls } from '../api/http.js';
import { getActivePath } from '../db/repositories/paths.js';
import {
  clearCurrentPlacement,
  markPlacementCurrent,
  getPlacementById,
} from '../db/repositories/placement.js';
import { getProfile, updateProfile, type ProfileRow } from '../db/repositories/profiles.js';
import type {
  OnboardingCompleteInput,
  OnboardingDraftInput,
} from '../domain/profile-validation.js';
import { AppError } from '../domain/types.js';
import { localToday } from '../engine/clock.js';
import { getTodayPlan, type DailyPlanDto } from './daily-plan.js';
import type { ServiceDeps } from './deps.js';
import { createPath, paramsFor, summarizePath, type PathSummaryDto } from './path.js';
import { getCurrentPlacementDto, type PlacementResultDto } from './placement.js';

// Dịch vụ hồ sơ/onboarding (T046, FR-005, FR-008, FR-010): lưu nháp (bỏ dở/tiếp tục), kiểm tra dữ liệu
// khai báo và hoàn tất bằng cách sinh lộ trình + kế hoạch hôm nay. Người học có thể bỏ qua placement
// (FR-008): lộ trình khi đó sinh từ hồ sơ khai báo.
//
// Báo trước giới hạn nội dung N3 khi trình độ/mục tiêu là N2/N1 do client tính từ lựa chọn (cùng quy tắc
// `scopeNotice` của engine); sau khi hoàn tất, `PathSummary.scopeNotice` mang kết quả chính thức.

export interface OnboardingStateDto {
  state: ProfileRow['onboardingState'];
  draft: Record<string, unknown>;
  /** Kết quả placement hiện hành (ví dụ mang từ dùng thử sang); người học chọn dùng hoặc bỏ để làm lại. */
  carriedPlacement?: PlacementResultDto;
}

function storedDraft(profile: ProfileRow): Record<string, unknown> {
  return omitNulls(profile.onboardingDraft ?? {});
}

export async function getOnboardingState(
  deps: ServiceDeps,
  userId: string,
): Promise<OnboardingStateDto> {
  const profile = await getProfile(deps.db, userId);
  if (!profile) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy hồ sơ');
  const carried = await getCurrentPlacementDto(deps, userId, profile.language);
  return {
    state: profile.onboardingState,
    draft: storedDraft(profile),
    ...(carried ? { carriedPlacement: carried } : {}),
  };
}

/** `PUT /onboarding`: lưu nháp các bước đã nhập (thay toàn bộ nháp cũ). */
export async function saveOnboardingDraft(
  deps: ServiceDeps,
  userId: string,
  draft: OnboardingDraftInput,
): Promise<OnboardingStateDto> {
  const profile = await getProfile(deps.db, userId);
  if (!profile) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy hồ sơ');
  await updateProfile(
    deps.db,
    userId,
    {
      onboardingDraft: omitNulls(draft),
      // Đã hoàn tất thì giữ nguyên trạng thái; chỉ chuyển từ chưa bắt đầu sang đang làm.
      ...(profile.onboardingState === 'not_started'
        ? { onboardingState: 'in_progress' as const }
        : {}),
    },
    deps.clock.now(),
  );
  return getOnboardingState(deps, userId);
}

export interface OnboardingResultDto {
  path: PathSummaryDto;
  today: DailyPlanDto;
}

/**
 * `POST /onboarding/complete`: ghi hồ sơ khai báo, sinh lộ trình (`reason='onboarding'`) từ hồ sơ và
 * kết quả placement được chọn (nếu có), rồi trả lộ trình + kế hoạch hôm nay. Gọi lại sau khi đã hoàn tất
 * là idempotent: trả lộ trình và kế hoạch hiện có, không sinh lại.
 */
export async function completeOnboarding(
  deps: ServiceDeps,
  userId: string,
  input: OnboardingCompleteInput,
): Promise<OnboardingResultDto> {
  const profile = await getProfile(deps.db, userId);
  if (!profile) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy hồ sơ');

  if (profile.onboardingState === 'completed') {
    const existing = await getActivePath(deps.db, userId);
    if (existing) {
      return {
        path: await summarizePath(deps, userId, profile, existing),
        today: await getTodayPlan(deps, userId),
      };
    }
  }

  const timezone = input.timezone ?? profile.timezone;
  if (input.targetDate && input.targetDate < localToday(deps.clock, timezone)) {
    throw new AppError(422, 'VALIDATION_FAILED', 'Dữ liệu không hợp lệ', {
      targetDate: 'Mốc thời gian phải từ hôm nay trở đi',
    });
  }

  const created = await deps.db.transaction(async (tx) => {
    // Chỉ dùng kết quả placement khi người học chọn rõ (bỏ qua/bỏ kết quả → lộ trình từ hồ sơ khai báo).
    let placement = null;
    if (input.placementResultId) {
      placement = (await getPlacementById(tx, userId, input.placementResultId)) ?? null;
      if (!placement) {
        throw new AppError(422, 'VALIDATION_FAILED', 'Dữ liệu không hợp lệ', {
          placementResultId: 'Không tìm thấy kết quả kiểm tra trình độ',
        });
      }
      if (!placement.isCurrent) {
        await clearCurrentPlacement(tx, userId);
        await markPlacementCurrent(tx, placement.id);
      }
    }

    const updated = await updateProfile(
      tx,
      userId,
      {
        currentLevel: input.currentLevel,
        goalType: input.goalType,
        targetLevel: input.goalType === 'jlpt' ? (input.targetLevel ?? null) : null,
        dailyMinutes: input.dailyMinutes,
        targetDate: input.targetDate ?? null,
        skills: input.skills,
        timezone,
        onboardingState: 'completed',
        onboardingDraft: null,
      },
      deps.clock.now(),
    );
    const path = await createPath(tx, userId, 'onboarding', paramsFor(updated, placement));
    return { profile: updated, path };
  });

  return {
    path: await summarizePath(deps, userId, created.profile, created.path),
    today: await getTodayPlan(deps, userId),
  };
}
