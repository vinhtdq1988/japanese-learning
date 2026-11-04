import { z } from 'zod';

// Kiểm tra dữ liệu vào của phiên học (khớp `AnswerSubmission`, `startSession`, `recordStudyInterval`
// trong openapi.yaml). Thông báo lỗi cụ thể theo trường, bằng tiếng Việt.

/** Giới hạn mỗi khoảng thời gian học (giây); khớp CHECK của `study_intervals.duration_seconds`. */
export const MAX_INTERVAL_SECONDS = 1800;

const uuid = (label: string) => z.uuid({ error: `${label} phải là UUID` });

export const startSessionSchema = z.object({
  planItemId: uuid('planItemId'),
});

export const answerSubmissionSchema = z.object({
  clientEventId: uuid('clientEventId'),
  exerciseId: uuid('exerciseId'),
  // Chỉ số lựa chọn, danh sách cặp hoặc chuỗi điền từ: bộ chấm tự kiểm tra kiểu; thiếu thì từ chối.
  answer: z.unknown().refine((v) => v !== undefined && v !== null, 'Câu trả lời là bắt buộc'),
  answeredAt: z.iso
    .datetime({ offset: true, error: 'answeredAt phải là thời điểm ISO 8601' })
    .optional(),
  isRetry: z.boolean({ error: 'isRetry phải là true hoặc false' }).default(false),
});
export type AnswerSubmission = z.infer<typeof answerSubmissionSchema>;

export const intervalSchema = z.object({
  clientEventId: uuid('clientEventId'),
  startedAt: z.iso.datetime({ offset: true, error: 'startedAt phải là thời điểm ISO 8601' }),
  durationSeconds: z
    .number({ error: 'durationSeconds phải là số' })
    .int('durationSeconds phải là số nguyên')
    .min(1, 'durationSeconds tối thiểu 1 giây')
    .max(MAX_INTERVAL_SECONDS, `durationSeconds tối đa ${MAX_INTERVAL_SECONDS} giây`),
});
export type IntervalInput = z.infer<typeof intervalSchema>;

export const sessionIdParamsSchema = z.object({
  sessionId: uuid('sessionId'),
});
