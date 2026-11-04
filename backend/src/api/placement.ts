import type { FastifyInstance } from 'fastify';
import { placementAnswersSchema } from '../domain/profile-validation.js';
import { getQuestionSet, submitPlacement } from '../services/placement.js';
import { parseInput } from './errors.js';
import { languageFromRequest } from './http.js';
import { currentUserId } from './middleware/auth.js';

// Route kiểm tra trình độ (T048). `GET /placement/questions` công khai và KHÔNG trả đáp án đúng;
// `POST /placement/submit` chấm lại trên server từ câu trả lời và lưu kết quả hiện hành.

export function registerPlacementRoutes(api: FastifyInstance): void {
  const deps = api.deps;

  api.get('/placement/questions', async (request) =>
    getQuestionSet(deps, languageFromRequest(request)),
  );

  api.post('/placement/submit', { preHandler: [api.authenticate] }, async (request) =>
    submitPlacement(deps, currentUserId(request), parseInput(placementAnswersSchema, request.body)),
  );
}
