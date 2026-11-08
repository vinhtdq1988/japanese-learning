/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedContent } from '../../src/seed/index.js';
import {
  loadAuthzMatrix,
  expandPath,
  statusMatches,
  type MatrixRow,
} from '../contract/authz-matrix.js';
import { ContractClient } from '../contract/client.js';
import { matchOperation } from '../contract/helper.js';
import { answersFor, distinctTopicExercises, seedAnswers } from './class-activity-helpers.js';
import { createTestApp, type TestApp } from './helpers.js';
import { buildRoleWorld, randomMissingId, type RoleKey, type RoleWorld } from './org-helpers.js';

// Rà soát riêng tư toàn tuyến (spec 004, T130, FR-002, FR-035, SC-004): DUYỆT mọi route trong ma trận quyền
// (`/classes*`, `/org*`, `/admin/organizations*`, `/invitations*`, `/me/class*`) cho mọi vai trò được phép (2xx)
// và khẳng định mỗi KHÓA JSON của phản hồi đều được schema OpenAPI khai báo tại đúng vị trí (danh sách trắng) và
// không có khóa cấm ở bất kỳ độ sâu nào (mật khẩu, phiên, token, từng câu trả lời, hồ sơ cá nhân ngoài FR-035).
// `ADM` không có route nào trả tiến độ chi tiết của học viên (FR-002).

let ctx: TestApp;
let api: ContractClient;
let world: RoleWorld;
const matrix = loadAuthzMatrix();

const SPEC_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../specs/001-phase1-mvp/contracts/openapi.yaml',
);
const spec = parse(readFileSync(SPEC_PATH, 'utf8')) as any;

/** Khóa tuyệt đối không được xuất hiện ở phản hồi nào (bí mật tài khoản, dữ liệu thô, hồ sơ cá nhân ngoài FR-035). */
const FORBIDDEN_KEYS = new Set([
  'passwordHash',
  'password',
  'refreshToken',
  'accessToken',
  'sessions',
  'tokenHash',
  'token',
  'answers',
  'answer',
  'submittedAnswer',
  'choice',
  'isCorrect',
  'exerciseId',
  'clientEventId',
  'timezone',
  'goalType',
  'currentLevel',
  'targetDate',
  'prioritizedSkill',
  // Spec 005 (T078): thành tựu và tùy chọn hiệu ứng là chuyện riêng của người học, không lộ cho giáo viên/tổ chức.
  'celebrations',
  'achievements',
  'earnedAchievements',
  'dayCompleted',
  'soundEnabled',
  'visualEffectsEnabled',
]);

/** Khóa chỉ dành cho dữ liệu học của học viên: quản trị viên hệ thống KHÔNG được thấy ở bất kỳ route nào (FR-002). */
const LEARNER_PROGRESS_KEYS = new Set([
  'completionRatio',
  'expectedRatio',
  'streakDays',
  'minutesTotal',
  'minutesLast7Days',
  'reviewAccuracy',
  'progressStatus',
  'weakTopics',
  'flaggedLearners',
  'learners',
  'alerts',
  'dailyMinutes30',
]);

function resolve(node: any): any {
  let current = node;
  const seen = new Set<string>();
  while (current && typeof current === 'object' && typeof current.$ref === 'string') {
    if (seen.has(current.$ref)) break;
    seen.add(current.$ref);
    current = current.$ref
      .replace(/^#\//, '')
      .split('/')
      .reduce((acc: any, part: string) => acc?.[part], spec);
  }
  return current;
}

/** Gộp thuộc tính của một schema (kể cả `allOf`/`oneOf`/`anyOf`) thành bảng khóa → schema con. */
function propertiesOf(node: any): { props: Record<string, any>; free: boolean; items: any[] } {
  const schema = resolve(node);
  const result = { props: {} as Record<string, any>, free: false, items: [] as any[] };
  if (!schema || typeof schema !== 'object') return result;
  for (const [k, v] of Object.entries<any>(schema.properties ?? {})) {
    result.props[k] = result.props[k] ? { anyOf: [result.props[k], v] } : v;
  }
  if (schema.additionalProperties && schema.additionalProperties !== false) result.free = true;
  if (schema.type === 'object' && !schema.properties && schema.additionalProperties === undefined) {
    result.free = true; // object tự do (ví dụ `diff` của nhật ký): không có danh sách khóa để đối chiếu
  }
  if (schema.items) result.items.push(schema.items);
  for (const branch of [
    ...(schema.allOf ?? []),
    ...(schema.oneOf ?? []),
    ...(schema.anyOf ?? []),
  ]) {
    const sub = propertiesOf(branch);
    for (const [k, v] of Object.entries(sub.props)) {
      result.props[k] = result.props[k] ? { anyOf: [result.props[k], v] } : v;
    }
    result.free ||= sub.free;
    result.items.push(...sub.items);
  }
  return result;
}

/** Khóa trong `value` mà schema KHÔNG khai báo tại đúng vị trí đó (trả đường dẫn từng khóa lạ). */
function undeclaredKeys(value: unknown, schema: any, at = '$'): string[] {
  if (Array.isArray(value)) {
    const { items } = propertiesOf(schema);
    return value.flatMap((v, i) =>
      items.length === 0 ? [] : items.flatMap((s) => undeclaredKeys(v, s, `${at}[${i}]`)),
    );
  }
  if (value === null || typeof value !== 'object') return [];
  const { props, free } = propertiesOf(schema);
  const out: string[] = [];
  for (const [key, child] of Object.entries(value)) {
    if (props[key] === undefined) {
      if (!free) out.push(`${at}.${key}`);
      continue;
    }
    out.push(...undeclaredKeys(child, props[key], `${at}.${key}`));
  }
  return out;
}

function allKeys(value: unknown, into = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => allKeys(v, into));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      into.add(k);
      allKeys(v, into);
    }
  }
  return into;
}

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

async function call(row: MatrixRow, role: RoleKey, w: RoleWorld) {
  const values = worldValues(w);
  const params = Object.fromEntries(
    Object.entries(row.params ?? {}).map(([name, key]) => [
      name,
      key === 'missing' ? randomMissingId() : (values[key] ?? randomMissingId()),
    ]),
  );
  const headers: Record<string, string> = {};
  if (row.contentType) headers['content-type'] = row.contentType;
  return api.raw(row.method, expandPath(row.path, params), {
    token: w.tokens[role],
    headers,
    body: substitute(row.body, values),
  });
}

/** Schema của phản hồi JSON thành công của route (`undefined` nếu không có thân JSON, ví dụ 204 hoặc CSV). */
function responseSchema(row: MatrixRow, status: number, url: string): any {
  try {
    const op = matchOperation(row.method, url).operation as any;
    const response = resolve(op.responses?.[String(status)]);
    return response?.content?.['application/json']?.schema;
  } catch {
    return undefined;
  }
}

beforeAll(async () => {
  ctx = await createTestApp();
  await seedContent(ctx.handle.db);
  api = new ContractClient(ctx.app);
  world = await buildRoleWorld(ctx);
  // Dữ liệu thật để các DTO có nội dung: hoạt động sau khi vào lớp, hoạt động TRƯỚC khi vào lớp và một yêu cầu kiểm tra.
  const [topic] = await distinctTopicExercises(ctx, 1);
  const lrn = world.users.LRN.userId;
  await seedAnswers(ctx, lrn, answersFor(topic!, '2000-01-01', 40, 0)); // rất lâu trước khi vào lớp
  await seedAnswers(ctx, lrn, answersFor(topic!, new Date().toISOString().slice(0, 10), 4, 3));
  await api.raw('POST', `/classes/${world.classC}/placement-requests`, { token: world.tokens.OWN });
  // Spec 005: học viên của lớp có thành tựu và tắt hiệu ứng — mọi DTO lớp/tổ chức vẫn không được lộ chúng.
  await ctx.handle.pool.query(
    `INSERT INTO earned_achievements (user_id, achievement_code, earned_at, source)
     VALUES ($1, 'first_lesson', now(), 'earned'), ($1, 'streak_3', now(), 'earned')`,
    [lrn],
  );
  await ctx.handle.pool.query(
    `UPDATE learning_profiles SET sound_enabled = false, visual_effects_enabled = false WHERE user_id = $1`,
    [lrn],
  );
});
afterAll(async () => {
  await ctx.close();
});

const stripBom = (text: string): string => (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);

const COVERED = matrix.routes.filter((r) => matrix.prefixes.some((p) => r.path.startsWith(p)));

describe('mọi phản hồi JSON của route tổ chức/lớp chỉ chứa khóa được schema khai báo', () => {
  for (const row of COVERED) {
    const allowed = matrix.roles.filter((role) => row.expect[role] === '2xx');
    for (const role of allowed) {
      it(`${row.id} (${row.method} ${row.path}) – ${role}`, async () => {
        const w = row.mutating ? await buildRoleWorld(ctx) : world;
        const res = await call(row, role, w);
        expect(
          statusMatches(res.status, '2xx'),
          `${row.method} ${row.path} bởi ${role} nhận ${res.status}: ${res.text}`,
        ).toBe(true);
        if (!res.text || String(res.headers['content-type'] ?? '').startsWith('text/csv')) return;
        const body = JSON.parse(res.text);
        const keys = allKeys(body);
        expect(
          [...keys].filter((k) => FORBIDDEN_KEYS.has(k)),
          'khóa cấm',
        ).toEqual([]);

        const url = expandPath(
          row.path,
          Object.fromEntries(
            Object.entries(row.params ?? {}).map(([n, k]) => [n, worldValues(w)[k] ?? 'x']),
          ),
        );
        const schema = responseSchema(row, res.status, url);
        if (schema) expect(undeclaredKeys(body, schema), 'khóa ngoài schema').toEqual([]);
        // FR-002: quản trị viên hệ thống không thấy tiến độ chi tiết của học viên ở bất kỳ route nào.
        if (role === 'ADM') {
          expect(
            [...keys].filter((k) => LEARNER_PROGRESS_KEYS.has(k)),
            'dữ liệu học viên cho ADM',
          ).toEqual([]);
        }
      });
    }
  }
});

describe('báo cáo CSV không chứa cột ngoài danh sách trắng', () => {
  it('export.csv lớp chỉ có 13 cột tiêu đề cố định; chi tiết học viên chỉ section,label,value,extra', async () => {
    const cls = await api.raw('GET', `/classes/${world.classC}/export.csv`, {
      token: world.tokens.TCH,
    });
    expect(cls.status).toBe(200);
    expect(stripBom(cls.text).split('\r\n')[0]).toBe(
      [
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
      ].join(','),
    );
    const one = await api.raw(
      'GET',
      `/classes/${world.classC}/members/${world.users.LRN.userId}/export.csv`,
      { token: world.tokens.TCH },
    );
    expect(stripBom(one.text).split('\r\n')[0]).toBe('section,label,value,extra');
    for (const forbidden of ['password', 'token', 'timezone', 'goalType']) {
      expect(cls.text.toLowerCase()).not.toContain(forbidden.toLowerCase());
      expect(one.text.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });
});

describe('hoạt động trước joined_at không lộ cho giáo viên', () => {
  it('số liệu bảng điều khiển và chủ đề yếu bỏ qua 40 câu sai từ năm 2000', async () => {
    const dash = await api.raw('GET', `/classes/${world.classC}/dashboard`, {
      token: world.tokens.TCH,
    });
    const row = JSON.parse(dash.text).learners.find(
      (l: any) => l.userId === world.users.LRN.userId,
    );
    // Chỉ còn 4 câu hôm nay (3 đúng); 40 câu sai năm 2000 không được tính vào độ chính xác ôn.
    expect(row.lastActiveOn).not.toBe('2000-01-01');
    expect(row.reviewAccuracy === null || row.reviewAccuracy >= 0.5).toBe(true);
    const weak = JSON.parse(
      (await api.raw('GET', `/classes/${world.classC}/weak-topics`, { token: world.tokens.TCH }))
        .text,
    );
    expect(weak).toEqual([]);
  });
});

describe('bộ kiểm khóa tự phát hiện rò rỉ (tự kiểm chứng)', () => {
  it('khóa lạ chèn vào dòng học viên hoặc ở độ sâu bất kỳ bị bắt; khóa đã khai báo thì không', async () => {
    const row = COVERED.find((r) => r.id === 'us4-class-dashboard')!;
    const res = await call(row, 'TCH', world);
    const body = JSON.parse(res.text);
    const url = `/classes/${world.classC}/dashboard`;
    const schema = responseSchema(row, 200, url);
    expect(undeclaredKeys(body, schema)).toEqual([]);

    const leaked = structuredClone(body);
    leaked.learners[0].passwordHash = 'x';
    leaked.learners[0].overrides = { dailyMinutes: 10, shiftDays: 0, exemptUnitIds: [], secret: 1 };
    leaked.hiddenTopLevel = true;
    const found = undeclaredKeys(leaked, schema);
    expect(found).toEqual(
      expect.arrayContaining([
        '$.learners[0].passwordHash',
        '$.learners[0].overrides.secret',
        '$.hiddenTopLevel',
      ]),
    );
  });
});
