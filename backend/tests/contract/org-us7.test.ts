/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { seedContent } from '../../src/seed/index.js';
import {
  answersFor,
  distinctTopicExercises,
  seedAnswers,
} from '../integration/class-activity-helpers.js';
import { createTestApp, type TestApp } from '../integration/helpers.js';
import {
  addOrgRole,
  createTestClass,
  createTestOrg,
  createTestUser,
  enrollLearner,
  tokenFor,
} from '../integration/org-helpers.js';
import { ContractClient } from './client.js';

// Kiểm thử hợp đồng US7 (spec 004, T115, quickstart OG7, SC-007): bộ lọc bảng điều khiển (một thao tác lọc),
// `weak-topics`, `export.csv` lớp/học viên khớp schema + header CSV, ngưỡng vắng 1–14 và số "cần chú ý" ở
// `GET /classes`.

let ctx: TestApp;
let api: ContractClient;
const NOW = '2026-01-20T05:00:00Z';
const JOINED = '2026-01-06T03:00:00Z';

beforeAll(async () => {
  ctx = await createTestApp();
  await seedContent(ctx.handle.db);
  api = new ContractClient(ctx.app);
});
beforeEach(() => ctx.clock.set(NOW));
afterAll(async () => {
  await ctx.close();
});

async function completeUnits(userId: string, unitIds: string[]): Promise<void> {
  await ctx.handle.pool.query(
    `INSERT INTO unit_progress (user_id, unit_id, status)
     SELECT $1, u, 'completed' FROM unnest($2::uuid[]) AS u
     ON CONFLICT (user_id, unit_id) DO UPDATE SET status = 'completed'`,
    [userId, unitIds],
  );
}

/** Lớp có lộ trình chặt (05→25/01) để hôm nay (20/01) mong đợi ~75%; năm học viên ở các trạng thái khác nhau. */
async function setup() {
  const org = await createTestOrg(ctx, { seats: 20 });
  const teacher = await createTestUser(ctx);
  await addOrgRole(ctx, org.orgId, teacher.userId, { teacher: true });
  const { classId } = await createTestClass(ctx, org.orgId, { teacherIds: [teacher.userId] });
  const token = await tokenFor(ctx, teacher);
  const put = await api.put(`/classes/${classId}/path`, {
    token,
    body: {
      startLevel: 'N5',
      targetLevel: 'N4',
      skills: ['vocabulary', 'grammar'],
      startsOn: '2026-01-05',
      endsOn: '2026-01-25',
      dailyMinutes: 30,
    },
  });
  expect(put.status).toBe(200);
  const path = await api.get(`/classes/${classId}/path`, { token });
  const unitIds: string[] = path.body.path.units.map((u: any) => u.unitId);
  const target = unitIds.slice(0, Math.round(unitIds.length * 0.75));

  const join = async (displayName: string) => {
    const user = await createTestUser(ctx, { displayName });
    ctx.clock.set(JOINED);
    const { membershipId } = await enrollLearner(ctx, org.orgId, classId, user.userId);
    ctx.clock.set(NOW);
    return { ...user, membershipId };
  };
  const [topic] = await distinctTopicExercises(ctx, 1);
  const active = await join('Active');
  const absent = await join('Absent');
  const behind = await join('Behind');
  const paused = await join('Paused');
  const fresh = await join('Fresh');
  await completeUnits(active.userId, target);
  await completeUnits(absent.userId, target);
  await seedAnswers(ctx, active.userId, answersFor(topic!, '2026-01-19', 4, 3));
  await seedAnswers(ctx, absent.userId, answersFor(topic!, '2026-01-12', 4, 3));
  await seedAnswers(ctx, behind.userId, answersFor(topic!, '2026-01-19', 4, 3));
  await seedAnswers(ctx, paused.userId, answersFor(topic!, '2026-01-10', 4, 3));
  await ctx.handle.pool.query(
    `INSERT INTO class_pause_periods (class_id, membership_id, started_on) VALUES ($1, $2, '2026-01-18')`,
    [classId, paused.membershipId],
  );
  return { orgId: org.orgId, classId, teacher, token, active, absent, behind, paused, fresh };
}

const ids = (body: any): string[] => body.learners.map((r: any) => r.userId).sort();

describe('GET /classes/{id}/dashboard?filter=…', () => {
  it('mỗi bộ lọc trả đúng tập học viên; summary luôn tính trên cả lớp', async () => {
    const w = await setup();
    const get = async (filter?: string) => {
      const res = await api.get(
        `/classes/${w.classId}/dashboard${filter ? `?filter=${filter}` : ''}`,
        { token: w.token },
      );
      expect(res.status).toBe(200);
      return res.body;
    };
    const sorted = (...users: { userId: string }[]) => users.map((u) => u.userId).sort();

    const all = await get();
    expect(all.learners).toHaveLength(5);
    const alertsOf = (u: { userId: string }) =>
      all.learners.find((r: any) => r.userId === u.userId).alerts;
    expect(alertsOf(w.active)).toEqual([]);
    expect(alertsOf(w.absent)).toEqual(['absent']);
    expect(alertsOf(w.behind)).toEqual(['behind']);
    expect(alertsOf(w.paused)).toEqual([]); // đang tạm dừng ⇒ không cảnh báo dù vắng lâu
    expect(alertsOf(w.fresh)).toEqual(['absent', 'behind']);
    expect(all.summary.needAttention).toBe(3);

    expect(ids(await get('needs_attention'))).toEqual(sorted(w.absent, w.behind, w.fresh));
    expect(ids(await get('absent'))).toEqual(sorted(w.absent, w.fresh));
    expect(ids(await get('behind'))).toEqual(sorted(w.behind, w.fresh));
    expect(ids(await get('paused'))).toEqual(sorted(w.paused));
    expect(ids(await get('not_started'))).toEqual(sorted(w.fresh));

    const filtered = await get('paused');
    expect(filtered.summary.learnerCount).toBe(5);
    expect(filtered.summary.needAttention).toBe(3);
  });

  it('bộ lọc không hợp lệ ⇒ 422', async () => {
    const w = await setup();
    const res = await api.get(`/classes/${w.classId}/dashboard?filter=bogus`, {
      token: w.token,
      validateRequest: false,
      validateResponse: false,
    });
    expect(res.status).toBe(422);
  });
});

describe('ngưỡng vắng mặt (absenceThresholdDays)', () => {
  it('đổi ngưỡng đổi cảnh báo và needAttentionCount của GET /classes', async () => {
    const w = await setup();
    const list = async () => {
      const res = await api.get('/classes', { token: w.token });
      expect(res.status).toBe(200);
      return res.body.find((c: any) => c.id === w.classId);
    };
    expect((await list()).needAttentionCount).toBe(3);

    const patch = await api.patch(`/classes/${w.classId}`, {
      token: w.token,
      body: { absenceThresholdDays: 14 },
    });
    expect(patch.status).toBe(200);
    expect(patch.body.absenceThresholdDays).toBe(14);
    // Absent vắng 7 ngày và Fresh vắng 13 ngày đều < 14 ⇒ chỉ còn Behind và Fresh (vẫn "chậm").
    expect((await list()).needAttentionCount).toBe(2);
    const dash = await api.get(`/classes/${w.classId}/dashboard?filter=absent`, { token: w.token });
    expect(dash.body.learners).toEqual([]);
  });

  it.each([0, 15, -1, 3.5])('absenceThresholdDays = %s ⇒ 422', async (value) => {
    const w = await setup();
    const res = await api.patch(`/classes/${w.classId}`, {
      token: w.token,
      body: { absenceThresholdDays: value },
      validateRequest: false,
      validateResponse: false,
    });
    expect(res.status).toBe(422);
  });
});

describe('GET /classes/{id}/weak-topics', () => {
  it('200 khớp schema ClassWeakTopic[]', async () => {
    const w = await setup();
    const [t] = await distinctTopicExercises(ctx, 1);
    await seedAnswers(ctx, w.active.userId, answersFor(t!, '2026-01-18', 30, 3));
    const res = await api.get(`/classes/${w.classId}/weak-topics`, { token: w.token });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    for (const topic of res.body) {
      expect(Object.keys(topic).sort()).toEqual([
        'accuracy',
        'answers',
        'flaggedLearners',
        'name',
        'skill',
        'topicId',
      ]);
    }
  });
});

describe('xuất CSV', () => {
  it('export.csv lớp: kiểu nội dung, Content-Disposition RFC 5987, BOM', async () => {
    const w = await setup();
    const res = await api.raw('GET', `/classes/${w.classId}/export.csv`, { token: w.token });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(String(res.headers['content-disposition'])).toMatch(
      /^attachment; filename\*=UTF-8''class-.+-2026-01-20\.csv$/,
    );
    expect(res.text.charCodeAt(0)).toBe(0xfeff);
    expect(res.text.split('\r\n').filter(Boolean)).toHaveLength(6); // tiêu đề + 5 học viên
  });

  it('members/{userId}/export.csv: header CSV, học viên không thuộc lớp ⇒ 404', async () => {
    const w = await setup();
    const res = await api.raw(
      'GET',
      `/classes/${w.classId}/members/${w.active.userId}/export.csv`,
      {
        token: w.token,
      },
    );
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(String(res.headers['content-disposition'])).toContain("filename*=UTF-8''");
    expect(res.text.split('\r\n')[0]).toBe('﻿section,label,value,extra');

    const outsider = await createTestUser(ctx);
    const none = await api.raw(
      'GET',
      `/classes/${w.classId}/members/${outsider.userId}/export.csv`,
      {
        token: w.token,
      },
    );
    expect(none.status).toBe(404);
  });
});
