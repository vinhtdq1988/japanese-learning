import { notFoundGeneric, orgError } from '../api/errors.js';
import { getClassInOrg, hasClassPath } from '../db/repositories/classes.js';
import { lockOrganization } from '../db/repositories/organizations.js';
import { parseCsv } from '../domain/csv.js';
import { AppError } from '../domain/types.js';
import type { ServiceDeps } from './deps.js';
import { deliverStudentInvitations, inviteStudentsTx } from './invitations.js';
import type { OrgContext } from './org-access.js';

// Nhập danh sách học viên bằng CSV (spec 004, T054, FR-013, contracts/csv-formats.md §1). Thân yêu cầu là nội
// dung file (`text/csv`); lỗi định dạng/quá cỡ ⇒ 422 TOÀN FILE và KHÔNG tạo lời mời nào.

type CsvDeps = Pick<ServiceDeps, 'config' | 'db' | 'clock' | 'jobQueue'>;

const csvError = (message: string) =>
  new AppError(422, 'VALIDATION_FAILED', 'Dữ liệu không hợp lệ', { file: message });

/**
 * Phân tích file CSV thành danh sách `{email, displayName}`. Ném 422 khi quá `CSV_IMPORT_MAX_BYTES`, thiếu
 * cột `email`, hoặc quá `CSV_IMPORT_MAX_ROWS` dòng dữ liệu (dòng trống không tính).
 */
export function parseInviteCsv(
  config: Pick<CsvDeps['config'], 'CSV_IMPORT_MAX_BYTES' | 'CSV_IMPORT_MAX_ROWS'>,
  text: string,
): { email: string; displayName: string | null }[] {
  if (Buffer.byteLength(text, 'utf8') > config.CSV_IMPORT_MAX_BYTES) {
    throw csvError(`File quá lớn (tối đa ${config.CSV_IMPORT_MAX_BYTES} byte)`);
  }
  const parsed = parseCsv(text);
  const emailCol = parsed.headers.indexOf('email');
  if (emailCol < 0) throw csvError('Thiếu cột "email" ở dòng tiêu đề');
  if (parsed.rows.length > config.CSV_IMPORT_MAX_ROWS) {
    throw csvError(`Tối đa ${config.CSV_IMPORT_MAX_ROWS} dòng dữ liệu mỗi file`);
  }
  const nameCol = parsed.headers.indexOf('display_name');
  return parsed.rows.map((row) => ({
    email: row[emailCol] ?? '',
    displayName: nameCol >= 0 ? row[nameCol]?.trim() || null : null,
  }));
}

/**
 * `POST /classes/{id}/invitations/import`: xử lý tuần tự trong MỘT giao dịch khóa tổ chức, đúng một
 * `outcome` cho mỗi dòng dữ liệu theo thứ tự ưu tiên của csv-formats §1. Lớp chưa có lộ trình ⇒ 409
 * `CLASS_NOT_READY`; lớp lưu trữ ⇒ 409 `CLASS_ARCHIVED`.
 */
export async function importInvitationsCsv(
  deps: CsvDeps,
  ctx: OrgContext,
  classId: string,
  text: string,
): Promise<{
  summary: Record<string, number>;
  results: { row: number; email: string; outcome: string }[];
}> {
  const invitees = parseInviteCsv(deps.config, text);
  const batch = await deps.db.transaction(async (tx) => {
    if (!(await lockOrganization(tx, ctx.organizationId))) throw notFoundGeneric();
    const cls = await getClassInOrg(tx, ctx.organizationId, classId);
    if (!cls) throw notFoundGeneric();
    if (cls.status === 'archived') throw orgError('CLASS_ARCHIVED', 'Lớp đã được lưu trữ');
    if (!(await hasClassPath(tx, classId))) {
      throw orgError('CLASS_NOT_READY', 'Hãy đặt lộ trình cho lớp trước khi mời học viên');
    }
    const result = await inviteStudentsTx(tx, deps, {
      organizationId: ctx.organizationId,
      classId,
      invitedBy: ctx.userId,
      invitees,
    });
    return { ...result, className: cls.name };
  });
  await deliverStudentInvitations(deps, batch.className, batch.created);
  return { summary: batch.summary, results: batch.results };
}
