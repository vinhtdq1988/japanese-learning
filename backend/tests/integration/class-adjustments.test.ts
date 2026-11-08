/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { seedContent } from '../../src/seed/index.js';
import { ContractClient } from '../contract/client.js';
import { query } from './lesson-helpers.js';
import { createTestApp, type TestApp } from './helpers.js';
import {
  addOrgRole,
  createTestClass,
  createTestOrg,
  createTestUser,
  endLearnerMembership,
  enrollLearner,
  tokenFor,
  type TestUser,
} from './org-helpers.js';

// Tinh chỉnh lộ trình lớp (spec 004, T091, US5, quickstart OG5, FR-020, FR-022 → FR-026): chọn bài/thứ tự/ngày
// mở, bài giao, ghi đè riêng, miễn bài, tạm dừng. Kế hoạch từng học viên phản ánh đúng; cảnh báo khả thi không
// chặn lưu; đơn vị bị vô hiệu hóa biến khỏi kế hoạch/mẫu số và xuất hiện trong `contentNotices`.

let ctx: TestApp;
let api: ContractClient;
const NOW = '2026-01-20T05:00:00Z'; // 12:00 giờ Việt Nam, ngày địa phương 2026-01-20

beforeAll(async () => {
  ctx = await createTestApp();
  await seedContent(ctx.handle.db);
  api = new ContractClient(ctx.app);
});
beforeEach(() => {
  ctx.clock.set(NOW);
  invalidateContent();
});
afterAll(async () => {
  await ctx.close();
});

const invalidateContent = () => (ctx.app as any).deps.contentCache.invalidate();

interface World {
  orgId: string;
  classId: string;
  teacher: TestUser;
  token: string;
  /** Đơn vị của lộ trình mẫu theo thứ tự tham khảo: id + tiêu đề tiếng Việt. */
  units: { unitId: string; title: string }[];
}

/** Lớp có lộ trình mẫu (05→30/06, 30 phút/ngày, từ vựng + ngữ pháp + Kanji N5→N3). */
async function setupClass(withPath = true): Promise<World> {
  const org = await createTestOrg(ctx, { seats: 20 });
  const teacher = await createTestUser(ctx);
  await addOrgRole(ctx, org.orgId, teacher.userId, { teacher: true });
  const { classId } = await createTestClass(ctx, org.orgId, {
    teacherIds: [teacher.userId],
    withPath: false,
  });
  const token = await tokenFor(ctx, teacher);
  let units: World['units'] = [];
  if (withPath) {
    const put = await api.put(`/classes/${classId}/path`, {
      token,
      body: {
        startLevel: 'N5',
        targetLevel: 'N3',
        skills: ['vocabulary', 'grammar', 'kanji'],
        startsOn: '2026-01-05',
        endsOn: '2026-06-30',
        dailyMinutes: 30,
      },
    });
    expect(put.status).toBe(200);
    units = put.body.units.map((u: any) => ({ unitId: u.unitId, title: u.title }));
    expect(units.length).toBeGreaterThan(12);
  }
  return { orgId: org.orgId, classId, teacher, token, units };
}

async function joinLearner(
  w: World,
  name = 'Học viên',
): Promise<TestUser & { membershipId: string }> {
  const user = await createTestUser(ctx, { displayName: name });
  const { membershipId } = await enrollLearner(ctx, w.orgId, w.classId, user.userId);
  return { ...user, membershipId };
}

const putUnits = (w: World, units: unknown[], validateResponse = true) =>
  api.put(`/classes/${w.classId}/path/units`, {
    token: w.token,
    body: { units },
    validateResponse,
    validateRequest: validateResponse,
  });
const getPath = async (w: World) =>
  (await api.get(`/classes/${w.classId}/path`, { token: w.token })).body.path;
const todayOf = async (user: TestUser) =>
  (await api.get('/today', { token: await tokenFor(ctx, user) })).body;
const newUnitTitles = (plan: any): string[] =>
  plan.items.filter((i: any) => i.type === 'new_unit').map((i: any) => i.title);
const dashboard = async (w: World) =>
  (await api.get(`/classes/${w.classId}/dashboard`, { token: w.token })).body;

describe('PUT /classes/{id}/path/units (chế độ liệt kê)', () => {
  it('lớp chưa có lộ trình ⇒ 409 CLASS_NOT_READY', async () => {
    const w = await setupClass(false);
    const res = await putUnits(w, [], false);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CLASS_NOT_READY');
  });

  it('chọn 12 đơn vị theo thứ tự + ngày mở: GET phản ánh đúng thứ tự, vị trí và isOpen', async () => {
    const w = await setupClass();
    const chosen = [...w.units].reverse().slice(0, 12);
    const body = chosen.map((u, i) => ({
      unitId: u.unitId,
      ...(i === 3 ? { opensOn: '2026-02-01' } : {}),
    }));
    const res = await putUnits(w, body);
    expect(res.status).toBe(200);
    expect(res.body.mode).toBe('explicit');
    expect(res.body.units.map((u: any) => u.unitId)).toEqual(chosen.map((u) => u.unitId));
    expect(res.body.units.map((u: any) => u.position)).toEqual(chosen.map((_, i) => i + 1));
    expect(res.body.units[3]).toMatchObject({ opensOn: '2026-02-01', isOpen: false });
    expect(res.body.units[0]).toMatchObject({ isOpen: true });

    const stored = await getPath(w);
    expect(stored.units.map((u: any) => u.unitId)).toEqual(chosen.map((u) => u.unitId));
  });

  it('thay trọn vẹn trong một giao dịch; units: [] quay lại chế độ mẫu', async () => {
    const w = await setupClass();
    await putUnits(
      w,
      w.units.slice(0, 5).map((u) => ({ unitId: u.unitId })),
    );
    await putUnits(
      w,
      w.units.slice(5, 7).map((u) => ({ unitId: u.unitId })),
    );
    expect((await getPath(w)).units.map((u: any) => u.unitId)).toEqual(
      w.units.slice(5, 7).map((u) => u.unitId),
    );
    // Hoán đổi vị trí không vướng ràng buộc UNIQUE (class_id, position) hoãn được.
    const swapped = [w.units[6]!, w.units[5]!].map((u) => ({ unitId: u.unitId }));
    expect((await putUnits(w, swapped)).status).toBe(200);

    const reset = await putUnits(w, []);
    expect(reset.status).toBe(200);
    expect(reset.body.mode).toBe('template');
    expect(
      await query(ctx, 'SELECT 1 FROM class_path_units WHERE class_id = $1', [w.classId]),
    ).toHaveLength(0);
  });

  it('đơn vị không tồn tại / không active / trùng ⇒ 422 và danh sách cũ KHÔNG đổi', async () => {
    const w = await setupClass();
    await putUnits(
      w,
      w.units.slice(0, 3).map((u) => ({ unitId: u.unitId })),
    );
    const inactive = w.units[10]!.unitId;
    await query(ctx, `UPDATE learning_units SET status = 'inactive' WHERE id = $1`, [inactive]);
    invalidateContent();
    try {
      for (const bad of [
        [{ unitId: randomUUID() }],
        [{ unitId: inactive }],
        [{ unitId: w.units[0]!.unitId }, { unitId: w.units[0]!.unitId }],
      ]) {
        const res = await putUnits(w, bad, false);
        expect(res.status).toBe(422);
        expect(res.body.code).toBe('VALIDATION_FAILED');
        expect(res.body.fields).toHaveProperty('units');
      }
    } finally {
      await query(ctx, `UPDATE learning_units SET status = 'active' WHERE id = $1`, [inactive]);
      invalidateContent();
    }
    expect((await getPath(w)).units.map((u: any) => u.unitId)).toEqual(
      w.units.slice(0, 3).map((u) => u.unitId),
    );
  });

  it('kế hoạch học viên theo danh sách chọn: bài đầu danh sách, bài chưa mở không vào kế hoạch', async () => {
    const w = await setupClass();
    const [a, b, c] = [w.units[8]!, w.units[2]!, w.units[5]!];
    await putUnits(w, [
      { unitId: a.unitId },
      { unitId: b.unitId, opensOn: '2026-03-01' },
      { unitId: c.unitId },
    ]);
    const learner = await joinLearner(w);
    const titles = newUnitTitles(await todayOf(learner));
    expect(titles.length).toBeGreaterThan(0);
    expect(titles[0]).toBe(a.title);
    expect(titles).not.toContain(b.title);
    expect(titles.every((t) => [a.title, c.title].includes(t))).toBe(true);
  });
});

describe('bài giao', () => {
  const post = (w: World, body: unknown, validateResponse = true) =>
    api.post(`/classes/${w.classId}/assignments`, {
      token: w.token,
      body,
      validateResponse,
      validateRequest: validateResponse,
    });

  it('giao 1–20 đơn vị với một hạn: 201 kèm batchId, tiêu đề; GET path có bài giao', async () => {
    const w = await setupClass();
    const picked = w.units.slice(-2);
    const res = await post(w, { unitIds: picked.map((u) => u.unitId), dueOn: '2026-01-25' });
    expect(res.status).toBe(201);
    expect(res.body.assignments).toHaveLength(2);
    const batch = new Set(res.body.assignments.map((a: any) => a.batchId));
    expect(batch).toEqual(new Set([res.body.batchId]));
    expect(res.body.assignments.map((a: any) => a.title).sort()).toEqual(
      picked.map((u) => u.title).sort(),
    );
    expect((await getPath(w)).assignments).toHaveLength(2);
  });

  it('kiểm tra đầu vào: 0 hoặc > 20 đơn vị, đơn vị lạ/không active, hạn đã qua ⇒ 422', async () => {
    const w = await setupClass();
    const bad = [
      { unitIds: [], dueOn: '2026-01-25' },
      { unitIds: Array.from({ length: 21 }, () => randomUUID()), dueOn: '2026-01-25' },
      { unitIds: [randomUUID()], dueOn: '2026-01-25' },
      { unitIds: [w.units[0]!.unitId], dueOn: '2026-01-19' },
      { unitIds: [w.units[0]!.unitId], dueOn: '2026-13-40' },
      { unitIds: [w.units[0]!.unitId, w.units[0]!.unitId], dueOn: '2026-01-25' },
    ];
    for (const body of bad) {
      const res = await post(w, body, false);
      expect(res.status, JSON.stringify(body).slice(0, 80)).toBe(422);
    }
    expect((await getPath(w)).assignments).toEqual([]);
  });

  it('đơn vị đã có bài giao còn hiệu lực ⇒ 409; hủy rồi giao lại được; hủy lần hai ⇒ 404', async () => {
    const w = await setupClass();
    const unit = w.units[3]!.unitId;
    const first = await post(w, { unitIds: [unit], dueOn: '2026-01-25' });
    expect(first.status).toBe(201);
    expect((await post(w, { unitIds: [unit], dueOn: '2026-01-26' }, false)).status).toBe(409);

    const id = first.body.assignments[0].id;
    expect(
      (await api.delete(`/classes/${w.classId}/assignments/${id}`, { token: w.token })).status,
    ).toBe(204);
    expect(
      (
        await api.delete(`/classes/${w.classId}/assignments/${id}`, {
          token: w.token,
          validateResponse: false,
        })
      ).status,
    ).toBe(404);
    expect((await post(w, { unitIds: [unit], dueOn: '2026-01-26' })).status).toBe(201);
  });

  it('bài giao vượt quỹ: 201 kèm cảnh báo over_capacity theo assignmentId, KHÔNG chặn lưu', async () => {
    const w = await setupClass();
    // Hạn hôm nay: quỹ 30 phút, giao 12 đơn vị ⇒ chắc chắn vượt.
    const res = await post(w, {
      unitIds: w.units.slice(0, 12).map((u) => u.unitId),
      dueOn: '2026-01-20',
    });
    expect(res.status).toBe(201);
    expect(res.body.warnings.length).toBeGreaterThan(0);
    const ids = new Set(res.body.assignments.map((a: any) => a.id));
    for (const warn of res.body.warnings) {
      expect(warn.code).toBe('over_capacity');
      expect(warn.requiredMinutes).toBeGreaterThan(warn.capacityMinutes);
      expect(ids.has(warn.assignmentId)).toBe(true);
    }
  });

  it('bài giao được đẩy lên đầu kế hoạch của mọi học viên chưa làm xong', async () => {
    const w = await setupClass();
    const target = w.units[w.units.length - 1]!;
    expect((await post(w, { unitIds: [target.unitId], dueOn: '2026-01-25' })).status).toBe(201);
    const learner = await joinLearner(w);
    expect(newUnitTitles(await todayOf(learner))[0]).toBe(target.title);
  });

  it('học viên đã hoàn thành đơn vị thì bài giao không còn đẩy lên (ghi nhận, không làm lại)', async () => {
    const w = await setupClass();
    const target = w.units[w.units.length - 1]!;
    const learner = await joinLearner(w);
    await query(
      ctx,
      `INSERT INTO unit_progress (user_id, unit_id, status) VALUES ($1, $2, 'completed')`,
      [learner.userId, target.unitId],
    );
    await post(w, { unitIds: [target.unitId], dueOn: '2026-01-25' });
    expect(newUnitTitles(await todayOf(learner))).not.toContain(target.title);
  });
});

describe('ghi đè riêng một học viên', () => {
  const putOverride = (w: World, userId: string, body: unknown, validateResponse = true) =>
    api.put(`/classes/${w.classId}/members/${userId}/override`, {
      token: w.token,
      body,
      validateResponse,
      validateRequest: validateResponse,
    });

  it('đổi phút/ngày: kế hoạch của riêng người đó theo quỹ mới; người khác không đổi', async () => {
    const w = await setupClass();
    const a = await joinLearner(w, 'A');
    const b = await joinLearner(w, 'B');
    const res = await putOverride(w, a.userId, { dailyMinutes: 5, shiftDays: 3 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ dailyMinutes: 5, shiftDays: 3, exemptUnitIds: [] });
    expect((await todayOf(a)).budgetMinutes).toBe(5);
    expect((await todayOf(b)).budgetMinutes).toBe(30);

    const reset = await putOverride(w, a.userId, { dailyMinutes: null, shiftDays: 0 });
    expect(reset.body).toMatchObject({ dailyMinutes: null, shiftDays: 0 });
  });

  it('dời mốc +N ngày hạ tỷ lệ mong đợi trên bảng điều khiển của người đó', async () => {
    const w = await setupClass();
    const a = await joinLearner(w, 'A');
    const before = (await dashboard(w)).learners[0].expectedRatio;
    await putOverride(w, a.userId, { dailyMinutes: null, shiftDays: 10 });
    const row = (await dashboard(w)).learners[0];
    expect(row.expectedRatio).toBeLessThan(before);
    expect(row.overrides).toMatchObject({ shiftDays: 10 });
  });

  it('giá trị ngoài phạm vi ⇒ 422; người không phải thành viên lớp ⇒ 404', async () => {
    const w = await setupClass();
    const a = await joinLearner(w);
    for (const body of [
      { dailyMinutes: 7, shiftDays: 0 },
      { dailyMinutes: 10, shiftDays: 61 },
      { dailyMinutes: 10, shiftDays: -61 },
      { dailyMinutes: 10 },
    ]) {
      expect((await putOverride(w, a.userId, body, false)).status).toBe(422);
    }
    const stranger = await createTestUser(ctx);
    expect(
      (await putOverride(w, stranger.userId, { dailyMinutes: 10, shiftDays: 0 }, false)).status,
    ).toBe(404);
  });

  it('gắn với giai đoạn thành viên: rời rồi vào lại bắt đầu sạch (không còn ghi đè/miễn bài)', async () => {
    const w = await setupClass();
    const a = await joinLearner(w);
    await putOverride(w, a.userId, { dailyMinutes: 5, shiftDays: 7 });
    await api.put(`/classes/${w.classId}/members/${a.userId}/exemptions/${w.units[0]!.unitId}`, {
      token: w.token,
    });
    await endLearnerMembership(ctx, w.orgId, a.membershipId, 'switched_personal');
    await enrollLearner(ctx, w.orgId, w.classId, a.userId);
    const row = (await dashboard(w)).learners.find((r: any) => r.userId === a.userId);
    expect(row.overrides).toBeUndefined();
    expect((await todayOf(a)).budgetMinutes).toBe(30);
  });
});

describe('miễn bài', () => {
  const exempt = (w: World, userId: string, unitId: string, method: 'put' | 'delete') =>
    (method === 'put' ? api.put.bind(api) : api.delete.bind(api))(
      `/classes/${w.classId}/members/${userId}/exemptions/${unitId}`,
      { token: w.token, validateResponse: false, validateRequest: false },
    );

  it('miễn rồi bỏ miễn (idempotent): đơn vị rời khỏi/quay lại mẫu số tiến độ của người đó', async () => {
    const w = await setupClass();
    const a = await joinLearner(w);
    const unit = w.units[0]!.unitId;
    const ratioOf = async () => (await dashboard(w)).learners[0].completionRatio;
    await query(
      ctx,
      `INSERT INTO unit_progress (user_id, unit_id, status) VALUES ($1, $2, 'completed')`,
      [a.userId, w.units[1]!.unitId],
    );
    const before = await ratioOf();

    expect((await exempt(w, a.userId, unit, 'put')).status).toBe(204);
    expect((await exempt(w, a.userId, unit, 'put')).status).toBe(204);
    expect(await ratioOf()).toBeGreaterThan(before);
    expect((await dashboard(w)).learners[0].overrides.exemptUnitIds).toEqual([unit]);

    expect((await exempt(w, a.userId, unit, 'delete')).status).toBe(204);
    expect(await ratioOf()).toBe(before);
  });

  it('đơn vị được miễn không vào kế hoạch của người đó nhưng vẫn vào kế hoạch người khác', async () => {
    const w = await setupClass();
    const a = await joinLearner(w, 'A');
    const b = await joinLearner(w, 'B');
    const firstOfB = newUnitTitles(await todayOf(b))[0]!;
    const unit = w.units.find((u) => u.title === firstOfB)!.unitId;
    expect((await exempt(w, a.userId, unit, 'put')).status).toBe(204);
    expect(newUnitTitles(await todayOf(a))).not.toContain(firstOfB);
    expect(newUnitTitles(await todayOf(b))).toContain(firstOfB);
  });

  it('đơn vị không tồn tại ⇒ 422; người không phải thành viên ⇒ 404', async () => {
    const w = await setupClass();
    const a = await joinLearner(w);
    expect((await exempt(w, a.userId, randomUUID(), 'put')).status).toBe(422);
    const stranger = await createTestUser(ctx);
    expect((await exempt(w, stranger.userId, w.units[0]!.unitId, 'put')).status).toBe(404);
  });
});

describe('tạm dừng', () => {
  const createPause = (w: World, body: unknown, validateResponse = true) =>
    api.post(`/classes/${w.classId}/pauses`, {
      token: w.token,
      body,
      validateResponse,
      validateRequest: validateResponse,
    });
  const listPauses = async (w: World) =>
    (await api.get(`/classes/${w.classId}/pauses`, { token: w.token })).body as any[];

  it('tạm dừng cả lớp: mọi học viên "paused", đóng lại thì trở về trạng thái tiến độ', async () => {
    const w = await setupClass();
    await joinLearner(w, 'A');
    await joinLearner(w, 'B');
    const created = await createPause(w, { startedOn: '2026-01-19' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ userId: null, startedOn: '2026-01-19', endedOn: null });
    expect((await dashboard(w)).summary.paused).toBe(2);
    expect((await listPauses(w)).map((p) => p.id)).toEqual([created.body.id]);

    const end = await api.post(`/classes/${w.classId}/pauses/${created.body.id}/end`, {
      token: w.token,
      body: { endedOn: '2026-01-20' },
    });
    expect(end.status).toBe(200);
    expect(end.body.endedOn).toBe('2026-01-20');
    expect((await dashboard(w)).summary.paused).toBe(0);
  });

  it('chỉ một khoảng mở cho mỗi phạm vi (cả lớp / từng học viên) ⇒ 409; phạm vi khác thì được', async () => {
    const w = await setupClass();
    const a = await joinLearner(w);
    expect((await createPause(w, { startedOn: '2026-01-20' })).status).toBe(201);
    expect((await createPause(w, { startedOn: '2026-01-21' }, false)).status).toBe(409);
    expect((await createPause(w, { userId: a.userId, startedOn: '2026-01-20' })).status).toBe(201);
    expect(
      (await createPause(w, { userId: a.userId, startedOn: '2026-01-22' }, false)).status,
    ).toBe(409);
    const kinds = (await listPauses(w)).map((p) => p.userId);
    expect(kinds.sort()).toEqual([null, a.userId].sort());
  });

  it('khoảng nghỉ đặt trước (tương lai) hợp lệ; chưa tới ngày thì chưa "paused"', async () => {
    const w = await setupClass();
    await joinLearner(w);
    const res = await createPause(w, { startedOn: '2026-02-01', endedOn: '2026-02-08' });
    expect(res.status).toBe(201);
    expect((await dashboard(w)).summary.paused).toBe(0);
    ctx.clock.set('2026-02-03T05:00:00Z');
    w.token = await tokenFor(ctx, w.teacher); // token cũ đã hết hạn theo đồng hồ giả
    expect((await dashboard(w)).summary.paused).toBe(1);
  });

  it('kiểm tra đầu vào: ngày kết thúc phải sau ngày bắt đầu; học viên lạ ⇒ 404; kết thúc mặc định hôm nay', async () => {
    const w = await setupClass();
    const stranger = await createTestUser(ctx);
    expect(
      (await createPause(w, { startedOn: '2026-02-08', endedOn: '2026-02-01' }, false)).status,
    ).toBe(422);
    expect((await createPause(w, { startedOn: 'khong-phai-ngay' }, false)).status).toBe(422);
    expect(
      (await createPause(w, { userId: stranger.userId, startedOn: '2026-01-20' }, false)).status,
    ).toBe(404);

    const open = await createPause(w, { startedOn: '2026-01-10' });
    const end = await api.post(`/classes/${w.classId}/pauses/${open.body.id}/end`, {
      token: w.token,
    });
    expect(end.status).toBe(200);
    expect(end.body.endedOn).toBe('2026-01-20');
  });

  it('tạm dừng của lớp không làm sai chuỗi/vắng của học viên và không bị tính là bỏ lỡ', async () => {
    const w = await setupClass();
    const a = await joinLearner(w);
    await createPause(w, { startedOn: '2026-01-10' });
    const row = (await dashboard(w)).learners.find((r: any) => r.userId === a.userId);
    expect(row.progressStatus).toBe('paused');
    expect(row.alerts).toEqual([]);
  });
});

describe('đơn vị bị vô hiệu hóa (FR-020)', () => {
  it('biến khỏi kế hoạch/mẫu số và hiện trong contentNotices của giáo viên cho tới khi được gỡ', async () => {
    const w = await setupClass();
    const keep = w.units[0]!;
    const gone = w.units[1]!;
    await putUnits(w, [{ unitId: keep.unitId }, { unitId: gone.unitId }]);
    expect(
      (
        await api.post(`/classes/${w.classId}/assignments`, {
          token: w.token,
          body: { unitIds: [gone.unitId], dueOn: '2026-01-25' },
        })
      ).status,
    ).toBe(201);
    const learner = await joinLearner(w);

    await query(ctx, `UPDATE learning_units SET status = 'inactive' WHERE id = $1`, [gone.unitId]);
    invalidateContent();
    try {
      const path = await getPath(w);
      expect(path.contentNotices).toEqual(
        expect.arrayContaining([
          { unitId: gone.unitId, title: gone.title, source: 'path' },
          { unitId: gone.unitId, title: gone.title, source: 'assignment' },
        ]),
      );
      const dash = await dashboard(w);
      expect(dash.contentNotices.length).toBe(2);
      expect(newUnitTitles(await todayOf(learner))).not.toContain(gone.title);
      // Mẫu số chỉ còn đơn vị còn active.
      await query(
        ctx,
        `INSERT INTO unit_progress (user_id, unit_id, status) VALUES ($1, $2, 'completed')`,
        [learner.userId, keep.unitId],
      );
      expect((await dashboard(w)).learners[0].completionRatio).toBe(1);

      // Gỡ khỏi lộ trình và hủy bài giao ⇒ hết thông báo.
      await putUnits(w, [{ unitId: keep.unitId }]);
      const assignmentId = (await getPath(w)).assignments[0].id;
      await api.delete(`/classes/${w.classId}/assignments/${assignmentId}`, { token: w.token });
      expect((await getPath(w)).contentNotices).toEqual([]);
    } finally {
      await query(ctx, `UPDATE learning_units SET status = 'active' WHERE id = $1`, [gone.unitId]);
      invalidateContent();
    }
  });
});
