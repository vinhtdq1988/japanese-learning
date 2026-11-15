import { defineConfig } from 'vitest/config';

// Hai dự án kiểm thử:
// - `unit`: engine/miền thuần hàm, không cần CSDL (chạy được ở mọi máy).
// - `db`: kiểm thử hợp đồng + tích hợp cần PostgreSQL thật. `globalSetup` khởi động Testcontainers
//   (cần Docker) hoặc dùng `TEST_DATABASE_URL` nếu đặt; các file chạy tuần tự vì dùng chung một CSDL.
//
// Spec 008 (research D7): thư viện nội dung thật lớn dần theo đợt, còn 71 điểm `seedContent`,
// `simulate-plans.ts` và các golden gắn với 33 đơn vị cơ sở. Nên cả hai dự án chạy với
// `CONTENT_RELEASES=000-baseline`; kiểm thử về nội dung thật (`content-files`, `content-coverage`,
// `content-releases`, seed đầy đủ, `runway`) truyền `releases: 'all'` tường minh (tham số thắng biến).
const CONTENT_ENV = { CONTENT_RELEASES: '000-baseline' };

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          environment: 'node',
          env: CONTENT_ENV,
        },
      },
      {
        test: {
          name: 'db',
          include: ['tests/contract/**/*.test.ts', 'tests/integration/**/*.test.ts'],
          environment: 'node',
          env: CONTENT_ENV,
          globalSetup: ['tests/integration/setup.ts'],
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
