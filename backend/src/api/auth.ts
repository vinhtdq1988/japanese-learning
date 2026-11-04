import type { FastifyInstance } from 'fastify';
import {
  loginSchema,
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
  refreshSchema,
  registerSchema,
} from '../domain/profile-validation.js';
import {
  confirmPasswordReset,
  login,
  logout,
  refresh,
  register,
  requestPasswordReset,
} from '../services/auth.js';
import { parseInput } from './errors.js';

// Route xác thực (T044): đăng ký, đăng nhập, làm mới, đăng xuất, đặt lại mật khẩu. Giới hạn tần suất
// theo IP cho đăng ký/đăng nhập/đặt lại do `registerRateLimit` gắn tự động theo đường dẫn (R9).

export function registerAuthRoutes(api: FastifyInstance): void {
  const deps = api.deps;
  const userAgent = (header: string | string[] | undefined): string | null =>
    typeof header === 'string' ? header.slice(0, 255) : null;

  api.post('/auth/register', async (request, reply) => {
    const body = parseInput(registerSchema, request.body);
    const tokens = await register(deps, body, userAgent(request.headers['user-agent']));
    return reply.status(201).send(tokens);
  });

  api.post('/auth/login', async (request) => {
    const body = parseInput(loginSchema, request.body);
    return login(deps, body, userAgent(request.headers['user-agent']));
  });

  api.post('/auth/refresh', async (request) => {
    const body = parseInput(refreshSchema, request.body);
    return refresh(deps, body.refreshToken);
  });

  api.post('/auth/logout', { preHandler: [api.authenticate] }, async (request, reply) => {
    await logout(deps, request.auth?.sessionId ?? null);
    return reply.status(204).send();
  });

  api.post('/auth/password-reset/request', async (request, reply) => {
    const body = parseInput(passwordResetRequestSchema, request.body);
    await requestPasswordReset(deps, body.email);
    // Luôn 202 dù email có tồn tại hay không (chống dò tài khoản).
    return reply.status(202).send();
  });

  api.post('/auth/password-reset/confirm', async (request, reply) => {
    const body = parseInput(passwordResetConfirmSchema, request.body);
    await confirmPasswordReset(deps, body);
    return reply.status(204).send();
  });
}
