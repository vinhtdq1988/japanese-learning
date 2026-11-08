import type { I18nText, Language } from './types.js';

// Kiểu và hằng miền dùng chung cho tổ chức, lớp học và lộ trình lớp (spec 004, data-model.md §2, §6,
// research O4, O8, O13, contracts/csv-formats.md). Không phụ thuộc CSDL nên engine và kiểm thử dùng được.

/** Vai trò tổ chức (không vào JWT, research O2); học viên suy ra từ thành viên lớp đang hoạt động. */
export const ORG_ROLES = ['owner', 'teacher'] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

/** Lý do kết thúc một giai đoạn thành viên lớp (khớp enum `membership_end_reason`). */
export const MEMBERSHIP_END_REASONS = [
  'switched_personal',
  'removed',
  'moved',
  'seat_revoked',
  'seat_expired',
  'org_disabled',
  'class_archived',
  'account_deleted',
] as const;
export type MembershipEndReason = (typeof MEMBERSHIP_END_REASONS)[number];

/** Trạng thái tiến độ của học viên trong lớp (research O10). */
export const CLASS_PROGRESS_STATUSES = ['on_track', 'behind', 'ahead', 'paused'] as const;
export type ClassProgressStatus = (typeof CLASS_PROGRESS_STATUSES)[number];

/** Cảnh báo dẫn xuất khi đọc, không lưu và không gửi đi (research O10, FR-031). */
export const CLASS_ALERTS = ['absent', 'behind', 'overdue_assignment'] as const;
export type ClassAlert = (typeof CLASS_ALERTS)[number];

/** Trạng thái một bài giao đối với từng học viên (dẫn xuất, research O12). */
export const ASSIGNMENT_STATES = ['pending', 'on_time', 'late', 'overdue'] as const;
export type AssignmentState = (typeof ASSIGNMENT_STATES)[number];

/** Trạng thái giấy phép tại một ngày (data-model §3.3). */
export const LICENSE_STATES = ['ok', 'expiring', 'in_grace', 'lapsed'] as const;
export type LicenseState = (typeof LICENSE_STATES)[number];

/** Kết quả của MỖI dòng nhập CSV; mỗi dòng có đúng một kết quả (csv-formats.md §1). */
export const CSV_OUTCOMES = [
  'invited',
  'invalid_email',
  'duplicate_in_file',
  'already_in_class',
  'already_in_other_class',
  'already_invited',
  'no_seat',
  'unavailable',
] as const;
export type CsvOutcome = (typeof CSV_OUTCOMES)[number];

/**
 * Trường hồ sơ/điều khiển bị khóa khi người học thuộc lớp (research O8, FR-018). Danh sách duy nhất dùng
 * chung cho lỗi `CLASS_MANAGED.fields`, `Me.classSummary.lockedFields` và kiểm thử.
 */
export const CLASS_LOCKED_PROFILE_FIELDS = [
  'dailyMinutes',
  'skills',
  'prioritizedSkill',
  'currentLevel',
  'goalType',
  'targetLevel',
  'targetDate',
] as const;
export type ClassLockedProfileField = (typeof CLASS_LOCKED_PROFILE_FIELDS)[number];

/** Mã mục dữ liệu giáo viên/chủ tổ chức xem được (FR-035, FR-036). */
export const SHARED_DATA_CODES = [
  'display_name',
  'email',
  'progress',
  'study_time',
  'review_accuracy',
  'weak_topics',
  'streak',
  'assignments',
  'placement_result',
] as const;
export type SharedDataCode = (typeof SHARED_DATA_CODES)[number];

export interface SharedDataItemDef {
  code: SharedDataCode;
  label: I18nText;
}

export interface NotVisibleDef {
  code: string;
  label: I18nText;
}

export interface LockedControlDef {
  code: ClassLockedProfileField;
  label: I18nText;
}

/**
 * Thông báo dữ liệu chia sẻ phiên bản 1 (research O4, O13): NGUỒN DUY NHẤT cho thông báo trước khi vào
 * lớp (lời mời, nhập mã) và trang "Lớp của tôi", nên hai nơi không thể lệch nhau (FR-036). Tăng `version`
 * và `consent_version` khi nội dung đổi.
 */
export const SHARED_DATA_V1 = {
  version: 1,
  visible: [
    { code: 'display_name', label: { vi: 'Tên hiển thị', en: 'Display name' } },
    { code: 'email', label: { vi: 'Email', en: 'Email' } },
    {
      code: 'progress',
      label: { vi: 'Tiến độ trong lộ trình lớp', en: 'Progress on the class path' },
    },
    {
      code: 'study_time',
      label: {
        vi: 'Thời gian học kể từ ngày vào lớp',
        en: 'Study time since you joined the class',
      },
    },
    {
      code: 'review_accuracy',
      label: { vi: 'Độ chính xác khi ôn tập', en: 'Review accuracy' },
    },
    { code: 'weak_topics', label: { vi: 'Mảng còn yếu', en: 'Weak topics' } },
    { code: 'streak', label: { vi: 'Chuỗi ngày học', en: 'Study streak' } },
    {
      code: 'assignments',
      label: {
        vi: 'Bài giao và việc hoàn thành đúng/trễ hạn',
        en: 'Assignments and on-time/late completion',
      },
    },
    {
      code: 'placement_result',
      label: {
        vi: 'Kết quả kiểm tra trình độ do lớp yêu cầu',
        en: 'Placement test results requested by the class',
      },
    },
  ] satisfies SharedDataItemDef[],
  notVisible: [
    {
      code: 'credentials',
      label: { vi: 'Mật khẩu và phiên đăng nhập', en: 'Your password and sessions' },
    },
    {
      code: 'before_joining',
      label: {
        vi: 'Hoạt động học trước ngày vào lớp',
        en: 'Anything you studied before joining the class',
      },
    },
    {
      code: 'answers',
      label: { vi: 'Từng câu trả lời của bạn', en: 'Each individual answer you gave' },
    },
    {
      code: 'other_profile',
      label: {
        vi: 'Các dữ liệu hồ sơ ngoài danh sách trên',
        en: 'Any profile data outside the list above',
      },
    },
  ] satisfies NotVisibleDef[],
  lockedControls: [
    { code: 'dailyMinutes', label: { vi: 'Thời gian học mỗi ngày', en: 'Daily study time' } },
    { code: 'skills', label: { vi: 'Kỹ năng muốn học', en: 'Skills to learn' } },
    { code: 'prioritizedSkill', label: { vi: 'Kỹ năng ưu tiên', en: 'Prioritized skill' } },
    { code: 'currentLevel', label: { vi: 'Trình độ hiện tại', en: 'Current level' } },
    { code: 'goalType', label: { vi: 'Loại mục tiêu', en: 'Goal type' } },
    { code: 'targetLevel', label: { vi: 'Mục tiêu JLPT', en: 'JLPT target' } },
    { code: 'targetDate', label: { vi: 'Ngày đạt mục tiêu', en: 'Target date' } },
  ] satisfies LockedControlDef[],
  /** Học viên rời lớp (chuyển sang lộ trình cá nhân) bất cứ lúc nào. */
  canLeaveAnytime: true,
  /**
   * Trung tâm KHÔNG tự chuyển học viên sang lớp khác: chỉ gửi lời mời chuyển lớp và học viên phải đồng ý lại
   * (chủ dự án chọn "bắt học viên đồng ý lại", research "Điểm cần xác nhận" #1, Hiến pháp III).
   */
  mayBeMovedWithinOrganization: false,
} as const;

/** DTO `SharedDataDisclosure` đã bản địa hóa (khớp openapi.yaml 1.12.0). */
export interface SharedDataDisclosureDto {
  version: number;
  visible: { code: SharedDataCode; label: string }[];
  notVisible: string[];
  lockedControls: string[];
  canLeaveAnytime: true;
  mayBeMovedWithinOrganization: false;
}

/** Dựng thông báo dữ liệu chia sẻ theo ngôn ngữ người gọi. */
export function sharedDataDisclosure(language: Language): SharedDataDisclosureDto {
  return {
    version: SHARED_DATA_V1.version,
    visible: SHARED_DATA_V1.visible.map((i) => ({ code: i.code, label: i.label[language] })),
    notVisible: SHARED_DATA_V1.notVisible.map((i) => i.label[language]),
    lockedControls: SHARED_DATA_V1.lockedControls.map((i) => i.label[language]),
    canLeaveAnytime: SHARED_DATA_V1.canLeaveAnytime,
    mayBeMovedWithinOrganization: SHARED_DATA_V1.mayBeMovedWithinOrganization,
  };
}

/** Từ khóa hành động ghi vào `admin_action_logs.action` cho tổ chức/lớp (data-model §4). */
export const ORG_LOG_ACTIONS = [
  'org.create',
  'org.rename',
  'org.disable',
  'org.enable',
  'license.create',
  'license.adjust',
  'license.revoke',
  'seat.assign',
  'seat.revoke',
  'teacher.invite',
  'teacher.remove',
  'owner.invite',
  'invitation.revoke',
  'class.create',
  'class.archive',
  'class.update',
  'class.teachers',
  'class.invite',
  'class.join',
  'class.leave',
  'class.move_student',
  'class.remove_student',
  'class.path_update',
  'class.assign',
  'class.override',
  'class.pause',
  'class.join_code',
  'class.export',
  'class.placement_request',
] as const;
export type OrgLogAction = (typeof ORG_LOG_ACTIONS)[number];

/** Giá trị `admin_action_logs.target_type` cho hành động tổ chức/lớp. */
export const ORG_LOG_TARGET_TYPES = [
  'organization',
  'license',
  'seat',
  'class',
  'membership',
  'assignment',
  'invitation',
] as const;
export type OrgLogTargetType = (typeof ORG_LOG_TARGET_TYPES)[number];

/** Khóa sắp xếp và bộ lọc của bảng điều khiển lớp (api-changes §10). */
export const DASHBOARD_SORTS = [
  'name',
  'completion',
  'streak',
  'minutes7',
  'accuracy',
  'lastActive',
  'status',
] as const;
export type DashboardSort = (typeof DASHBOARD_SORTS)[number];

export const DASHBOARD_FILTERS = [
  'behind',
  'absent',
  'needs_attention',
  'paused',
  'not_started',
] as const;
export type DashboardFilter = (typeof DASHBOARD_FILTERS)[number];
