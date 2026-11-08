import { eq } from 'drizzle-orm';
import type { DbExecutor, Transaction } from '../client.js';
import { classPaths } from '../schema.js';

// Repository lộ trình lớp (spec 004, data-model §3.8, FR-017). Mỗi lớp tối đa MỘT lộ trình và KHÔNG có thao
// tác xóa: chỉ tạo/sửa, nên không có hàm xóa ở đây. Truy cập theo `classId`: caller đã xác nhận lớp thuộc đúng
// tổ chức/được phép (`getManagedClass`) hoặc là lớp của chính học viên (`resolveLearningContext`).

export type ClassPathRow = typeof classPaths.$inferSelect;

export interface ClassPathValues {
  startLevel: ClassPathRow['startLevel'];
  targetLevel: ClassPathRow['targetLevel'];
  skills: ClassPathRow['skills'];
  startsOn: string;
  endsOn: string;
  dailyMinutes: number;
}

export async function getClassPathRow(
  db: DbExecutor,
  classId: string,
): Promise<ClassPathRow | undefined> {
  const [row] = await db.select().from(classPaths).where(eq(classPaths.classId, classId)).limit(1);
  return row;
}

/** Tạo hoặc sửa lộ trình lớp (một dòng cho mỗi lớp); lưu trọn vẹn hoặc không đổi vì chạy trong giao dịch. */
export async function upsertClassPath(
  tx: Transaction,
  classId: string,
  values: ClassPathValues,
  updatedBy: string | null,
  now: Date,
): Promise<ClassPathRow> {
  const [row] = await tx
    .insert(classPaths)
    .values({ classId, ...values, updatedBy, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: classPaths.classId,
      set: { ...values, updatedBy, updatedAt: now },
    })
    .returning();
  return row!;
}
