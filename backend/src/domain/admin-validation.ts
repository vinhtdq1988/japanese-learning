import { z } from 'zod';
import {
  CONTENT_LEVELS,
  EXERCISE_TYPES,
  GOAL_TYPES,
  SKILLS,
  UNIT_EST_MINUTES,
  UNIT_STATUSES,
} from './types.js';

// Kiểm tra cấu trúc dữ liệu vào của `/admin/*` (T104–T107). Đây là lớp kiểm tra HÌNH DẠNG (kiểu, enum,
// độ dài) để bản nháp lưu được dở dang; quy tắc NỘI DUNG đầy đủ (bản dịch vi + en, đáp án hợp lệ…) nằm
// ở `content-validation.ts` và chỉ bắt buộc khi đơn vị `active` (kích hoạt hoặc sửa đơn vị đang hoạt động).

const MAX_TEXT = 5000;
const MAX_TITLE = 200;

/** Văn bản dịch cho bản nháp: đủ hai khóa nhưng cho phép trống (độ đầy đủ kiểm tra khi kích hoạt). */
const i18nDraft = (max: number) =>
  z.object(
    {
      vi: z.string({ error: 'Thiếu bản dịch vi' }).max(max, `Tối đa ${max} ký tự`),
      en: z.string({ error: 'Thiếu bản dịch en' }).max(max, `Tối đa ${max} ký tự`),
    },
    { error: 'Cần văn bản dịch dạng { vi, en }' },
  );

const exampleSchema = z.object({
  ja: z.string({ error: 'Thiếu câu ví dụ tiếng Nhật' }).max(MAX_TEXT, `Tối đa ${MAX_TEXT} ký tự`),
  reading: z.string().max(MAX_TEXT).nullable().optional(),
  translation: i18nDraft(MAX_TEXT),
});

const elementStatusSchema = z.enum(['active', 'inactive'], {
  error: 'status phải là active hoặc inactive',
});

const itemSchema = z.object({
  id: z.uuid('id của mục không hợp lệ').optional(),
  status: elementStatusSchema.optional(),
  japanese: z
    .string({ error: 'Thiếu chữ Nhật' })
    .trim()
    .min(1, 'Thiếu chữ Nhật')
    .max(500, 'Tối đa 500 ký tự'),
  reading: z.string().max(500, 'Tối đa 500 ký tự').nullable().optional(),
  meaning: i18nDraft(MAX_TEXT),
  explanation: i18nDraft(MAX_TEXT).nullable().optional(),
  examples: z.array(exampleSchema, { error: 'examples phải là danh sách' }).max(20).optional(),
});

const exerciseSchema = z.object({
  id: z.uuid('id của bài tập không hợp lệ').optional(),
  status: elementStatusSchema.optional(),
  itemIndex: z
    .number({ error: 'itemIndex phải là số' })
    .int('itemIndex phải là số nguyên')
    .min(0, 'itemIndex không được âm')
    .nullable()
    .optional(),
  type: z.enum(EXERCISE_TYPES, {
    error: `Loại bài tập phải thuộc ${EXERCISE_TYPES.join(', ')}`,
  }),
  prompt: i18nDraft(MAX_TEXT),
  payload: z.record(z.string(), z.unknown(), { error: 'payload phải là đối tượng JSON' }),
  feedbackCorrect: i18nDraft(MAX_TEXT),
  feedbackIncorrect: i18nDraft(MAX_TEXT),
});

/** Số mục/bài tập tối đa trong một đơn vị (đơn vị là bài 5–15 phút, nên rất nhỏ). */
const MAX_ELEMENTS = 100;

export const adminUnitWriteSchema = z
  .object({
    kind: z.enum(SKILLS, { error: `kind phải thuộc ${SKILLS.join(', ')}` }),
    title: i18nDraft(MAX_TITLE),
    level: z.enum(CONTENT_LEVELS, { error: `level phải thuộc ${CONTENT_LEVELS.join(', ')}` }),
    goalTags: z.array(z.enum(GOAL_TYPES, { error: 'Mục tiêu không hợp lệ' })).optional(),
    topicId: z.uuid('topicId không hợp lệ'),
    difficulty: z
      .number({ error: 'difficulty phải là số' })
      .int('difficulty phải là số nguyên')
      .min(1, 'difficulty từ 1 đến 5')
      .max(5, 'difficulty từ 1 đến 5'),
    tier: z.enum(['foundation', 'core'], { error: 'tier phải là foundation hoặc core' }).optional(),
    estMinutes: z
      .number({ error: 'estMinutes phải là số phút' })
      .refine(
        (v) => (UNIT_EST_MINUTES as readonly number[]).includes(v),
        `estMinutes phải thuộc ${UNIT_EST_MINUTES.join(', ')} (FR-017)`,
      ),
    sequence: z
      .number({ error: 'sequence phải là số' })
      .int('sequence phải là số nguyên')
      .min(-1_000_000)
      .max(1_000_000)
      .optional(),
    items: z.array(itemSchema, { error: 'items phải là danh sách' }).max(MAX_ELEMENTS).optional(),
    exercises: z
      .array(exerciseSchema, { error: 'exercises phải là danh sách' })
      .max(MAX_ELEMENTS)
      .optional(),
  })
  .superRefine((unit, ctx) => {
    if (unit.tier === 'foundation' && unit.level !== 'N5') {
      ctx.addIssue({
        code: 'custom',
        path: ['tier'],
        message: "tier='foundation' chỉ hợp lệ với level N5",
      });
    }
    // `items` vắng mặt = giữ mục hiện có; khi đó dịch vụ tự kiểm tra `itemIndex` theo số mục hiện có.
    const itemCount = unit.items?.length;
    unit.exercises?.forEach((ex, i) => {
      if (itemCount !== undefined && ex.itemIndex != null && ex.itemIndex >= itemCount) {
        ctx.addIssue({
          code: 'custom',
          path: ['exercises', i, 'itemIndex'],
          message: 'itemIndex nằm ngoài danh sách items',
        });
      }
    });
    const dupes = (ids: (string | undefined)[], path: 'items' | 'exercises') => {
      const seen = new Set<string>();
      ids.forEach((id, i) => {
        if (!id) return;
        if (seen.has(id)) {
          ctx.addIssue({
            code: 'custom',
            path: [path, i, 'id'],
            message: 'id bị trùng trong payload',
          });
        }
        seen.add(id);
      });
    };
    dupes(unit.items?.map((x) => x.id) ?? [], 'items');
    dupes(unit.exercises?.map((x) => x.id) ?? [], 'exercises');
  });
export type AdminUnitWriteInput = z.infer<typeof adminUnitWriteSchema>;
export type AdminItemWrite = NonNullable<AdminUnitWriteInput['items']>[number];
export type AdminExerciseWrite = NonNullable<AdminUnitWriteInput['exercises']>[number];

export const adminUnitIdParamsSchema = z.object({ unitId: z.uuid('unitId phải là UUID') });

export const adminUnitListQuerySchema = z.object({
  status: z
    .enum(UNIT_STATUSES, { error: `status phải thuộc ${UNIT_STATUSES.join(', ')}` })
    .optional(),
  level: z
    .enum(CONTENT_LEVELS, { error: `level phải thuộc ${CONTENT_LEVELS.join(', ')}` })
    .optional(),
  kind: z.enum(SKILLS, { error: `kind phải thuộc ${SKILLS.join(', ')}` }).optional(),
});

export const adminUnitStatusSchema = z
  .object({
    status: z
      .enum(UNIT_STATUSES, { error: `status phải thuộc ${UNIT_STATUSES.join(', ')}` })
      .optional(),
    isTrial: z.boolean({ error: 'isTrial phải là true hoặc false' }).optional(),
  })
  .refine((v) => v.status !== undefined || v.isTrial !== undefined, {
    message: 'Cần status hoặc isTrial',
    path: ['status'],
  });

// --- Câu hỏi kiểm tra trình độ ---

export const adminPlacementQuestionSchema = z
  .object({
    level: z.enum(CONTENT_LEVELS, { error: `level phải thuộc ${CONTENT_LEVELS.join(', ')}` }),
    skill: z.enum(SKILLS, { error: `skill phải thuộc ${SKILLS.join(', ')}` }),
    topicId: z.uuid('topicId không hợp lệ'),
    prompt: z
      .string({ error: 'Thiếu nội dung câu hỏi' })
      .trim()
      .min(1, 'Thiếu nội dung câu hỏi')
      .max(500, 'Tối đa 500 ký tự'),
    hint: i18nDraft(MAX_TEXT).nullable().optional(),
    choices: z
      .array(
        z
          .string({ error: 'Lựa chọn phải là chuỗi' })
          .trim()
          .min(1, 'Lựa chọn không được trống')
          .max(200),
        { error: 'choices phải là danh sách' },
      )
      .min(2, 'Cần ít nhất 2 lựa chọn')
      .max(6, 'Tối đa 6 lựa chọn'),
    correctChoice: z
      .number({ error: 'correctChoice phải là chỉ số lựa chọn' })
      .int('correctChoice phải là số nguyên')
      .min(0, 'correctChoice không được âm'),
    position: z
      .number({ error: 'position phải là số' })
      .int('position phải là số nguyên')
      .min(0, 'position không được âm')
      .max(1000, 'position quá lớn')
      .optional(),
  })
  .superRefine((q, ctx) => {
    if (new Set(q.choices).size !== q.choices.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['choices'],
        message: 'Các lựa chọn không được trùng nhau',
      });
    }
    if (q.correctChoice >= q.choices.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['correctChoice'],
        message: 'correctChoice phải nằm trong danh sách lựa chọn',
      });
    }
  });
export type AdminPlacementQuestionInput = z.infer<typeof adminPlacementQuestionSchema>;

export const adminQuestionIdParamsSchema = z.object({
  questionId: z.uuid('questionId phải là UUID'),
});

export const adminActiveSetSchema = z.object({
  questionIds: z.array(z.uuid('questionIds chứa giá trị không phải UUID'), {
    error: 'questionIds phải là danh sách',
  }),
});

// --- Người dùng và nhật ký ---

export const adminUserIdParamsSchema = z.object({ userId: z.uuid('userId phải là UUID') });

export const adminUserStatusSchema = z.object({
  status: z.enum(['active', 'disabled'], { error: 'status phải là active hoặc disabled' }),
});

export const adminUserListQuerySchema = z.object({
  q: z.string().trim().max(100, 'Từ khóa tối đa 100 ký tự').optional(),
  cursor: z.uuid('cursor không hợp lệ').optional(),
});

export const adminLogListQuerySchema = z.object({
  cursor: z.uuid('cursor không hợp lệ').optional(),
});
