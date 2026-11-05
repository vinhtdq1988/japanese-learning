import type { FastifyInstance } from 'fastify';
import {
  adminActiveSetSchema,
  adminPlacementQuestionSchema,
  adminQuestionIdParamsSchema,
} from '../../domain/admin-validation.js';
import {
  createAdminPlacementQuestion,
  listAdminPlacementQuestions,
  setActivePlacementSet,
  updateAdminPlacementQuestion,
} from '../../services/admin-placement.js';
import { parseInput } from '../errors.js';
import { currentUserId } from '../middleware/auth.js';
import type { AdminGuard } from './guard.js';

// Route quản trị câu hỏi kiểm tra trình độ (T106, FR-007, FR-030).

export function registerAdminPlacementRoutes(api: FastifyInstance, guard: AdminGuard): void {
  const deps = api.deps;

  api.get('/admin/placement-questions', guard, async () => listAdminPlacementQuestions(deps));

  api.post('/admin/placement-questions', guard, async (request, reply) => {
    const input = parseInput(adminPlacementQuestionSchema, request.body);
    const question = await createAdminPlacementQuestion(deps, currentUserId(request), input);
    return reply.status(201).send(question);
  });

  // Đăng ký trước route `:questionId` để đường dẫn tĩnh `active-set` không bị coi là một id.
  api.put('/admin/placement-questions/active-set', guard, async (request, reply) => {
    const { questionIds } = parseInput(adminActiveSetSchema, request.body);
    await setActivePlacementSet(deps, currentUserId(request), questionIds);
    return reply.status(204).send();
  });

  api.put('/admin/placement-questions/:questionId', guard, async (request) => {
    const { questionId } = parseInput(adminQuestionIdParamsSchema, request.params);
    const input = parseInput(adminPlacementQuestionSchema, request.body);
    return updateAdminPlacementQuestion(deps, currentUserId(request), questionId, input);
  });
}
