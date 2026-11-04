import type { FastifyInstance } from 'fastify';
import { profileUpdateSchema } from '../domain/profile-validation.js';
import { getMe, updateMe } from '../services/profile.js';
import { parseInput } from './errors.js';
import { currentUserId } from './middleware/auth.js';

// Route tài khoản (T047, T093): `GET /me`, `PATCH /me` (kể cả hệ quả lên lộ trình). Đổi email, đổi mật
// khẩu/xóa/khôi phục (T111) được bổ sung vào file này ở các câu chuyện sau.

export function registerAccountRoutes(api: FastifyInstance): void {
  const deps = api.deps;
  const secured = { preHandler: [api.authenticate] };

  api.get('/me', secured, async (request) => getMe(deps, currentUserId(request)));

  api.patch('/me', secured, async (request) =>
    updateMe(deps, currentUserId(request), parseInput(profileUpdateSchema, request.body)),
  );
}
