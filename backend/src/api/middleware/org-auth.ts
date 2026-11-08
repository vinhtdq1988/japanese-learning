import type { FastifyInstance, FastifyRequest } from 'fastify';
import { AppError } from '../../domain/types.js';
import type { ClassRow } from '../../db/repositories/classes.js';
import { getManagedClass, loadOrgContext, type OrgContext } from '../../services/org-access.js';
import { notFoundGeneric } from '../errors.js';

// preHandler phân quyền tổ chức (spec 004, research O2, contracts/permissions-matrix.md). Chạy SAU
// `authenticate`. Vai trò tra CSDL mỗi request (không vào JWT) nên hiệu lực tức thì. Quy ước phản hồi:
// - sai vai trò mà không có đối tượng nào bị tiết lộ ⇒ 403 `FORBIDDEN`;
// - đối tượng ngoài phạm vi / không tồn tại ⇒ 404 `NOT_FOUND` thông điệp chung (FR-007).

declare module 'fastify' {
  interface FastifyRequest {
    /** Ngữ cảnh tổ chức của người gọi (sau `loadOrg`); null nếu không thuộc tổ chức nào. */
    orgCtx: OrgContext | null;
    /** Lớp người gọi quản lý (sau `requireClassManager`). */
    classCtx: ClassRow | null;
  }
}

const forbidden = () => new AppError(403, 'FORBIDDEN', 'Không có quyền truy cập');

/** Lấy ngữ cảnh tổ chức đã nạp; ném 403 nếu route chưa qua `loadOrg` hoặc người gọi không thuộc tổ chức. */
export function requireOrgContext(request: FastifyRequest): OrgContext {
  if (!request.orgCtx) throw forbidden();
  return request.orgCtx;
}

/** Lớp mà route đã xác nhận người gọi quản lý. */
export function requireClassContext(request: FastifyRequest): ClassRow {
  if (!request.classCtx) throw notFoundGeneric();
  return request.classCtx;
}

export interface OrgGuards {
  /** Nạp `request.orgCtx` (có thể null); không từ chối. */
  loadOrg: (request: FastifyRequest) => Promise<void>;
  /** Chủ tổ chức; ngược lại 403. */
  requireOrgOwner: (request: FastifyRequest) => Promise<void>;
  /** Chủ tổ chức hoặc giáo viên (kể cả giáo viên mất seat); ngược lại 403. */
  requireOrgStaff: (request: FastifyRequest) => Promise<void>;
  /**
   * Người quản lý lớp có id ở tham số đường dẫn `paramName` (mặc định `id`): chủ tổ chức hoặc giáo viên
   * phụ trách. Lớp ngoài phạm vi ⇒ 404 chung. Đặt `request.classCtx`.
   */
  requireClassManager: (paramName?: string) => (request: FastifyRequest) => Promise<void>;
  /** Quyền xem dữ liệu học viên (tổ chức active, giấy phép hiệu lực, chủ hoặc giáo viên giữ seat); ngược lại 403. */
  requireDataAccess: (request: FastifyRequest) => Promise<void>;
}

/** Tạo các guard gắn với dependencies của ứng dụng. */
export function createOrgGuards(app: FastifyInstance): OrgGuards {
  const deps = app.deps;

  async function loadOrg(request: FastifyRequest): Promise<void> {
    if (!request.auth) throw new AppError(401, 'UNAUTHORIZED', 'Chưa xác thực');
    request.orgCtx = await loadOrgContext(deps, request.auth.userId);
  }

  async function requireOrgStaff(request: FastifyRequest): Promise<void> {
    await loadOrg(request);
    const ctx = request.orgCtx;
    if (!ctx || (!ctx.isOwner && !ctx.isTeacher)) throw forbidden();
  }

  async function requireOrgOwner(request: FastifyRequest): Promise<void> {
    await loadOrg(request);
    if (!request.orgCtx?.isOwner) throw forbidden();
  }

  function requireClassManager(paramName = 'id') {
    return async (request: FastifyRequest): Promise<void> => {
      await requireOrgStaff(request);
      const params = request.params as Record<string, string | undefined>;
      const classId = params[paramName];
      if (!classId) throw notFoundGeneric();
      request.classCtx = await getManagedClass(deps, request.orgCtx!, classId);
    };
  }

  async function requireDataAccess(request: FastifyRequest): Promise<void> {
    if (!request.orgCtx?.dataAccess) throw forbidden();
  }

  return { loadOrg, requireOrgOwner, requireOrgStaff, requireClassManager, requireDataAccess };
}
