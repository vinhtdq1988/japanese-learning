/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { seedContent } from '../../src/seed/index.js';
import { ContractClient } from '../contract/client.js';
import { createTestApp, type TestApp } from './helpers.js';
import {
  addOrgRole,
  createTestClass,
  createTestOrg,
  createTestUser,
  enrollLearner,
  randomMissingId,
  tokenFor,
} from './org-helpers.js';

// Kiểm thử mời chuyển lớp (spec 004, T122/T126, US8, FR-014, Hiến pháp III): chủ dự án chọn "bắt học viên đồng ý
// lại" nên `POST /classes/{id}/members/{userId}/move` chỉ MỜI (202) và học viên vẫn ở lớp cũ; chấp nhận lời mời
// mới chuyển (giữ seat, `reassignment_count` không tăng, tiến độ/lịch ôn giữ), từ chối thì không đổi gì. Người mời
// phải có quyền ở cả hai lớp (hoặc là chủ tổ chức), kiểm lại lúc học viên chấp nhận.

let ctx: TestApp;
let api: ContractClient;
const NOW = '2026-01-20T05:00:00Z';

beforeAll(async () => {
  ctx = await createTestApp();
  await seedContent(ctx.handle.db);
  api = new ContractClient(ctx.app);
});
beforeEach(() => ctx.clock.set(NOW));
afterAll(async () => {
  await ctx.close();
});

/** Token thô của lời mời đã tạo (CSDL chỉ giữ băm ⇒ lấy từ email trong hàng đợi). */
function tokenFromEmail(to: string): string {
  const job = [...ctx.jobQueue.jobs]
    .reverse()
    .find((j) => (j.data as any).to === to && (j.data as any).kind === 'org_invitation');
  const match = /#\/invite\/([A-Za-z0-9_-]+)/.exec((job?.data as any)?.text ?? '');
  if (!match) throw new Error(`Không có email lời mời gửi tới ${to}`);
  return match[1]!;
}
const emailTo = (to: string) =>
  [...ctx.jobQueue.jobs].reverse().find((j) => (j.data as any).to === to)?.data as any;

const joinBody = { decision: 'join_class', confirmed: true };
const respond = (token: string, bearer: string, body: Record<string, unknown>) =>
  api.post(`/invitations/${token}/respond`, { token: bearer, body, validateRequest: false });

/** Tổ chức có hai lớp (A, B) cùng giáo viên `both` phụ trách cả hai; `onlyA` chỉ phụ trách A; chủ tổ chức. */
async function setup(seats = 10) {
  const org = await createTestOrg(ctx, { seats });
  const owner = await createTestUser(ctx, { displayName: 'Chủ' });
  const both = await createTestUser(ctx, { displayName: 'GV cả hai lớp' });
  const onlyA = await createTestUser(ctx, { displayName: 'GV chỉ lớp A' });
  await addOrgRole(ctx, org.orgId, owner.userId, { owner: true });
  await addOrgRole(ctx, org.orgId, both.userId, { teacher: true });
  await addOrgRole(ctx, org.orgId, onlyA.userId, { teacher: true });
  const a = await createTestClass(ctx, org.orgId, {
    name: 'Lớp A',
    teacherIds: [both.userId, onlyA.userId],
  });
  const b = await createTestClass(ctx, org.orgId, { name: 'Lớp B', teacherIds: [both.userId] });
  const learner = await createTestUser(ctx, { displayName: 'Học viên' });
  const { membershipId, seatId } = await enrollLearner(ctx, org.orgId, a.classId, learner.userId);
  return {
    org,
    classA: a.classId,
    classB: b.classId,
    owner,
    both,
    onlyA,
    learner,
    membershipId,
    seatId: seatId!,
    tokens: {
      owner: await tokenFor(ctx, owner),
      both: await tokenFor(ctx, both),
      onlyA: await tokenFor(ctx, onlyA),
      learner: await tokenFor(ctx, learner),
    },
  };
}

const move = (classId: string, userId: string, token: string, toClassId: string) =>
  api.post(`/classes/${classId}/members/${userId}/move`, {
    token,
    body: { toClassId },
    validateResponse: false,
  });

const activeMemberships = async (userId: string) =>
  (
    await ctx.handle.pool.query(
      `SELECT id, class_id, seat_id FROM class_memberships WHERE user_id = $1 AND left_at IS NULL`,
      [userId],
    )
  ).rows;

describe('mời chuyển lớp KHÔNG chuyển ngay', () => {
  it('202; học viên vẫn ở lớp cũ, seat không đổi, có lời mời chờ tới lớp đích; email nêu cả hai lớp', async () => {
    const w = await setup();
    const res = await move(w.classA, w.learner.userId, w.tokens.both, w.classB);
    expect(res.status).toBe(202);

    const members = await activeMemberships(w.learner.userId);
    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({ id: w.membershipId, class_id: w.classA });
    const { rows } = await ctx.handle.pool.query(
      `SELECT kind, status, class_id FROM invitations WHERE organization_id = $1 AND email = $2`,
      [w.org.orgId, w.learner.email.toLowerCase()],
    );
    expect(rows).toEqual([{ kind: 'student', status: 'pending', class_id: w.classB }]);

    // Email song ngữ, nêu lớp hiện tại + lớp đích và nói rõ học viên có thể từ chối.
    const mail = emailTo(w.learner.email);
    expect(mail.subject).toContain('chuyển sang lớp khác');
    expect(mail.text).toContain('"Lớp A"');
    expect(mail.text).toContain('"Lớp B"');

    const log = await ctx.handle.pool.query(
      `SELECT actor_id, organization_id, diff FROM admin_action_logs
        WHERE action = 'class.move_student' AND organization_id = $1`,
      [w.org.orgId],
    );
    expect(log.rows).toHaveLength(1);
    expect(log.rows[0].diff).toMatchObject({
      op: 'invite',
      fromClassId: w.classA,
      toClassId: w.classB,
    });
  });

  it('không giữ chỗ seat: số seat đang dùng/giữ chỗ không đổi', async () => {
    const w = await setup(3); // 1 seat học viên + 2 giáo viên ⇒ cố ý hết chỗ
    const before = await ctx.handle.pool.query(
      `SELECT count(*) FILTER (WHERE holder_user_id IS NOT NULL)::int AS used FROM seats`,
    );
    const res = await move(w.classA, w.learner.userId, w.tokens.both, w.classB);
    expect(res.status).toBe(202);
    const after = await ctx.handle.pool.query(
      `SELECT count(*) FILTER (WHERE holder_user_id IS NOT NULL)::int AS used FROM seats`,
    );
    expect(after.rows[0].used).toBe(before.rows[0].used);
  });
});

describe('học viên chấp nhận hoặc từ chối', () => {
  it('chấp nhận ⇒ moved + mở lớp mới, GIỮ seat, reassignment_count không tăng, dữ liệu học giữ nguyên', async () => {
    const w = await setup();
    await ctx.handle.pool.query(
      `INSERT INTO unit_progress (user_id, unit_id, status)
       SELECT $1, id, 'completed' FROM learning_units LIMIT 3`,
      [w.learner.userId],
    );
    const reassignBefore = await ctx.handle.pool.query(
      `SELECT reassignment_count FROM seats WHERE id = $1`,
      [w.seatId],
    );
    await move(w.classA, w.learner.userId, w.tokens.both, w.classB);

    const preview = await api.get(`/invitations/${tokenFromEmail(w.learner.email)}`, {
      token: w.tokens.learner,
    });
    expect(preview.status).toBe(200);
    expect(preview.body.class.id).toBe(w.classB);
    expect(preview.body.disclosure.mayBeMovedWithinOrganization).toBe(false);

    const accepted = await respond(tokenFromEmail(w.learner.email), w.tokens.learner, joinBody);
    expect(accepted.status).toBe(200);
    expect(accepted.body).toMatchObject({ status: 'joined' });
    expect(accepted.body.class.id).toBe(w.classB);

    const members = await activeMemberships(w.learner.userId);
    expect(members).toHaveLength(1);
    expect(members[0].class_id).toBe(w.classB);
    const old = await ctx.handle.pool.query(
      `SELECT end_reason, left_at, exit_display_name FROM class_memberships WHERE id = $1`,
      [w.membershipId],
    );
    expect(old.rows[0]).toMatchObject({ end_reason: 'moved', exit_display_name: 'Học viên' });
    expect(old.rows[0].left_at).not.toBeNull();

    // Seat không đổi người giữ, đếm đổi không tăng; tiến độ học còn nguyên.
    const seat = await ctx.handle.pool.query(
      `SELECT holder_user_id, reassignment_count FROM seats WHERE id = $1`,
      [w.seatId],
    );
    expect(seat.rows[0].holder_user_id).toBe(w.learner.userId);
    expect(seat.rows[0].reassignment_count).toBe(reassignBefore.rows[0].reassignment_count);
    const progress = await ctx.handle.pool.query(
      `SELECT count(*)::int AS n FROM unit_progress WHERE user_id = $1`,
      [w.learner.userId],
    );
    expect(progress.rows[0].n).toBe(3);

    const mine = await api.get('/me/class', { token: w.tokens.learner });
    expect(mine.body.class.id).toBe(w.classB);
    expect(mine.body.movedNotice).toBeNull();
  });

  it('từ chối (stay_personal) ⇒ ở lại lớp cũ, không đổi gì', async () => {
    const w = await setup();
    await move(w.classA, w.learner.userId, w.tokens.both, w.classB);
    const declined = await respond(tokenFromEmail(w.learner.email), w.tokens.learner, {
      decision: 'stay_personal',
    });
    expect(declined.status).toBe(200);
    const members = await activeMemberships(w.learner.userId);
    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({ id: w.membershipId, class_id: w.classA });
  });

  it('chấp nhận mà thiếu confirmed ⇒ 422 và vẫn ở lớp cũ', async () => {
    const w = await setup();
    await move(w.classA, w.learner.userId, w.tokens.both, w.classB);
    const res = await respond(tokenFromEmail(w.learner.email), w.tokens.learner, {
      decision: 'join_class',
    });
    expect(res.status).toBe(422);
    expect((await activeMemberships(w.learner.userId))[0].class_id).toBe(w.classA);
  });

  it('lớp đích đầy lúc chấp nhận ⇒ 409 CLASS_FULL, hoàn tác và vẫn ở lớp cũ', async () => {
    const w = await setup();
    await move(w.classA, w.learner.userId, w.tokens.both, w.classB);
    for (let i = 0; i < ctx.config.CLASS_MAX_MEMBERS; i++) {
      const filler = await createTestUser(ctx);
      await enrollLearner(ctx, w.org.orgId, w.classB, filler.userId, { seat: false });
    }
    const res = await respond(tokenFromEmail(w.learner.email), w.tokens.learner, joinBody);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CLASS_FULL');
    const members = await activeMemberships(w.learner.userId);
    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({ id: w.membershipId, class_id: w.classA });
  });

  it('người mời mất quyền ở lớp đích trước khi học viên chấp nhận ⇒ 409 ALREADY_IN_CLASS, không chuyển ngầm', async () => {
    const w = await setup();
    await move(w.classA, w.learner.userId, w.tokens.both, w.classB);
    await ctx.handle.pool.query(`DELETE FROM class_teachers WHERE class_id = $1 AND user_id = $2`, [
      w.classB,
      w.both.userId,
    ]);
    const res = await respond(tokenFromEmail(w.learner.email), w.tokens.learner, joinBody);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ALREADY_IN_CLASS');
    expect((await activeMemberships(w.learner.userId))[0].class_id).toBe(w.classA);
  });
});

describe('quyền và điều kiện', () => {
  it('chủ tổ chức mời được dù không phụ trách lớp nào', async () => {
    const w = await setup();
    const res = await move(w.classA, w.learner.userId, w.tokens.owner, w.classB);
    expect(res.status).toBe(202);
  });

  it('giáo viên chỉ phụ trách lớp nguồn (không có quyền lớp đích) ⇒ 404 chung', async () => {
    const w = await setup();
    const res = await move(w.classA, w.learner.userId, w.tokens.onlyA, w.classB);
    expect(res.status).toBe(404);
    const ghost = await move(w.classA, w.learner.userId, w.tokens.onlyA, randomMissingId());
    expect(ghost.status).toBe(404);
    expect(res.body).toEqual(ghost.body);
    expect(
      await ctx.handle.pool.query(`SELECT 1 FROM invitations WHERE class_id = $1`, [w.classB]),
    ).toMatchObject({ rowCount: 0 });
  });

  it('lớp đích thuộc tổ chức khác ⇒ 404 chung', async () => {
    const w = await setup();
    const other = await createTestOrg(ctx, { seats: 3 });
    const foreign = await createTestClass(ctx, other.orgId, { name: 'Lớp ngoài' });
    const res = await move(w.classA, w.learner.userId, w.tokens.owner, foreign.classId);
    expect(res.status).toBe(404);
  });

  it('chuyển sang chính lớp hiện tại ⇒ 422; học viên không thuộc lớp nguồn ⇒ 404', async () => {
    const w = await setup();
    expect((await move(w.classA, w.learner.userId, w.tokens.both, w.classA)).status).toBe(422);
    const stranger = await createTestUser(ctx);
    expect((await move(w.classA, stranger.userId, w.tokens.both, w.classB)).status).toBe(404);
    // Học viên chỉ thuộc lớp A, nên mời "từ lớp B" cũng là 404 chung.
    expect((await move(w.classB, w.learner.userId, w.tokens.both, w.classA)).status).toBe(404);
  });

  it('lớp đích chưa có lộ trình ⇒ 409 CLASS_NOT_READY; lớp đích lưu trữ ⇒ 409 CLASS_ARCHIVED; đã có lời mời chờ ⇒ 409', async () => {
    const w = await setup();
    const noPath = await createTestClass(ctx, w.org.orgId, {
      name: 'Lớp chưa sẵn sàng',
      teacherIds: [w.both.userId],
      withPath: false,
    });
    const notReady = await move(w.classA, w.learner.userId, w.tokens.both, noPath.classId);
    expect(notReady.status).toBe(409);
    expect(notReady.body.code).toBe('CLASS_NOT_READY');

    await ctx.handle.pool.query(
      `UPDATE classes SET status = 'archived', archived_at = now() WHERE id = $1`,
      [w.classB],
    );
    const archived = await move(w.classA, w.learner.userId, w.tokens.both, w.classB);
    expect(archived.status).toBe(409);
    expect(archived.body.code).toBe('CLASS_ARCHIVED');
    await ctx.handle.pool.query(
      `UPDATE classes SET status = 'active', archived_at = NULL WHERE id = $1`,
      [w.classB],
    );

    expect((await move(w.classA, w.learner.userId, w.tokens.both, w.classB)).status).toBe(202);
    expect((await move(w.classA, w.learner.userId, w.tokens.both, w.classB)).status).toBe(409);
  });

  it('lớp đích đầy ngay lúc mời ⇒ 409 CLASS_FULL', async () => {
    const w = await setup();
    for (let i = 0; i < ctx.config.CLASS_MAX_MEMBERS; i++) {
      const filler = await createTestUser(ctx);
      await enrollLearner(ctx, w.org.orgId, w.classB, filler.userId, { seat: false });
    }
    const res = await move(w.classA, w.learner.userId, w.tokens.both, w.classB);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CLASS_FULL');
  });

  it('giáo viên phụ trách lớp đích không bị mời làm học viên của chính lớp đó', async () => {
    const w = await setup();
    // `both` vừa là giáo viên lớp B vừa (giả sử) học viên lớp A: không được chuyển vào lớp mà họ phụ trách.
    await ctx.handle.pool.query(`DELETE FROM class_teachers WHERE class_id = $1 AND user_id = $2`, [
      w.classA,
      w.both.userId,
    ]);
    await enrollLearner(ctx, w.org.orgId, w.classA, w.both.userId, { seat: false });
    const res = await move(w.classA, w.both.userId, w.tokens.owner, w.classB);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INVITEE_UNAVAILABLE');
  });
});
