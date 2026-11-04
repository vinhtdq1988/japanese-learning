import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { placementAnswersSchema } from '../domain/profile-validation.js';
import { getTrialContent, gradeTrialPlacement, recordTrialEvent } from '../services/trial.js';
import { parseInput } from './errors.js';
import { languageFromRequest } from './http.js';

// Route dùng thử công khai (T097, T098, T098a; FR-036 → FR-040). Không xác thực, không phiên phía server,
// không ghi bản ghi định danh hay IP vào CSDL; chỉ tăng bộ đếm tổng hợp ẩn danh. Giới hạn tần suất theo
// IP do middleware `rate-limit` gắn theo đường dẫn (60/phút; chấm placement 10/phút).

/** Thân `POST /trial/events`: CHỈ nhận tên sự kiện, mọi trường khác bị từ chối (FR-038). */
const trialEventSchema = z.strictObject({
  event: z.enum(['lesson_completed'], { error: 'event phải là lesson_completed' }),
});

export function registerTrialRoutes(api: FastifyInstance): void {
  const deps = api.deps;

  api.get('/trial/content', async (request) => getTrialContent(deps, languageFromRequest(request)));

  api.post('/trial/placement/grade', async (request) =>
    gradeTrialPlacement(
      deps,
      parseInput(placementAnswersSchema, request.body),
      languageFromRequest(request),
    ),
  );

  api.post('/trial/events', async (request, reply) => {
    const { event } = parseInput(trialEventSchema, request.body);
    await recordTrialEvent(deps, event);
    return reply.status(204).send();
  });
}
