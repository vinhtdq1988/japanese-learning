import type { FastifyInstance } from 'fastify';

// CORS cho chế độ dev khi client web và API khác origin (vd. `flutter run -d web-server` ở cổng 8080,
// API ở cổng 3000). Bản triển khai thật dùng nginx proxy cùng origin nên KHÔNG cần và để trống danh sách.
// API dùng bearer token (không cookie) nên không bật `Access-Control-Allow-Credentials`.

export interface CorsOptions {
  /** Các origin được phép, so khớp chính xác (vd. `http://192.168.1.11:8080`); rỗng = tắt CORS. */
  allowedOrigins: readonly string[];
}

const ALLOWED_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';
const ALLOWED_HEADERS = 'Authorization, Content-Type';
const EXPOSED_HEADERS = 'Retry-After';
/** Thời gian trình duyệt được lưu đệm kết quả preflight (giây). */
const PREFLIGHT_MAX_AGE_SECONDS = 600;

export function registerCors(app: FastifyInstance, options: CorsOptions): void {
  if (options.allowedOrigins.length === 0) return;
  const allowed = new Set(options.allowedOrigins);

  // onRequest chạy trước giới hạn tần suất và định tuyến nên preflight không bị tính vào hạn mức
  // và không rơi vào 404; header đặt ở đây được giữ cả với phản hồi lỗi (401, 422, 429, …).
  app.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin;
    // Phản hồi phụ thuộc Origin nên bộ đệm trung gian phải tách theo Origin.
    reply.header('Vary', 'Origin');
    if (origin === undefined || !allowed.has(origin)) return;

    reply.header('Access-Control-Allow-Origin', origin);
    reply.header('Access-Control-Expose-Headers', EXPOSED_HEADERS);

    if (request.method === 'OPTIONS' && request.headers['access-control-request-method']) {
      reply.header('Access-Control-Allow-Methods', ALLOWED_METHODS);
      reply.header('Access-Control-Allow-Headers', ALLOWED_HEADERS);
      reply.header('Access-Control-Max-Age', String(PREFLIGHT_MAX_AGE_SECONDS));
      return reply.status(204).send();
    }
  });
}
