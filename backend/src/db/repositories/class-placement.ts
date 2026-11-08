import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { DbExecutor, Transaction } from '../client.js';
import { classPlacementRequests, classes, placementResults } from '../schema.js';

// Yêu cầu kiểm tra trình độ cho cả lớp (spec 004, T124, US8, FR-034, data-model §3.14): tối đa MỘT yêu cầu mở
// cho mỗi lớp (UNIQUE một phần). Kết quả học viên nộp nằm ở `placement_results` với `is_current = false` và
// `class_placement_request_id`, không đổi kết quả/lộ trình cá nhân (research O14). Hàm phía giáo viên nhận
// `organizationId`; hàm phía học viên dựa trên `classId` của thành viên hiện tại của chính họ.

export type PlacementRequestRow = typeof classPlacementRequests.$inferSelect;
export type PlacementResultRow = typeof placementResults.$inferSelect;

/** Yêu cầu đang mở của lớp thuộc tổ chức; lớp ngoài tổ chức ⇒ `undefined`. */
export async function getOpenRequest(
  db: DbExecutor,
  organizationId: string,
  classId: string,
): Promise<PlacementRequestRow | undefined> {
  const [row] = await db
    .select({ request: classPlacementRequests })
    .from(classPlacementRequests)
    .innerJoin(classes, eq(classes.id, classPlacementRequests.classId))
    .where(
      and(
        eq(classes.organizationId, organizationId),
        eq(classPlacementRequests.classId, classId),
        isNull(classPlacementRequests.closedAt),
      ),
    )
    .limit(1);
  return row?.request;
}

/** Yêu cầu đang mở của một lớp (phía học viên – `classId` lấy từ thành viên hiện tại của chính họ). */
export async function getOpenRequestOfClass(
  db: DbExecutor,
  classId: string,
): Promise<PlacementRequestRow | undefined> {
  const [row] = await db
    .select()
    .from(classPlacementRequests)
    .where(
      and(eq(classPlacementRequests.classId, classId), isNull(classPlacementRequests.closedAt)),
    )
    .limit(1);
  return row;
}

export async function insertRequest(
  tx: Transaction,
  values: { classId: string; requestedBy: string; now: Date },
): Promise<PlacementRequestRow> {
  const [row] = await tx
    .insert(classPlacementRequests)
    .values({
      classId: values.classId,
      requestedBy: values.requestedBy,
      requestedAt: values.now,
    })
    .returning();
  return row!;
}

/** Đóng yêu cầu đang mở; trả dòng đã đóng hoặc `undefined` nếu không có yêu cầu mở. */
export async function closeOpenRequest(
  tx: Transaction,
  organizationId: string,
  classId: string,
  now: Date,
): Promise<PlacementRequestRow | undefined> {
  const open = await getOpenRequest(tx, organizationId, classId);
  if (!open) return undefined;
  const [row] = await tx
    .update(classPlacementRequests)
    .set({ closedAt: now })
    .where(eq(classPlacementRequests.id, open.id))
    .returning();
  return row;
}

/** Kết quả đã nộp cho một yêu cầu của các học viên cho trước (mỗi người tối đa một kết quả). */
export async function listRequestResults(
  db: DbExecutor,
  requestId: string,
  userIds: readonly string[],
): Promise<PlacementResultRow[]> {
  if (userIds.length === 0) return [];
  return db
    .select()
    .from(placementResults)
    .where(
      and(
        eq(placementResults.classPlacementRequestId, requestId),
        inArray(placementResults.userId, [...userIds]),
      ),
    );
}

/** Học viên đã nộp bài cho yêu cầu này chưa. */
export async function hasSubmittedForRequest(
  db: DbExecutor,
  userId: string,
  requestId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: placementResults.id })
    .from(placementResults)
    .where(
      and(
        eq(placementResults.userId, userId),
        eq(placementResults.classPlacementRequestId, requestId),
      ),
    )
    .limit(1);
  return row !== undefined;
}
