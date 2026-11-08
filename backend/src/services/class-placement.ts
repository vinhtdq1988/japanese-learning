import { notFoundGeneric, orgError } from '../api/errors.js';
import { logOrgAction } from '../db/repositories/admin-logs.js';
import {
  closeOpenRequest,
  getOpenRequest,
  getOpenRequestOfClass,
  hasSubmittedForRequest,
  insertRequest,
  listRequestResults,
  type PlacementRequestRow,
} from '../db/repositories/class-placement.js';
import { listDashboardMembers } from '../db/repositories/class-stats.js';
import { isUniqueViolation } from '../db/repositories/users.js';
import { lockClassInOrg } from '../db/repositories/classes.js';
import { AppError } from '../domain/types.js';
import type { ServiceDeps } from './deps.js';
import type { OrgContext } from './org-access.js';

// Yêu cầu cả lớp làm bài kiểm tra trình độ đầu vào (spec 004, T124, US8, FR-034, api-changes §11): giáo viên tạo
// yêu cầu, học viên nộp qua `POST /placement/submit` kèm `classRequestId` (xử lý ở `placement.ts`), giáo viên xem
// kết quả từng người và phân bố. Kết quả KHÔNG tự đổi lộ trình lớp (và không đổi kết quả cá nhân của học viên).

type PlacementDeps = Pick<ServiceDeps, 'db' | 'clock'>;

/** `ClassPlacementRequest` của OpenAPI. */
export interface PlacementRequestDto {
  id: string;
  requestedAt: string;
  closedAt: string | null;
}

/** Một dòng kết quả của `ClassPlacementResults`. */
export interface PlacementResultItemDto {
  userId: string;
  displayName: string;
  status: 'done' | 'pending';
  estimatedLevel?: string;
  score?: number;
  total?: number;
  takenAt?: string;
}

export interface ClassPlacementResultsDto {
  request: PlacementRequestDto;
  results: PlacementResultItemDto[];
  /** Số học viên đã làm bài theo trình độ ước tính; luôn có đủ bốn khóa. */
  distribution: { none: number; N5: number; N4: number; N3: number };
}

const requestDto = (row: PlacementRequestRow): PlacementRequestDto => ({
  id: row.id,
  requestedAt: row.requestedAt.toISOString(),
  closedAt: row.closedAt ? row.closedAt.toISOString() : null,
});

const alreadyOpen = () =>
  new AppError(409, 'VALIDATION_FAILED', 'Lớp đang có một yêu cầu kiểm tra trình độ chưa đóng', {
    placementRequest: 'Đã có yêu cầu đang mở',
  });

/** `POST /classes/{id}/placement-requests`. Lớp lưu trữ ⇒ 409 `CLASS_ARCHIVED`; đã có yêu cầu mở ⇒ 409. */
export async function createPlacementRequest(
  deps: PlacementDeps,
  ctx: OrgContext,
  classId: string,
): Promise<PlacementRequestDto> {
  try {
    return await deps.db.transaction(async (tx) => {
      const cls = await lockClassInOrg(tx, ctx.organizationId, classId);
      if (!cls) throw notFoundGeneric();
      if (cls.status === 'archived') throw orgError('CLASS_ARCHIVED', 'Lớp đã được lưu trữ');
      if (await getOpenRequest(tx, ctx.organizationId, classId)) throw alreadyOpen();
      const row = await insertRequest(tx, {
        classId,
        requestedBy: ctx.userId,
        now: deps.clock.now(),
      });
      await logOrgAction(tx, {
        actorId: ctx.userId,
        organizationId: ctx.organizationId,
        action: 'class.placement_request',
        targetType: 'class',
        targetId: classId,
        diff: { op: 'create', requestId: row.id },
      });
      return requestDto(row);
    });
  } catch (err) {
    // Hai giáo viên tạo cùng lúc: chỉ mục duy nhất một phần chặn bản thứ hai.
    if (isUniqueViolation(err)) throw alreadyOpen();
    throw err;
  }
}

/**
 * `GET /classes/{id}/placement-requests/current`: kết quả từng thành viên HIỆN TẠI của lớp (học viên vào lớp sau
 * cũng thấy là `pending`) và phân bố trình độ. Không có yêu cầu mở ⇒ 404 chung.
 */
export async function getPlacementResults(
  deps: Pick<ServiceDeps, 'db'>,
  ctx: OrgContext,
  classId: string,
): Promise<ClassPlacementResultsDto> {
  const request = await getOpenRequest(deps.db, ctx.organizationId, classId);
  if (!request) throw notFoundGeneric();
  const members = await listDashboardMembers(deps.db, ctx.organizationId, classId);
  const submitted = new Map(
    (
      await listRequestResults(
        deps.db,
        request.id,
        members.map((m) => m.userId),
      )
    ).map((r) => [r.userId, r]),
  );

  const distribution = { none: 0, N5: 0, N4: 0, N3: 0 };
  const results: PlacementResultItemDto[] = members
    .map((m): PlacementResultItemDto => {
      const row = submitted.get(m.userId);
      if (!row) return { userId: m.userId, displayName: m.displayName, status: 'pending' };
      const level = row.estimatedLevel as keyof typeof distribution;
      if (level in distribution) distribution[level] += 1;
      return {
        userId: m.userId,
        displayName: m.displayName,
        status: 'done',
        estimatedLevel: row.estimatedLevel,
        score: row.score,
        total: row.answers.length,
        takenAt: row.takenAt.toISOString(),
      };
    })
    .sort(
      (a, b) =>
        a.displayName.localeCompare(b.displayName, 'vi') || a.userId.localeCompare(b.userId),
    );
  return { request: requestDto(request), results, distribution };
}

/** `POST /classes/{id}/placement-requests/current/close`. Không có yêu cầu mở ⇒ 404 chung. */
export async function closePlacementRequest(
  deps: PlacementDeps,
  ctx: OrgContext,
  classId: string,
): Promise<void> {
  await deps.db.transaction(async (tx) => {
    const cls = await lockClassInOrg(tx, ctx.organizationId, classId);
    if (!cls) throw notFoundGeneric();
    const closed = await closeOpenRequest(tx, ctx.organizationId, classId, deps.clock.now());
    if (!closed) throw notFoundGeneric();
    await logOrgAction(tx, {
      actorId: ctx.userId,
      organizationId: ctx.organizationId,
      action: 'class.placement_request',
      targetType: 'class',
      targetId: classId,
      diff: { op: 'close', requestId: closed.id },
    });
  });
}

/**
 * Yêu cầu kiểm tra mà học viên cần làm (cho `MyClass.placementRequest`): có khi lớp đang có yêu cầu mở và học
 * viên CHƯA nộp bài cho yêu cầu đó; ngược lại `null`.
 */
export async function pendingRequestForLearner(
  db: PlacementDeps['db'],
  userId: string,
  classId: string,
): Promise<{ id: string; requestedAt: string } | null> {
  const open = await getOpenRequestOfClass(db, classId);
  if (!open || (await hasSubmittedForRequest(db, userId, open.id))) return null;
  return { id: open.id, requestedAt: open.requestedAt.toISOString() };
}
