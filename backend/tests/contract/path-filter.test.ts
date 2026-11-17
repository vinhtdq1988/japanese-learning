/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedContent } from '../../src/seed/index.js';
import { createTestApp, type TestApp } from '../integration/helpers.js';
import { onboardedLearner, type Learner } from '../integration/lesson-helpers.js';
import {
  addOrgRole,
  createTestClass,
  createTestInvitation,
  createTestOrg,
  createTestUser,
} from '../integration/org-helpers.js';
import { ContractClient } from './client.js';

// Kiểm thử hợp đồng `GET /path` lọc/phân trang (spec 008, T210; OpenAPI 1.15.0, contracts/api-changes.md §2,
// FR-019 ngoài lề, SC-007): tổ hợp `kind`/`level`/`status`/`limit`/`offset`, `itemsTotal`, 422 khi tham số sai,
// `offset` vượt `itemsTotal`, `kind` ngoài kỹ năng hiệu lực, lộ trình lớp và hành vi cũ khi không có tham số.
// Mọi request/response được ContractClient đối chiếu `openapi.yaml`.

let ctx: TestApp;
let api: ContractClient;

beforeAll(async () => {
  ctx = await createTestApp();
  await seedContent(ctx.handle.db);
  api = new ContractClient(ctx.app);
});
afterAll(async () => {
  await ctx.close();
});

const getPath = (learner: Learner, query = '') =>
  api.get(`/path${query ? `?${query}` : ''}`, { token: learner.token });

/** Người học ba kỹ năng (từ vựng, ngữ pháp, Kanji), 15 phút/ngày, đi từ N5 → N3 nên lộ trình có nhiều loại/trình độ. */
const learnerWithMixedPath = (): Promise<Learner> =>
  onboardedLearner(api, ctx, {
    skills: ['vocabulary', 'grammar', 'kanji'],
    dailyMinutes: 15,
    goalType: 'jlpt',
    targetLevel: 'N3',
  });

/** Bản đầy đủ không tham số = nguồn đối chiếu (thứ tự xếp hạng động). */
async function fullPath(learner: Learner) {
  const res = await getPath(learner);
  expect(res.status).toBe(200);
  return res.body as {
    totalUnits: number;
    completedUnits: number;
    itemsTotal?: number;
    items: { unitId: string; kind: string; level: string; status: string }[];
  };
}

describe('không tham số = hành vi cũ', () => {
  it('trả TOÀN BỘ đơn vị; itemsTotal (nếu có) bằng số phần tử và totalUnits', async () => {
    const learner = await learnerWithMixedPath();
    const full = await fullPath(learner);
    expect(full.items.length).toBeGreaterThan(5);
    expect(full.items).toHaveLength(full.totalUnits);
    if (full.itemsTotal !== undefined) expect(full.itemsTotal).toBe(full.items.length);
  });
});

describe('bộ lọc kind / level / status', () => {
  it('kind: chỉ đơn vị của loại đó, giữ thứ tự xếp hạng, itemsTotal = số khớp', async () => {
    const learner = await learnerWithMixedPath();
    const full = await fullPath(learner);
    for (const kind of ['vocabulary', 'grammar', 'kanji']) {
      const res = await getPath(learner, `kind=${kind}`);
      expect(res.status, kind).toBe(200);
      const expected = full.items.filter((i) => i.kind === kind).map((i) => i.unitId);
      expect(
        res.body.items.map((i: any) => i.unitId),
        kind,
      ).toEqual(expected);
      expect(res.body.itemsTotal, kind).toBe(expected.length);
    }
  });

  it('level và status: lọc đúng và giữ thứ tự', async () => {
    const learner = await learnerWithMixedPath();
    const full = await fullPath(learner);
    for (const level of ['N5', 'N4', 'N3']) {
      const res = await getPath(learner, `level=${level}`);
      expect(res.status, level).toBe(200);
      expect(
        res.body.items.map((i: any) => i.unitId),
        level,
      ).toEqual(full.items.filter((i) => i.level === level).map((i) => i.unitId));
    }
    const pending = await getPath(learner, 'status=pending');
    expect(pending.status).toBe(200);
    expect(pending.body.items).toHaveLength(full.items.length);
    for (const status of ['in_progress', 'completed', 'mastered']) {
      const res = await getPath(learner, `status=${status}`);
      expect(res.status, status).toBe(200);
      expect(res.body.items, status).toEqual([]);
      expect(res.body.itemsTotal, status).toBe(0);
    }
  });

  it('tổ hợp kind + level + status + limit + offset', async () => {
    const learner = await learnerWithMixedPath();
    const full = await fullPath(learner);
    const matching = full.items.filter(
      (i) => i.kind === 'vocabulary' && i.level === 'N5' && i.status === 'pending',
    );
    expect(matching.length).toBeGreaterThan(1);
    const res = await getPath(learner, 'kind=vocabulary&level=N5&status=pending&limit=1&offset=1');
    expect(res.status).toBe(200);
    expect(res.body.items.map((i: any) => i.unitId)).toEqual([matching[1]!.unitId]);
    expect(res.body.itemsTotal).toBe(matching.length);
  });

  it('totalUnits/completedUnits luôn là của TOÀN BỘ lộ trình, không đổi theo bộ lọc', async () => {
    const learner = await learnerWithMixedPath();
    const full = await fullPath(learner);
    for (const q of ['kind=grammar', 'level=N3', 'status=completed', 'limit=2&offset=3']) {
      const res = await getPath(learner, q);
      expect(res.status, q).toBe(200);
      expect(res.body.totalUnits, q).toBe(full.totalUnits);
      expect(res.body.completedUnits, q).toBe(full.completedUnits);
    }
  });
});

describe('limit / offset', () => {
  it('cắt SAU khi lọc, giữ thứ tự và ghép lại đủ danh sách', async () => {
    const learner = await learnerWithMixedPath();
    const full = await fullPath(learner);
    const pages: string[] = [];
    for (let offset = 0; offset < full.items.length; offset += 4) {
      const res = await getPath(learner, `limit=4&offset=${offset}`);
      expect(res.status).toBe(200);
      expect(res.body.items.length).toBeLessThanOrEqual(4);
      expect(res.body.itemsTotal).toBe(full.items.length);
      pages.push(...res.body.items.map((i: any) => i.unitId));
    }
    expect(pages).toEqual(full.items.map((i) => i.unitId));
  });

  it('limit biên 1 và 500 hợp lệ; offset mặc định 0', async () => {
    const learner = await learnerWithMixedPath();
    const full = await fullPath(learner);
    const one = await getPath(learner, 'limit=1');
    expect(one.status).toBe(200);
    expect(one.body.items.map((i: any) => i.unitId)).toEqual([full.items[0]!.unitId]);
    const max = await getPath(learner, 'limit=500');
    expect(max.status).toBe(200);
    expect(max.body.items).toHaveLength(Math.min(500, full.items.length));
  });

  it('offset vượt itemsTotal → items rỗng nhưng vẫn 200 và itemsTotal đúng', async () => {
    const learner = await learnerWithMixedPath();
    const full = await fullPath(learner);
    const res = await getPath(learner, `offset=${full.items.length + 50}`);
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.itemsTotal).toBe(full.items.length);
  });
});

describe('422 VALIDATION_FAILED khi tham số sai', () => {
  const invalid = [
    'kind=reading_comprehension',
    'kind=',
    'level=N1',
    'level=n4',
    'status=done',
    'limit=0',
    'limit=501',
    'limit=-3',
    'limit=abc',
    'limit=1.5',
    'offset=-1',
    'offset=x',
  ];
  it.each(invalid)('GET /path?%s → 422', async (query) => {
    const learner = await learnerWithMixedPath();
    const res = await getPath(learner, query);
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(Object.keys(res.body.fields ?? {}).length).toBeGreaterThan(0);
  });
});

describe('kind ngoài kỹ năng hiệu lực', () => {
  it('người học chỉ từ vựng + ngữ pháp lọc kind=kanji → 200 items rỗng; kind=reading/writing dưới 30 phút cũng rỗng', async () => {
    const learner = await onboardedLearner(api, ctx, { skills: ['vocabulary', 'grammar'] });
    for (const kind of ['kanji', 'reading', 'writing']) {
      const res = await getPath(learner, `kind=${kind}`);
      expect(res.status, kind).toBe(200);
      expect(res.body.items, kind).toEqual([]);
      expect(res.body.itemsTotal, kind).toBe(0);
    }
  });
});

describe('chưa onboarding → 404', () => {
  it('GET /path?kind=grammar trước onboarding vẫn là 404', async () => {
    const { registerUser } = await import('./client.js');
    const fresh = await registerUser(api);
    const res = await api.get('/path?kind=grammar', { token: fresh.accessToken });
    expect(res.status).toBe(404);
  });
});

describe('lộ trình lớp (source = class)', () => {
  it('học viên thuộc lớp: bộ lọc/phân trang áp dụng như nhau, totalUnits không đổi theo bộ lọc', async () => {
    const org = await createTestOrg(ctx, { seats: 4 });
    const teacher = await createTestUser(ctx);
    await addOrgRole(ctx, org.orgId, teacher.userId, { teacher: true });
    const { classId } = await createTestClass(ctx, org.orgId, {
      teacherIds: [teacher.userId],
      dailyMinutes: 10,
    });
    const learner = await onboardedLearner(api, ctx);
    const invitation = await createTestInvitation(ctx, org.orgId, {
      kind: 'student',
      email: learner.user.email,
      classId,
    });
    const joined = await api.post(`/invitations/${invitation.token}/respond`, {
      token: learner.token,
      body: { decision: 'join_class', confirmed: true },
    });
    expect(joined.status).toBe(200);

    const full = await getPath(learner);
    expect(full.status).toBe(200);
    expect(full.body.source).toBe('class');
    const items = full.body.items as { unitId: string; kind: string }[];
    expect(items.length).toBeGreaterThan(1);

    const kind = items[0]!.kind;
    const filtered = await getPath(learner, `kind=${kind}&limit=1`);
    expect(filtered.status).toBe(200);
    expect(filtered.body.source).toBe('class');
    expect(filtered.body.items.map((i: any) => i.unitId)).toEqual([
      items.find((i) => i.kind === kind)!.unitId,
    ]);
    expect(filtered.body.itemsTotal).toBe(items.filter((i) => i.kind === kind).length);
    expect(filtered.body.totalUnits).toBe(full.body.totalUnits);
    expect(filtered.body.completedUnits).toBe(full.body.completedUnits);

    const bad = await getPath(learner, 'level=N1');
    expect(bad.status).toBe(422);
  });
});
