import type { FastifyInstance } from 'fastify';

// Header bảo mật cho phản hồi API (R16): CSP, HSTS và các header phòng thủ cơ bản.
// CSP của client web (phục vụ bởi nginx) được cấu hình ở `client/nginx.conf` (T118) và `client/web/index.html` (T116).

/** CSP chặt cho API: API chỉ trả JSON nên không cho phép tải bất kỳ tài nguyên nào. */
export const API_CONTENT_SECURITY_POLICY =
  "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

export interface SecurityHeadersOptions {
  /** Chỉ bật HSTS khi chạy sau TLS (production); dev dùng HTTP thường. */
  hsts: boolean;
}

export function registerSecurityHeaders(
  app: FastifyInstance,
  options: SecurityHeadersOptions,
): void {
  app.addHook('onSend', async (_request, reply) => {
    reply.header('Content-Security-Policy', API_CONTENT_SECURITY_POLICY);
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('Cross-Origin-Resource-Policy', 'same-site');
    // Phản hồi chứa dữ liệu cá nhân/đáp án không được lưu đệm trung gian.
    reply.header('Cache-Control', 'no-store');
    if (options.hsts) {
      reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
  });
}
