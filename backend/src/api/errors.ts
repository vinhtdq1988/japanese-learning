import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError, type ZodType } from 'zod';
import { AppError, type ErrorCode } from '../domain/types.js';

// Xử lý lỗi theo schema `Error` của openapi.yaml: `{ code, message, fields? }`.
// Thông điệp lỗi không lộ chi tiết nội bộ hay dữ liệu người khác (FR-034, R16).

export interface ErrorBody {
  code: ErrorCode;
  message: string;
  fields?: Record<string, string>;
}

/** Thông điệp chung cho mọi đối tượng ngoài phạm vi người gọi; khớp `setNotFoundHandler` (FR-007). */
export const NOT_FOUND_MESSAGE = 'Không tìm thấy tài nguyên';

/**
 * Lỗi 404 dùng chung cho "không tồn tại" và "ngoài phạm vi tổ chức của người gọi": thân phản hồi PHẢI
 * giống hệt nhau từng byte để không lộ sự tồn tại của đối tượng thuộc tổ chức khác (FR-007, SC-004).
 */
export function notFoundGeneric(): AppError {
  return new AppError(404, 'NOT_FOUND', NOT_FOUND_MESSAGE);
}

/** Mã lỗi tổ chức/lớp học (spec 004) và mã HTTP của từng mã, khớp `Error.code` trong openapi.yaml 1.12.0. */
export const ORG_ERROR_STATUS = {
  CLASS_MANAGED: 409,
  SEAT_UNAVAILABLE: 409,
  SEAT_REASSIGN_LIMIT: 422,
  SEAT_BELOW_USAGE: 422,
  CLASS_NOT_READY: 409,
  CLASS_FULL: 409,
  CLASS_ARCHIVED: 409,
  LAST_TEACHER: 409,
  ALREADY_IN_CLASS: 409,
  // Thông điệp chung, KHÔNG nêu tên tổ chức khác (FR-002).
  INVITEE_UNAVAILABLE: 409,
} as const satisfies Partial<Record<ErrorCode, number>>;

export type OrgErrorCode = keyof typeof ORG_ERROR_STATUS;

/** Tạo `AppError` cho mã lỗi tổ chức với mã HTTP đúng hợp đồng; `fields` dùng cho `CLASS_MANAGED`. */
export function orgError(
  code: OrgErrorCode,
  message: string,
  fields?: Record<string, string>,
): AppError {
  return new AppError(ORG_ERROR_STATUS[code], code, message, fields);
}

/** Thông điệp chung khi email/tài khoản thuộc tổ chức khác: KHÔNG nêu tên tổ chức (FR-002). */
export const inviteeUnavailable = (): AppError =>
  orgError('INVITEE_UNAVAILABLE', 'Email này không thể nhận lời mời vào tổ chức');

/** Chuyển lỗi Zod thành lỗi 422 `VALIDATION_FAILED` với thông báo cụ thể theo trường. */
export function zodToAppError(err: ZodError): AppError {
  const fields: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join('.') || '_';
    fields[key] ??= issue.message;
  }
  return new AppError(422, 'VALIDATION_FAILED', 'Dữ liệu không hợp lệ', fields);
}

/** Kiểm tra dữ liệu vào bằng Zod; ném `AppError` 422 nếu sai. */
export function parseInput<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) throw zodToAppError(result.error);
  return result.data;
}

function codeForStatus(status: number): ErrorCode {
  switch (status) {
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 429:
      return 'TOO_MANY_REQUESTS';
    default:
      return status >= 500 ? 'INTERNAL_ERROR' : 'VALIDATION_FAILED';
  }
}

export function toErrorResponse(err: unknown): { status: number; body: ErrorBody } {
  if (err instanceof AppError) {
    const body: ErrorBody = { code: err.code, message: err.message };
    if (err.fields) body.fields = err.fields;
    return { status: err.statusCode, body };
  }
  if (err instanceof ZodError) {
    const e = zodToAppError(err);
    return { status: e.statusCode, body: { code: e.code, message: e.message, fields: e.fields } };
  }
  const e = err as Partial<FastifyError> & { code?: string; message?: string };
  const status = typeof e.statusCode === 'number' ? e.statusCode : 500;
  if (status >= 400 && status < 500) {
    // Rate-limit trả đối tượng đã có `code`; lỗi Fastify 4xx khác (JSON hỏng, media type…) về dạng chung.
    const code = e.code === 'TOO_MANY_REQUESTS' ? 'TOO_MANY_REQUESTS' : codeForStatus(status);
    const message =
      code === 'VALIDATION_FAILED' ? 'Yêu cầu không hợp lệ' : (e.message ?? 'Yêu cầu không hợp lệ');
    return { status: status === 400 ? 422 : status, body: { code, message } };
  }
  return { status: 500, body: { code: 'INTERNAL_ERROR', message: 'Lỗi hệ thống' } };
}

export function registerErrorHandlers(app: FastifyInstance): void {
  app.setErrorHandler((err: unknown, request: FastifyRequest, reply: FastifyReply) => {
    const { status, body } = toErrorResponse(err);
    if (status >= 500) request.log.error({ err }, 'Lỗi không xử lý được');
    if (err instanceof AppError && err.headers) void reply.headers(err.headers);
    return reply.status(status).send(body);
  });

  app.setNotFoundHandler((_request, reply) =>
    reply.status(404).send({ code: 'NOT_FOUND', message: NOT_FOUND_MESSAGE }),
  );
}
