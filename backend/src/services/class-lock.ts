import { orgError } from '../api/errors.js';
import type { DbExecutor } from '../db/client.js';
import { findActiveMembershipByUser } from '../db/repositories/class-memberships.js';
import { CLASS_LOCKED_PROFILE_FIELDS } from '../domain/org-types.js';

// Khóa quyền kiểm soát lộ trình cá nhân khi người học thuộc lớp (spec 004, FR-018, research O8). Gọi trong
// DỊCH VỤ (không chỉ route) nên máy chủ từ chối đúng cho mọi đường vào, kể cả khi client cũ không hiện khóa.

/** Thông điệp chung của `CLASS_MANAGED`. */
export const CLASS_MANAGED_MESSAGE =
  'Do lớp quyết định; chuyển sang lộ trình cá nhân (rời lớp) để tự điều chỉnh';

/**
 * Ném 409 `CLASS_MANAGED` (kèm `fields` = các trường/thao tác bị khóa) nếu người học đang thuộc lớp. Mặc định
 * liệt kê toàn bộ `CLASS_LOCKED_PROFILE_FIELDS`; truyền `fields` để chỉ nêu đúng phần đang bị thay đổi.
 */
export async function assertNotClassManaged(
  db: DbExecutor,
  userId: string,
  fields: readonly string[] = CLASS_LOCKED_PROFILE_FIELDS,
): Promise<void> {
  if (!(await findActiveMembershipByUser(db, userId))) return;
  throw orgError(
    'CLASS_MANAGED',
    CLASS_MANAGED_MESSAGE,
    Object.fromEntries(fields.map((f) => [f, 'do lớp quyết định'])),
  );
}
