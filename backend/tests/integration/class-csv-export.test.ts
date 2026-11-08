/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { parseCsv } from '../../src/domain/csv.js';
import { seedContent } from '../../src/seed/index.js';
import { ContractClient } from '../contract/client.js';
import {
  answersFor,
  distinctTopicExercises,
  seedAnswers,
  seedIntervals,
} from './class-activity-helpers.js';
import { createTestApp, type TestApp } from './helpers.js';
import {
  addOrgRole,
  createTestClass,
  createTestOrg,
  createTestUser,
  enrollLearner,
  tokenFor,
} from './org-helpers.js';

// Kiểm thử xuất CSV lớp (spec 004, T114, US7, SC-009, FR-033, contracts/csv-formats.md §2–§4): BOM + CRLF, đúng 13
// cột tiêu đề cố định, từng giá trị khớp `ClassLearnerRow` của bảng điều khiển, chống công thức ở mọi ô chuỗi,
// nhật ký `class.export` kèm `organization_id`, học viên đã rời lớp ⇒ 404.

let ctx: TestApp;
let api: ContractClient;
const NOW = '2026-01-20T05:00:00Z'; // ngày địa phương 2026-01-20
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

const COLUMNS = [
  'display_name',
  'email',
  'joined_on',
  'status',
  'alerts',
  'completion_percent',
  'expected_percent',
  'streak_days',
  'minutes_last_7_days',
  'minutes_total',
  'review_accuracy_percent',
  'last_active_on',
  'absent_days',
];
/** Bộ giá trị tấn công công thức (csv-formats.md §3). */
const ATTACK_NAMES = [
  "=cmd|' /C calc'!A0",
  '+1+1',
  '-2+3',
  '@SUM(A1)',
  '\t=1+1',
  '\r=1+1',
  '  =1+1',
  '=1+1',
];
const FORMULA_START = /^[=+\-@\t\r]/;

async function setup() {
  const org = await createTestOrg(ctx, { seats: 20 });
  const teacher = await createTestUser(ctx);
  await addOrgRole(ctx, org.orgId, teacher.userId, { teacher: true });
  const { classId } = await createTestClass(ctx, org.orgId, {
    name: 'Lớp Tiếng Nhật N5 – Sáng',
    teacherIds: [teacher.userId],
  });
  const join = async (displayName: string) => {
    const user = await createTestUser(ctx, { displayName });
    ctx.clock.set(JOINED);
    const { membershipId } = await enrollLearner(ctx, org.orgId, classId, user.userId);
    ctx.clock.set(NOW);
    return { ...user, membershipId };
  };
  return {
    orgId: org.orgId,
    classId,
    teacher,
    token: await tokenFor(ctx, teacher),
    join,
  };
}

const num = (value: string | undefined): number | null =>
  value === undefined || value === '' ? null : Number(value);
const pct = (ratio: number | null) => (ratio === null ? null : Number((ratio * 100).toFixed(1)));

describe('xuất CSV cả lớp', () => {
  it('BOM, CRLF, 13 cột, từng giá trị khớp bảng điều khiển, trạng thái not_started và alerts nối bằng |', async () => {
    const w = await setup();
    const [t1] = await distinctTopicExercises(ctx, 1);
    const active = await w.join('An hoạt động đều');
    const absent = await w.join('Bình vắng lâu');
    const fresh = await w.join('Chi chưa bắt đầu');

    await seedAnswers(ctx, active.userId, answersFor(t1!, '2026-01-19', 4, 3));
    await seedIntervals(ctx, active.userId, [
      { day: '2026-01-18', seconds: 1200 },
      { day: '2026-01-19', seconds: 540 },
    ]);
    await seedAnswers(ctx, absent.userId, answersFor(t1!, '2026-01-12', 4, 2));
    await seedIntervals(ctx, absent.userId, [{ day: '2026-01-12', seconds: 300 }]);

    const dash = await api.get(`/classes/${w.classId}/dashboard`, { token: w.token });
    expect(dash.status).toBe(200);
    const rows: any[] = dash.body.learners;

    const res = await api.raw('GET', `/classes/${w.classId}/export.csv`, { token: w.token });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(String(res.headers['content-disposition'])).toMatch(
      /^attachment; filename\*=UTF-8''class-[\w%.-]+-2026-01-20\.csv$/,
    );
    // BOM UTF-8 (EF BB BF) và CRLF.
    expect([...Buffer.from(res.text, 'utf8').subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(res.text).toContain('\r\n');
    expect(res.text.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);

    const parsed = parseCsv(res.text);
    expect(parsed.headers).toEqual(COLUMNS);
    expect(parsed.rows).toHaveLength(rows.length);
    expect(rows).toHaveLength(3);

    for (const row of rows) {
      const line = parsed.rows.find((r) => r[1] === row.email);
      expect(line, `thiếu dòng của ${row.email}`).toBeDefined();
      const cell = Object.fromEntries(COLUMNS.map((c, i) => [c, line![i]!]));
      expect(cell.display_name).toBe(row.displayName);
      expect(cell.joined_on).toBe('2026-01-06');
      expect(cell.status).toBe(row.hasStarted ? row.progressStatus : 'not_started');
      expect(cell.alerts).toBe(row.alerts.join('|'));
      expect(num(cell.completion_percent)).toBe(pct(row.completionRatio));
      expect(num(cell.expected_percent)).toBe(pct(row.expectedRatio));
      expect(num(cell.streak_days)).toBe(row.streakDays);
      expect(num(cell.minutes_last_7_days)).toBe(row.minutesLast7Days);
      expect(num(cell.minutes_total)).toBe(row.minutesTotal);
      expect(num(cell.review_accuracy_percent)).toBe(pct(row.reviewAccuracy));
      expect(cell.last_active_on).toBe(row.lastActiveOn ?? '');
      expect(num(cell.absent_days)).toBe(row.absentDays);
    }

    const freshLine = parsed.rows.find((r) => r[1] === fresh.email)!;
    expect(freshLine[3]).toBe('not_started');
    expect(freshLine[11]).toBe(''); // last_active_on rỗng khi chưa học
    expect(freshLine[10]).toBe(''); // review_accuracy_percent rỗng khi chưa ôn
    const absentLine = parsed.rows.find((r) => r[1] === absent.email)!;
    expect(absentLine[4]!.split('|')).toContain('absent'); // vắng 12/01 → 19/01 = 7 ngày ≥ ngưỡng 3
    expect(num(absentLine[12])).toBeGreaterThanOrEqual(3);
  });

  it('vô hiệu hóa công thức: không ô nào bắt đầu bằng ký tự công thức, nội dung còn nguyên', async () => {
    const w = await setup();
    for (const name of ATTACK_NAMES) await w.join(name);
    const viet = await w.join('Nguyễn, Thị "Hoa" Mai');
    const jp = await w.join('佐藤 花子');

    const res = await api.raw('GET', `/classes/${w.classId}/export.csv`, { token: w.token });
    expect(res.status).toBe(200);
    const parsed = parseCsv(res.text);
    expect(parsed.rows).toHaveLength(ATTACK_NAMES.length + 2);

    for (const line of parsed.rows) {
      for (const cell of line) expect(cell, `ô "${cell}"`).not.toMatch(FORMULA_START);
    }
    const names = parsed.rows.map((r) => r[0]!);
    for (const attack of ATTACK_NAMES) expect(names).toContain(`'${attack}`);
    // Tên có dấu phẩy, nháy kép, tiếng Việt và tiếng Nhật vẫn nguyên vẹn khi phân tích lại.
    expect(names).toContain(viet.displayName);
    expect(names).toContain(jp.displayName);
  });

  it('mỗi lần xuất ghi class.export kèm organization_id, actor_id và diff', async () => {
    const w = await setup();
    const learner = await w.join('An');
    const before = await ctx.handle.pool.query(
      `SELECT count(*)::int AS n FROM admin_action_logs WHERE action = 'class.export'`,
    );
    await api.raw('GET', `/classes/${w.classId}/export.csv`, { token: w.token });
    await api.raw('GET', `/classes/${w.classId}/members/${learner.userId}/export.csv`, {
      token: w.token,
    });
    const { rows } = await ctx.handle.pool.query(
      `SELECT actor_id, organization_id, target_type, target_id, diff
         FROM admin_action_logs WHERE action = 'class.export' AND target_id = $1
        ORDER BY occurred_at, id`,
      [w.classId],
    );
    expect(before.rows[0].n).toBeGreaterThanOrEqual(0);
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(r).toMatchObject({
        actor_id: w.teacher.userId,
        organization_id: w.orgId,
        target_type: 'class',
      });
    }
    expect(rows[0].diff).toEqual({ type: 'class' });
    expect(rows[1].diff).toEqual({ type: 'learner', userId: learner.userId });
  });
});

describe('xuất CSV chi tiết một học viên', () => {
  it('dạng section,label,value,extra với đủ các mục, khớp chi tiết học viên', async () => {
    const w = await setup();
    const [t1] = await distinctTopicExercises(ctx, 1);
    const learner = await w.join('An');
    await seedAnswers(ctx, learner.userId, answersFor(t1!, '2026-01-18', 20, 5));
    await seedIntervals(ctx, learner.userId, [{ day: '2026-01-18', seconds: 600 }]);
    // Một bài giao còn hạn để kiểm mục assignment.
    const detail = await api.get(`/classes/${w.classId}/members/${learner.userId}/detail`, {
      token: w.token,
    });
    expect(detail.status).toBe(200);
    const firstUnit = detail.body.units[0].unitId;
    await ctx.handle.pool.query(
      `INSERT INTO class_assignments (class_id, batch_id, unit_id, due_on, assigned_by)
       VALUES ($1, gen_random_uuid(), $2, '2026-01-30', $3)`,
      [w.classId, firstUnit, w.teacher.userId],
    );

    const res = await api.raw('GET', `/classes/${w.classId}/members/${learner.userId}/export.csv`, {
      token: w.token,
    });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect([...Buffer.from(res.text, 'utf8').subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const parsed = parseCsv(res.text);
    expect(parsed.headers).toEqual(['section', 'label', 'value', 'extra']);

    const bySection = (s: string) => parsed.rows.filter((r) => r[0] === s);
    const row = detail.body.row;
    const summary = Object.fromEntries(bySection('summary').map((r) => [r[1]!, r[2]!]));
    expect(summary).toMatchObject({
      completion_percent: row.completionRatio === null ? '' : String(pct(row.completionRatio)),
      streak_days: String(row.streakDays),
      minutes_total: String(row.minutesTotal),
      review_accuracy_percent: row.reviewAccuracy === null ? '' : String(pct(row.reviewAccuracy)),
    });
    expect(bySection('unit')).toHaveLength(detail.body.units.length);
    expect(bySection('unit')[0]![1]).toBe(detail.body.units[0].title);
    expect(bySection('unit')[0]![3]).toMatch(/\//); // kỹ năng/trình độ
    expect(bySection('assignment')).toHaveLength(1);
    expect(bySection('assignment')[0]![3]).toBe('2026-01-30');
    expect(bySection('daily_minutes')).toHaveLength(30);
    expect(bySection('daily_minutes').find((r) => r[1] === '2026-01-18')![2]).toBe('10');
    expect(bySection('weak_topic')).toHaveLength(detail.body.weakTopics.length);
    expect(bySection('weak_topic').length).toBeGreaterThan(0); // 5/20 = 25% ⇒ chủ đề yếu
    expect(bySection('placement')).toEqual([['placement', 'estimated_level', 'none', '']]);
  });

  it('học viên đã rời lớp hoặc không thuộc lớp ⇒ 404 chung', async () => {
    const w = await setup();
    const learner = await w.join('Bình');
    const outsider = await createTestUser(ctx);
    await ctx.handle.pool.query(
      `UPDATE class_memberships SET left_at = now(), end_reason = 'removed' WHERE user_id = $1`,
      [learner.userId],
    );
    const left = await api.raw(
      'GET',
      `/classes/${w.classId}/members/${learner.userId}/export.csv`,
      {
        token: w.token,
      },
    );
    const never = await api.raw(
      'GET',
      `/classes/${w.classId}/members/${outsider.userId}/export.csv`,
      {
        token: w.token,
      },
    );
    expect(left.status).toBe(404);
    expect(never.status).toBe(404);
    expect(left.text).toBe(never.text);
  });
});
