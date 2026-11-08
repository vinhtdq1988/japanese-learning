import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { DbExecutor, Transaction } from '../client.js';
import {
  classAssignments,
  classLearnerExemptions,
  classLearnerOverrides,
  classMemberships,
  classPathUnits,
  classPausePeriods,
  classes,
  learningProfiles,
  learningUnits,
} from '../schema.js';
import type { I18nText, LocalDate } from '../../domain/types.js';
import type { ClassAssignmentRow } from './class-learning.js';

// Điều chỉnh lộ trình lớp (spec 004, T095, US5, data-model §3.8 → §3.13): danh sách đơn vị chọn, bài giao, ghi
// đè riêng, miễn bài, khoảng tạm dừng. Mọi hàm nhận `organizationId` khi chạm dữ liệu theo id từ bên ngoài; các
// thao tác ghi chạy trong giao dịch của dịch vụ (caller đã khóa lớp bằng `lockClassInOrg`).

// --- Danh sách đơn vị chọn (chế độ liệt kê) ---

export interface ClassPathUnitRow {
  unitId: string;
  position: number;
  opensOn: LocalDate | null;
}

/** Danh sách đơn vị giáo viên chọn theo `position`; rỗng ⇒ lớp ở chế độ mẫu. */
export async function listClassPathUnits(
  db: DbExecutor,
  organizationId: string,
  classId: string,
): Promise<ClassPathUnitRow[]> {
  return db
    .select({
      unitId: classPathUnits.unitId,
      position: classPathUnits.position,
      opensOn: classPathUnits.opensOn,
    })
    .from(classPathUnits)
    .innerJoin(classes, eq(classes.id, classPathUnits.classId))
    .where(and(eq(classes.organizationId, organizationId), eq(classPathUnits.classId, classId)))
    .orderBy(asc(classPathUnits.position));
}

/**
 * Thay TOÀN BỘ danh sách đơn vị của lớp (xóa rồi chèn lại trong cùng giao dịch ⇒ hoán đổi vị trí không vướng
 * `UNIQUE (class_id, position)` hoãn được). `position` đặt lại 1..n theo thứ tự đầu vào; rỗng ⇒ về chế độ mẫu.
 */
export async function replaceClassPathUnits(
  tx: Transaction,
  classId: string,
  units: readonly { unitId: string; opensOn: LocalDate | null }[],
): Promise<void> {
  await tx.delete(classPathUnits).where(eq(classPathUnits.classId, classId));
  if (units.length === 0) return;
  await tx.insert(classPathUnits).values(
    units.map((u, i) => ({
      classId,
      unitId: u.unitId,
      position: i + 1,
      opensOn: u.opensOn,
    })),
  );
}

/** Tiêu đề và trạng thái của các đơn vị theo id (kể cả đơn vị không còn `active`) – dùng cho thông báo nội dung. */
export async function lookupUnits(
  db: DbExecutor,
  unitIds: readonly string[],
): Promise<Map<string, { title: I18nText; status: string }>> {
  if (unitIds.length === 0) return new Map();
  const rows = await db
    .select({ id: learningUnits.id, title: learningUnits.title, status: learningUnits.status })
    .from(learningUnits)
    .where(inArray(learningUnits.id, [...unitIds]));
  return new Map(rows.map((r) => [r.id, { title: r.title, status: r.status }]));
}

// --- Bài giao ---

/** Id các đơn vị (trong `unitIds`) đang có bài giao còn hiệu lực của lớp. */
export async function listAssignedUnitIds(
  tx: DbExecutor,
  classId: string,
  unitIds: readonly string[],
): Promise<Set<string>> {
  if (unitIds.length === 0) return new Set();
  const rows = await tx
    .select({ unitId: classAssignments.unitId })
    .from(classAssignments)
    .where(
      and(
        eq(classAssignments.classId, classId),
        isNull(classAssignments.cancelledAt),
        inArray(classAssignments.unitId, [...unitIds]),
      ),
    );
  return new Set(rows.map((r) => r.unitId));
}

/** Giao một lô đơn vị với cùng hạn (cùng `batch_id`). */
export async function insertAssignments(
  tx: Transaction,
  input: {
    classId: string;
    batchId: string;
    unitIds: readonly string[];
    dueOn: LocalDate;
    assignedBy: string;
    now: Date;
  },
): Promise<ClassAssignmentRow[]> {
  return tx
    .insert(classAssignments)
    .values(
      input.unitIds.map((unitId) => ({
        classId: input.classId,
        batchId: input.batchId,
        unitId,
        dueOn: input.dueOn,
        assignedBy: input.assignedBy,
        createdAt: input.now,
      })),
    )
    .returning({
      id: classAssignments.id,
      batchId: classAssignments.batchId,
      unitId: classAssignments.unitId,
      dueOn: classAssignments.dueOn,
      createdAt: classAssignments.createdAt,
    });
}

/** Hủy một bài giao còn hiệu lực của lớp thuộc tổ chức; `false` nếu không có (đã hủy/không tồn tại). */
export async function cancelAssignment(
  tx: Transaction,
  organizationId: string,
  classId: string,
  assignmentId: string,
  now: Date,
): Promise<ClassAssignmentRow | undefined> {
  const [row] = await tx
    .update(classAssignments)
    .set({ cancelledAt: now })
    .where(
      and(
        eq(classAssignments.id, assignmentId),
        eq(classAssignments.classId, classId),
        isNull(classAssignments.cancelledAt),
        sql`${classAssignments.classId} IN (SELECT id FROM classes WHERE organization_id = ${organizationId})`,
      ),
    )
    .returning({
      id: classAssignments.id,
      batchId: classAssignments.batchId,
      unitId: classAssignments.unitId,
      dueOn: classAssignments.dueOn,
      createdAt: classAssignments.createdAt,
    });
  return row;
}

// --- Ghi đè riêng và miễn bài (gắn với giai đoạn thành viên `membership_id`) ---

export async function upsertOverride(
  tx: Transaction,
  membershipId: string,
  values: { dailyMinutes: number | null; shiftDays: number },
  updatedBy: string,
  now: Date,
): Promise<void> {
  await tx
    .insert(classLearnerOverrides)
    .values({ membershipId, ...values, updatedBy, updatedAt: now })
    .onConflictDoUpdate({
      target: classLearnerOverrides.membershipId,
      set: { ...values, updatedBy, updatedAt: now },
    });
}

export async function listExemptedUnitIds(db: DbExecutor, membershipId: string): Promise<string[]> {
  const rows = await db
    .select({ unitId: classLearnerExemptions.unitId })
    .from(classLearnerExemptions)
    .where(eq(classLearnerExemptions.membershipId, membershipId))
    .orderBy(asc(classLearnerExemptions.createdAt), asc(classLearnerExemptions.unitId));
  return rows.map((r) => r.unitId);
}

/** Miễn một đơn vị cho thành viên (lũy đẳng). */
export async function addExemption(
  tx: Transaction,
  membershipId: string,
  unitId: string,
  createdBy: string,
  now: Date,
): Promise<void> {
  await tx
    .insert(classLearnerExemptions)
    .values({ membershipId, unitId, createdBy, createdAt: now })
    .onConflictDoNothing();
}

/** Bỏ miễn (lũy đẳng: không có cũng không lỗi). */
export async function removeExemption(
  tx: Transaction,
  membershipId: string,
  unitId: string,
): Promise<void> {
  await tx
    .delete(classLearnerExemptions)
    .where(
      and(
        eq(classLearnerExemptions.membershipId, membershipId),
        eq(classLearnerExemptions.unitId, unitId),
      ),
    );
}

// --- Khoảng tạm dừng ---

export interface PauseRow {
  id: string;
  /** `null` = cả lớp. */
  userId: string | null;
  membershipId: string | null;
  displayName: string | null;
  startedOn: LocalDate;
  endedOn: LocalDate | null;
}

const pauseSelection = {
  id: classPausePeriods.id,
  userId: classMemberships.userId,
  membershipId: classPausePeriods.membershipId,
  displayName: learningProfiles.displayName,
  startedOn: classPausePeriods.startedOn,
  endedOn: classPausePeriods.endedOn,
};

/** Khoảng tạm dừng của lớp: cả lớp và của các thành viên ĐANG hoạt động, cũ nhất trước. */
export async function listPauses(
  db: DbExecutor,
  organizationId: string,
  classId: string,
  pauseId?: string,
): Promise<PauseRow[]> {
  return db
    .select(pauseSelection)
    .from(classPausePeriods)
    .innerJoin(classes, eq(classes.id, classPausePeriods.classId))
    .leftJoin(classMemberships, eq(classMemberships.id, classPausePeriods.membershipId))
    .leftJoin(learningProfiles, eq(learningProfiles.userId, classMemberships.userId))
    .where(
      and(
        eq(classes.organizationId, organizationId),
        eq(classPausePeriods.classId, classId),
        pauseId ? eq(classPausePeriods.id, pauseId) : undefined,
        sql`(${classPausePeriods.membershipId} IS NULL OR ${classMemberships.leftAt} IS NULL)`,
      ),
    )
    .orderBy(asc(classPausePeriods.startedOn), asc(classPausePeriods.createdAt));
}

/** Có khoảng đang mở (`ended_on IS NULL`) cùng phạm vi (cả lớp hoặc một thành viên) không. */
export async function hasOpenPause(
  tx: DbExecutor,
  classId: string,
  membershipId: string | null,
): Promise<boolean> {
  const [row] = await tx
    .select({ id: classPausePeriods.id })
    .from(classPausePeriods)
    .where(
      and(
        eq(classPausePeriods.classId, classId),
        membershipId
          ? eq(classPausePeriods.membershipId, membershipId)
          : isNull(classPausePeriods.membershipId),
        isNull(classPausePeriods.endedOn),
      ),
    )
    .limit(1);
  return row !== undefined;
}

export async function insertPause(
  tx: Transaction,
  input: {
    classId: string;
    membershipId: string | null;
    startedOn: LocalDate;
    endedOn: LocalDate | null;
    createdBy: string;
    now: Date;
  },
): Promise<string> {
  const [row] = await tx
    .insert(classPausePeriods)
    .values({
      classId: input.classId,
      membershipId: input.membershipId,
      startedOn: input.startedOn,
      endedOn: input.endedOn,
      createdBy: input.createdBy,
      createdAt: input.now,
    })
    .returning({ id: classPausePeriods.id });
  return row!.id;
}

/** Đặt ngày kết thúc cho một khoảng tạm dừng đang mở. */
export async function closePause(
  tx: Transaction,
  pauseId: string,
  endedOn: LocalDate,
): Promise<void> {
  await tx.update(classPausePeriods).set({ endedOn }).where(eq(classPausePeriods.id, pauseId));
}
