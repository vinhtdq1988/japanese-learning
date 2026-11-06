import { z } from 'zod';
import { isValidTimezone } from '../engine/clock.js';
import {
  DAILY_MINUTES,
  GOAL_TYPES,
  LANGUAGES,
  LEVELS,
  SKILLS,
  TARGET_LEVELS,
  type DailyMinutes,
  type Skill,
} from './types.js';

// Quy tắc kiểm tra dữ liệu người dùng nhập (đăng ký, hồ sơ, onboarding). Thông báo lỗi cụ thể theo
// trường, bằng tiếng Việt (FR-001, spec "trường hợp biên": email sai định dạng/mật khẩu yếu).

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

/** Mật khẩu phổ biến bị từ chối (so khớp không phân biệt hoa thường). */
const COMMON_PASSWORDS = new Set([
  'password',
  'password1',
  '12345678',
  '123456789',
  '1234567890',
  'qwertyui',
  'qwertyuiop',
  'iloveyou',
  'abc12345',
  'matkhau123',
]);

export const emailSchema = z
  .string({ error: 'Email là bắt buộc' })
  .trim()
  .max(254, 'Email quá dài')
  .pipe(z.email('Email không đúng định dạng'));

export const passwordSchema = z
  .string({ error: 'Mật khẩu là bắt buộc' })
  .min(MIN_PASSWORD_LENGTH, `Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự`)
  .max(MAX_PASSWORD_LENGTH, `Mật khẩu tối đa ${MAX_PASSWORD_LENGTH} ký tự`)
  .refine(
    (value) => new Set(value).size >= 4 && !COMMON_PASSWORDS.has(value.toLowerCase()),
    'Mật khẩu quá yếu: không dùng mật khẩu phổ biến hoặc lặp lại một vài ký tự',
  );

export const displayNameSchema = z
  .string({ error: 'Tên hiển thị là bắt buộc' })
  .trim()
  .min(1, 'Tên hiển thị không được để trống')
  .max(60, 'Tên hiển thị tối đa 60 ký tự');

export const languageSchema = z.enum(LANGUAGES, { error: 'Ngôn ngữ phải là vi hoặc en' });

export const timezoneSchema = z
  .string({ error: 'Múi giờ phải là chuỗi' })
  .refine(isValidTimezone, 'Múi giờ không hợp lệ (cần tên IANA, ví dụ Asia/Ho_Chi_Minh)');

export const levelSchema = z.enum(LEVELS, { error: 'Trình độ không hợp lệ' });
export const targetLevelSchema = z.enum(TARGET_LEVELS, { error: 'Mục tiêu JLPT không hợp lệ' });
export const goalTypeSchema = z.enum(GOAL_TYPES, { error: 'Mục tiêu học không hợp lệ' });

export const dailyMinutesSchema = z
  .number({ error: 'Thời gian mỗi ngày phải là số phút' })
  .refine(
    (value): value is DailyMinutes => (DAILY_MINUTES as readonly number[]).includes(value),
    `Thời gian mỗi ngày phải là một trong ${DAILY_MINUTES.join(', ')} phút`,
  );

export const targetDateSchema = z.iso.date('Mốc thời gian phải có dạng YYYY-MM-DD');

/**
 * Kỹ năng hỗ trợ: từ vựng, ngữ pháp và Kanji (spec 003); nghe, đọc bị từ chối với thông điệp
 * "chưa có trong phiên bản này". Phải là tập con không rỗng, không trùng.
 */
export const skillsSchema = z
  .array(z.string({ error: 'Kỹ năng không hợp lệ' }), { error: 'Kỹ năng phải là danh sách' })
  .min(1, 'Chọn ít nhất một kỹ năng')
  // Lỗi đặt ở chính mảng (khóa `skills`), không theo từng phần tử (`skills.1`) để client hiển thị một chỗ.
  .refine((skills) => skills.every((s) => (SKILLS as readonly string[]).includes(s)), {
    error: 'Kỹ năng này chưa có trong phiên bản hiện tại',
  })
  .transform((skills) => [...new Set(skills)] as Skill[]);

// --- Đăng ký / đăng nhập ---

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: displayNameSchema,
  language: languageSchema.optional(),
  timezone: timezoneSchema.optional(),
  fromTrial: z.boolean().optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string({ error: 'Mật khẩu là bắt buộc' }).min(1, 'Mật khẩu là bắt buộc'),
});

export const refreshSchema = z.object({
  refreshToken: z.string({ error: 'refreshToken là bắt buộc' }).min(1, 'refreshToken là bắt buộc'),
});

export const passwordResetRequestSchema = z.object({ email: emailSchema });

export const passwordResetConfirmSchema = z.object({
  token: z.string({ error: 'Token là bắt buộc' }).min(1, 'Token là bắt buộc'),
  newPassword: passwordSchema,
});

// --- Onboarding ---

/** Bản nháp onboarding: mọi trường tùy chọn (người học nhập dần từng bước). */
export const onboardingDraftSchema = z.object({
  currentLevel: levelSchema.optional(),
  goalType: goalTypeSchema.optional(),
  targetLevel: targetLevelSchema.nullable().optional(),
  dailyMinutes: dailyMinutesSchema.optional(),
  targetDate: targetDateSchema.nullable().optional(),
  skills: skillsSchema.optional(),
  placementResultId: z.uuid('placementResultId không hợp lệ').nullable().optional(),
  timezone: timezoneSchema.optional(),
});
export type OnboardingDraftInput = z.infer<typeof onboardingDraftSchema>;

/** Hoàn tất onboarding: các trường bắt buộc phải đủ; `targetLevel` bắt buộc khi mục tiêu là JLPT. */
export const onboardingCompleteSchema = onboardingDraftSchema
  .extend({
    currentLevel: levelSchema,
    goalType: goalTypeSchema,
    dailyMinutes: dailyMinutesSchema,
    skills: skillsSchema,
  })
  .superRefine((value, ctx) => {
    if (value.goalType === 'jlpt' && !value.targetLevel) {
      ctx.addIssue({
        code: 'custom',
        path: ['targetLevel'],
        message: 'Mục tiêu JLPT cần chọn cấp độ muốn đạt',
      });
    }
  });
export type OnboardingCompleteInput = z.infer<typeof onboardingCompleteSchema>;

// --- Sửa hồ sơ ---

export const profileUpdateSchema = z.object({
  displayName: displayNameSchema.optional(),
  email: emailSchema.optional(),
  currentPassword: z.string().optional(),
  currentLevel: levelSchema.optional(),
  dailyMinutes: dailyMinutesSchema.optional(),
  goalType: goalTypeSchema.optional(),
  targetLevel: targetLevelSchema.optional(),
  targetDate: targetDateSchema.nullable().optional(),
  prioritizedSkill: z.enum(SKILLS, { error: 'Kỹ năng không hợp lệ' }).nullable().optional(),
  // Đổi kỹ năng KHÔNG sinh lộ trình mới; `prioritizedSkill` phải thuộc `skills` (kiểm ở dịch vụ hồ sơ).
  skills: skillsSchema.optional(),
  language: languageSchema.optional(),
  timezone: timezoneSchema.optional(),
});
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

// --- Mật khẩu, xóa tài khoản ---

export const passwordChangeSchema = z.object({
  currentPassword: z
    .string({ error: 'Mật khẩu hiện tại là bắt buộc' })
    .min(1, 'Mật khẩu hiện tại là bắt buộc'),
  newPassword: passwordSchema,
});
export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;

export const accountDeleteSchema = z.object({
  password: z.string({ error: 'Mật khẩu là bắt buộc' }).min(1, 'Mật khẩu là bắt buộc'),
});

// --- Placement ---

export const placementAnswersSchema = z.object({
  durationSeconds: z
    .number({ error: 'durationSeconds phải là số giây' })
    .int('durationSeconds phải là số nguyên')
    .min(0, 'durationSeconds không được âm')
    .optional(),
  answers: z
    .array(
      z.object({
        questionId: z.uuid('questionId không hợp lệ'),
        choice: z
          .number({ error: 'choice phải là chỉ số lựa chọn hoặc null' })
          .int('choice phải là số nguyên')
          .min(0, 'choice không được âm')
          .nullable(),
      }),
      { error: 'answers phải là danh sách' },
    )
    .max(100, 'Quá nhiều câu trả lời'),
});
export type PlacementAnswersInput = z.infer<typeof placementAnswersSchema>;

export const rebuildPathSchema = z
  .object({ usePlacementResultId: z.uuid('usePlacementResultId không hợp lệ').optional() })
  .optional();

// --- Ghi đè lộ trình ---

export const unitIdParamsSchema = z.object({
  unitId: z.uuid('unitId phải là UUID'),
});

export const itemIdParamsSchema = z.object({
  itemId: z.uuid('itemId phải là UUID'),
});

export const setMasteredSchema = z.object({
  mastered: z.boolean({ error: 'mastered phải là true hoặc false' }),
});
