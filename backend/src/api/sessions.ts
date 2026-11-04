import type { FastifyInstance } from 'fastify';
import {
  answerSubmissionSchema,
  intervalSchema,
  sessionIdParamsSchema,
  startSessionSchema,
} from '../domain/session-validation.js';
import {
  completeSession,
  recordInterval,
  startSession,
  submitAnswer,
} from '../services/lesson-session.js';
import { parseInput } from './errors.js';
import { currentUserId } from './middleware/auth.js';

// Route phiên học (T062–T064): bắt đầu/tiếp tục phiên, ghi câu trả lời, ghi khoảng thời gian học và
// hoàn thành phiên. Mọi truy vấn lọc theo `user_id` lấy từ token (R16).

export function registerSessionRoutes(api: FastifyInstance): void {
  const deps = api.deps;
  const secured = { preHandler: [api.authenticate] };

  api.post('/sessions', secured, async (request) => {
    const { planItemId } = parseInput(startSessionSchema, request.body);
    return startSession(deps, currentUserId(request), planItemId);
  });

  api.post('/sessions/:sessionId/answers', secured, async (request) => {
    const { sessionId } = parseInput(sessionIdParamsSchema, request.params);
    const body = parseInput(answerSubmissionSchema, request.body);
    return submitAnswer(deps, currentUserId(request), sessionId, body);
  });

  api.post('/sessions/:sessionId/intervals', secured, async (request, reply) => {
    const { sessionId } = parseInput(sessionIdParamsSchema, request.params);
    const body = parseInput(intervalSchema, request.body);
    await recordInterval(deps, currentUserId(request), sessionId, body);
    return reply.status(204).send();
  });

  api.post('/sessions/:sessionId/complete', secured, async (request) => {
    const { sessionId } = parseInput(sessionIdParamsSchema, request.params);
    return completeSession(deps, currentUserId(request), sessionId);
  });
}
