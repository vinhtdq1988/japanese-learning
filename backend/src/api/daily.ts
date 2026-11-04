import type { FastifyInstance } from 'fastify';
import { getExtraUnit, getTodayPlan } from '../services/daily-plan.js';
import { currentUserId } from './middleware/auth.js';

// Route kế hoạch hằng ngày: `GET /today` (T050) và `POST /today/extra` (T065, học thêm).

export function registerDailyRoutes(api: FastifyInstance): void {
  const deps = api.deps;
  const secured = { preHandler: [api.authenticate] };

  api.get('/today', secured, async (request) => getTodayPlan(deps, currentUserId(request)));

  api.post('/today/extra', secured, async (request) => getExtraUnit(deps, currentUserId(request)));
}
