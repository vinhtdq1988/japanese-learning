import { and, eq, isNull, or } from 'drizzle-orm';
import type { DbExecutor } from '../client.js';
import type { PausePeriod } from '../../engine/daily-plan.js';
import {
  classAssignments,
  classLearnerExemptions,
  classLearnerOverrides,
  classMemberships,
  classPausePeriods,
  classes,
} from '../schema.js';

// Dữ liệu điều chỉnh học theo lớp mà `resolveLearningContext` đọc (spec 004, research O6, O9, data-model §3.12,
// §3.13). Khóa theo thành viên/lớp của CHÍNH người học đang gọi (id lấy từ thành viên lớp hiệu lực), không nhận
// id đối tượng từ bên ngoài.

export interface LearnerOverrideRow {
  dailyMinutes: number | null;
  shiftDays: number;
}

/** Ghi đè riêng của một thành viên (phút/ngày, dời mốc) hoặc `undefined` nếu chưa có. */
export async function getLearnerOverride(
  db: DbExecutor,
  membershipId: string,
): Promise<LearnerOverrideRow | undefined> {
  const [row] = await db
    .select({
      dailyMinutes: classLearnerOverrides.dailyMinutes,
      shiftDays: classLearnerOverrides.shiftDays,
    })
    .from(classLearnerOverrides)
    .where(eq(classLearnerOverrides.membershipId, membershipId))
    .limit(1);
  return row;
}

/**
 * Khoảng tạm dừng áp dụng cho một thành viên: cả lớp (`membership_id IS NULL`) và riêng người đó. Dạng
 * `PausePeriod {startedOn, endedOn}` nửa khoảng khớp engine nên tái dùng `isPausedOn`, `absentDays`,
 * `hasLearningGap`, `currentStreakDays` (research O9).
 */
export async function listPausesForMember(
  db: DbExecutor,
  classId: string,
  membershipId: string,
): Promise<PausePeriod[]> {
  const rows = await db
    .select({ startedOn: classPausePeriods.startedOn, endedOn: classPausePeriods.endedOn })
    .from(classPausePeriods)
    .where(
      and(
        eq(classPausePeriods.classId, classId),
        or(
          isNull(classPausePeriods.membershipId),
          eq(classPausePeriods.membershipId, membershipId),
        ),
      ),
    );
  return rows;
}

/** Khoảng tạm dừng CẢ LỚP (`membership_id IS NULL`), dùng cho cảnh báo khả thi của lộ trình lớp (FR-025). */
export async function listClassWidePauses(db: DbExecutor, classId: string): Promise<PausePeriod[]> {
  return db
    .select({ startedOn: classPausePeriods.startedOn, endedOn: classPausePeriods.endedOn })
    .from(classPausePeriods)
    .where(and(eq(classPausePeriods.classId, classId), isNull(classPausePeriods.membershipId)));
}

// --- Đọc theo lô cho bảng điều khiển (spec 004, T085): mỗi hàm MỘT truy vấn cho cả lớp, lọc theo tổ chức ---

export interface ClassPauseRow extends PausePeriod {
  id: string;
  /** `null` = cả lớp. */
  membershipId: string | null;
}

/** Mọi khoảng tạm dừng của lớp (cả lớp + từng thành viên) thuộc tổ chức. */
export async function listPausesForClass(
  db: DbExecutor,
  organizationId: string,
  classId: string,
): Promise<ClassPauseRow[]> {
  return db
    .select({
      id: classPausePeriods.id,
      membershipId: classPausePeriods.membershipId,
      startedOn: classPausePeriods.startedOn,
      endedOn: classPausePeriods.endedOn,
    })
    .from(classPausePeriods)
    .innerJoin(classes, eq(classes.id, classPausePeriods.classId))
    .where(and(eq(classes.organizationId, organizationId), eq(classPausePeriods.classId, classId)));
}

/** Ghi đè riêng (phút, dời mốc) của các thành viên đang hoạt động của lớp, theo `membership_id`. */
export async function listOverridesForClass(
  db: DbExecutor,
  organizationId: string,
  classId: string,
): Promise<Map<string, LearnerOverrideRow>> {
  const rows = await db
    .select({
      membershipId: classLearnerOverrides.membershipId,
      dailyMinutes: classLearnerOverrides.dailyMinutes,
      shiftDays: classLearnerOverrides.shiftDays,
    })
    .from(classLearnerOverrides)
    .innerJoin(classMemberships, eq(classMemberships.id, classLearnerOverrides.membershipId))
    .where(
      and(
        eq(classMemberships.organizationId, organizationId),
        eq(classMemberships.classId, classId),
        isNull(classMemberships.leftAt),
      ),
    );
  return new Map(
    rows.map((r) => [r.membershipId, { dailyMinutes: r.dailyMinutes, shiftDays: r.shiftDays }]),
  );
}

/** Đơn vị được miễn của các thành viên đang hoạt động của lớp: `membership_id` → tập `unit_id`. */
export async function listExemptionsForClass(
  db: DbExecutor,
  organizationId: string,
  classId: string,
): Promise<Map<string, Set<string>>> {
  const rows = await db
    .select({
      membershipId: classLearnerExemptions.membershipId,
      unitId: classLearnerExemptions.unitId,
    })
    .from(classLearnerExemptions)
    .innerJoin(classMemberships, eq(classMemberships.id, classLearnerExemptions.membershipId))
    .where(
      and(
        eq(classMemberships.organizationId, organizationId),
        eq(classMemberships.classId, classId),
        isNull(classMemberships.leftAt),
      ),
    );
  const byMember = new Map<string, Set<string>>();
  for (const r of rows) {
    const set = byMember.get(r.membershipId) ?? new Set<string>();
    set.add(r.unitId);
    byMember.set(r.membershipId, set);
  }
  return byMember;
}

export interface ClassAssignmentRow {
  id: string;
  batchId: string;
  unitId: string;
  dueOn: string;
  createdAt: Date;
}

/** Bài giao chưa bị hủy của lớp, hạn gần nhất trước. */
export async function listActiveAssignments(
  db: DbExecutor,
  organizationId: string,
  classId: string,
): Promise<ClassAssignmentRow[]> {
  return db
    .select({
      id: classAssignments.id,
      batchId: classAssignments.batchId,
      unitId: classAssignments.unitId,
      dueOn: classAssignments.dueOn,
      createdAt: classAssignments.createdAt,
    })
    .from(classAssignments)
    .innerJoin(classes, eq(classes.id, classAssignments.classId))
    .where(
      and(
        eq(classes.organizationId, organizationId),
        eq(classAssignments.classId, classId),
        isNull(classAssignments.cancelledAt),
      ),
    )
    .orderBy(classAssignments.dueOn, classAssignments.id);
}
