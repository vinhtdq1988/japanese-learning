import type { FastifyInstance } from 'fastify';
import {
  classCreateSchema,
  classPatchSchema,
  classTeachersSchema,
  confirmSchema,
  inviteLearnersSchema,
  joinCodeUpdateSchema,
  moveStudentSchema,
} from '../domain/org-validation.js';
import {
  archiveClass,
  createClass,
  getClassDetail,
  getRoster,
  listClasses,
  patchClass,
  setClassTeachers,
} from '../services/classes.js';
import { importInvitationsCsv } from '../services/class-csv.js';
import { removeStudent } from '../services/class-members.js';
import { getJoinCode, rotateJoinCode, setJoinCode } from '../services/join-code.js';
import { inviteLearners, inviteMoveToClass } from '../services/invitations.js';
import { parseInput } from './errors.js';
import { uuidParam } from './http.js';
import { createOrgGuards, requireClassContext, requireOrgContext } from './middleware/org-auth.js';

// Route lớp học `/classes*` — cấu trúc lớp, thành viên, lời mời, mã tham gia, nhập CSV (spec 004, T055,
// api-changes §8, §8.1). Quyền do `requireClassManager` (chủ tổ chức hoặc giáo viên phụ trách; ngoài phạm vi ⇒
// 404 chung). Lộ trình lớp ở `class-path.ts`, bảng điều khiển/xuất CSV ở `class-reports.ts` (câu chuyện sau).

export function registerClassRoutes(api: FastifyInstance): void {
  const deps = api.deps;
  const guards = createOrgGuards(api);
  const staff = { preHandler: [api.authenticate, guards.requireOrgStaff] };
  const manager = { preHandler: [api.authenticate, guards.requireClassManager()] };
  const ownerOfClass = {
    preHandler: [api.authenticate, guards.requireOrgOwner, guards.requireClassManager()],
  };
  type Params = { id?: string; userId?: string };

  // Thân `text/csv` của nhập CSV: nhận nguyên văn dạng chuỗi. Giới hạn cứng gấp đôi ngưỡng nghiệp vụ để
  // file chỉ vượt nhẹ vẫn nhận được lỗi 422 có thông điệp rõ (kiểm tra chính xác ở `parseInviteCsv`).
  api.addContentTypeParser(
    'text/csv',
    { parseAs: 'string', bodyLimit: deps.config.CSV_IMPORT_MAX_BYTES * 2 },
    (_request, body, done) => done(null, body),
  );

  api.get('/classes', staff, async (request) => listClasses(deps, requireOrgContext(request)));

  api.post('/classes', staff, async (request, reply) => {
    const input = parseInput(classCreateSchema, request.body);
    return reply.status(201).send(await createClass(deps, requireOrgContext(request), input));
  });

  api.get('/classes/:id', manager, async (request) =>
    getClassDetail(deps, requireOrgContext(request), requireClassContext(request)),
  );

  api.patch('/classes/:id', manager, async (request) => {
    const input = parseInput(classPatchSchema, request.body);
    return patchClass(deps, requireOrgContext(request), requireClassContext(request).id, input);
  });

  api.post('/classes/:id/archive', manager, async (request) => {
    parseInput(confirmSchema, request.body);
    return archiveClass(deps, requireOrgContext(request), requireClassContext(request).id);
  });

  api.put('/classes/:id/teachers', ownerOfClass, async (request) => {
    const { userIds } = parseInput(classTeachersSchema, request.body);
    return setClassTeachers(
      deps,
      requireOrgContext(request),
      requireClassContext(request).id,
      userIds,
    );
  });

  api.get('/classes/:id/roster', manager, async (request) =>
    getRoster(deps, requireOrgContext(request), requireClassContext(request).id),
  );

  api.delete('/classes/:id/members/:userId', manager, async (request, reply) => {
    await removeStudent(
      deps,
      requireOrgContext(request),
      requireClassContext(request).id,
      uuidParam((request.params as Params).userId),
    );
    return reply.status(204).send();
  });

  // Chuyển lớp = MỜI học viên chuyển (202); học viên phải đồng ý lại thì mới chuyển (Hiến pháp III, US8).
  api.post('/classes/:id/members/:userId/move', manager, async (request, reply) => {
    const { toClassId } = parseInput(moveStudentSchema, request.body);
    await inviteMoveToClass(
      deps,
      requireOrgContext(request),
      requireClassContext(request).id,
      uuidParam((request.params as Params).userId),
      toClassId,
    );
    return reply.status(202).send();
  });

  api.post('/classes/:id/invitations', manager, async (request) => {
    const { invitees } = parseInput(inviteLearnersSchema, request.body);
    return inviteLearners(
      deps,
      requireOrgContext(request),
      requireClassContext(request).id,
      invitees,
    );
  });

  api.post('/classes/:id/invitations/import', manager, async (request) => {
    const text = typeof request.body === 'string' ? request.body : '';
    return importInvitationsCsv(
      deps,
      requireOrgContext(request),
      requireClassContext(request).id,
      text,
    );
  });

  api.get('/classes/:id/join-code', manager, async (request) =>
    getJoinCode(requireClassContext(request)),
  );

  api.put('/classes/:id/join-code', manager, async (request) => {
    const input = parseInput(joinCodeUpdateSchema, request.body);
    return setJoinCode(deps, requireOrgContext(request), requireClassContext(request).id, input);
  });

  api.post('/classes/:id/join-code/rotate', manager, async (request) =>
    rotateJoinCode(deps, requireOrgContext(request), requireClassContext(request).id),
  );
}
