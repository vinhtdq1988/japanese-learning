import { desc, eq, sql } from 'drizzle-orm';
import type { DbExecutor } from '../client.js';
import { adminActionLogs } from '../schema.js';

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
}

/** Ghi một dòng nhật ký; gọi trong cùng giao dịch với thay đổi được ghi lại. */
export async function insertAdminLog(db: DbExecutor, entry: NewAdminActionLog): Promise<void> {
  await db.insert(adminActionLogs).values(entry);
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
  options: { afterId?: string; limit: number },
): Promise<AdminActionLogRow[]> {
  const query = db.select().from(adminActionLogs);
  const filtered = options.afterId
    ? query.where(
        sql`(${adminActionLogs.occurredAt}, ${adminActionLogs.id}) < (
          SELECT occurred_at, id FROM admin_action_logs WHERE id = ${options.afterId})`,
      )
    : query;
  return filtered
    .orderBy(desc(adminActionLogs.occurredAt), desc(adminActionLogs.id))
    .limit(options.limit);
}
