import rateLimit, { type FastifyRateLimitStore } from '@fastify/rate-limit';
import type { FastifyInstance, RouteOptions } from 'fastify';
import type { Config } from '../../config.js';

// Giới hạn tần suất theo IP (R9, FR-040). Bộ đếm nằm trong bộ nhớ tiến trình và hết hạn theo cửa sổ;
// KHÔNG ghi IP vào CSDL (FR-038).

type RateLimitConfig = Pick<
  Config,
  'RATE_LIMIT_TRIAL_PER_MIN' | 'RATE_LIMIT_TRIAL_GRADE_PER_MIN' | 'RATE_LIMIT_AUTH_PER_MIN'
>;

interface Rule {
  groupId: string;
  max: number;
}

const WINDOW = '1 minute';

/** Số khóa tối đa trong bộ nhớ trước khi dọn các khóa đã hết cửa sổ (chặn phình bộ nhớ khi bị quét IP). */
const MAX_TRACKED_KEYS = 50_000;

/**
 * Bộ đếm cửa sổ cố định trong bộ nhớ, dùng CHUNG cho mọi route. Plugin mặc định tạo bộ đếm riêng cho
 * mỗi route (`child`) nên `groupId` không gom được các route; ở đây `child()` trả chính nó và khóa
 * (IP + `groupId`) quyết định route nào chung bộ đếm. Không ghi gì ra CSDL (FR-038).
 */
export class SharedWindowStore implements FastifyRateLimitStore {
  private readonly hits = new Map<string, { current: number; start: number }>();

  incr(
    key: string,
    callback: (error: Error | null, result?: { current: number; ttl: number }) => void,
    timeWindow: number,
  ): void {
    const now = Date.now();
    let entry = this.hits.get(key);
    if (!entry || entry.start + timeWindow <= now) {
      if (this.hits.size >= MAX_TRACKED_KEYS) this.purgeExpired(now, timeWindow);
      entry = { current: 0, start: now };
      this.hits.set(key, entry);
    }
    entry.current += 1;
    callback(null, { current: entry.current, ttl: timeWindow - (now - entry.start) });
  }

  child(): FastifyRateLimitStore {
    return this;
  }

  private purgeExpired(now: number, timeWindow: number): void {
    for (const [key, entry] of this.hits) {
      if (entry.start + timeWindow <= now) this.hits.delete(key);
    }
  }
}

/** Tiền tố API; khớp với `app.ts`. */
const PREFIX = '/api/v1';

/**
 * Chọn nhóm giới hạn cho một route (đường dẫn đầy đủ, gồm tiền tố):
 * - `POST /trial/placement/grade`: 10/phút
 * - `/trial/*` (kể cả `POST /trial/events`) và `GET /placement/questions`: 60/phút, dùng chung một bộ đếm
 * - `/auth/*` đăng ký, đăng nhập, yêu cầu/xác nhận đặt lại mật khẩu: 10/phút, dùng chung một bộ đếm
 * Trả null nếu route không bị giới hạn (làm mới token và đăng xuất không nằm trong nhóm này).
 */
export function ruleForRoute(config: RateLimitConfig, url: string): Rule | null {
  const path = url.startsWith(PREFIX) ? url.slice(PREFIX.length) : url;
  if (path === '/trial/placement/grade') {
    return { groupId: 'trial-grade', max: config.RATE_LIMIT_TRIAL_GRADE_PER_MIN };
  }
  if (path.startsWith('/trial/') || path === '/placement/questions') {
    return { groupId: 'trial', max: config.RATE_LIMIT_TRIAL_PER_MIN };
  }
  if (
    path === '/auth/register' ||
    path === '/auth/login' ||
    path.startsWith('/auth/password-reset/')
  ) {
    return { groupId: 'auth', max: config.RATE_LIMIT_AUTH_PER_MIN };
  }
  return null;
}

/**
 * Đăng ký rate-limit và tự gắn ngưỡng cho route theo `ruleForRoute`. PHẢI gọi trước khi đăng ký
 * các route: hook `onRoute` của ta cần chạy trước hook của plugin để plugin thấy cấu hình.
 */
export async function registerRateLimit(
  app: FastifyInstance,
  config: RateLimitConfig,
): Promise<void> {
  app.addHook('onRoute', (route: RouteOptions) => {
    const rule = ruleForRoute(config, route.url);
    if (!rule) return;
    const methods = Array.isArray(route.method) ? route.method : [route.method];
    if (methods.every((m) => m === 'HEAD' || m === 'OPTIONS')) return;
    route.config = {
      ...route.config,
      rateLimit: { groupId: rule.groupId, max: rule.max, timeWindow: WINDOW },
    };
  });

  await app.register(rateLimit, {
    global: false,
    store: SharedWindowStore,
    keyGenerator: (request) => request.ip,
    errorResponseBuilder: (_request, context) => ({
      statusCode: context.statusCode,
      code: 'TOO_MANY_REQUESTS',
      message: `Vượt giới hạn tần suất, thử lại sau ${Math.ceil(context.ttl / 1000)} giây`,
    }),
  });
}
