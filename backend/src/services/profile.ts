import { omitNulls } from '../api/http.js';
import { getActivePath } from '../db/repositories/paths.js';
import { getPlacementById, type PlacementResultRow } from '../db/repositories/placement.js';
import {
  getProfile,
  updateProfile,
  type ProfilePatch,
  type ProfileRow,
} from '../db/repositories/profiles.js';
import { findUserById } from '../db/repositories/users.js';
import type { ProfileUpdateInput } from '../domain/profile-validation.js';
import { AppError, type AccountStatus, type Role } from '../domain/types.js';
import { localToday } from '../engine/clock.js';
import { applyEmailChange, prepareEmailChange } from './account.js';
import type { ServiceDeps } from './deps.js';
import { createPath, paramsFor, paramsOfPath, type PathReason } from './path.js';

// Dịch vụ hồ sơ (T047, T093): đọc `GET /me` và sửa hồ sơ qua `PATCH /me`, kể cả hệ quả lên lộ trình
// (đổi mục tiêu/trình độ sinh lộ trình mới) và đổi email (T111, cần mật khẩu hiện tại).

export interface MeDto {
  id: string;
  email: string;
  role: Role;
  status: AccountStatus;
  profile: Record<string, unknown>;
}

/** Hồ sơ theo schema `Profile`: trường chưa có giá trị bị bỏ khỏi phản hồi (không phải `null`). */
export function profileToDto(profile: ProfileRow): Record<string, unknown> {
  return omitNulls({
    displayName: profile.displayName,
    currentLevel: profile.currentLevel,
    goalType: profile.goalType,
    targetLevel: profile.targetLevel,
    dailyMinutes: profile.dailyMinutes,
    targetDate: profile.targetDate,
    skills: profile.skills,
    prioritizedSkill: profile.prioritizedSkill,
    language: profile.language,
    timezone: profile.timezone,
    paused: profile.paused,
    onboardingState: profile.onboardingState,
  });
}

export async function getMe(deps: Pick<ServiceDeps, 'db'>, userId: string): Promise<MeDto> {
  const [user, profile] = await Promise.all([
    findUserById(deps.db, userId),
    getProfile(deps.db, userId),
  ]);
  if (!user || !profile) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy tài khoản');
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    profile: profileToDto(profile),
  };
}

/** Trường chỉ sửa được sau khi hoàn tất onboarding vì có hệ quả lên lộ trình/kế hoạch. */
const PATH_FIELDS = [
  'currentLevel',
  'goalType',
  'targetLevel',
  'targetDate',
  'prioritizedSkill',
] as const;

function validationFailed(fields: Record<string, string>): AppError {
  return new AppError(422, 'VALIDATION_FAILED', 'Dữ liệu không hợp lệ', fields);
}

interface ResolvedPathFields {
  goalType: ProfileRow['goalType'];
  targetLevel: ProfileRow['targetLevel'];
  targetDate: ProfileRow['targetDate'];
  goalChanged: boolean;
  levelChanged: boolean;
}

/** Giá trị mục tiêu sau khi sửa (kèm kiểm tra) và việc có thay đổi thật so với hồ sơ hiện tại. */
function resolvePathFields(
  deps: Pick<ServiceDeps, 'clock'>,
  profile: ProfileRow,
  input: ProfileUpdateInput,
): ResolvedPathFields {
  const goalType = input.goalType ?? profile.goalType;
  const targetDate = input.targetDate !== undefined ? input.targetDate : profile.targetDate;
  const errors: Record<string, string> = {};

  // Mức JLPT chỉ có ý nghĩa với mục tiêu JLPT; mục tiêu khác thì không giữ lại.
  let targetLevel: ProfileRow['targetLevel'] = null;
  if (goalType === 'jlpt') {
    targetLevel = input.targetLevel ?? profile.targetLevel;
    if (!targetLevel) errors.targetLevel = 'Mục tiêu JLPT cần chọn cấp độ muốn đạt';
  }

  if (input.targetDate && input.targetDate !== profile.targetDate) {
    if (input.targetDate < localToday(deps.clock, input.timezone ?? profile.timezone)) {
      errors.targetDate = 'Mốc thời gian phải từ hôm nay trở đi';
    }
  }
  if (input.prioritizedSkill && !profile.skills.includes(input.prioritizedSkill)) {
    errors.prioritizedSkill = 'Kỹ năng ưu tiên phải nằm trong các kỹ năng đã chọn';
  }
  if (Object.keys(errors).length > 0) throw validationFailed(errors);

  return {
    goalType,
    targetLevel,
    targetDate,
    goalChanged:
      goalType !== profile.goalType ||
      targetLevel !== profile.targetLevel ||
      targetDate !== profile.targetDate,
    levelChanged: input.currentLevel !== undefined && input.currentLevel !== profile.currentLevel,
  };
}

/**
 * `PATCH /me`: sửa hồ sơ (FR-002, FR-016, SC-006).
 * - `displayName`, `language`, `timezone`: chỉ lưu.
 * - `email`: bắt buộc `currentPassword` đúng (401), từ chối email trùng (409 `EMAIL_TAKEN` /
 *   `EMAIL_PENDING_DELETION`); lưu cùng giao dịch với phần còn lại.
 * - `dailyMinutes`, `prioritizedSkill`: lưu và áp dụng trực tiếp cho kế hoạch được sinh kế tiếp, KHÔNG
 *   sinh lộ trình mới (`rankUnits` đọc `prioritized_skill` từ hồ sơ).
 * - `goalType`/`targetLevel`/`targetDate` đổi giá trị → lộ trình mới `reason='goal_change'`;
 *   `currentLevel` đổi giá trị → lộ trình mới `reason='level_change'` (kết quả placement cũ không còn
 *   quyết định điểm xuất phát vì người học đã tự khai báo lại trình độ). Cả hai đổi → `goal_change`.
 * Lộ trình cũ chuyển `superseded`; `unit_progress`, `study_records`, `review_schedules`, `topic_stats`
 * giữ nguyên (data-model §2.11). Hồ sơ và lộ trình mới được lưu trong cùng một giao dịch.
 */
export async function updateMe(
  deps: Pick<ServiceDeps, 'db' | 'clock'>,
  userId: string,
  input: ProfileUpdateInput,
): Promise<MeDto> {
  const emailChange =
    input.email !== undefined
      ? await prepareEmailChange(deps.db, userId, input.email, input.currentPassword)
      : null;

  const profile = await getProfile(deps.db, userId);
  if (!profile) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy tài khoản');

  const touched = PATH_FIELDS.filter((field) => input[field] !== undefined);
  if (touched.length > 0 && profile.onboardingState !== 'completed') {
    throw validationFailed(
      Object.fromEntries(
        touched.map((f) => [f, 'Hãy hoàn tất onboarding trước khi sửa trường này']),
      ),
    );
  }

  const next = resolvePathFields(deps, profile, input);
  const patch: ProfilePatch = {
    ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
    ...(input.language !== undefined ? { language: input.language } : {}),
    ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
    ...(input.dailyMinutes !== undefined ? { dailyMinutes: input.dailyMinutes } : {}),
    ...(input.prioritizedSkill !== undefined ? { prioritizedSkill: input.prioritizedSkill } : {}),
    ...(input.currentLevel !== undefined ? { currentLevel: input.currentLevel } : {}),
    ...(input.goalType !== undefined || input.targetLevel !== undefined
      ? { goalType: next.goalType, targetLevel: next.targetLevel }
      : {}),
    ...(input.targetDate !== undefined ? { targetDate: next.targetDate } : {}),
  };

  const reason: PathReason | null = next.goalChanged
    ? 'goal_change'
    : next.levelChanged
      ? 'level_change'
      : null;

  await deps.db.transaction(async (tx) => {
    const now = deps.clock.now();
    if (emailChange) await applyEmailChange(tx, userId, emailChange, now);
    const updated = await updateProfile(tx, userId, patch, now);
    if (!reason) return;
    // Đổi mục tiêu giữ kết quả placement lộ trình cũ đang dùng; đổi trình độ tự khai báo thì bỏ nó.
    let placement: PlacementResultRow | null = null;
    if (reason === 'goal_change') {
      const previous = await getActivePath(tx, userId);
      const previousId = previous ? paramsOfPath(previous).placementResultId : null;
      placement = previousId ? ((await getPlacementById(tx, userId, previousId)) ?? null) : null;
    }
    await createPath(tx, userId, reason, paramsFor(updated, placement));
  });
  return getMe(deps, userId);
}
