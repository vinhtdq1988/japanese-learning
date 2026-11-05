import { and, desc, eq, sql } from 'drizzle-orm';
import type { DbExecutor } from '../client.js';
import { learningProfiles, users } from '../schema.js';

// Repository tra cứu và đổi trạng thái tài khoản cho quản trị viên (T107, FR-031).

export interface AdminUserRow {
  id: string;
  email: string;
  displayName: string | null;
  role: 'learner' | 'admin';
  status: 'active' | 'disabled' | 'pending_deletion';
  createdAt: Date;
}

const columns = {
  id: users.id,
  email: users.email,
  displayName: learningProfiles.displayName,
  role: users.role,
  status: users.status,
  createdAt: users.createdAt,
};

/** Thoát ký tự đặc biệt của LIKE để từ khóa của admin luôn được hiểu theo nghĩa đen. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Tài khoản theo tên/email (không phân biệt hoa thường), mới nhất trước; phân trang theo `(created_at, id)`. */
export async function searchUsers(
  db: DbExecutor,
  options: { q?: string; afterId?: string; limit: number },
): Promise<AdminUserRow[]> {
  const conditions = [];
  if (options.q) {
    const pattern = `%${escapeLike(options.q)}%`;
    conditions.push(
      sql`(${users.email}::text ILIKE ${pattern} ESCAPE '\\' OR ${learningProfiles.displayName} ILIKE ${pattern} ESCAPE '\\')`,
    );
  }
  if (options.afterId) {
    conditions.push(
      sql`(${users.createdAt}, ${users.id}) < (SELECT created_at, id FROM users WHERE id = ${options.afterId})`,
    );
  }
  return db
    .select(columns)
    .from(users)
    .leftJoin(learningProfiles, eq(learningProfiles.userId, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(users.createdAt), desc(users.id))
    .limit(options.limit);
}

export async function userExists(db: DbExecutor, id: string): Promise<boolean> {
  const [row] = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1);
  return row !== undefined;
}

/** Khóa hàng tài khoản (`FOR UPDATE`) để hai admin đổi trạng thái đồng thời không ghi nhật ký lệch nhau. */
export async function lockUser(db: DbExecutor, id: string): Promise<AdminUserRow | undefined> {
  const [row] = await db
    .select(columns)
    .from(users)
    .leftJoin(learningProfiles, eq(learningProfiles.userId, users.id))
    .where(eq(users.id, id))
    .for('update', { of: users })
    .limit(1);
  return row;
}

export async function setUserStatus(
  db: DbExecutor,
  id: string,
  status: 'active' | 'disabled',
  now: Date,
): Promise<void> {
  await db.update(users).set({ status, updatedAt: now }).where(eq(users.id, id));
}
