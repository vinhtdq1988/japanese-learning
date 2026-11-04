import type { FastifyInstance } from 'fastify';
import { getProgress } from '../services/progress.js';
import { currentUserId } from './middleware/auth.js';

// Route tiến độ (T086): `GET /progress` – tóm tắt tính toán từ dữ liệu đã ghi, lọc theo `user_id` từ token.

export function registerProgressRoutes(api: FastifyInstance): void {
  const deps = api.deps;
  const secured = { preHandler: [api.authenticate] };

  api.get('/progress', secured, async (request) => getProgress(deps, currentUserId(request)));
}
