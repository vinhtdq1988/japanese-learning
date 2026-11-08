import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureAllProfiles } from './api-snapshot.js';

// Sinh ảnh chụp golden ở MỨC DỊCH VỤ (spec 004, T002, SC-012): phản hồi `GET /path`, `GET /progress` và
// `GET /today` ngày đầu của từng hồ sơ đại diện cũ. PHẢI chạy trên mã dịch vụ CHƯA đổi sang
// `resolveLearningContext` (trước US3); sau đó là chuẩn so sánh cho kiểm thử hồi quy. KHÔNG chạy lại sau khi
// dịch vụ đã đổi, trừ khi chủ ý cập nhật chuẩn (khi đó mọi khác biệt cần được duyệt).
//
// CẢNH BÁO: script XÓA SẠCH dữ liệu CSDL được chỉ định. Chỉ trỏ vào CSDL dành riêng cho việc này; để tránh
// nhầm, tên CSDL PHẢI chứa "test" hoặc "golden".
//
// Chạy (cần PostgreSQL 16 trống, ví dụ `docker run -p 5433:5432 -e POSTGRES_PASSWORD=pw postgres:16`
// rồi tạo CSDL `jl_golden`):
//   cd backend && GOLDEN_DATABASE_URL=postgres://postgres:pw@localhost:5433/jl_golden \
//     pnpm exec tsx tests/fixtures/golden/generate-api-pre-org.ts

const url = process.env.GOLDEN_DATABASE_URL;
if (!url) throw new Error('Thiếu biến môi trường GOLDEN_DATABASE_URL (xem chú thích đầu file)');
const dbName = new URL(url).pathname.replace(/^\//, '');
if (!/test|golden/i.test(dbName)) {
  throw new Error(
    `Từ chối chạy: tên CSDL "${dbName}" phải chứa "test" hoặc "golden" (script xóa sạch dữ liệu)`,
  );
}

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, 'api-pre-org.json');

const profiles = await captureAllProfiles(url);
writeFileSync(OUT, `${JSON.stringify({ profiles }, null, 2)}\n`, 'utf8');
console.log(`Đã ghi ${Object.keys(profiles).length} hồ sơ vào ${OUT}`);
