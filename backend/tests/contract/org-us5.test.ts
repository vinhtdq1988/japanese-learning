/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { seedContent } from '../../src/seed/index.js';
import { createTestApp, type TestApp } from '../integration/helpers.js';
import { buildRoleWorld, type RoleWorld } from '../integration/org-helpers.js';
import { ContractClient } from './client.js';

// Kiểm thử hợp đồng US5 (spec 004, T092, api-changes §9, FR-024 → FR-026): các route chọn bài, bài giao, ghi
// đè, miễn bài, tạm dừng khớp OpenAPI 1.12.0; `GET /me/class` có `assignments[].state`, `teacherAdjustments`,
// `pausedToday`; `PathWarning` khi bài giao vượt quỹ; kế hoạch hằng ngày vẫn ≤ quỹ dù lộ trình vượt quỹ.

let ctx: TestApp;
let api: ContractClient;
let world: RoleWorld;
const NOW = '2026-01-20T05:00:00Z';

beforeAll(async () => {
  ctx = await createTestApp();
  await seedContent(ctx.handle.db);
  api = new ContractClient(ctx.app);
});
beforeEach(async () => {
  ctx.clock.set(NOW);
  world = await buildRoleWorld(ctx);
});
afterAll(async () => {
  await ctx.close();
});

const tch = () => world.tokens.TCH!;
const lrn = () => world.tokens.LRN!;

async function pathUnits(): Promise<{ unitId: string; title: string }[]> {
  const res = await api.get(`/classes/${world.classC}/path`, { token: tch() });
  expect(res.status).toBe(200);
  return res.body.path.units;
}

describe('chọn bài, bài giao', () => {
  it('PUT /path/units: 200 khớp ClassPath; chế độ explicit giữ đúng thứ tự', async () => {
    const units = (await pathUnits()).slice(0, 4).reverse();
    const res = await api.put(`/classes/${world.classC}/path/units`, {
      token: tch(),
      body: {
        units: units.map((u, i) => ({ unitId: u.unitId, opensOn: i === 1 ? '2026-03-01' : null })),
      },
    });
    expect(res.status).toBe(200);
    expect(res.body.mode).toBe('explicit');
    expect(res.body.units.map((u: any) => u.unitId)).toEqual(units.map((u) => u.unitId));
  });

  it('POST /assignments: 201 khớp schema; DELETE: 204', async () => {
    const [u] = await pathUnits();
    const created = await api.post(`/classes/${world.classC}/assignments`, {
      token: tch(),
      body: { unitIds: [u!.unitId], dueOn: '2026-02-01' },
    });
    expect(created.status).toBe(201);
    expect(created.body.assignments[0]).toMatchObject({ unitId: u!.unitId, dueOn: '2026-02-01' });
    const del = await api.delete(
      `/classes/${world.classC}/assignments/${created.body.assignments[0].id}`,
      { token: tch() },
    );
    expect(del.status).toBe(204);
  });

  it('bài giao vượt quỹ: PathWarning over_capacity khớp schema (assignmentId có giá trị)', async () => {
    const units = (await pathUnits()).slice(0, 15);
    const res = await api.post(`/classes/${world.classC}/assignments`, {
      token: tch(),
      body: { unitIds: units.map((u) => u.unitId), dueOn: '2026-01-20' },
    });
    expect(res.status).toBe(201);
    expect(res.body.warnings.length).toBeGreaterThan(0);
    expect(res.body.warnings[0]).toMatchObject({ code: 'over_capacity' });
    expect(res.body.warnings[0].assignmentId).toBeTruthy();
  });
});

describe('ghi đè, miễn bài, tạm dừng', () => {
  const lrnId = () => world.users.LRN.userId;

  it('PUT /override: 200 khớp LearnerOverride', async () => {
    const res = await api.put(`/classes/${world.classC}/members/${lrnId()}/override`, {
      token: tch(),
      body: { dailyMinutes: 15, shiftDays: -2 },
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ dailyMinutes: 15, shiftDays: -2 });
  });

  it('PUT/DELETE /exemptions/{unitId}: 204', async () => {
    const [u] = await pathUnits();
    const url = `/classes/${world.classC}/members/${lrnId()}/exemptions/${u!.unitId}`;
    expect((await api.put(url, { token: tch() })).status).toBe(204);
    expect((await api.delete(url, { token: tch() })).status).toBe(204);
  });

  it('GET|POST /pauses và POST /pauses/{id}/end khớp schema ClassPause', async () => {
    const created = await api.post(`/classes/${world.classC}/pauses`, {
      token: tch(),
      body: { userId: lrnId(), startedOn: '2026-01-20' },
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ userId: lrnId(), startedOn: '2026-01-20' });
    const list = await api.get(`/classes/${world.classC}/pauses`, { token: tch() });
    expect(list.status).toBe(200);
    expect(list.body.map((p: any) => p.id)).toContain(created.body.id);
    const end = await api.post(`/classes/${world.classC}/pauses/${created.body.id}/end`, {
      token: tch(),
      body: { endedOn: '2026-01-25' },
    });
    expect(end.status).toBe(200);
    expect(end.body.endedOn).toBe('2026-01-25');
  });
});

describe('GET /me/class của học viên', () => {
  it('có assignments[].state, teacherAdjustments và pausedToday', async () => {
    const [u] = await pathUnits();
    await api.post(`/classes/${world.classC}/assignments`, {
      token: tch(),
      body: { unitIds: [u!.unitId], dueOn: '2026-01-30' },
    });
    await api.put(`/classes/${world.classC}/members/${world.users.LRN.userId}/override`, {
      token: tch(),
      body: { dailyMinutes: 5, shiftDays: 4 },
    });
    await api.post(`/classes/${world.classC}/pauses`, {
      token: tch(),
      body: { userId: world.users.LRN.userId, startedOn: '2026-01-20' },
    });

    const res = await api.get('/me/class', { token: lrn() });
    expect(res.status).toBe(200);
    expect(res.body.assignments).toHaveLength(1);
    expect(res.body.assignments[0]).toMatchObject({ unitId: u!.unitId, state: 'pending' });
    expect(res.body.teacherAdjustments).toMatchObject({ dailyMinutes: 5, shiftDays: 4 });
    expect(res.body.pausedToday).toBe(true);
  });

  it('bài giao đã quá hạn chưa xong ⇒ state overdue', async () => {
    const [u] = await pathUnits();
    await ctx.handle.pool.query(
      `INSERT INTO class_assignments (class_id, batch_id, unit_id, due_on)
       VALUES ($1, gen_random_uuid(), $2, '2026-01-10')`,
      [world.classC, u!.unitId],
    );
    const res = await api.get('/me/class', { token: lrn() });
    expect(res.body.assignments[0].state).toBe('overdue');
  });
});

describe('quỹ thời gian (FR-025)', () => {
  it('kế hoạch hằng ngày vẫn ≤ quỹ dù bài giao vượt quỹ', async () => {
    await api.put(`/classes/${world.classC}/members/${world.users.LRN.userId}/override`, {
      token: tch(),
      body: { dailyMinutes: 5, shiftDays: 0 },
    });
    const units = (await pathUnits()).slice(0, 15);
    const assigned = await api.post(`/classes/${world.classC}/assignments`, {
      token: tch(),
      body: { unitIds: units.map((u) => u.unitId), dueOn: '2026-01-20' },
    });
    expect(assigned.body.warnings.length).toBeGreaterThan(0);

    const plan = await api.get('/today', { token: lrn() });
    expect(plan.status).toBe(200);
    expect(plan.body.budgetMinutes).toBe(5);
    expect(plan.body.estimatedMinutes).toBeLessThanOrEqual(5);
    for (const item of plan.body.items) expect(item.estMinutes).toBeLessThanOrEqual(15);
  });
});
