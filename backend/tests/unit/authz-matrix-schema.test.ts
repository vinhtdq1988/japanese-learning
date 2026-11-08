import { describe, expect, it } from 'vitest';
import {
  expandPath,
  inMatrixScope,
  loadAuthzMatrix,
  MATRIX_ROLES,
  normalizeRoutePattern,
  statusMatches,
  validateMatrix,
  type AuthzMatrix,
  type MatrixRow,
} from '../contract/authz-matrix.js';

// Kiểm thử cấu trúc ma trận phân quyền (spec 004, T024) – không cần CSDL; phần thi hành ma trận nằm ở
// tests/contract/org-authz-matrix.test.ts.

const allExpect = (value: string) =>
  Object.fromEntries(
    MATRIX_ROLES.map((r) => [r, r === 'ANON' ? '401' : value]),
  ) as MatrixRow['expect'];

const row = (over: Partial<MatrixRow> = {}): MatrixRow => ({
  id: 'org.get',
  method: 'GET',
  path: '/org',
  expect: allExpect('403'),
  ...over,
});

const matrixOf = (routes: MatrixRow[]): AuthzMatrix => ({
  roles: [...MATRIX_ROLES],
  prefixes: ['/admin/organizations', '/org', '/classes', '/invitations', '/me/class'],
  routes,
});

describe('authz-matrix.json', () => {
  it('nạp được và hợp lệ về cấu trúc', () => {
    const m = loadAuthzMatrix();
    expect(m.roles).toEqual([...MATRIX_ROLES]);
    expect(m.prefixes).toContain('/classes');
  });
});

describe('validateMatrix', () => {
  it('chấp nhận dòng đầy đủ vai trò với đường dẫn có tham số đã khai báo', () => {
    const errors = validateMatrix(
      matrixOf([
        row(),
        row({
          id: 'class.get',
          path: '/classes/{id}',
          params: { id: 'classC' },
          expect: allExpect('2xx'),
        }),
      ]),
    );
    expect(errors).toEqual([]);
  });

  it('báo thiếu kỳ vọng của một vai trò, kỳ vọng sai và ANON khác 401', () => {
    const bad = row({
      expect: { ...allExpect('403'), TCH: '9xx', ADM: undefined as never, ANON: '403' },
    });
    const errors = validateMatrix(matrixOf([bad]));
    expect(errors.some((e) => e.includes('TCH') && e.includes('9xx'))).toBe(true);
    expect(errors.some((e) => e.includes('thiếu kỳ vọng cho ADM'))).toBe(true);
    expect(errors.some((e) => e.includes('ANON luôn phải là 401'))).toBe(true);
  });

  it('báo trùng id, thiếu params cho placeholder và đường dẫn ngoài tiền tố', () => {
    const errors = validateMatrix(
      matrixOf([
        row({ id: 'a' }),
        row({ id: 'a', method: 'POST' }),
        row({ id: 'b', path: '/classes/{id}', expect: allExpect('2xx') }),
        row({ id: 'c', path: '/auth/login' }),
      ]),
    );
    expect(errors.some((e) => e.includes('dòng trùng id: a'))).toBe(true);
    expect(errors.some((e) => e.includes("thiếu 'params.id'"))).toBe(true);
    expect(errors.some((e) => e.includes('ngoài các tiền tố'))).toBe(true);
  });

  it('tiền tố /org không khớp nhầm /organizations', () => {
    expect(inMatrixScope('/org/teachers', ['/org'])).toBe(true);
    expect(inMatrixScope('/org', ['/org'])).toBe(true);
    expect(inMatrixScope('/organizations', ['/org'])).toBe(false);
    expect(inMatrixScope('/admin/organizations/{orgId}', ['/admin/organizations'])).toBe(true);
    expect(inMatrixScope('/admin/units', ['/admin/organizations'])).toBe(false);
  });
});

describe('tiện ích ma trận', () => {
  it('normalizeRoutePattern đổi :param thành {param} và bỏ tiền tố /api/v1', () => {
    expect(normalizeRoutePattern('/api/v1/classes/:id/members/:userId')).toBe(
      '/classes/{id}/members/{userId}',
    );
    expect(normalizeRoutePattern('/api/v1/org')).toBe('/org');
  });

  it('statusMatches hiểu 2xx và mã chính xác', () => {
    expect(statusMatches(200, '2xx')).toBe(true);
    expect(statusMatches(204, '2xx')).toBe(true);
    expect(statusMatches(404, '2xx')).toBe(false);
    expect(statusMatches(404, '404')).toBe(true);
    expect(statusMatches(403, '404')).toBe(false);
  });

  it('expandPath thay placeholder và báo lỗi khi thiếu giá trị', () => {
    expect(expandPath('/classes/{id}/members/{userId}', { id: 'a', userId: 'b' })).toBe(
      '/classes/a/members/b',
    );
    expect(() => expandPath('/classes/{id}', {})).toThrow(/id/);
  });
});
