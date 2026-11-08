import { inviteeUnavailable, notFoundGeneric, orgError } from '../api/errors.js';
import type { Transaction } from '../db/client.js';
import { logOrgAction } from '../db/repositories/admin-logs.js';
import {
  countActiveMembers,
  findActiveMembershipByUser,
  findActiveMembershipInClass,
} from '../db/repositories/class-memberships.js';
import {
  getClassBrief,
  getClassInOrg,
  hasClassPath,
  isClassTeacher,
  type ClassBriefDto,
} from '../db/repositories/classes.js';
import {
  closeInvitation,
  expireStaleForEmail,
  findByTokenHash,
  findPendingForEmail,
  insertInvitation,
  lockInvitation,
  newInvitationToken,
  type InvitationRow,
} from '../db/repositories/invitations.js';
import { findOrgMemberOfUser, grantOrgRole } from '../db/repositories/organization-members.js';
import { getOrganization, lockOrganization } from '../db/repositories/organizations.js';
import { getProfile } from '../db/repositories/profiles.js';
import { allocateSeat, findSeatByHolder } from '../db/repositories/seats.js';
import { sharedDataDisclosure, type CsvOutcome } from '../domain/org-types.js';
import { canMoveBetween, enterClassTx, transferMembershipTx } from './class-members.js';
import { findUserByEmail, findUserById } from '../db/repositories/users.js';
import type { InvitationRespondInput } from '../domain/org-validation.js';
import { AppError, DEFAULT_LANGUAGE } from '../domain/types.js';
import { localToday } from '../engine/clock.js';
import type { ServiceDeps } from './deps.js';
import { invitationDto, type InvitationRowDto } from './org-dto.js';
import { sendOrgInvitationEmail } from './org-emails.js';
import { assertSeatAvailable, readSeatAvailability, seatError } from './org-seats.js';
import type { OrgContext } from './org-access.js';
import { sha256Hex } from './tokens.js';

// Dịch vụ lời mời (spec 004, T033, FR-002, FR-005, FR-011). Nhánh `owner`/`teacher` ở file này; nhánh học
// viên (`kind = 'student'`, hai lựa chọn + thông báo dữ liệu chia sẻ) thêm ở US2 (T050).

type InviteDeps = Pick<ServiceDeps, 'config' | 'db' | 'clock' | 'jobQueue'>;

const DAY_MS = 86_400_000;

const validation = (field: string, message: string) =>
  new AppError(422, 'VALIDATION_FAILED', 'Dữ liệu không hợp lệ', { [field]: message });

export interface CreateInvitationInput {
  organizationId: string;
  kind: 'owner' | 'teacher';
  /** Email đã chuẩn hóa chữ thường. */
  email: string;
  /** Người mời; null cho lời mời do hệ thống tạo. */
  invitedBy: string | null;
}

export interface CreatedInvitation {
  row: InvitationRow;
  /** Token thô, chỉ tồn tại trong bộ nhớ để đưa vào email. */
  token: string;
  organizationName: string;
}

/**
 * Tạo lời mời trong giao dịch của caller (tổ chức ĐÃ được caller khóa). Kiểm tra: tài khoản của tổ chức
 * khác ⇒ `INVITEE_UNAVAILABLE`; đã có vai trò đó ⇒ 422; đã có lời mời chờ ⇒ 409; giáo viên cần chỗ trống
 * (trừ chủ tổ chức và người đã giữ seat). Email thuộc tài khoản `pending_deletion` vẫn mời được và vẫn giữ chỗ.
 */
export async function createInvitationTx(
  tx: Transaction,
  deps: Pick<ServiceDeps, 'config' | 'clock'>,
  rawInput: CreateInvitationInput,
): Promise<CreatedInvitation> {
  const input = { ...rawInput, email: rawInput.email.trim().toLowerCase() };
  const org = await getOrganization(tx, input.organizationId);
  if (!org) throw notFoundGeneric();
  const now = deps.clock.now();

  const user = await findUserByEmail(tx, input.email);
  let needsSeat = input.kind === 'teacher';
  if (user) {
    const member = await findOrgMemberOfUser(tx, user.id);
    if (member && member.organizationId !== input.organizationId) throw inviteeUnavailable();
    if (member) {
      if (input.kind === 'owner' && member.isOwner) {
        throw validation('email', 'Người này đã là chủ tổ chức');
      }
      if (input.kind === 'teacher' && member.isTeacher) {
        throw validation('email', 'Người này đã là giáo viên của tổ chức');
      }
      if (member.isOwner) needsSeat = false;
    }
    if (needsSeat && (await findSeatByHolder(tx, input.organizationId, user.id))) needsSeat = false;
  }

  await expireStaleForEmail(tx, input.organizationId, input.email, now);
  if (await findPendingForEmail(tx, input.organizationId, input.email, now)) {
    throw new AppError(409, 'VALIDATION_FAILED', 'Dữ liệu không hợp lệ', {
      email: 'Đã có lời mời đang chờ cho email này',
    });
  }

  if (input.kind === 'teacher') {
    if (org.status !== 'active') throw seatError('no_license');
    if (needsSeat) await assertSeatAvailable(tx, deps, input.organizationId);
  }

  const { token, tokenHash } = newInvitationToken();
  const row = await insertInvitation(tx, {
    organizationId: input.organizationId,
    kind: input.kind,
    email: input.email,
    tokenHash,
    expiresAt: new Date(now.getTime() + deps.config.INVITATION_TTL_DAYS * DAY_MS),
    invitedBy: input.invitedBy,
  });
  await logOrgAction(tx, {
    actorId: input.invitedBy,
    organizationId: input.organizationId,
    action: input.kind === 'owner' ? 'owner.invite' : 'teacher.invite',
    targetType: 'invitation',
    targetId: row.id,
    diff: { kind: input.kind },
  });
  return { row, token, organizationName: org.name };
}

/** Gửi email lời mời song ngữ qua hàng đợi, SAU khi giao dịch tạo lời mời đã commit. */
export async function deliverInvitation(
  deps: InviteDeps,
  created: CreatedInvitation,
): Promise<void> {
  const inviterName = created.row.invitedBy
    ? ((await getProfile(deps.db, created.row.invitedBy))?.displayName ?? null)
    : null;
  await sendOrgInvitationEmail(deps, created.row.email, {
    kind: created.row.kind,
    organizationName: created.organizationName,
    inviterName,
    token: created.token,
    expiresAt: created.row.expiresAt,
  });
}

/** Mời chủ tổ chức / giáo viên: tạo trong giao dịch khóa tổ chức rồi gửi email. */
export async function createInvitation(
  deps: InviteDeps,
  input: CreateInvitationInput,
): Promise<InvitationRowDto> {
  const created = await deps.db.transaction(async (tx) => {
    if (!(await lockOrganization(tx, input.organizationId))) throw notFoundGeneric();
    return createInvitationTx(tx, deps, input);
  });
  await deliverInvitation(deps, created);
  return invitationDto(created.row);
}

/**
 * Lời mời dùng được bởi `userId`: còn `pending`, chưa hết hạn, email người gọi khớp (không phân biệt hoa
 * thường) và tài khoản `active`. Mọi trường hợp còn lại – token sai, đã dùng, hết hạn, email không khớp,
 * tài khoản chờ xóa – đều là 404 chung, thân giống hệt nhau (FR-007).
 */
async function usableInvitation(
  deps: Pick<ServiceDeps, 'db' | 'clock'>,
  userId: string,
  token: string,
): Promise<InvitationRow> {
  const row = await findByTokenHash(deps.db, sha256Hex(token));
  const user = await findUserById(deps.db, userId);
  if (
    !row ||
    !user ||
    row.status !== 'pending' ||
    row.expiresAt <= deps.clock.now() ||
    user.status !== 'active' ||
    user.email.toLowerCase() !== row.email.toLowerCase()
  ) {
    throw notFoundGeneric();
  }
  return row;
}

export interface InvitationPreviewDto {
  kind: InvitationRow['kind'];
  organizationName: string;
  invitedBy: string | null;
  expiresAt: string;
  /** Chỉ khi `kind = 'student'`: lớp được mời. */
  class?: ClassBriefDto;
  /** Chỉ khi `kind = 'student'`: thông báo dữ liệu chia sẻ + hai lựa chọn ngang nhau (FR-016). */
  disclosure?: ReturnType<typeof sharedDataDisclosure>;
}

export async function previewInvitation(
  deps: Pick<ServiceDeps, 'db' | 'clock'>,
  userId: string,
  token: string,
): Promise<InvitationPreviewDto> {
  const row = await usableInvitation(deps, userId, token);
  const org = await getOrganization(deps.db, row.organizationId);
  if (!org) throw notFoundGeneric();
  const inviter = row.invitedBy ? await getProfile(deps.db, row.invitedBy) : undefined;
  const dto: InvitationPreviewDto = {
    kind: row.kind,
    organizationName: org.name,
    invitedBy: inviter?.displayName ?? null,
    expiresAt: row.expiresAt.toISOString(),
  };
  if (row.kind === 'student') {
    // Lớp đã lưu trữ ⇒ lời mời đã bị hủy; phòng trường hợp đua vẫn trả 404 chung thay vì xem trước một lời mời chết.
    const cls = row.classId ? await getClassInOrg(deps.db, org.id, row.classId) : undefined;
    const brief =
      cls?.status === 'active' ? await getClassBrief(deps.db, org.id, cls.id) : undefined;
    if (!brief) throw notFoundGeneric();
    const language = (await getProfile(deps.db, userId))?.language ?? DEFAULT_LANGUAGE;
    dto.class = brief;
    dto.disclosure = sharedDataDisclosure(language);
  }
  return dto;
}

export interface InvitationRespondResultDto {
  status: 'accepted' | 'declined' | 'joined' | 'stayed_personal';
  /** Khi `joined`. */
  class?: ClassBriefDto;
  joinedAt?: string;
}

/**
 * Trả lời lời mời chủ tổ chức/giáo viên. `accept` đặt cờ vai trò trong `organization_members`; giáo viên
 * (không phải chủ tổ chức) chiếm một seat. Kiểm lại `INVITEE_UNAVAILABLE` lúc chấp nhận để chống đua. Mất
 * chỗ lúc chấp nhận ⇒ 409 `SEAT_UNAVAILABLE`/422 `SEAT_REASSIGN_LIMIT`, giao dịch hoàn tác nên lời mời giữ
 * `pending`. Khóa tổ chức rồi khóa dòng lời mời nên hai người cùng nhận seat cuối chỉ một người thành công.
 */
export async function respondInvitation(
  deps: Pick<ServiceDeps, 'config' | 'db' | 'clock'>,
  userId: string,
  token: string,
  input: InvitationRespondInput,
): Promise<InvitationRespondResultDto> {
  const preliminary = await usableInvitation(deps, userId, token);
  if (preliminary.kind === 'student')
    return respondStudentInvitation(deps, userId, preliminary, input);
  const accepts = input.decision === 'accept';
  if (!accepts && input.decision !== 'decline') {
    throw validation('decision', 'Lời mời này chỉ nhận "accept" hoặc "decline"');
  }

  return deps.db.transaction(async (tx) => {
    const org = await lockOrganization(tx, preliminary.organizationId);
    if (!org) throw notFoundGeneric();
    const row = await lockInvitation(tx, preliminary.organizationId, preliminary.id);
    const now = deps.clock.now();
    if (!row || row.status !== 'pending' || row.expiresAt <= now) throw notFoundGeneric();

    if (!accepts) {
      await closeInvitation(tx, row.organizationId, row.id, 'declined', now);
      return { status: 'declined' as const };
    }

    const member = await findOrgMemberOfUser(tx, userId);
    if (member && member.organizationId !== row.organizationId) throw inviteeUnavailable();

    await grantOrgRole(
      tx,
      row.organizationId,
      userId,
      { owner: row.kind === 'owner', teacher: row.kind === 'teacher' },
      now,
    );
    if (row.kind === 'teacher' && !member?.isOwner) {
      if (org.status !== 'active') throw seatError('no_license');
      const seat = await allocateSeat(
        tx,
        row.organizationId,
        userId,
        localToday(deps.clock, deps.config.ORG_TIMEZONE),
        now,
      );
      if (!seat.ok) throw seatError(seat.reason);
      if (!seat.alreadyHeld) {
        await logOrgAction(tx, {
          actorId: userId,
          organizationId: row.organizationId,
          action: 'seat.assign',
          targetType: 'seat',
          targetId: seat.seatId,
          diff: { userId, reassigned: seat.reassigned, via: 'invitation' },
        });
      }
    }
    await closeInvitation(tx, row.organizationId, row.id, 'accepted', now, userId);
    return { status: 'accepted' as const };
  });
}

/**
 * Thu hồi lời mời `pending` theo id: chủ tổ chức thu hồi mọi lời mời của tổ chức; giáo viên chỉ lời mời học
 * viên của lớp mình phụ trách. Ngoài phạm vi (kể cả đã đóng) ⇒ 404 chung. Trả lại chỗ giữ vì lời mời không
 * còn `pending`.
 */
export async function revokeInvitation(
  deps: Pick<ServiceDeps, 'db' | 'clock'>,
  ctx: OrgContext,
  invitationId: string,
): Promise<void> {
  await deps.db.transaction(async (tx) => {
    if (!(await lockOrganization(tx, ctx.organizationId))) throw notFoundGeneric();
    const row = await lockInvitation(tx, ctx.organizationId, invitationId);
    if (!row || row.status !== 'pending') throw notFoundGeneric();
    const allowed =
      ctx.isOwner ||
      (ctx.isTeacher &&
        row.kind === 'student' &&
        row.classId !== null &&
        (await isClassTeacher(tx, ctx.organizationId, row.classId, ctx.userId)));
    if (!allowed) throw notFoundGeneric();
    const now = deps.clock.now();
    await closeInvitation(tx, ctx.organizationId, row.id, 'revoked', now);
    await logOrgAction(tx, {
      actorId: ctx.userId,
      organizationId: ctx.organizationId,
      action: 'invitation.revoke',
      targetType: 'invitation',
      targetId: row.id,
      diff: { kind: row.kind },
    });
  });
}

// --- Nhánh học viên (spec 004, T050, FR-010 → FR-016) ---

/**
 * Trả lời lời mời học viên: HAI lựa chọn ngang nhau. `join_class` cần `confirmed: true` ⇒ kiểm điều kiện vào
 * lớp rồi mở thành viên và tính seat; thất bại (hết seat, lớp đầy…) làm hoàn tác giao dịch nên lời mời giữ
 * `pending` và học viên tiếp tục lộ trình cá nhân. `stay_personal` đóng lời mời `declined`, không tốn seat,
 * không đổi hồ sơ (FR-016).
 */
async function respondStudentInvitation(
  deps: Pick<ServiceDeps, 'config' | 'db' | 'clock'>,
  userId: string,
  preliminary: InvitationRow,
  input: InvitationRespondInput,
): Promise<InvitationRespondResultDto> {
  const joins = input.decision === 'join_class';
  if (!joins && input.decision !== 'stay_personal') {
    throw validation('decision', 'Lời mời vào lớp chỉ nhận "join_class" hoặc "stay_personal"');
  }
  if (joins && input.confirmed !== true) {
    throw validation(
      'confirmed',
      'Cần xác nhận (confirmed: true) sau khi đọc dữ liệu được chia sẻ',
    );
  }

  return deps.db.transaction(async (tx) => {
    const org = await lockOrganization(tx, preliminary.organizationId);
    if (!org) throw notFoundGeneric();
    const row = await lockInvitation(tx, preliminary.organizationId, preliminary.id);
    const now = deps.clock.now();
    if (!row || row.status !== 'pending' || row.expiresAt <= now || !row.classId) {
      throw notFoundGeneric();
    }
    if (!joins) {
      await closeInvitation(tx, row.organizationId, row.id, 'declined', now);
      return { status: 'stayed_personal' as const };
    }
    // Đang ở lớp KHÁC trong cùng tổ chức: chấp nhận = đồng ý chuyển lớp (giữ seat, tiến độ, lịch ôn). Chỉ chuyển
    // khi người mời còn quyền ở cả hai lớp; ngược lại `enterClassTx`/`transferMembershipTx` báo `ALREADY_IN_CLASS`.
    const current = await findActiveMembershipByUser(tx, userId);
    const membership =
      current && current.organizationId === row.organizationId && current.classId !== row.classId
        ? await transferMembershipTx(tx, deps, {
            organizationId: row.organizationId,
            userId,
            current,
            toClassId: row.classId,
            authorizedBy: row.invitedBy,
          })
        : await enterClassTx(tx, deps, {
            organizationId: row.organizationId,
            classId: row.classId,
            userId,
            requireFreeSeat: false,
          });
    await closeInvitation(tx, row.organizationId, row.id, 'accepted', now, userId);
    const brief = await getClassBrief(tx, row.organizationId, row.classId);
    if (!brief) throw notFoundGeneric();
    return { status: 'joined' as const, class: brief, joinedAt: membership.joinedAt.toISOString() };
  });
}

export interface StudentInviteeInput {
  /** Email thô từ người dùng/CSV; được cắt khoảng trắng và hạ chữ thường khi xử lý. */
  email: string;
  displayName?: string | null;
}

export interface StudentInviteResult {
  /** Số thứ tự (từ 1) trong danh sách hoặc dòng dữ liệu của file. */
  row: number;
  email: string;
  outcome: CsvOutcome;
}

export interface StudentInviteBatch {
  results: StudentInviteResult[];
  summary: Record<string, number>;
  /** Lời mời đã tạo, để gửi email SAU khi giao dịch commit. */
  created: CreatedInvitation[];
}

/** Email cho phép: một `@`, miền có dấu `.`, ≤ 254 ký tự, không khoảng trắng/ký tự điều khiển (csv-formats §1). */
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/u;
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u001f\u007f]/u;
export const isValidInviteEmail = (email: string): boolean =>
  email.length > 0 && email.length <= 254 && EMAIL_RE.test(email) && !CONTROL_RE.test(email);

/**
 * Mời một loạt học viên vào lớp TRONG giao dịch của caller (tổ chức ĐÃ bị khóa): xử lý tuần tự, mỗi phần tử
 * nhận đúng MỘT `outcome` theo thứ tự ưu tiên của csv-formats.md §1, nên tổng số kết quả = số phần tử đầu vào
 * và sức chứa không bao giờ vượt (hết seat ở phần tử k ⇒ các phần tử hợp lệ sau đó nhận `no_seat`).
 */
export async function inviteStudentsTx(
  tx: Transaction,
  deps: Pick<ServiceDeps, 'config' | 'clock'>,
  params: {
    organizationId: string;
    classId: string;
    invitedBy: string;
    invitees: StudentInviteeInput[];
  },
): Promise<StudentInviteBatch> {
  const { organizationId, classId } = params;
  const org = await getOrganization(tx, organizationId);
  if (!org) throw notFoundGeneric();
  const now = deps.clock.now();
  const results: StudentInviteResult[] = [];
  const created: CreatedInvitation[] = [];
  const seen = new Set<string>();
  const summary: Record<string, number> = { total: params.invitees.length };
  const record = (row: number, email: string, outcome: CsvOutcome) => {
    results.push({ row, email, outcome });
    summary[outcome] = (summary[outcome] ?? 0) + 1;
  };

  let row = 0;
  for (const invitee of params.invitees) {
    row += 1;
    const raw = invitee.email.trim();
    const email = raw.toLowerCase();
    if (!isValidInviteEmail(email)) {
      record(row, raw, 'invalid_email');
      continue;
    }
    if (seen.has(email)) {
      record(row, email, 'duplicate_in_file');
      continue;
    }
    seen.add(email);

    const user = await findUserByEmail(tx, email);
    let holdsSeat = false;
    if (user) {
      const membership = await findActiveMembershipByUser(tx, user.id);
      if (membership && membership.organizationId === organizationId) {
        record(
          row,
          email,
          membership.classId === classId ? 'already_in_class' : 'already_in_other_class',
        );
        continue;
      }
      const member = await findOrgMemberOfUser(tx, user.id);
      if (
        (membership && membership.organizationId !== organizationId) ||
        (member && member.organizationId !== organizationId) ||
        (await isClassTeacher(tx, organizationId, classId, user.id))
      ) {
        record(row, email, 'unavailable');
        continue;
      }
      holdsSeat = (await findSeatByHolder(tx, organizationId, user.id)) !== undefined;
    }

    await expireStaleForEmail(tx, organizationId, email, now);
    if (await findPendingForEmail(tx, organizationId, email, now)) {
      record(row, email, 'already_invited');
      continue;
    }
    if (!holdsSeat) {
      const availability = await readSeatAvailability(tx, deps, organizationId);
      if (org.status !== 'active' || availability.available < 1) {
        record(row, email, 'no_seat');
        continue;
      }
    }

    const { token, tokenHash } = newInvitationToken();
    const inserted = await insertInvitation(tx, {
      organizationId,
      classId,
      kind: 'student',
      email,
      displayNameHint: invitee.displayName?.trim().slice(0, 80) || null,
      tokenHash,
      expiresAt: new Date(now.getTime() + deps.config.INVITATION_TTL_DAYS * DAY_MS),
      invitedBy: params.invitedBy,
    });
    created.push({ row: inserted, token, organizationName: org.name });
    record(row, email, 'invited');
  }

  if (created.length > 0) {
    await logOrgAction(tx, {
      actorId: params.invitedBy,
      organizationId,
      action: 'class.invite',
      targetType: 'class',
      targetId: classId,
      diff: { invited: created.length, total: params.invitees.length },
    });
  }
  return { results, summary, created };
}

/** Gửi email các lời mời học viên đã tạo (SAU commit); thư nêu tên lớp và người mời. */
export async function deliverStudentInvitations(
  deps: InviteDeps,
  className: string,
  created: CreatedInvitation[],
  /** Có ⇒ đây là lời mời CHUYỂN lớp: thư nêu lớp hiện tại và nói rõ học viên có thể từ chối. */
  fromClassName?: string | null,
): Promise<void> {
  for (const item of created) {
    const inviterName = item.row.invitedBy
      ? ((await getProfile(deps.db, item.row.invitedBy))?.displayName ?? null)
      : null;
    await sendOrgInvitationEmail(deps, item.row.email, {
      kind: 'student',
      organizationName: item.organizationName,
      className,
      fromClassName: fromClassName ?? null,
      inviterName,
      token: item.token,
      expiresAt: item.row.expiresAt,
    });
  }
}

/**
 * `POST /classes/{id}/invitations`: mời học viên bằng email. Lớp phải `active` (409 `CLASS_ARCHIVED`) và có
 * lộ trình (409 `CLASS_NOT_READY`, FR-010). Mỗi lời mời giữ chỗ một seat.
 */
export async function inviteLearners(
  deps: InviteDeps,
  ctx: OrgContext,
  classId: string,
  invitees: StudentInviteeInput[],
): Promise<{ results: StudentInviteResult[]; summary: Record<string, number> }> {
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
  return { results: batch.results, summary: batch.summary };
}

/**
 * `POST /classes/{id}/members/{userId}/move`: MỜI học viên đang ở lớp `fromClassId` chuyển sang `toClassId`
 * (spec 004, T126, US8, FR-014). KHÔNG chuyển ngay: học viên PHẢI đồng ý lại (Hiến pháp III) bằng cách chấp nhận
 * lời mời – lúc đó `respondStudentInvitation` mới chuyển, giữ seat/tiến độ/lịch ôn. Người mời phải là chủ tổ
 * chức hoặc giáo viên phụ trách cả hai lớp; lớp đích ngoài phạm vi ⇒ 404 chung. Lời mời không giữ chỗ seat vì
 * học viên đã giữ seat của tổ chức.
 */
export async function inviteMoveToClass(
  deps: InviteDeps,
  ctx: OrgContext,
  fromClassId: string,
  userId: string,
  toClassId: string,
): Promise<void> {
  if (fromClassId === toClassId) throw validation('toClassId', 'Lớp đích phải khác lớp hiện tại');
  const batch = await deps.db.transaction(async (tx) => {
    const org = await lockOrganization(tx, ctx.organizationId);
    if (!org) throw notFoundGeneric();
    const from = await getClassInOrg(tx, ctx.organizationId, fromClassId);
    if (!from) throw notFoundGeneric();
    if (from.status === 'archived') throw orgError('CLASS_ARCHIVED', 'Lớp đã được lưu trữ');
    const membership = await findActiveMembershipInClass(
      tx,
      ctx.organizationId,
      fromClassId,
      userId,
    );
    if (!membership) throw notFoundGeneric();

    const to = await getClassInOrg(tx, ctx.organizationId, toClassId);
    if (
      !to ||
      !(await canMoveBetween(tx, ctx.organizationId, ctx.userId, fromClassId, toClassId))
    ) {
      throw notFoundGeneric();
    }
    if (to.status === 'archived') throw orgError('CLASS_ARCHIVED', 'Lớp đích đã được lưu trữ');
    if (!(await hasClassPath(tx, toClassId))) {
      throw orgError('CLASS_NOT_READY', 'Lớp đích chưa có lộ trình nên chưa nhận học viên');
    }
    if (
      (await countActiveMembers(tx, ctx.organizationId, toClassId)) >= deps.config.CLASS_MAX_MEMBERS
    ) {
      throw orgError('CLASS_FULL', 'Lớp đích đã đủ số học viên tối đa');
    }
    if (await isClassTeacher(tx, ctx.organizationId, toClassId, userId)) throw inviteeUnavailable();

    const user = await findUserById(tx, userId);
    if (!user || user.status !== 'active') throw notFoundGeneric();
    const email = user.email.toLowerCase();
    const now = deps.clock.now();
    await expireStaleForEmail(tx, ctx.organizationId, email, now);
    if (await findPendingForEmail(tx, ctx.organizationId, email, now)) {
      throw new AppError(409, 'VALIDATION_FAILED', 'Học viên đã có một lời mời đang chờ', {
        email: 'Đã có lời mời đang chờ cho học viên này',
      });
    }
    const profile = await getProfile(tx, userId);
    const { token, tokenHash } = newInvitationToken();
    const inserted = await insertInvitation(tx, {
      organizationId: ctx.organizationId,
      classId: toClassId,
      kind: 'student',
      email,
      displayNameHint: profile?.displayName?.slice(0, 80) ?? null,
      tokenHash,
      expiresAt: new Date(now.getTime() + deps.config.INVITATION_TTL_DAYS * DAY_MS),
      invitedBy: ctx.userId,
    });
    await logOrgAction(tx, {
      actorId: ctx.userId,
      organizationId: ctx.organizationId,
      action: 'class.move_student',
      targetType: 'membership',
      targetId: membership.id,
      diff: { op: 'invite', fromClassId, toClassId, userId, invitationId: inserted.id },
    });
    return {
      created: [{ row: inserted, token, organizationName: org.name }] satisfies CreatedInvitation[],
      toName: to.name,
      fromName: from.name,
    };
  });
  await deliverStudentInvitations(deps, batch.toName, batch.created, batch.fromName);
}
