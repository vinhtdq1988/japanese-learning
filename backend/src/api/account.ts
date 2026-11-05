import type { FastifyInstance } from 'fastify';
import {
  accountDeleteSchema,
  passwordChangeSchema,
  profileUpdateSchema,
} from '../domain/profile-validation.js';
import { changePassword, deleteAccount, restoreAccount } from '../services/account.js';
import { getMe, updateMe } from '../services/profile.js';
import { parseInput } from './errors.js';
import { currentUserId } from './middleware/auth.js';

// Route tài khoản (T047, T093, T111): `GET/PATCH /me` (kể cả đổi email và hệ quả lên lộ trình),
// `PUT /me/password`, `POST /account/delete`, `POST /account/restore`.

export function registerAccountRoutes(api: FastifyInstance): void {
  const deps = api.deps;
  const secured = { preHandler: [api.authenticate] };

  api.get('/me', secured, async (request) => getMe(deps, currentUserId(request)));

  api.patch('/me', secured, async (request) =>
    updateMe(deps, currentUserId(request), parseInput(profileUpdateSchema, request.body)),
  );

  api.put('/me/password', secured, async (request, reply) => {
    const input = parseInput(passwordChangeSchema, request.body);
    await changePassword(deps, currentUserId(request), request.auth?.sessionId ?? null, input);
    return reply.status(204).send();
  });

  api.post('/account/delete', secured, async (request) => {
    const { password } = parseInput(accountDeleteSchema, request.body);
    return deleteAccount(deps, currentUserId(request), password);
  });

  // Token của tài khoản `pending_deletion` chỉ qua được route này và `/auth/logout` (middleware xác thực).
  api.post('/account/restore', secured, async (request) => {
    const userId = currentUserId(request);
    await restoreAccount(deps, userId);
    return getMe(deps, userId);
  });
}
