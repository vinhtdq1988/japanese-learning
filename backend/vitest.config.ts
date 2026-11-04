import { defineConfig } from 'vitest/config';

// Hai dự án kiểm thử:
// - `unit`: engine/miền thuần hàm, không cần CSDL (chạy được ở mọi máy).
// - `db`: kiểm thử hợp đồng + tích hợp cần PostgreSQL thật. `globalSetup` khởi động Testcontainers
//   (cần Docker) hoặc dùng `TEST_DATABASE_URL` nếu đặt; các file chạy tuần tự vì dùng chung một CSDL.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'db',
          include: ['tests/contract/**/*.test.ts', 'tests/integration/**/*.test.ts'],
          environment: 'node',
          globalSetup: ['tests/integration/setup.ts'],
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
