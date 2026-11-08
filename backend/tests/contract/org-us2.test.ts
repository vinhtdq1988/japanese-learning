/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { QUEUES } from '../../src/jobs/boss.js';
import { createTestApp, type TestApp } from '../integration/helpers.js';
import {
  addOrgRole,
  createTestClass,
  createTestOrg,
  createTestUser,
  enrollLearner,
  tokenFor,
  type TestUser,
} from '../integration/org-helpers.js';
import { ContractClient } from './client.js';

// Kiểm thử hợp đồng US2 (spec 004, T044, quickstart OG2): tạo lớp, mời học viên (email/mã/CSV), hai lựa chọn
// của học viên, rời lớp, lưu trữ. Phản hồi được đối chiếu với OpenAPI 1.12.0.

let ctx: TestApp;
let api: ContractClient;

beforeAll(async () => {
  ctx = await createTestApp();
  api = new ContractClient(ctx.app);
});
afterAll(async () => {
  await ctx.close();
});

/** Token lời mời lấy từ email đã đưa vào hàng đợi (CSDL chỉ giữ băm). */
function tokenFromEmail(to: string): string {
  const job = [...ctx.jobQueue.jobs]
    .reverse()
    .find((j) => j.name === QUEUES.sendEmail && (j.data as any).to === to);
  const match = /#\/invite\/([A-Za-z0-9_-]+)/.exec((job?.data as any)?.text ?? '');
  if (!match) throw new Error(`Không có email lời mời gửi tới ${to}`);
  return match[1]!;
}

interface World {
  orgId: string;
  owner: TestUser;
  teacher: TestUser;
  ownerToken: string;
  teacherToken: string;
  classId: string;
}

/** Tổ chức có chủ, một giáo viên phụ trách một lớp ĐÃ có lộ trình. */
async function setup(seats = 6): Promise<World> {
  const org = await createTestOrg(ctx, { seats });
  const owner = await createTestUser(ctx, { displayName: 'Chủ tổ chức' });
  const teacher = await createTestUser(ctx, { displayName: 'Cô Hana' });
  await addOrgRole(ctx, org.orgId, owner.userId, { owner: true });
  await addOrgRole(ctx, org.orgId, teacher.userId, { teacher: true });
  const { classId } = await createTestClass(ctx, org.orgId, {
    name: 'Lớp N5 sáng',
    teacherIds: [teacher.userId],
  });
  return {
    orgId: org.orgId,
    owner,
    teacher,
    ownerToken: await tokenFor(ctx, owner),
    teacherToken: await tokenFor(ctx, teacher),
    classId,
  };
}

const csvHeaders = { 'content-type': 'text/csv; charset=utf-8' };

describe('POST /classes và GET /classes', () => {
  it('giáo viên tạo lớp tự là phụ trách; teacherIds chỉ chủ tổ chức', async () => {
    const w = await setup();
    const created = await api.post('/classes', {
      token: w.teacherToken,
      body: { name: 'Lớp N4 chiều', description: 'Buổi chiều thứ ba' },
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      name: 'Lớp N4 chiều',
      status: 'active',
      memberCount: 0,
      hasPath: false,
      teacherless: false,
      description: 'Buổi chiều thứ ba',
    });
    expect(created.body.teachers).toEqual([
      expect.objectContaining({ userId: w.teacher.userId, displayName: 'Cô Hana' }),
    ]);

    const forbidden = await api.post('/classes', {
      token: w.teacherToken,
      body: { name: 'X', teacherIds: [w.teacher.userId] },
    });
    expect(forbidden.status).toBe(403);
  });

  it('chủ tổ chức chọn giáo viên cùng tổ chức; người lạ → 422; không chọn ai → lớp chưa có giáo viên', async () => {
    const w = await setup();
    const ok = await api.post('/classes', {
      token: w.ownerToken,
      body: { name: 'Lớp do chủ tạo', teacherIds: [w.teacher.userId] },
    });
    expect(ok.status).toBe(201);
    expect(ok.body.teachers).toHaveLength(1);

    const outsider = await createTestUser(ctx);
    const bad = await api.post('/classes', {
      token: w.ownerToken,
      body: { name: 'Lớp lỗi', teacherIds: [outsider.userId] },
    });
    expect(bad.status).toBe(422);
    expect(bad.body.fields).toHaveProperty('teacherIds');

    // Chủ tổ chức không chọn ai (và không phải giáo viên): lớp tạm chưa có giáo viên (FR-040).
    const none = await api.post('/classes', { token: w.ownerToken, body: { name: 'Lớp trống' } });
    expect(none.status).toBe(201);
    expect(none.body).toMatchObject({ teachers: [], teacherless: true });
  });

  it('danh sách: giáo viên chỉ thấy lớp mình, chủ tổ chức thấy mọi lớp', async () => {
    const w = await setup();
    const otherTeacher = await createTestUser(ctx);
    await addOrgRole(ctx, w.orgId, otherTeacher.userId, { teacher: true });
    await createTestClass(ctx, w.orgId, { name: 'Lớp khác', teacherIds: [otherTeacher.userId] });

    const mine = await api.get('/classes', { token: w.teacherToken });
    expect(mine.status).toBe(200);
    expect(mine.body.map((c: any) => c.id)).toEqual([w.classId]);
    expect(mine.body[0]).toMatchObject({ hasPath: true, memberCount: 0, needAttentionCount: 0 });

    const all = await api.get('/classes', { token: w.ownerToken });
    expect(all.body).toHaveLength(2);
  });

  it('GET /classes/{id} và PATCH kiểm ngưỡng vắng mặt 1–14', async () => {
    const w = await setup();
    const detail = await api.get(`/classes/${w.classId}`, { token: w.teacherToken });
    expect(detail.status).toBe(200);
    expect(detail.body).toMatchObject({ id: w.classId, absenceThresholdDays: 3 });
    const patched = await api.patch(`/classes/${w.classId}`, {
      token: w.teacherToken,
      body: { name: 'Tên mới', absenceThresholdDays: 5 },
    });
    expect(patched.status).toBe(200);
    expect(patched.body).toMatchObject({ name: 'Tên mới', absenceThresholdDays: 5 });
    const bad = await api.patch(`/classes/${w.classId}`, {
      token: w.teacherToken,
      body: { absenceThresholdDays: 15 },
      validateRequest: false,
    });
    expect(bad.status).toBe(422);
  });
});

describe('mời học viên bằng email và hai lựa chọn (FR-016)', () => {
  it('luồng đầy đủ: mời → xem trước kèm disclosure → từ chối → mời lại → vào lớp → rời lớp', async () => {
    const w = await setup(3);
    const decliner = await createTestUser(ctx, { displayName: 'Người từ chối' });
    const joiner = await createTestUser(ctx, { displayName: 'Người vào lớp' });

    const invited = await api.post(`/classes/${w.classId}/invitations`, {
      token: w.teacherToken,
      body: {
        invitees: [
          { email: decliner.email, displayName: 'Từ chối' },
          { email: joiner.email },
          { email: 'khong-hop-le' },
          { email: decliner.email },
        ],
      },
    });
    expect(invited.status).toBe(200);
    expect(invited.body.results.map((r: any) => r.outcome)).toEqual([
      'invited',
      'invited',
      'invalid_email',
      'duplicate_in_file',
    ]);
    expect(invited.body.summary).toMatchObject({ total: 4, invited: 2, invalid_email: 1 });
    const mail = ctx.jobQueue.jobs.find(
      (j) => j.name === QUEUES.sendEmail && (j.data as any).to === joiner.email,
    )!.data as any;
    expect(mail.text).toContain('Lớp N5 sáng');
    expect(mail.text).toMatch(/decline/i);

    // Giữ chỗ nhưng chưa tốn seat.
    const roster1 = await api.get(`/classes/${w.classId}/roster`, { token: w.teacherToken });
    expect(roster1.body.map((r: any) => r.status).sort()).toEqual(['invited', 'invited']);

    const declineToken = tokenFromEmail(decliner.email);
    const declineBearer = await tokenFor(ctx, decliner);
    const preview = await api.get(`/invitations/${declineToken}`, { token: declineBearer });
    expect(preview.status).toBe(200);
    expect(preview.body).toMatchObject({ kind: 'student', organizationName: expect.any(String) });
    expect(preview.body.class).toMatchObject({ id: w.classId, name: 'Lớp N5 sáng' });
    expect(preview.body.disclosure).toMatchObject({
      version: 1,
      canLeaveAnytime: true,
      mayBeMovedWithinOrganization: false,
    });
    expect(preview.body.disclosure.visible.length).toBeGreaterThan(0);
    expect(preview.body.disclosure.notVisible.length).toBeGreaterThan(0);
    expect(preview.body.disclosure.lockedControls.length).toBeGreaterThan(0);

    const stay = await api.post(`/invitations/${declineToken}/respond`, {
      token: declineBearer,
      body: { decision: 'stay_personal' },
    });
    expect(stay.body.status).toBe('stayed_personal');
    const roster2 = await api.get(`/classes/${w.classId}/roster`, { token: w.teacherToken });
    expect(roster2.body.map((r: any) => r.status).sort()).toEqual(['declined', 'invited']);

    // join_class thiếu confirmed → 422, lời mời vẫn pending.
    const joinToken = tokenFromEmail(joiner.email);
    const joinBearer = await tokenFor(ctx, joiner);
    const noConfirm = await api.post(`/invitations/${joinToken}/respond`, {
      token: joinBearer,
      body: { decision: 'join_class' },
    });
    expect(noConfirm.status).toBe(422);
    const joined = await api.post(`/invitations/${joinToken}/respond`, {
      token: joinBearer,
      body: { decision: 'join_class', confirmed: true },
    });
    expect(joined.status).toBe(200);
    expect(joined.body.status).toBe('joined');
    expect(joined.body.class.id).toBe(w.classId);
    expect(joined.body.joinedAt).toBeTruthy();

    const mine = await api.get('/me/class', { token: joinBearer });
    expect(mine.status).toBe(200);
    expect(mine.body.class.id).toBe(w.classId);
    expect(mine.body.path).toMatchObject({ startLevel: 'N5', dailyMinutes: 10 });
    expect(mine.body.disclosure.version).toBe(1);

    const roster3 = await api.get(`/classes/${w.classId}/roster`, { token: w.teacherToken });
    expect(roster3.body.find((r: any) => r.status === 'joined')).toMatchObject({
      userId: joiner.userId,
      displayName: 'Người vào lớp',
      email: joiner.email,
    });

    // Rời lớp cần confirm; xong thì mất "Lớp của tôi" và seat được giải phóng.
    const noLeave = await api.post('/me/class/leave', {
      token: joinBearer,
      body: {},
      validateRequest: false,
    });
    expect(noLeave.status).toBe(422);
    const left = await api.post('/me/class/leave', { token: joinBearer, body: { confirm: true } });
    expect(left.status).toBe(204);
    expect((await api.get('/me/class', { token: joinBearer })).status).toBe(404);
    const roster4 = await api.get(`/classes/${w.classId}/roster`, { token: w.teacherToken });
    const ended = roster4.body.find((r: any) => r.status === 'switched_personal');
    expect(ended).toMatchObject({ displayName: 'Người vào lớp' });
    // Học viên đã rời chỉ còn tên + ngày: không userId/email (research O13).
    expect(ended.userId ?? null).toBeNull();
    expect(ended.email ?? null).toBeNull();
  });

  it('409 CLASS_NOT_READY khi lớp chưa có lộ trình (mời, bật mã)', async () => {
    const w = await setup();
    const { classId } = await createTestClass(ctx, w.orgId, {
      name: 'Lớp chưa lộ trình',
      teacherIds: [w.teacher.userId],
      withPath: false,
    });
    const inv = await api.post(`/classes/${classId}/invitations`, {
      token: w.teacherToken,
      body: { invitees: [{ email: 'a@example.com' }] },
    });
    expect(inv.status).toBe(409);
    expect(inv.body.code).toBe('CLASS_NOT_READY');
    const code = await api.put(`/classes/${classId}/join-code`, {
      token: w.teacherToken,
      body: { enabled: true },
    });
    expect(code.status).toBe(409);
    expect(code.body.code).toBe('CLASS_NOT_READY');
  });

  it('thu hồi lời mời trả lại chỗ giữ', async () => {
    // 2 seat: giáo viên chiếm 1, còn đúng 1 chỗ cho học viên.
    const w = await setup(2);
    const first = await api.post(`/classes/${w.classId}/invitations`, {
      token: w.teacherToken,
      body: { invitees: [{ email: 'cho-seat@example.com' }] },
    });
    expect(first.body.results[0].outcome).toBe('invited');
    const full = await api.post(`/classes/${w.classId}/invitations`, {
      token: w.teacherToken,
      body: { invitees: [{ email: 'het-cho@example.com' }] },
    });
    expect(full.body.results[0].outcome).toBe('no_seat');

    const roster = await api.get(`/classes/${w.classId}/roster`, { token: w.teacherToken });
    const invitationId = roster.body.find((r: any) => r.status === 'invited').invitationId;
    const revoked = await api.call('delete', `/invitations/${invitationId}`, {
      token: w.teacherToken,
    });
    expect(revoked.status).toBe(204);
    const retry = await api.post(`/classes/${w.classId}/invitations`, {
      token: w.teacherToken,
      body: { invitees: [{ email: 'het-cho@example.com' }] },
    });
    expect(retry.body.results[0].outcome).toBe('invited');
  });
});

describe('mã tham gia', () => {
  it('bật → xem trước → vào lớp; đổi mã vô hiệu mã cũ; stay_personal trả 204', async () => {
    const w = await setup();
    const empty = await api.get(`/classes/${w.classId}/join-code`, { token: w.teacherToken });
    expect(empty.body).toMatchObject({ enabled: false });
    const on = await api.put(`/classes/${w.classId}/join-code`, {
      token: w.teacherToken,
      body: { enabled: true },
    });
    expect(on.status).toBe(200);
    expect(on.body.code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    const oldCode = on.body.code as string;

    const rotated = await api.post(`/classes/${w.classId}/join-code/rotate`, {
      token: w.teacherToken,
    });
    expect(rotated.body.code).not.toBe(oldCode);

    const learner = await createTestUser(ctx);
    const token = await tokenFor(ctx, learner);
    const stale = await api.post('/me/class/join', { token, body: { code: oldCode } });
    expect(stale.status).toBe(404);

    const preview = await api.post('/me/class/join', {
      token,
      body: { code: rotated.body.code.toLowerCase() },
    });
    expect(preview.status).toBe(200);
    expect(preview.body.status).toBe('preview');
    expect(preview.body.class.id).toBe(w.classId);
    expect(preview.body.disclosure.canLeaveAnytime).toBe(true);

    const stay = await api.post('/me/class/join', {
      token,
      body: { code: rotated.body.code, decision: 'stay_personal' },
    });
    expect(stay.status).toBe(204);
    expect((await api.get('/me/class', { token })).status).toBe(404);

    const joined = await api.post('/me/class/join', {
      token,
      body: { code: rotated.body.code, decision: 'join_class', confirmed: true },
    });
    expect(joined.status).toBe(200);
    expect(joined.body.status).toBe('joined');
    expect((await api.get('/me/class', { token })).status).toBe(200);

    // Đã thuộc lớp → 409 ALREADY_IN_CLASS.
    const again = await api.post('/me/class/join', {
      token,
      body: { code: rotated.body.code, decision: 'join_class', confirmed: true },
    });
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('ALREADY_IN_CLASS');
  });
});

describe('nhập CSV', () => {
  it('trả đúng một kết quả cho mỗi dòng; 422 toàn file khi thiếu cột email', async () => {
    const w = await setup(8);
    const csv = [
      'email,display_name',
      'an@example.com,Nguyễn Văn An',
      'khong-hop-le,Sai',
      'binh@example.com,"Trần, Thị Bình"',
      'an@example.com,Trùng',
      '',
    ].join('\r\n');
    const res = await api.raw('POST', `/classes/${w.classId}/invitations/import`, {
      token: w.teacherToken,
      headers: csvHeaders,
      body: csv,
    });
    expect(res.status).toBe(200);
    const body = JSON.parse(res.text);
    expect(body.results.map((r: any) => [r.row, r.outcome])).toEqual([
      [1, 'invited'],
      [2, 'invalid_email'],
      [3, 'invited'],
      [4, 'duplicate_in_file'],
    ]);
    expect(body.summary).toMatchObject({ total: 4, invited: 2 });

    const bad = await api.raw('POST', `/classes/${w.classId}/invitations/import`, {
      token: w.teacherToken,
      headers: csvHeaders,
      body: 'name\r\nAn\r\n',
    });
    expect(bad.status).toBe(422);
  });
});

describe('thành viên, giáo viên phụ trách và lưu trữ', () => {
  it('DELETE member: gỡ học viên, seat giải phóng, roster chỉ còn tên + ngày', async () => {
    const w = await setup();
    const learner = await createTestUser(ctx, { displayName: 'Bị gỡ' });
    await enrollLearner(ctx, w.orgId, w.classId, learner.userId);
    const res = await api.call('delete', `/classes/${w.classId}/members/${learner.userId}`, {
      token: w.teacherToken,
    });
    expect(res.status).toBe(204);
    const roster = await api.get(`/classes/${w.classId}/roster`, { token: w.teacherToken });
    expect(roster.body).toEqual([
      expect.objectContaining({ status: 'removed', displayName: 'Bị gỡ' }),
    ]);
    const again = await api.call('delete', `/classes/${w.classId}/members/${learner.userId}`, {
      token: w.teacherToken,
    });
    expect(again.status).toBe(404);
  });

  it('PUT teachers: chỉ chủ tổ chức; rỗng → LAST_TEACHER; học viên của lớp → ALREADY_IN_CLASS', async () => {
    const w = await setup();
    const second = await createTestUser(ctx);
    await addOrgRole(ctx, w.orgId, second.userId, { teacher: true });
    const forbidden = await api.put(`/classes/${w.classId}/teachers`, {
      token: w.teacherToken,
      body: { userIds: [w.teacher.userId] },
    });
    expect(forbidden.status).toBe(403);
    const empty = await api.put(`/classes/${w.classId}/teachers`, {
      token: w.ownerToken,
      body: { userIds: [] },
    });
    expect(empty.status).toBe(409);
    expect(empty.body.code).toBe('LAST_TEACHER');
    const ok = await api.put(`/classes/${w.classId}/teachers`, {
      token: w.ownerToken,
      body: { userIds: [second.userId] },
    });
    expect(ok.status).toBe(200);
    expect(ok.body.teachers.map((t: any) => t.userId)).toEqual([second.userId]);

    const student = await createTestUser(ctx);
    await addOrgRole(ctx, w.orgId, student.userId, { teacher: true });
    // Một giáo viên của tổ chức đang là học viên lớp này không thể làm phụ trách lớp này.
    await enrollLearner(ctx, w.orgId, w.classId, student.userId);
    const conflict = await api.put(`/classes/${w.classId}/teachers`, {
      token: w.ownerToken,
      body: { userIds: [second.userId, student.userId] },
    });
    expect(conflict.status).toBe(409);
    expect(conflict.body.code).toBe('ALREADY_IN_CLASS');
  });

  it('archive cần confirm; đóng mọi thành viên; sau đó mọi thao tác ghi → 409 CLASS_ARCHIVED', async () => {
    const w = await setup();
    const learner = await createTestUser(ctx);
    await enrollLearner(ctx, w.orgId, w.classId, learner.userId);
    const noConfirm = await api.post(`/classes/${w.classId}/archive`, {
      token: w.teacherToken,
      body: {},
      validateRequest: false,
    });
    expect(noConfirm.status).toBe(422);
    const archived = await api.post(`/classes/${w.classId}/archive`, {
      token: w.teacherToken,
      body: { confirm: true },
    });
    expect(archived.status).toBe(200);
    expect(archived.body).toEqual({ learnersMoved: 1 });

    const detail = await api.get(`/classes/${w.classId}`, { token: w.teacherToken });
    expect(detail.body).toMatchObject({ status: 'archived', memberCount: 0 });
    for (const attempt of [
      api.patch(`/classes/${w.classId}`, { token: w.teacherToken, body: { name: 'X' } }),
      api.post(`/classes/${w.classId}/invitations`, {
        token: w.teacherToken,
        body: { invitees: [{ email: 'a@example.com' }] },
      }),
      api.put(`/classes/${w.classId}/join-code`, {
        token: w.teacherToken,
        body: { enabled: true },
      }),
      api.post(`/classes/${w.classId}/archive`, { token: w.teacherToken, body: { confirm: true } }),
    ]) {
      const res = await attempt;
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('CLASS_ARCHIVED');
    }
    expect((await api.get('/me/class', { token: await tokenFor(ctx, learner) })).status).toBe(404);
  });
});
