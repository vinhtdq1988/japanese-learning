import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { signAccessToken } from '../../src/api/middleware/auth.js';
import { generateJoinCode } from '../../src/services/join-code.js';
import { generateOpaqueToken, sha256Hex } from '../../src/services/tokens.js';
import { withTransaction } from '../../src/db/client.js';
import { closeMembership, openMembership } from '../../src/db/repositories/class-memberships.js';
import { lockOrganization } from '../../src/db/repositories/organizations.js';
import { allocateSeat } from '../../src/db/repositories/seats.js';
import { insertProfile, insertUser } from '../../src/db/repositories/users.js';
import {
  classPaths,
  classTeachers,
  classes,
  invitations,
  organizationMembers,
  organizations,
  seatLicenses,
  seats,
} from '../../src/db/schema.js';
import { localToday } from '../../src/engine/clock.js';
import { createAdmin } from '../../src/seed/create-admin.js';
import { ContractClient } from '../contract/client.js';
import type { TestApp } from './helpers.js';

// Tiện ích kiểm thử cho tổ chức/lớp/seat (spec 004, T021): dựng dữ liệu TRỰC TIẾP qua repository (bỏ qua
// luồng mời) để mỗi bộ kiểm thử tập trung vào hành vi cần kiểm, và dựng "thế giới vai trò" của ma trận quyền.

let counter = 0;
const nextId = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;

/** Múi giờ của học viên thử nghiệm: trùng `ORG_TIMEZONE` mặc định để ngày giấy phép và ngày học khớp. */
export const TEST_TIMEZONE = 'Asia/Ho_Chi_Minh';

export interface TestUser {
  userId: string;
  email: string;
  displayName: string;
  role: 'learner' | 'admin';
}

/** Tạo tài khoản + hồ sơ (tên hiển thị); `role: 'admin'` dùng lệnh vận hành như `create-admin`. */
export async function createTestUser(
  ctx: TestApp,
  options: { email?: string; displayName?: string; role?: 'learner' | 'admin' } = {},
): Promise<TestUser> {
  const email = options.email ?? `u-${nextId()}@example.com`;
  const displayName = options.displayName ?? `Người dùng ${email.split('@')[0]}`;
  const role = options.role ?? 'learner';
  if (role === 'admin') {
    const { userId } = await createAdmin(ctx.handle.db, email, 'Admin-Matkhau-123');
    return { userId, email, displayName, role };
  }
  const user = await insertUser(ctx.handle.db, { email, passwordHash: 'x', fromTrial: false });
  await insertProfile(ctx.handle.db, {
    userId: user.id,
    displayName,
    language: 'vi',
    timezone: TEST_TIMEZONE,
  });
  return { userId: user.id, email, displayName, role };
}

/**
 * Access token hợp lệ cho `user` ký theo đồng hồ giả hiện tại (hết hạn sau 15 phút theo đồng hồ giả).
 * Gọi lại sau khi tiến đồng hồ để lấy token mới; để thử "phiên đang mở" hãy GIỮ token cũ.
 */
export async function tokenFor(
  ctx: TestApp,
  user: Pick<TestUser, 'userId' | 'role'>,
): Promise<string> {
  return signAccessToken(
    ctx.config,
    { userId: user.userId, role: user.role, status: 'active' },
    ctx.clock.now(),
  );
}

export interface TestOrg {
  orgId: string;
  licenseId: string | null;
  seatIds: string[];
}

export interface CreateOrgOptions {
  name?: string;
  /** Số seat của giấy phép; 0 = không tạo giấy phép. */
  seats?: number;
  startsOn?: string;
  endsOn?: string;
  graceDays?: number;
  maxReassignments?: number;
  status?: 'active' | 'disabled';
}

/** Tạo tổ chức, (tùy chọn) giấy phép và các dòng seat trống. */
export async function createTestOrg(
  ctx: TestApp,
  options: CreateOrgOptions = {},
): Promise<TestOrg> {
  const { db } = ctx.handle;
  const [org] = await db
    .insert(organizations)
    .values({ name: options.name ?? `Tổ chức ${nextId()}`, status: options.status ?? 'active' })
    .returning();
  const seatCount = options.seats ?? 5;
  if (seatCount <= 0) return { orgId: org!.id, licenseId: null, seatIds: [] };
  const [license] = await db
    .insert(seatLicenses)
    .values({
      organizationId: org!.id,
      startsOn: options.startsOn ?? '2026-01-01',
      endsOn: options.endsOn ?? '2026-12-31',
      graceDays: options.graceDays ?? 7,
      maxReassignments: options.maxReassignments ?? 2,
    })
    .returning();
  const seatRows = await db
    .insert(seats)
    .values(Array.from({ length: seatCount }, () => ({ licenseId: license!.id })))
    .returning({ id: seats.id });
  return { orgId: org!.id, licenseId: license!.id, seatIds: seatRows.map((s) => s.id) };
}

/**
 * Gán vai trò tổ chức cho tài khoản. `teacher` chiếm một seat (trừ khi `seat: false` để dựng giáo viên MẤT
 * seat); `owner` không chiếm seat. Trả `seatId` đã gán (nếu có).
 */
export async function addOrgRole(
  ctx: TestApp,
  orgId: string,
  userId: string,
  roles: { owner?: boolean; teacher?: boolean; seat?: boolean },
): Promise<{ seatId: string | null }> {
  const now = ctx.clock.now();
  await ctx.handle.db
    .insert(organizationMembers)
    .values({
      userId,
      organizationId: orgId,
      isOwner: roles.owner ?? false,
      isTeacher: roles.teacher ?? false,
      joinedAt: now,
    })
    .onConflictDoUpdate({
      target: organizationMembers.userId,
      set: { isOwner: roles.owner ?? false, isTeacher: roles.teacher ?? false },
    });
  if (!roles.teacher || roles.seat === false) return { seatId: null };
  const seatId = await withTransaction(ctx.handle.db, async (tx) => {
    await lockOrganization(tx, orgId);
    const result = await allocateSeat(tx, orgId, userId, localToday(ctx.clock, TEST_TIMEZONE), now);
    if (!result.ok) throw new Error(`Không gán được seat cho giáo viên: ${result.reason}`);
    return result.seatId;
  });
  return { seatId };
}

export interface CreateClassOptions {
  name?: string;
  teacherIds?: string[];
  /** Tạo `class_paths` để lớp sẵn sàng nhận học viên; `false` = lớp chưa có lộ trình (`CLASS_NOT_READY`). */
  withPath?: boolean;
  dailyMinutes?: 5 | 10 | 15 | 30;
}

/** Tạo lớp, gán giáo viên phụ trách và (mặc định) lộ trình mẫu N5 → N4 cho vocabulary + grammar. */
export async function createTestClass(
  ctx: TestApp,
  orgId: string,
  options: CreateClassOptions = {},
): Promise<{ classId: string }> {
  const { db } = ctx.handle;
  const [cls] = await db
    .insert(classes)
    .values({ organizationId: orgId, name: options.name ?? `Lớp ${nextId()}` })
    .returning();
  const classId = cls!.id;
  if (options.teacherIds && options.teacherIds.length > 0) {
    await db
      .insert(classTeachers)
      .values(options.teacherIds.map((userId) => ({ classId, userId })));
  }
  if (options.withPath ?? true) {
    await db.insert(classPaths).values({
      classId,
      startLevel: 'N5',
      targetLevel: 'N4',
      skills: ['vocabulary', 'grammar'],
      startsOn: '2026-01-05',
      endsOn: '2026-06-30',
      dailyMinutes: options.dailyMinutes ?? 10,
    });
  }
  return { classId };
}

/**
 * Đưa học viên vào lớp qua repository (bỏ qua luồng mời): gán seat (trừ khi `seat: false`), mở thành viên,
 * và tạo `organization_members` cờ false. Ném lỗi nếu không gán được seat.
 */
export async function enrollLearner(
  ctx: TestApp,
  orgId: string,
  classId: string,
  userId: string,
  options: { seat?: boolean } = {},
): Promise<{ membershipId: string; seatId: string | null }> {
  const now = ctx.clock.now();
  return withTransaction(ctx.handle.db, async (tx) => {
    await lockOrganization(tx, orgId);
    let seatId: string | null = null;
    if (options.seat !== false) {
      const alloc = await allocateSeat(
        tx,
        orgId,
        userId,
        localToday(ctx.clock, TEST_TIMEZONE),
        now,
      );
      if (!alloc.ok) throw new Error(`Không gán được seat cho học viên: ${alloc.reason}`);
      seatId = alloc.seatId;
    }
    const opened = await openMembership(tx, {
      classId,
      userId,
      organizationId: orgId,
      seatId,
      consentVersion: 1,
      now,
    });
    if (!opened.ok) throw new Error('Học viên thuộc tổ chức khác');
    return { membershipId: opened.membership.id, seatId };
  });
}

/** Đóng thành viên lớp qua repository (không giải phóng seat – mô phỏng bước thấp của `endMembership`). */
export async function endLearnerMembership(
  ctx: TestApp,
  orgId: string,
  membershipId: string,
  reason: Parameters<typeof closeMembership>[3] = 'removed',
): Promise<void> {
  await withTransaction(ctx.handle.db, async (tx) => {
    await closeMembership(tx, orgId, membershipId, reason, null, ctx.clock.now());
  });
}

/**
 * Tạo lời mời trực tiếp qua CSDL (bỏ qua giữ chỗ/kiểm tra của dịch vụ). Trả token thô để gọi
 * `GET /invitations/{token}`. `expired: true` tạo lời mời đã quá hạn (vẫn `pending` trong CSDL).
 */
export async function createTestInvitation(
  ctx: TestApp,
  orgId: string,
  options: {
    kind: 'owner' | 'teacher' | 'student';
    email: string;
    classId?: string;
    expired?: boolean;
  },
): Promise<{ id: string; token: string }> {
  const token = generateOpaqueToken();
  const now = ctx.clock.now();
  const expiresAt = new Date(now.getTime() + (options.expired ? -1 : 14) * 86_400_000);
  const [row] = await ctx.handle.db
    .insert(invitations)
    .values({
      organizationId: orgId,
      kind: options.kind,
      email: options.email,
      classId: options.classId ?? null,
      tokenHash: sha256Hex(token),
      expiresAt,
    })
    .returning({ id: invitations.id });
  return { id: row!.id, token };
}

/** Một vai trò thử nghiệm trong ma trận quyền. */
export type RoleKey =
  'ANON' | 'USR' | 'LRN' | 'TCH' | 'TCH0' | 'TCHx' | 'OWN' | 'ADM' | 'OWNb' | 'TCHb';

export interface RoleWorld {
  orgA: TestOrg;
  orgB: TestOrg;
  /** Lớp C của tổ chức A, có lộ trình, do TCH và TCH0 phụ trách. */
  classC: string;
  /** Lớp D của tổ chức A do TCHx phụ trách (TCH/TCH0 không phụ trách). */
  classD: string;
  /** Lớp E của tổ chức B (đối tượng "tổ chức khác" khi thử từ phía A). */
  classE: string;
  /** Lớp F của tổ chức A, do TCH + TCH0 phụ trách, ĐÃ lưu trữ (kiểm `CLASS_ARCHIVED`). */
  classArchived: string;
  /** Mã tham gia đang bật của lớp C. */
  joinCodeC: string;
  /** Thành viên đang hoạt động của lớp C. */
  membershipL: string;
  /** Giấy phép đang hiệu lực của tổ chức A. */
  licenseA: string;
  /** Lời mời giáo viên đang chờ của tổ chức A (id, không phải token). */
  invitationA: string;
  users: Record<Exclude<RoleKey, 'ANON'>, TestUser>;
  /** Access token mỗi vai trò, ký theo đồng hồ giả lúc dựng; `ANON` = `undefined`. */
  tokens: Record<RoleKey, string | undefined>;
}

/**
 * Dựng "thế giới" cho ma trận quyền (permissions-matrix.md §1): tổ chức A (lớp C do TCH + TCH0 phụ trách,
 * lớp D do TCHx; học viên LRN trong lớp C) và tổ chức B (OWNb, TCHb, lớp E); USR không thuộc tổ chức nào;
 * ADM là quản trị viên hệ thống. TCH0 giữ vai trò nhưng KHÔNG có seat.
 */
export async function buildRoleWorld(ctx: TestApp): Promise<RoleWorld> {
  const orgA = await createTestOrg(ctx, { name: 'Tổ chức A', seats: 10 });
  const orgB = await createTestOrg(ctx, { name: 'Tổ chức B', seats: 10 });

  const [usr, lrn, tch, tch0, tchx, own, adm, ownb, tchb] = await Promise.all([
    createTestUser(ctx, { displayName: 'USR' }),
    createTestUser(ctx, { displayName: 'LRN' }),
    createTestUser(ctx, { displayName: 'TCH' }),
    createTestUser(ctx, { displayName: 'TCH0' }),
    createTestUser(ctx, { displayName: 'TCHx' }),
    createTestUser(ctx, { displayName: 'OWN' }),
    createTestUser(ctx, { displayName: 'ADM', role: 'admin' }),
    createTestUser(ctx, { displayName: 'OWNb' }),
    createTestUser(ctx, { displayName: 'TCHb' }),
  ]);

  await addOrgRole(ctx, orgA.orgId, own.userId, { owner: true });
  await addOrgRole(ctx, orgA.orgId, tch.userId, { teacher: true });
  await addOrgRole(ctx, orgA.orgId, tch0.userId, { teacher: true, seat: false });
  await addOrgRole(ctx, orgA.orgId, tchx.userId, { teacher: true });
  await addOrgRole(ctx, orgB.orgId, ownb.userId, { owner: true });
  await addOrgRole(ctx, orgB.orgId, tchb.userId, { teacher: true });

  const { classId: classC } = await createTestClass(ctx, orgA.orgId, {
    name: 'Lớp C',
    teacherIds: [tch.userId, tch0.userId],
  });
  const { classId: classD } = await createTestClass(ctx, orgA.orgId, {
    name: 'Lớp D',
    teacherIds: [tchx.userId],
  });
  const { classId: classE } = await createTestClass(ctx, orgB.orgId, {
    name: 'Lớp E',
    teacherIds: [tchb.userId],
  });
  const { classId: classArchived } = await createTestClass(ctx, orgA.orgId, {
    name: 'Lớp F (lưu trữ)',
    teacherIds: [tch.userId, tch0.userId],
  });
  await ctx.handle.db
    .update(classes)
    .set({ status: 'archived', archivedAt: ctx.clock.now() })
    .where(eq(classes.id, classArchived));
  const joinCodeC = generateJoinCode();
  await ctx.handle.db
    .update(classes)
    .set({ joinCode: joinCodeC, joinCodeEnabled: true })
    .where(eq(classes.id, classC));
  const { membershipId } = await enrollLearner(ctx, orgA.orgId, classC, lrn.userId);
  const pendingInvitation = await createTestInvitation(ctx, orgA.orgId, {
    kind: 'teacher',
    email: `pending-${randomUUID()}@example.com`,
  });

  const users = {
    USR: usr,
    LRN: lrn,
    TCH: tch,
    TCH0: tch0,
    TCHx: tchx,
    OWN: own,
    ADM: adm,
    OWNb: ownb,
    TCHb: tchb,
  };
  const tokens = { ANON: undefined } as Record<RoleKey, string | undefined>;
  for (const [key, user] of Object.entries(users)) {
    tokens[key as RoleKey] = await tokenFor(ctx, user);
  }
  return {
    orgA,
    orgB,
    classC,
    classD,
    classE,
    classArchived,
    joinCodeC,
    membershipL: membershipId,
    licenseA: orgA.licenseId!,
    invitationA: pendingInvitation.id,
    users,
    tokens,
  };
}

/** Một UUID ngẫu nhiên hợp lệ không tồn tại trong CSDL (đối chứng "không tồn tại" với "tổ chức khác"). */
export const randomMissingId = (): string => randomUUID();

/** Máy khách hợp đồng cho ứng dụng thử nghiệm (đối chiếu request/response với openapi.yaml). */
export const apiFor = (ctx: TestApp): ContractClient => new ContractClient(ctx.app);
