import type { FastifyInstance } from 'fastify';
import { studyDefaultsDto } from '../domain/study-defaults.js';

// Route bảng gợi ý kỹ năng theo quỹ thời gian (spec 007, FR-021…023): chỉ đọc, giống nhau cho mọi
// người học đã đăng nhập (kể cả học viên thuộc lớp — việc khóa lựa chọn do `PATCH /me` quyết định).

export function registerStudyDefaultsRoutes(api: FastifyInstance): void {
  const secured = { preHandler: [api.authenticate] };

  api.get('/study-defaults', secured, async () => studyDefaultsDto());
}
