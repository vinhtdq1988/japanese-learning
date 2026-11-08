import { randomInt } from 'node:crypto';
import { notFoundGeneric, orgError } from '../api/errors.js';
import type { Transaction } from '../db/client.js';
import { logOrgAction } from '../db/repositories/admin-logs.js';
import {
  findClassByJoinCode,
  getClassBrief,
  hasClassPath,
  lockClassInOrg,
  updateClass,
  type ClassBriefDto,
  type ClassRow,
} from '../db/repositories/classes.js';
import { clearJoinAttempts, registerJoinAttempt } from '../db/repositories/join-code-attempts.js';
import { isUniqueViolation } from '../db/repositories/users.js';
import { lockOrganization } from '../db/repositories/organizations.js';
import { getProfile } from '../db/repositories/profiles.js';
import { sharedDataDisclosure } from '../domain/org-types.js';
import type { JoinCodeUpdateInput } from '../domain/org-validation.js';
import { AppError, DEFAULT_LANGUAGE } from '../domain/types.js';
import { enterClassTx } from './class-members.js';
import type { ServiceDeps } from './deps.js';
import type { OrgContext } from './org-access.js';
import { assertClassWritable } from './org-access.js';

// Mã tham gia lớp (spec 004, T054, FR-012, research O4). Chống dò mã: đếm lần nhập THEO TÀI KHOẢN, mọi lỗi mã
// (không tồn tại, tắt, hết hạn, lớp lưu trữ, thiếu lộ trình) trả CÙNG một 404 chung.

/** 32 ký tự không nhập nhằng: bỏ `0`, `1`, `I`, `O` (chữ in hoa; ≈ 10¹² khả năng với 8 ký tự). */
export const JOIN_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const JOIN_CODE_LENGTH = 8;

export function generateJoinCode(): string {
  let code = '';
  for (let i = 0; i < JOIN_CODE_LENGTH; i += 1) {
    code += JOIN_CODE_ALPHABET[randomInt(JOIN_CODE_ALPHABET.length)];
  }
  return code;
}

/** Chuẩn hóa mã người dùng nhập: bỏ khoảng trắng/gạch ngang, in hoa. */
export function normalizeJoinCode(input: string): string {
  return input.replace(/[\s-]+/g, '').toUpperCase();
}

type CodeDeps = Pick<ServiceDeps, 'config' | 'db' | 'clock'>;

export interface JoinCodeDto {
  code: string | null;
  enabled: boolean;
  expiresAt: string | null;
}

const joinCodeDto = (
  cls: Pick<ClassRow, 'joinCode' | 'joinCodeEnabled' | 'joinCodeExpiresAt'>,
): JoinCodeDto => ({
  code: cls.joinCode,
  enabled: cls.joinCodeEnabled,
  expiresAt: cls.joinCodeExpiresAt ? cls.joinCodeExpiresAt.toISOString() : null,
});

export function getJoinCode(cls: ClassRow): JoinCodeDto {
  return joinCodeDto(cls);
}

/** Sinh mã mới chưa dùng; thử lại khi trùng (UNIQUE) – xác suất trùng cực nhỏ. */
async function assignFreshCode(
  tx: Transaction,
  organizationId: string,
  classId: string,
  patch: { joinCodeEnabled?: boolean; joinCodeExpiresAt?: Date | null },
  now: Date,
): Promise<ClassRow> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      // Mỗi lần thử trong savepoint riêng để lỗi UNIQUE không làm hỏng giao dịch bao ngoài.
      return await tx.transaction(async (savepoint) => {
        const row = await updateClass(
          savepoint,
          organizationId,
          classId,
          { joinCode: generateJoinCode(), ...patch },
          now,
        );
        if (!row) throw notFoundGeneric();
        return row;
      });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  }
  throw new AppError(500, 'INTERNAL_ERROR', 'Không sinh được mã tham gia');
}

/**
 * `PUT /classes/{id}/join-code`: bật/tắt (bật lần đầu sinh mã) và đặt hạn tùy chọn. Bật khi lớp chưa có lộ
 * trình ⇒ 409 `CLASS_NOT_READY` (FR-010). Lớp lưu trữ ⇒ 409 `CLASS_ARCHIVED`.
 */
export async function setJoinCode(
  deps: CodeDeps,
  ctx: OrgContext,
  classId: string,
  input: JoinCodeUpdateInput,
): Promise<JoinCodeDto> {
  const now = deps.clock.now();
  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
  if (expiresAt && expiresAt <= now) {
    throw new AppError(422, 'VALIDATION_FAILED', 'Dữ liệu không hợp lệ', {
      expiresAt: 'Hạn dùng phải ở tương lai',
    });
  }
  return deps.db.transaction(async (tx) => {
    const cls = await lockClassInOrg(tx, ctx.organizationId, classId);
    if (!cls) throw notFoundGeneric();
    assertClassWritable(cls);
    if (input.enabled && !(await hasClassPath(tx, classId))) {
      throw orgError('CLASS_NOT_READY', 'Hãy đặt lộ trình cho lớp trước khi bật mã tham gia');
    }
    const patch = {
      joinCodeEnabled: input.enabled,
      ...(input.expiresAt !== undefined ? { joinCodeExpiresAt: expiresAt } : {}),
    };
    let row: ClassRow | undefined;
    if (input.enabled && !cls.joinCode) {
      row = await assignFreshCode(tx, ctx.organizationId, classId, patch, now);
    } else {
      row = await updateClass(tx, ctx.organizationId, classId, patch, now);
    }
    await logOrgAction(tx, {
      actorId: ctx.userId,
      organizationId: ctx.organizationId,
      action: 'class.join_code',
      targetType: 'class',
      targetId: classId,
      diff: { enabled: input.enabled, expiresAt: input.expiresAt ?? null },
    });
    return joinCodeDto(row!);
  });
}

/** `POST /classes/{id}/join-code/rotate`: mã mới thay ngay mã cũ (mã cũ không còn tra được). */
export async function rotateJoinCode(
  deps: CodeDeps,
  ctx: OrgContext,
  classId: string,
): Promise<JoinCodeDto> {
  const now = deps.clock.now();
  return deps.db.transaction(async (tx) => {
    const cls = await lockClassInOrg(tx, ctx.organizationId, classId);
    if (!cls) throw notFoundGeneric();
    assertClassWritable(cls);
    if (!(await hasClassPath(tx, classId))) {
      throw orgError('CLASS_NOT_READY', 'Hãy đặt lộ trình cho lớp trước khi tạo mã tham gia');
    }
    const row = await assignFreshCode(tx, ctx.organizationId, classId, {}, now);
    await logOrgAction(tx, {
      actorId: ctx.userId,
      organizationId: ctx.organizationId,
      action: 'class.join_code',
      targetType: 'class',
      targetId: classId,
      diff: { rotated: true },
    });
    return joinCodeDto(row);
  });
}

/**
 * Ghi nhận lần nhập mã rồi tra lớp. Sai ngưỡng ⇒ 429 `TOO_MANY_REQUESTS` kèm `Retry-After`; mã không dùng
 * được vì BẤT KỲ lý do nào ⇒ cùng 404 chung. Mã đúng ⇒ xóa bộ đếm.
 */
async function resolveCode(deps: CodeDeps, userId: string, rawCode: string): Promise<ClassRow> {
  const now = deps.clock.now();
  const attempt = await registerJoinAttempt(
    deps.db,
    userId,
    now,
    deps.config.JOIN_CODE_MAX_FAILURES,
    deps.config.JOIN_CODE_LOCK_MINUTES,
  );
  if (!attempt.allowed) {
    const seconds = Math.max(1, Math.ceil((attempt.lockedUntil.getTime() - now.getTime()) / 1000));
    throw new AppError(
      429,
      'TOO_MANY_REQUESTS',
      'Bạn đã nhập sai mã quá nhiều lần, hãy thử lại sau',
      undefined,
      { 'Retry-After': String(seconds) },
    );
  }
  const cls = await findClassByJoinCode(deps.db, normalizeJoinCode(rawCode), now);
  if (!cls) throw notFoundGeneric();
  await clearJoinAttempts(deps.db, userId);
  return cls;
}

export interface JoinPreviewDto {
  status: 'preview';
  class: ClassBriefDto;
  disclosure: ReturnType<typeof sharedDataDisclosure>;
}

export interface JoinedDto {
  status: 'joined';
  class: ClassBriefDto;
  joinedAt: string;
}

/**
 * `POST /me/class/join`: hai bước không trạng thái. Không `decision` ⇒ xem trước `{class, disclosure}`;
 * `stay_personal` ⇒ `null` (route trả 204, không đổi gì); `join_class` + `confirmed: true` ⇒ vào lớp.
 * Mã được tra lại ở cả hai bước.
 */
export async function joinByCode(
  deps: CodeDeps,
  userId: string,
  input: { code: string; decision?: 'join_class' | 'stay_personal'; confirmed?: boolean },
): Promise<JoinPreviewDto | JoinedDto | null> {
  if (input.decision === 'join_class' && input.confirmed !== true) {
    throw new AppError(422, 'VALIDATION_FAILED', 'Dữ liệu không hợp lệ', {
      confirmed: 'Cần xác nhận (confirmed: true) sau khi đọc dữ liệu được chia sẻ',
    });
  }
  const cls = await resolveCode(deps, userId, input.code);
  if (input.decision === 'stay_personal') return null;

  if (!input.decision) {
    const brief = await getClassBrief(deps.db, cls.organizationId, cls.id);
    if (!brief) throw notFoundGeneric();
    const language = (await getProfile(deps.db, userId))?.language ?? DEFAULT_LANGUAGE;
    return { status: 'preview', class: brief, disclosure: sharedDataDisclosure(language) };
  }

  return deps.db.transaction(async (tx) => {
    if (!(await lockOrganization(tx, cls.organizationId))) throw notFoundGeneric();
    const membership = await enterClassTx(tx, deps, {
      organizationId: cls.organizationId,
      classId: cls.id,
      userId,
      requireFreeSeat: true,
    });
    const brief = await getClassBrief(tx, cls.organizationId, cls.id);
    if (!brief) throw notFoundGeneric();
    return { status: 'joined' as const, class: brief, joinedAt: membership.joinedAt.toISOString() };
  });
}
