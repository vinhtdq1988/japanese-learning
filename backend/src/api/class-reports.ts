import type { FastifyInstance, FastifyReply } from 'fastify';
import { classDashboardQuerySchema } from '../domain/org-validation.js';
import { getClassWeakTopics, getDashboard, getLearnerDetail } from '../services/class-dashboard.js';
import {
  closePlacementRequest,
  createPlacementRequest,
  getPlacementResults,
} from '../services/class-placement.js';
import { exportClassCsv, exportLearnerCsv, type CsvExport } from '../services/class-export.js';
import { parseInput } from './errors.js';
import { uuidParam } from './http.js';
import { createOrgGuards, requireClassContext, requireOrgContext } from './middleware/org-auth.js';

// Route theo dõi lớp `/classes/{id}/dashboard`, `/classes/{id}/members/{userId}/detail` (spec 004, T086,
// api-changes §10, FR-027 → FR-030, FR-035). Thứ tự guard: `requireClassManager` (lớp ngoài phạm vi ⇒ 404 chung)
// rồi `requireDataAccess` (giáo viên mất seat / giấy phép hết hạn ⇒ 403): quản trị viên hệ thống KHÔNG xem được
// tiến độ chi tiết (FR-002). Chủ đề yếu và xuất CSV (US7); kiểm tra trình độ lớp (US8) bổ sung ở cuối tệp.

/** Phản hồi tệp CSV: BOM nằm sẵn trong thân; tên tệp mã hóa theo RFC 5987 (`filename*`). */
function sendCsv(reply: FastifyReply, file: CsvExport): FastifyReply {
  return reply
    .header('Content-Type', 'text/csv; charset=utf-8')
    .header(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
    )
    .send(file.body);
}

export function registerClassReportRoutes(api: FastifyInstance): void {
  const deps = api.deps;
  const guards = createOrgGuards(api);
  const dataManager = {
    preHandler: [api.authenticate, guards.requireClassManager(), guards.requireDataAccess],
  };
  type Params = { id?: string; userId?: string };

  api.get('/classes/:id/dashboard', dataManager, async (request) => {
    const query = parseInput(classDashboardQuerySchema, request.query);
    return getDashboard(deps, requireOrgContext(request), requireClassContext(request).id, query);
  });

  api.get('/classes/:id/members/:userId/detail', dataManager, async (request) =>
    getLearnerDetail(
      deps,
      requireOrgContext(request),
      requireClassContext(request).id,
      uuidParam((request.params as Params).userId),
    ),
  );

  api.get('/classes/:id/weak-topics', dataManager, async (request) =>
    getClassWeakTopics(deps, requireOrgContext(request), requireClassContext(request).id),
  );

  api.get('/classes/:id/export.csv', dataManager, async (request, reply) =>
    sendCsv(
      reply,
      await exportClassCsv(deps, requireOrgContext(request), requireClassContext(request).id),
    ),
  );

  api.get('/classes/:id/members/:userId/export.csv', dataManager, async (request, reply) =>
    sendCsv(
      reply,
      await exportLearnerCsv(
        deps,
        requireOrgContext(request),
        requireClassContext(request).id,
        uuidParam((request.params as Params).userId),
      ),
    ),
  );

  // Kiểm tra trình độ cho cả lớp (US8, FR-034): quyền như các route dữ liệu học viên.
  api.post('/classes/:id/placement-requests', dataManager, async (request, reply) =>
    reply
      .status(201)
      .send(
        await createPlacementRequest(
          deps,
          requireOrgContext(request),
          requireClassContext(request).id,
        ),
      ),
  );

  api.get('/classes/:id/placement-requests/current', dataManager, async (request) =>
    getPlacementResults(deps, requireOrgContext(request), requireClassContext(request).id),
  );

  api.post('/classes/:id/placement-requests/current/close', dataManager, async (request, reply) => {
    await closePlacementRequest(deps, requireOrgContext(request), requireClassContext(request).id);
    return reply.status(204).send();
  });
}
