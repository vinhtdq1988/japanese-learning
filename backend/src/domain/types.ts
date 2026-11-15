// Kiểu miền dùng chung cho backend (khớp data-model.md và contracts/openapi.yaml).

/** Trình độ tự khai báo / ước tính (N2, N1 chỉ có ở khai báo, nội dung chỉ đến N3). */
export const LEVELS = ['none', 'N5', 'N4', 'N3', 'N2', 'N1'] as const;
export type Level = (typeof LEVELS)[number];

/** Trình độ của nội dung học (Giai đoạn 1 chỉ N5–N3). */
export const CONTENT_LEVELS = ['N5', 'N4', 'N3'] as const;
export type ContentLevel = (typeof CONTENT_LEVELS)[number];

/** Mục tiêu JLPT: nhận N5–N1, nội dung giới hạn ở N3 (`scopeNotice`). */
export const TARGET_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'] as const;
export type TargetLevel = (typeof TARGET_LEVELS)[number];

export const SKILLS = ['vocabulary', 'grammar', 'kanji', 'reading', 'writing'] as const;
export type Skill = (typeof SKILLS)[number];

/** Kỹ năng luyện đọc/viết: chỉ dành cho người học có quỹ thời gian từ 30 phút/ngày (spec 007). */
export const PRACTICE_SKILLS = ['reading', 'writing'] as const;
export type PracticeSkill = (typeof PRACTICE_SKILLS)[number];

/** Kỹ năng có trong bài kiểm tra trình độ (Kanji ngoài phạm vi – research K12). */
export const PLACEMENT_SKILLS = ['vocabulary', 'grammar'] as const;
export type PlacementSkill = (typeof PLACEMENT_SKILLS)[number];

/** Kỹ năng có trong nội dung dùng thử không cần đăng ký (Kanji ngoài phạm vi). */
export const TRIAL_SKILLS = ['vocabulary', 'grammar'] as const;
export type TrialSkill = (typeof TRIAL_SKILLS)[number];

/**
 * Khía cạnh ôn tập (research K3): `item` cho từ vựng/ngữ pháp và bài tập không gắn chữ; Kanji dùng
 * meaning | reading | word – mỗi cặp (chữ, khía cạnh) có lịch ôn riêng.
 */
export const REVIEW_FACETS = ['item', 'meaning', 'reading', 'word'] as const;
export type ReviewFacet = (typeof REVIEW_FACETS)[number];

/** Ba khía cạnh nhận diện của chữ Kanji (nghĩa, cách đọc, từ chứa chữ). */
export const KANJI_FACETS = ['meaning', 'reading', 'word'] as const;
export type KanjiFacet = (typeof KANJI_FACETS)[number];

export const GOAL_TYPES = ['jlpt', 'daily_conversation', 'work'] as const;
export type GoalType = (typeof GOAL_TYPES)[number];

export const LANGUAGES = ['vi', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = 'vi';

export const ROLES = ['learner', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const ACCOUNT_STATUSES = ['active', 'disabled', 'pending_deletion'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const UNIT_TIERS = ['foundation', 'core'] as const;
export type UnitTier = (typeof UNIT_TIERS)[number];

export const UNIT_STATUSES = ['draft', 'active', 'inactive'] as const;
export type UnitStatus = (typeof UNIT_STATUSES)[number];

export const EXERCISE_TYPES = ['multiple_choice', 'matching', 'fill_blank'] as const;
export type ExerciseType = (typeof EXERCISE_TYPES)[number];

/** Thời lượng ước tính hợp lệ của một đơn vị học (FR-017). */
export const UNIT_EST_MINUTES = [5, 10, 15] as const;
export type UnitEstMinutes = (typeof UNIT_EST_MINUTES)[number];

/** Quỹ thời gian mỗi ngày người học có thể khai báo (FR-005). */
export const DAILY_MINUTES = [5, 10, 15, 30] as const;
export type DailyMinutes = (typeof DAILY_MINUTES)[number];

/** Văn bản dịch (`i18n_text`): chứa đủ vi + en. */
export type I18nText = Record<Language, string>;

/** Chi tiết riêng của chữ Kanji (`content_items.kanji_details`, data-model §3.4). */
export interface KanjiDetails {
  /** Âm On (katakana); có thể rỗng. */
  onReadings: string[];
  /** Âm Kun (hiragana, `.` phân cách okurigana); có thể rỗng. */
  kunReadings: string[];
  strokeCount: number;
  components?: I18nText | null;
}

// --- Nội dung N4 → N3 đầy đủ (spec 008): siêu dữ liệu biên soạn, danh mục phạm vi, đợt phát hành ---
// Các kiểu dưới đây mô tả dữ liệu ở FILE (`content/`); chúng KHÔNG vào CSDL.

/** Dạng câu hỏi đề thi JLPT mà bài tập thể hiện (content-authoring.md §3); chỉ là siêu dữ liệu file. */
export const EXERCISE_FORMATS = [
  'kanji_reading',
  'orthography',
  'context_fill',
  'synonym',
  'usage',
  'form_fill',
  'sentence_correct',
  'sentence_order_star',
  'text_grammar',
  'contrast',
  'comprehension_short',
  'comprehension_mid',
  'info_search',
] as const;
export type ExerciseFormat = (typeof EXERCISE_FORMATS)[number];

/** Loại có danh mục phạm vi (luyện viết không có danh mục riêng). */
export const SCOPE_KINDS = ['kanji', 'vocabulary', 'grammar', 'reading'] as const;
export type ScopeKind = (typeof SCOPE_KINDS)[number];

/** Nguồn tham khảo của danh mục/đợt: chỉ ghi phạm vi đã tham khảo, không dán nội dung có bản quyền. */
export interface ScopeSource {
  name: string;
  note: string;
}

/** Một dòng danh mục phạm vi (`content/scope/*.json`, data-model §2). */
export interface ScopeRow {
  /** Ổn định, không đổi/tái sử dụng: `k-n4-012`, `v-n3-0450`, `g-n4-023`, `r-n3-form-notice`. */
  id: string;
  /** Kanji = ký tự; từ vựng = `japanese|reading`; ngữ pháp/đọc = mẫu viết tự do. */
  key: string;
  label?: I18nText;
  sources: string[];
  exclude?: { reason: string };
  /** Chỉ dòng `reading`: số đơn vị tối thiểu để coi là phủ (mặc định 1). */
  minUnits?: number;
}

export interface ScopeFile {
  kind: ScopeKind;
  /** N4/N3 với danh mục theo dõi độ phủ; N5 chỉ ở file tham chiếu. */
  level: Level;
  reference: boolean;
  sources: Record<string, ScopeSource>;
  rows: ScopeRow[];
  /** Tên file nguồn (do loader gắn), dùng trong thông báo lỗi. */
  file?: string;
}

/** Trạng thái phủ của một dòng danh mục — SUY RA từ đơn vị đã duyệt, không lưu. */
export type ScopeRowStatus = 'excluded' | 'covered' | 'uncovered';

export type CoverageViolationType =
  'duplicate_primary' | 'unknown_scope_ref' | 'missing_reason' | 'duplicate_key' | 'level_mismatch';

export interface CoverageViolation {
  type: CoverageViolationType;
  message: string;
  /** Dòng danh mục/đơn vị liên quan (nếu có). */
  id?: string;
  file?: string;
}

/** Báo cáo mức phủ (data-model §3). `percent` = covered / (total − excluded), 0..1 (1 khi mẫu số = 0). */
export interface CoverageReport {
  byKindLevel: {
    kind: ScopeKind;
    level: ContentLevel;
    total: number;
    covered: number;
    excluded: number;
    uncovered: number;
    percent: number;
  }[];
  uncovered: { id: string; key: string; level: ContentLevel; kind: ScopeKind }[];
  excluded: { id: string; key: string; reason: string }[];
  violations: CoverageViolation[];
}

/** Tham chiếu một file đơn vị trong đợt; đợt baseline chỉ bắt buộc `file`. */
export interface ReleaseUnitRef {
  file: string;
  reviewer?: string;
  /** `YYYY-MM-DD`. */
  reviewedOn?: LocalDate;
  checklist?: true;
}

/** Bổ sung chỉ-thêm cho chữ Kanji đã có (data-model §4.1). */
export interface Amendment {
  unit: { kind: 'kanji'; level: ContentLevel; titleEn: string };
  /** Ký tự Kanji. */
  item: string;
  add: {
    onReadings?: string[];
    kunReadings?: string[];
    examples?: {
      ja: string;
      reading?: string;
      kanjiReading?: string;
      translation: I18nText;
    }[];
    exercises?: {
      item?: string;
      facet: 'reading' | 'word';
      type: ExerciseType;
      prompt: I18nText;
      payload: Record<string, unknown>;
      feedbackCorrect: I18nText;
      feedbackIncorrect: I18nText;
    }[];
  };
}

/** Đợt phát hành nội dung (`content/releases/NNN-*.json`, data-model §4). */
export interface ReleaseManifest {
  id: string;
  date: LocalDate;
  title: I18nText;
  baseline?: boolean;
  sources?: ScopeSource[];
  units: ReleaseUnitRef[];
  amendments?: Amendment[];
  notes?: string;
}

/** Ngày địa phương dạng `YYYY-MM-DD` (không kèm múi giờ). */
export type LocalDate = string;

/** Mã lỗi máy đọc được trả về trong schema `Error` của openapi.yaml. */
export const ERROR_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'EMAIL_TAKEN',
  'EMAIL_PENDING_DELETION',
  'ACCOUNT_DISABLED',
  'ACCOUNT_PENDING_DELETION',
  'ACCOUNT_DELETED',
  'RESET_TOKEN_INVALID',
  'PLACEMENT_SET_INVALID',
  'PATH_PAUSED',
  'SESSION_INCOMPLETE',
  'SESSION_COMPLETED',
  'CONTENT_EXHAUSTED',
  'TOO_MANY_REQUESTS',
  // Tổ chức, lớp học và seat (spec 004)
  'CLASS_MANAGED',
  'SEAT_UNAVAILABLE',
  'SEAT_REASSIGN_LIMIT',
  'SEAT_BELOW_USAGE',
  'CLASS_NOT_READY',
  'CLASS_FULL',
  'CLASS_ARCHIVED',
  'LAST_TEACHER',
  'ALREADY_IN_CLASS',
  'INVITEE_UNAVAILABLE',
  // Luyện đọc/viết (spec 007)
  'PRACTICE_LOCKED',
  'INTERNAL_ERROR',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

/** Lỗi nghiệp vụ có mã HTTP và mã máy đọc được; bộ xử lý lỗi của Fastify ánh xạ sang schema `Error`. */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly fields?: Record<string, string>,
    /** Header phản hồi đi kèm (ví dụ `Retry-After` của 429 nhập mã tham gia). */
    public readonly headers?: Record<string, string>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
