import type { FastifyRequest } from 'fastify';
import { isUuid } from '../db/repositories/classes.js';
import { DEFAULT_LANGUAGE, LANGUAGES, type Language } from '../domain/types.js';
import { notFoundGeneric } from './errors.js';

// Tiện ích dùng chung cho các route.

/**
 * Bỏ các khóa có giá trị `null`/`undefined` khỏi phản hồi. Schema OpenAPI của nhiều trường không
 * cho `null` (enum không nullable), nên "không có giá trị" được biểu diễn bằng cách vắng mặt khóa.
 */
export function omitNulls<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== null && v !== undefined),
  ) as Partial<T>;
}

/**
 * Ngôn ngữ cho route công khai: tham số `lang` nếu hợp lệ, ngược lại header `Accept-Language`
 * (client đặt theo ngôn ngữ giao diện), cuối cùng mặc định `vi`.
 */
export function languageFromRequest(request: FastifyRequest): Language {
  const query = request.query as { lang?: unknown } | undefined;
  const fromQuery = query?.lang;
  if (typeof fromQuery === 'string' && (LANGUAGES as readonly string[]).includes(fromQuery)) {
    return fromQuery as Language;
  }
  const header = request.headers['accept-language'];
  if (typeof header === 'string') {
    for (const part of header.split(',')) {
      const tag = part.trim().slice(0, 2).toLowerCase();
      if ((LANGUAGES as readonly string[]).includes(tag)) return tag as Language;
    }
  }
  return DEFAULT_LANGUAGE;
}

/**
 * Tham số đường dẫn là id đối tượng tổ chức/lớp: id sai dạng bị coi như "không tồn tại" (404 chung, cùng thân
 * với đối tượng ngoài phạm vi – FR-007) thay vì 422 hay lỗi 22P02 của CSDL.
 */
export function uuidParam(value: string | undefined): string {
  if (!value || !isUuid(value)) throw notFoundGeneric();
  return value;
}
