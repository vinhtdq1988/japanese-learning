import Fastify, { type FastifyInstance } from 'fastify';
import type { Config } from './config.js';
import type { Database } from './db/client.js';
import { registerErrorHandlers } from './api/errors.js';
import { createAuthenticate } from './api/middleware/auth.js';
import { registerRateLimit } from './api/middleware/rate-limit.js';
import { registerSecurityHeaders } from './api/middleware/security-headers.js';
import { systemClock, type Clock } from './engine/clock.js';
import type { JobQueue } from './jobs/boss.js';
import { ContentCache } from './services/content-cache.js';
import type { EmailSender } from './services/email.js';

/** Tiền tố mọi route nghiệp vụ (khớp `servers` trong openapi.yaml). */
export const API_PREFIX = '/api/v1';

/** Phụ thuộc được tiêm vào ứng dụng: kiểm thử thay bằng bản giả (Clock, EmailSender, JobQueue). */
export interface AppDeps {
  config: Config;
  db: Database;
  clock?: Clock;
  emailSender: EmailSender;
  jobQueue: JobQueue;
}

export interface ResolvedDeps extends AppDeps {
  clock: Clock;
  /** Bộ đệm danh mục đơn vị học (TTL ≤ 60 giây, SC-008); mỗi ứng dụng có bộ đệm riêng. */
  contentCache: ContentCache;
}

declare module 'fastify' {
  interface FastifyInstance {
    deps: ResolvedDeps;
    /** preHandler xác thực JWT; dùng `{ preHandler: [app.authenticate] }`. */
    authenticate: ReturnType<typeof createAuthenticate>;
  }
}

export interface BuildAppOptions {
  /** Bật log truy cập (tắt trong kiểm thử). */
  logger?: boolean;
  /** Đăng ký route nghiệp vụ dưới tiền tố `/api/v1`; các câu chuyện US1–US8 bổ sung dần. */
  registerRoutes?: (api: FastifyInstance) => void | Promise<void>;
}

export async function buildApp(
  deps: AppDeps,
  options: BuildAppOptions = {},
): Promise<FastifyInstance> {
  const clock = deps.clock ?? systemClock;
  const resolved: ResolvedDeps = {
    ...deps,
    clock,
    contentCache: new ContentCache(deps.db, clock),
  };
  const { config } = resolved;

  const app = Fastify({
    logger: options.logger
      ? {
          level: 'info',
          // Chỉ ghi phương thức + đường dẫn (không IP, không query) để tuân thủ FR-038.
          serializers: {
            req: (req) => ({ method: req.method, url: req.url.split('?')[0] }),
          },
        }
      : false,
    // Phía sau reverse proxy (nginx) lấy IP thật từ X-Forwarded-For để rate-limit theo IP.
    trustProxy: config.NODE_ENV === 'production',
  });

  app.decorate('deps', resolved);
  app.decorate('authenticate', createAuthenticate({ config, now: () => resolved.clock.now() }));
  app.decorateRequest('auth', null);
  // Ngữ cảnh tổ chức/lớp do `createOrgGuards` điền (spec 004, research O2).
  app.decorateRequest('orgCtx', null);
  app.decorateRequest('classCtx', null);

  registerErrorHandlers(app);
  registerSecurityHeaders(app, { hsts: config.NODE_ENV === 'production' });
  await registerRateLimit(app, config);

  // Kiểm tra sống cho Docker/nginx; nằm ngoài hợp đồng OpenAPI.
  app.get('/health', async () => ({ status: 'ok' }));

  await app.register(
    async (api) => {
      await options.registerRoutes?.(api);
    },
    { prefix: API_PREFIX },
  );

  return app;
}
