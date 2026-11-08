import type { FastifyInstance } from 'fastify';
import {
  assignmentCreateSchema,
  classPathTemplateSchema,
  learnerOverrideSchema,
  pathUnitsSchema,
  pauseCreateSchema,
  pauseEndSchema,
} from '../domain/org-validation.js';
import {
  cancelAssignment,
  createAssignments,
  createPause,
  endPause,
  exemptUnit,
  listPauses,
  putOverride,
  putPathUnits,
  unexemptUnit,
} from '../services/class-adjustments.js';
import { getClassPath, putClassPathTemplate } from '../services/class-path.js';
import { parseInput } from './errors.js';
import { uuidParam } from './http.js';
import { createOrgGuards, requireClassContext, requireOrgContext } from './middleware/org-auth.js';

// Route lộ trình lớp và tinh chỉnh (spec 004, T075 + T098, api-changes §9, FR-017 → FR-026). Quyền do
// `requireClassManager` (chủ tổ chức hoặc giáo viên phụ trách; ngoài phạm vi ⇒ 404 chung). KHÔNG có thao tác xóa
// lộ trình. Cấu trúc lớp (lộ trình, chọn bài, bài giao) giáo viên mất seat vẫn sửa được; thao tác nhắm vào TỪNG
// HỌC VIÊN (ghi đè, miễn bài, tạm dừng) cần thêm quyền dữ liệu (`requireDataAccess`, FR-038).

export function registerClassPathRoutes(api: FastifyInstance): void {
  const deps = api.deps;
  const guards = createOrgGuards(api);
  const manager = { preHandler: [api.authenticate, guards.requireClassManager()] };
  const dataManager = {
    preHandler: [api.authenticate, guards.requireClassManager(), guards.requireDataAccess],
  };
  type Params = {
    id?: string;
    userId?: string;
    unitId?: string;
    assignmentId?: string;
    pauseId?: string;
  };
  const ids = (request: { params: unknown }) => request.params as Params;

  api.get('/classes/:id/path', manager, async (request) =>
    getClassPath(deps, requireOrgContext(request), requireClassContext(request)),
  );

  api.put('/classes/:id/path', manager, async (request) => {
    const input = parseInput(classPathTemplateSchema, request.body);
    return putClassPathTemplate(
      deps,
      requireOrgContext(request),
      requireClassContext(request).id,
      input,
    );
  });

  api.put('/classes/:id/path/units', manager, async (request) => {
    const input = parseInput(pathUnitsSchema, request.body);
    return putPathUnits(deps, requireOrgContext(request), requireClassContext(request).id, input);
  });

  api.post('/classes/:id/assignments', manager, async (request, reply) => {
    const input = parseInput(assignmentCreateSchema, request.body);
    const created = await createAssignments(
      deps,
      requireOrgContext(request),
      requireClassContext(request).id,
      input,
    );
    return reply.status(201).send(created);
  });

  api.delete('/classes/:id/assignments/:assignmentId', manager, async (request, reply) => {
    await cancelAssignment(
      deps,
      requireOrgContext(request),
      requireClassContext(request).id,
      uuidParam(ids(request).assignmentId),
    );
    return reply.status(204).send();
  });

  api.put('/classes/:id/members/:userId/override', dataManager, async (request) => {
    const input = parseInput(learnerOverrideSchema, request.body);
    return putOverride(
      deps,
      requireOrgContext(request),
      requireClassContext(request).id,
      uuidParam(ids(request).userId),
      input,
    );
  });

  api.put(
    '/classes/:id/members/:userId/exemptions/:unitId',
    dataManager,
    async (request, reply) => {
      await exemptUnit(
        deps,
        requireOrgContext(request),
        requireClassContext(request).id,
        uuidParam(ids(request).userId),
        uuidParam(ids(request).unitId),
      );
      return reply.status(204).send();
    },
  );

  api.delete(
    '/classes/:id/members/:userId/exemptions/:unitId',
    dataManager,
    async (request, reply) => {
      await unexemptUnit(
        deps,
        requireOrgContext(request),
        requireClassContext(request).id,
        uuidParam(ids(request).userId),
        uuidParam(ids(request).unitId),
      );
      return reply.status(204).send();
    },
  );

  api.get('/classes/:id/pauses', dataManager, async (request) =>
    listPauses(deps, requireOrgContext(request), requireClassContext(request).id),
  );

  api.post('/classes/:id/pauses', dataManager, async (request, reply) => {
    const input = parseInput(pauseCreateSchema, request.body);
    const created = await createPause(
      deps,
      requireOrgContext(request),
      requireClassContext(request).id,
      input,
    );
    return reply.status(201).send(created);
  });

  api.post('/classes/:id/pauses/:pauseId/end', dataManager, async (request) => {
    const input = parseInput(pauseEndSchema, request.body);
    return endPause(
      deps,
      requireOrgContext(request),
      requireClassContext(request).id,
      uuidParam(ids(request).pauseId),
      input,
    );
  });
}
