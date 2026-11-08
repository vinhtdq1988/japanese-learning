import { omitNulls } from '../api/http.js';
import { getActivePath } from '../db/repositories/paths.js';
import { getDisplayLicense } from '../db/repositories/organizations.js';
import { getPlacementById, type PlacementResultRow } from '../db/repositories/placement.js';
import {
  getProfile,
  updateProfile,
  type ProfilePatch,
  type ProfileRow,
} from '../db/repositories/profiles.js';
import { findUserById } from '../db/repositories/users.js';
import type { ProfileUpdateInput } from '../domain/profile-validation.js';
import { CLASS_LOCKED_PROFILE_FIELDS } from '../domain/org-types.js';
import { AppError, type AccountStatus, type Role } from '../domain/types.js';
import { localToday } from '../engine/clock.js';
import { applyEmailChange, prepareEmailChange } from './account.js';
import { assertNotClassManaged } from './class-lock.js';
import type { ServiceDeps } from './deps.js';
import { resolveLearningContext } from './learning-context.js';
import { loadOrgContext } from './org-access.js';
import { licenseView, type LicenseViewDto } from './org-dto.js';
import { createPath, paramsFor, paramsOfPath, type PathReason } from './path.js';

// Dịch vụ hồ sơ (T047, T093): đọc `GET /me` và sửa hồ sơ qua `PATCH /me`, kể cả hệ quả lên lộ trình
// (đổi mục tiêu/trình độ sinh lộ trình mới) và đổi email (T111, cần mật khẩu hiện tại).

/** Vai trò tổ chức của chủ tổ chức/giáo viên, để giao diện hiện đúng khu vực và cảnh báo hết hạn (FR-006). */
export interface MeOrganizationDto {
  id: string;
  name: string;
  roles: ('owner' | 'teacher')[];
  /** `false` khi mất seat/hết hạn/tổ chức bị vô hiệu hóa: chỉ xem cấu trúc (FR-038). */
  dataAccess: boolean;
  /** `null` khi tổ chức chưa có giấy phép nào. */
  license: LicenseViewDto | null;
}

/** Tóm tắt lớp của học viên thuộc lớp; `lockedFields` để client hiện khóa kèm lý do (FR-018). */
export interface MeClassSummaryDto {
  classId: string;
  className: string;
  organizationName: string;
  lockedFields: string[];
}

export interface MeDto {
  id: string;
  email: string;
  role: Role;
  status: AccountStatus;
  profile: Record<string, unknown>;
  /** Nguồn học hiện tại; `class` khi người học thuộc lớp (US3). */
  learningSource: 'personal' | 'class';
  /** Chỉ khi `learningSource = 'class'`. */
  classSummary?: MeClassSummaryDto;
  organization?: MeOrganizationDto;
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
    soundEnabled: profile.soundEnabled,
    visualEffectsEnabled: profile.visualEffectsEnabled,
  });
}

export async function getMe(
  deps: Pick<ServiceDeps, 'config' | 'db' | 'clock'>,
  userId: string,
): Promise<MeDto> {
  const [user, profile] = await Promise.all([
    findUserById(deps.db, userId),
    getProfile(deps.db, userId),
  ]);
  if (!user || !profile) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy tài khoản');
  const me: MeDto = {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    profile: profileToDto(profile),
    learningSource: 'personal',
  };
  // Học viên thuộc lớp: nguồn học là lớp và các điều khiển lộ trình cá nhân bị khóa (US3).
  const learning = await resolveLearningContext(deps, userId);
  if (learning?.source === 'class') {
    me.learningSource = 'class';
    me.classSummary = {
      classId: learning.classInfo.id,
      className: learning.classInfo.name,
      organizationName: learning.classInfo.organizationName,
      lockedFields: [...CLASS_LOCKED_PROFILE_FIELDS],
    };
  }
  // Vai trò tổ chức tra CSDL mỗi lần (không vào JWT) nên gỡ vai trò có hiệu lực ngay (research O2).
  const org = await loadOrgContext(deps, userId);
  if (org && (org.isOwner || org.isTeacher)) {
    const license = await getDisplayLicense(
      deps.db,
      org.organizationId,
      localToday(deps.clock, deps.config.ORG_TIMEZONE),
    );
    me.organization = {
      id: org.organizationId,
      name: org.organizationName,
      roles: [
        ...(org.isOwner ? (['owner'] as const) : []),
        ...(org.isTeacher ? (['teacher'] as const) : []),
      ],
      dataAccess: org.dataAccess,
      license: license
        ? licenseView(license, localToday(deps.clock, deps.config.ORG_TIMEZONE), deps.config)
        : null,
    };
  }
  return me;
}

/** Trường chỉ sửa được sau khi hoàn tất onboarding vì có hệ quả lên lộ trình/kế hoạch. */
const PATH_FIELDS = [
  'currentLevel',
  'goalType',
  'targetLevel',
  'targetDate',
  'prioritizedSkill',
  'skills',
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
  skillsAfter: readonly string[],
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
  if (input.prioritizedSkill && !skillsAfter.includes(input.prioritizedSkill)) {
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
 * - `soundEnabled`, `visualEffectsEnabled` (spec 005): chỉ lưu; không sinh lại lộ trình, không đụng kế hoạch,
 *   không cần `currentPassword` và KHÔNG bị khóa khi người học thuộc lớp (không nằm trong
 *   `CLASS_LOCKED_PROFILE_FIELDS`).
 * - `email`: bắt buộc `currentPassword` đúng (401), từ chối email trùng (409 `EMAIL_TAKEN` /
 *   `EMAIL_PENDING_DELETION`); lưu cùng giao dịch với phần còn lại.
 * - `dailyMinutes`, `prioritizedSkill`: lưu và áp dụng trực tiếp cho kế hoạch được sinh kế tiếp, KHÔNG
 *   sinh lộ trình mới (`rankUnits` đọc `prioritized_skill` từ hồ sơ).
 * - `skills` (spec 003, FR-007, FR-010): như `dailyMinutes`, KHÔNG sinh lộ trình mới và không đụng
 *   `unit_progress`/`study_records`/`review_schedules`/`topic_stats`; có hiệu lực ở kế hoạch sinh kế tiếp
 *   (kế hoạch đã sinh hôm nay không đổi). `prioritizedSkill` hiện tại không còn thuộc `skills` mới thì được
 *   đặt `null` trong cùng giao dịch; `kanji_selected_at` đặt `now()` khi Kanji được thêm, giữ khi bỏ chọn.
 * - `goalType`/`targetLevel`/`targetDate` đổi giá trị → lộ trình mới `reason='goal_change'`;
 *   `currentLevel` đổi giá trị → lộ trình mới `reason='level_change'` (kết quả placement cũ không còn
 *   quyết định điểm xuất phát vì người học đã tự khai báo lại trình độ). Cả hai đổi → `goal_change`.
 * Lộ trình cũ chuyển `superseded`; `unit_progress`, `study_records`, `review_schedules`, `topic_stats`
 * giữ nguyên (data-model §2.11). Hồ sơ và lộ trình mới được lưu trong cùng một giao dịch.
 */
export async function updateMe(
  deps: Pick<ServiceDeps, 'config' | 'db' | 'clock'>,
  userId: string,
  input: ProfileUpdateInput,
): Promise<MeDto> {
  const emailChange =
    input.email !== undefined
      ? await prepareEmailChange(deps.db, userId, input.email, input.currentPassword)
      : null;

  const profile = await getProfile(deps.db, userId);
  if (!profile) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy tài khoản');

  // Trường lộ trình/mục tiêu/thời gian do lớp quyết định (displayName, language, timezone, email vẫn được sửa).
  const lockedTouched = CLASS_LOCKED_PROFILE_FIELDS.filter((field) => input[field] !== undefined);
  if (lockedTouched.length > 0) await assertNotClassManaged(deps.db, userId, lockedTouched);

  const touched = PATH_FIELDS.filter((field) => input[field] !== undefined);
  if (touched.length > 0 && profile.onboardingState !== 'completed') {
    throw validationFailed(
      Object.fromEntries(
        touched.map((f) => [f, 'Hãy hoàn tất onboarding trước khi sửa trường này']),
      ),
    );
  }

  const skillsAfter = input.skills ?? profile.skills;
  const next = resolvePathFields(deps, profile, input, skillsAfter);
  const now = deps.clock.now();
  // Bỏ kỹ năng đang ưu tiên khỏi `skills` thì ưu tiên tự về null (trừ khi request đặt ưu tiên mới hợp lệ).
  const prioritizedAfter =
    input.prioritizedSkill !== undefined ? input.prioritizedSkill : profile.prioritizedSkill;
  const clearPriority =
    input.prioritizedSkill === undefined &&
    prioritizedAfter !== null &&
    !skillsAfter.includes(prioritizedAfter);
  const kanjiAdded = skillsAfter.includes('kanji') && !profile.skills.includes('kanji');
  const patch: ProfilePatch = {
    ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
    ...(input.language !== undefined ? { language: input.language } : {}),
    ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
    ...(input.soundEnabled !== undefined ? { soundEnabled: input.soundEnabled } : {}),
    ...(input.visualEffectsEnabled !== undefined
      ? { visualEffectsEnabled: input.visualEffectsEnabled }
      : {}),
    ...(input.dailyMinutes !== undefined ? { dailyMinutes: input.dailyMinutes } : {}),
    ...(input.skills !== undefined ? { skills: input.skills } : {}),
    ...(input.prioritizedSkill !== undefined ? { prioritizedSkill: input.prioritizedSkill } : {}),
    ...(clearPriority ? { prioritizedSkill: null } : {}),
    ...(kanjiAdded ? { kanjiSelectedAt: now } : {}),
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
