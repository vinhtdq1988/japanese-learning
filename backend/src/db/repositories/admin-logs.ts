import { and, desc, eq, sql, type SQL } from 'drizzle-orm';
import type { DbExecutor } from '../client.js';
import { adminActionLogs } from '../schema.js';
import type { OrgLogAction, OrgLogTargetType } from '../../domain/org-types.js';

// Repository nhật ký hành động quản trị (FR-032, data-model §2.18).

export type AdminActionLogRow = typeof adminActionLogs.$inferSelect;

export interface NewAdminActionLog {
  /** Người thực hiện; null cho thao tác hệ thống (lệnh vận hành). */
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  /** Thay đổi trước/sau, ĐÃ loại thông tin nhạy cảm (mật khẩu, token, email). */
  diff: Record<string, unknown> | null;
  /** Tổ chức liên quan (spec 004, FR-008); vắng mặt cho hành động quản trị nội dung/người dùng. */
  organizationId?: string | null;
}

/** Ghi một dòng nhật ký; gọi trong cùng giao dịch với thay đổi được ghi lại. */
export async function insertAdminLog(db: DbExecutor, entry: NewAdminActionLog): Promise<void> {
  await db.insert(adminActionLogs).values(entry);
}

export interface NewOrgActionLog {
  actorId: string | null;
  organizationId: string;
  action: OrgLogAction;
  targetType: OrgLogTargetType;
  targetId: string | null;
  /** Thay đổi trước/sau, ĐÃ loại thông tin nhạy cảm (mật khẩu, token; email chỉ khi thật cần). */
  diff: Record<string, unknown> | null;
}

/**
 * Ghi nhật ký một hành động của quản trị viên/chủ tổ chức/giáo viên trên tổ chức, lớp hay seat
 * (FR-008, data-model §4). Gọi trong cùng giao dịch với thay đổi được ghi lại.
 */
export async function logOrgAction(db: DbExecutor, entry: NewOrgActionLog): Promise<void> {
  await insertAdminLog(db, entry);
}

export async function adminLogExists(db: DbExecutor, id: string): Promise<boolean> {
  const [row] = await db
    .select({ id: adminActionLogs.id })
    .from(adminActionLogs)
    .where(eq(adminActionLogs.id, id))
    .limit(1);
  return row !== undefined;
}

/**
 * Trang nhật ký, mới nhất trước. Phân trang theo khóa `(occurred_at, id)` của dòng cuối trang trước
 * (so sánh trên chính cột trong CSDL nên không mất độ chính xác micro giây như khi đi qua `Date`).
 */
export async function listAdminLogs(
  db: DbExecutor,
  options: { afterId?: string; limit: number; organizationId?: string },
): Promise<AdminActionLogRow[]> {
  const conditions: SQL[] = [];
  if (options.organizationId) {
    conditions.push(eq(adminActionLogs.organizationId, options.organizationId));
  }
  if (options.afterId) {
    conditions.push(
      sql`(${adminActionLogs.occurredAt}, ${adminActionLogs.id}) < (
          SELECT occurred_at, id FROM admin_action_logs WHERE id = ${options.afterId})`,
    );
  }
  return db
    .select()
    .from(adminActionLogs)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(adminActionLogs.occurredAt), desc(adminActionLogs.id))
    .limit(options.limit);
}
