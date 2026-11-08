import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { registerApiRoutes } from '../../src/api/routes.js';
import { setOrganizationStatus } from '../../src/services/org-admin.js';
import { createTestApp, type TestApp } from '../integration/helpers.js';
import {
  addOrgRole,
  buildRoleWorld,
  createTestClass,
  createTestUser,
  endLearnerMembership,
  enrollLearner,
  randomMissingId,
  tokenFor,
  type RoleKey,
  type RoleWorld,
} from '../integration/org-helpers.js';
import {
  expandPath,
  inMatrixScope,
  loadAuthzMatrix,
  normalizeRoutePattern,
  statusMatches,
  type MatrixRow,
} from './authz-matrix.js';
import { ContractClient } from './client.js';

// Ma trận phân quyền vai trò × route (spec 004, T024, SC-004, contracts/permissions-matrix.md):
// (a) mọi route tổ chức/lớp ĐÃ ĐĂNG KÝ phải có dòng trong `authz-matrix.json` (thiếu dòng ⇒ thất bại);
// (b) mỗi dòng × mỗi vai trò khẳng định mã phản hồi;
// (c) 404 của "đối tượng tổ chức khác / vai trò không phụ trách" và của "không tồn tại" trùng từng byte.

const matrix = loadAuthzMatrix();

interface RegisteredRoute {
  method: string;
  pattern: string;
}

let ctx: TestApp;
let world: RoleWorld;
let api: ContractClient;
const registered: RegisteredRoute[] = [];

/** Ghi lại mọi route đăng ký (trừ HEAD/OPTIONS do Fastify tự thêm) để so với ma trận. */
async function registerAndCollect(api: FastifyInstance): Promise<void> {
  api.addHook('onRoute', (route) => {
    const methods = Array.isArray(route.method) ? route.method : [route.method];
    for (const method of methods) {
      if (method === 'HEAD' || method === 'OPTIONS') continue;
      registered.push({ method, pattern: normalizeRoutePattern(route.url) });
    }
  });
  await registerApiRoutes(api);
}

/** Khóa "thế giới" → giá trị thật dùng trong đường dẫn. */
function worldValues(w: RoleWorld): Record<string, string> {
  return {
    orgA: w.orgA.orgId,
    orgB: w.orgB.orgId,
    classC: w.classC,
    classD: w.classD,
    classE: w.classE,
    classArchived: w.classArchived,
    joinCodeC: w.joinCodeC,
    membershipL: w.membershipL,
    licenseA: w.licenseA,
    invitationA: w.invitationA,
    userUSR: w.users.USR.userId,
    userLRN: w.users.LRN.userId,
    userTCH: w.users.TCH.userId,
    userTCH0: w.users.TCH0.userId,
    userTCHx: w.users.TCHx.userId,
    userOWN: w.users.OWN.userId,
    userADM: w.users.ADM.userId,
    userOWNb: w.users.OWNb.userId,
    userTCHb: w.users.TCHb.userId,
  };
}

function resolveParams(row: MatrixRow, values: Record<string, string>, missing: boolean) {
  return Object.fromEntries(
    Object.entries(row.params ?? {}).map(([name, key]) => {
      if (key === 'missing' || missing) return [name, randomMissingId()];
      const v = values[key];
      if (v === undefined) throw new Error(`Khóa thế giới không có: ${key} (${row.id})`);
      return [name, v];
    }),
  );
}

/** Thay chuỗi `$khóa` trong body bằng giá trị của "thế giới" (ví dụ `$userTCH`, `$joinCodeC`). */
function substitute(value: unknown, values: Record<string, string>): unknown {
  if (typeof value === 'string' && value.startsWith('$') && value.slice(1) in values) {
    return values[value.slice(1)];
  }
  if (Array.isArray(value)) return value.map((v) => substitute(v, values));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, substitute(v, values)]));
  }
  return value;
}

function bodyFor(row: MatrixRow, w: RoleWorld): unknown {
  return substitute(row.body, worldValues(w));
}

async function call(row: MatrixRow, role: RoleKey, w: RoleWorld, missing = false) {
  const url = expandPath(row.path, resolveParams(row, worldValues(w), missing));
  const headers: Record<string, string> = {};
  if (row.contentType) headers['content-type'] = row.contentType;
  return api.raw(row.method, url, {
    token: w.tokens[role],
    headers,
    body: bodyFor(row, w),
  });
}

beforeAll(async () => {
  ctx = await createTestApp({ registerRoutes: registerAndCollect });
  api = new ContractClient(ctx.app);
  world = await buildRoleWorld(ctx);
});

afterAll(async () => {
  await ctx?.close();
});

describe('ma trận quyền: độ phủ route', () => {
  it('mọi route tổ chức/lớp đã đăng ký đều có dòng trong authz-matrix.json', () => {
    const inScope = registered.filter((r) => inMatrixScope(r.pattern, matrix.prefixes));
    const have = new Set(matrix.routes.map((r) => `${r.method} ${r.path}`));
    const missing = inScope.map((r) => `${r.method} ${r.pattern}`).filter((key) => !have.has(key));
    expect(missing, 'route thiếu dòng trong ma trận quyền').toEqual([]);
  });

  it('mọi dòng của ma trận ứng với một route thật (không có dòng thừa)', () => {
    const registeredKeys = new Set(registered.map((r) => `${r.method} ${r.pattern}`));
    const stale = matrix.routes
      .map((r) => `${r.method} ${r.path}`)
      .filter((key) => !registeredKeys.has(key));
    expect(stale, 'dòng ma trận không còn route').toEqual([]);
  });
});

describe('ma trận quyền: mã phản hồi theo vai trò', () => {
  for (const row of matrix.routes) {
    it.each(matrix.roles.map((role) => [role] as const))(
      `${row.id} (${row.method} ${row.path}) – %s`,
      async (role) => {
        // Thao tác đổi trạng thái: dựng thế giới mới cho từng vai trò để các lần gọi không ảnh hưởng nhau.
        const w = row.mutating ? await buildRoleWorld(ctx) : world;
        const res = await call(row, role, w);
        const expected = row.expect[role];
        expect(
          statusMatches(res.status, expected),
          `${row.method} ${row.path} bởi ${role}: mong ${expected}, nhận ${res.status} – ${res.text}`,
        ).toBe(true);
      },
    );
  }
});

describe('ma trận quyền: 404 không lộ sự tồn tại của đối tượng (FR-007)', () => {
  for (const row of matrix.routes) {
    const notFoundRoles = matrix.roles.filter((r) => row.expect[r] === '404');
    if (notFoundRoles.length === 0) continue;
    it.each(notFoundRoles.map((role) => [role] as const))(
      `${row.id} – 404 của %s trùng từng byte với đối tượng không tồn tại`,
      async (role) => {
        const real = await call(row, role, world);
        const ghost = await call(row, role, world, true);
        expect(real.status).toBe(404);
        expect(ghost.status).toBe(404);
        expect(real.text).toBe(ghost.text);
        expect(real.headers['content-type']).toBe(ghost.headers['content-type']);
        expect(JSON.parse(real.text)).toEqual({
          code: 'NOT_FOUND',
          message: 'Không tìm thấy tài nguyên',
        });
      },
    );
  }
});

// --- Thao tác bị khóa / được phép khi thuộc lớp (permissions-matrix.md §2 dòng 13, 14; T067) ---

interface LockedOperationRow {
  id: string;
  method: MatrixRow['method'];
  path: string;
  body?: unknown;
  mutating?: boolean;
  expect: Record<RoleKey, string>;
}

const lockedOperations =
  (
    JSON.parse(
      readFileSync(
        path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../fixtures/authz-matrix.json'),
        'utf8',
      ),
    ) as { lockedOperations?: LockedOperationRow[] }
  ).lockedOperations ?? [];

describe('ma trận quyền: thao tác bị khóa khi thuộc lớp (FR-018)', () => {
  it('có dòng cho các thao tác bị khóa chính', () => {
    const ids = lockedOperations.map((r) => r.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'us3-locked-patch-minutes',
        'us3-locked-onboarding-draft',
        'us3-locked-onboarding-complete',
      ]),
    );
  });

  for (const row of lockedOperations) {
    it.each(matrix.roles.map((role) => [role] as const))(
      `${row.id} (${row.method} ${row.path}) – %s`,
      async (role) => {
        const w = row.mutating ? await buildRoleWorld(ctx) : world;
        const res = await api.raw(row.method, row.path, {
          token: w.tokens[role],
          body: substitute(row.body, worldValues(w)),
        });
        const expected = row.expect[role];
        expect(
          statusMatches(res.status, expected),
          `${row.method} ${row.path} bởi ${role}: mong ${expected}, nhận ${res.status} – ${res.text}`,
        ).toBe(true);
        // Người học KHÔNG thuộc lớp (USR) luôn dùng được thao tác "bị khóa": khóa chỉ áp cho thành viên lớp.
        if (role === 'USR') expect(res.status).not.toBe(409);
        if (res.status === 409) expect(JSON.parse(res.text).code).toBe('CLASS_MANAGED');
      },
    );
  }
});

// --- Hiệu lực tức thì của quyền xem dữ liệu học viên (permissions-matrix.md §3.2, FR-037, SC-008; T082) ---
// Dùng CÙNG MỘT access token của TCH/OWN trước và sau khi học viên mất tư cách thành viên: request kế tiếp phải
// 404 ngay, không chờ token hết hạn.

describe('ma trận quyền: dữ liệu học viên có hiệu lực tức thì (cùng access token)', () => {
  type Cause = 'rời lớp' | 'bị gỡ' | 'mất seat' | 'xóa tài khoản' | 'lưu trữ lớp';
  const causes: Cause[] = ['rời lớp', 'bị gỡ', 'mất seat', 'xóa tài khoản', 'lưu trữ lớp'];

  async function applyCause(cause: Cause, w: RoleWorld, learner: { userId: string }, mid: string) {
    switch (cause) {
      case 'rời lớp':
        return endLearnerMembership(ctx, w.orgA.orgId, mid, 'switched_personal');
      case 'bị gỡ':
        return endLearnerMembership(ctx, w.orgA.orgId, mid, 'removed');
      case 'mất seat': {
        const res = await api.raw('POST', `/org/seats/${learner.userId}/revoke`, {
          token: w.tokens.OWN,
        });
        expect(res.status).toBe(204);
        return;
      }
      case 'xóa tài khoản':
        await ctx.handle.pool.query(
          `UPDATE users SET status = 'pending_deletion', deletion_requested_at = now() WHERE id = $1`,
          [learner.userId],
        );
        return;
      case 'lưu trữ lớp': {
        const res = await api.raw('POST', `/classes/${w.classC}/archive`, {
          token: w.tokens.TCH,
          body: { confirm: true },
        });
        expect(res.status).toBe(200);
      }
    }
  }

  it.each(
    causes.flatMap((cause) => (['TCH', 'OWN'] as const).map((role) => [cause, role] as const)),
  )(
    'học viên %s ⇒ %s thấy 404 ở request kế tiếp và dòng biến khỏi bảng điều khiển',
    async (cause, role) => {
      const w = await buildRoleWorld(ctx);
      const learner = await createTestUser(ctx, { displayName: `Học viên ${cause}` });
      const { membershipId } = await enrollLearner(ctx, w.orgA.orgId, w.classC, learner.userId);
      const token = w.tokens[role]!;
      const detail = `/classes/${w.classC}/members/${learner.userId}/detail`;

      expect((await api.raw('GET', detail, { token })).status).toBe(200);
      await applyCause(cause, w, learner, membershipId);

      const after = await api.raw('GET', detail, { token });
      const ghost = await api.raw(
        'GET',
        `/classes/${w.classC}/members/${randomMissingId()}/detail`,
        {
          token,
        },
      );
      expect(after.status).toBe(404);
      expect(after.text).toBe(ghost.text);
      const dash = await api.raw('GET', `/classes/${w.classC}/dashboard`, { token });
      expect(dash.status).toBe(200);
      expect(
        (JSON.parse(dash.text).learners as { userId: string }[]).map((r) => r.userId),
      ).not.toContain(learner.userId);
    },
  );

  // Nguyên nhân làm mất quyền của CẢ tổ chức (§3.2): vai trò còn nhưng `requireDataAccess` từ chối ⇒ 403.
  it.each(
    (['giấy phép quá ân hạn', 'tổ chức bị vô hiệu hóa'] as const).flatMap((cause) =>
      (['TCH', 'OWN'] as const).map((role) => [cause, role] as const),
    ),
  )(
    '%s ⇒ %s đang xem được chuyển sang 403 ở request kế tiếp (cùng token), không lộ dữ liệu học viên',
    async (cause, role) => {
      const w = await buildRoleWorld(ctx);
      const learner = await createTestUser(ctx, { displayName: `Học viên ${cause}` });
      await enrollLearner(ctx, w.orgA.orgId, w.classC, learner.userId);
      const token = w.tokens[role]!;
      const detail = `/classes/${w.classC}/members/${learner.userId}/detail`;
      expect((await api.raw('GET', detail, { token })).status).toBe(200);

      if (cause === 'giấy phép quá ân hạn') {
        // Không tiến đồng hồ để giữ nguyên access token đang mở (hết hạn 15 phút theo đồng hồ giả).
        await ctx.handle.pool.query(
          `UPDATE seat_licenses SET ends_on = '2026-01-02', grace_days = 0 WHERE id = $1`,
          [w.licenseA],
        );
      } else {
        await setOrganizationStatus(ctx.app.deps, null, w.orgA.orgId, 'disabled');
      }

      for (const url of [detail, `/classes/${w.classC}/dashboard`]) {
        const after = await api.raw('GET', url, { token });
        expect(after.status, `${cause} → ${url}: ${after.text}`).toBe(403);
        expect(after.text).not.toContain(learner.userId);
      }
      // Cấu trúc lớp vẫn xem được (FR-038): chỉ dữ liệu học bị khóa.
      expect((await api.raw('GET', `/classes/${w.classC}`, { token })).status).toBe(200);
    },
  );

  it('giáo viên bị gỡ vai trò: cùng token đang xem được lớp chuyển 403 ngay ở request kế tiếp', async () => {
    const w = await buildRoleWorld(ctx);
    const token = w.tokens.TCH!;
    const url = `/classes/${w.classC}/dashboard`;
    expect((await api.raw('GET', url, { token })).status).toBe(200);
    const removed = await api.raw('DELETE', `/org/teachers/${w.users.TCH.userId}`, {
      token: w.tokens.OWN,
    });
    expect(removed.status).toBe(204);
    expect((await api.raw('GET', url, { token })).status).toBe(403);
    expect((await api.raw('GET', `/classes/${w.classC}`, { token })).status).toBe(403);
  });

  it('giáo viên bị thu hồi seat: cùng token đang 200 chuyển 403 ngay (vẫn giữ vai trò, mất quyền dữ liệu)', async () => {
    const w = await buildRoleWorld(ctx);
    const teacher = await createTestUser(ctx, { displayName: 'Giáo viên mất seat' });
    await addOrgRole(ctx, w.orgA.orgId, teacher.userId, { teacher: true });
    const { classId } = await createTestClass(ctx, w.orgA.orgId, { teacherIds: [teacher.userId] });
    const token = await tokenFor(ctx, teacher);
    const url = `/classes/${classId}/dashboard`;

    expect((await api.raw('GET', url, { token })).status).toBe(200);
    const revoke = await api.raw('POST', `/org/seats/${teacher.userId}/revoke`, {
      token: w.tokens.OWN,
    });
    expect(revoke.status).toBe(204);
    expect((await api.raw('GET', url, { token })).status).toBe(403);
  });
});
