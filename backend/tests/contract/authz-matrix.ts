import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Dữ liệu và tiện ích của ma trận phân quyền (spec 004, T024, contracts/permissions-matrix.md §2, SC-004).
// `authz-matrix.json` là nguồn duy nhất cho bộ kiểm thử `org-authz-matrix.test.ts`; file này chỉ đọc, kiểm
// tra cấu trúc và chuẩn hóa để cả kiểm thử đơn vị (không cần CSDL) lẫn kiểm thử hợp đồng dùng chung.

export const MATRIX_ROLES = [
  'ANON',
  'USR',
  'LRN',
  'TCH',
  'TCH0',
  'TCHx',
  'OWN',
  'ADM',
  'OWNb',
  'TCHb',
] as const;
export type MatrixRole = (typeof MATRIX_ROLES)[number];

export type MatrixMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Kết quả mong đợi: `'2xx'` hoặc mã HTTP chính xác dạng chuỗi (ví dụ `'404'`). */
export type MatrixExpectation = string;

export interface MatrixRow {
  id: string;
  method: MatrixMethod;
  /** Đường dẫn kiểu OpenAPI, không gồm tiền tố `/api/v1` (ví dụ `/classes/{id}/dashboard`). */
  path: string;
  /** Tên tham số đường dẫn → khóa "thế giới" (`classC`, `membershipL`, `userLRN`, `missing`…). */
  params?: Record<string, string>;
  body?: unknown;
  contentType?: string;
  /** `true` khi thao tác đổi trạng thái: thế giới được dựng lại cho từng vai trò. */
  mutating?: boolean;
  expect: Record<MatrixRole, MatrixExpectation>;
  note?: string;
}

export interface AuthzMatrix {
  roles: MatrixRole[];
  prefixes: string[];
  routes: MatrixRow[];
}

const MATRIX_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../fixtures/authz-matrix.json',
);

const EXPECT_RE = /^(2xx|[1-5]\d\d)$/;

/** Kiểm tra cấu trúc ma trận; trả danh sách lỗi (rỗng = hợp lệ). */
export function validateMatrix(matrix: AuthzMatrix): string[] {
  const errors: string[] = [];
  if (JSON.stringify(matrix.roles) !== JSON.stringify(MATRIX_ROLES)) {
    errors.push(`'roles' phải đúng ${MATRIX_ROLES.join(', ')}`);
  }
  const ids = new Set<string>();
  const keys = new Set<string>();
  for (const row of matrix.routes) {
    if (ids.has(row.id)) errors.push(`dòng trùng id: ${row.id}`);
    ids.add(row.id);
    const key = `${row.method} ${row.path}`;
    const label = `${row.id} (${key})`;
    if (!matrix.prefixes.some((p) => row.path === p || row.path.startsWith(`${p}/`))) {
      errors.push(`${label}: đường dẫn ngoài các tiền tố của ma trận`);
    }
    for (const role of MATRIX_ROLES) {
      const value = row.expect?.[role];
      if (value === undefined) errors.push(`${label}: thiếu kỳ vọng cho ${role}`);
      else if (!EXPECT_RE.test(value)) errors.push(`${label}: kỳ vọng '${value}' của ${role} sai`);
    }
    if (row.expect?.ANON !== undefined && row.expect.ANON !== '401') {
      errors.push(`${label}: ANON luôn phải là 401`);
    }
    const placeholders = [...row.path.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]!);
    for (const p of placeholders) {
      if (!row.params?.[p]) errors.push(`${label}: thiếu 'params.${p}'`);
    }
    // Hai dòng cùng (method, path) chỉ được khác nhau khi ghi chú trường hợp riêng (id khác nhau).
    keys.add(key);
  }
  return errors;
}

export function loadAuthzMatrix(): AuthzMatrix {
  const matrix = JSON.parse(readFileSync(MATRIX_PATH, 'utf8')) as AuthzMatrix;
  const errors = validateMatrix(matrix);
  if (errors.length > 0)
    throw new Error(`authz-matrix.json không hợp lệ:\n- ${errors.join('\n- ')}`);
  return matrix;
}

/** Mẫu đường dẫn Fastify (`/api/v1/classes/:id`) → kiểu OpenAPI không tiền tố (`/classes/{id}`). */
export function normalizeRoutePattern(url: string): string {
  return url.replace(/^\/api\/v1/, '').replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

/** `true` nếu mã trạng thái thực tế đúng với kỳ vọng (`'2xx'` hoặc mã chính xác). */
export function statusMatches(actual: number, expected: MatrixExpectation): boolean {
  if (expected === '2xx') return actual >= 200 && actual < 300;
  return actual === Number(expected);
}

/** Thay `{param}` trong đường dẫn bằng giá trị đã giải từ "thế giới". */
export function expandPath(template: string, values: Record<string, string>): string {
  return template.replace(/\{([^}]+)\}/g, (_m, name: string) => {
    const v = values[name];
    if (v === undefined) throw new Error(`Thiếu giá trị cho tham số ${name} của ${template}`);
    return encodeURIComponent(v);
  });
}

/** Route đăng ký thuộc một trong các tiền tố của ma trận. */
export function inMatrixScope(pattern: string, prefixes: readonly string[]): boolean {
  return prefixes.some((p) => pattern === p || pattern.startsWith(`${p}/`));
}
