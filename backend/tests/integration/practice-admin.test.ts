/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedContent } from '../../src/seed/index.js';
import { ContractClient } from '../contract/client.js';
import { adminSession, topicIdFor, type AdminSession } from './admin-helpers.js';
import { createTestApp, type TestApp } from './helpers.js';
import { onboardedLearner } from './lesson-helpers.js';

// Quản trị bài luyện đọc/viết (spec 007, T051): Admin API tạo/kích hoạt đơn vị `reading`/`writing` hợp lệ;
// vi phạm PR2…PR6 → 422 VALIDATION_FAILED kèm `fields` theo đường dẫn lỗi; quyền các vai trò khác không đổi.

let ctx: TestApp;
let api: ContractClient;
let admin: AdminSession;
let readingTopic: string;
let writingTopic: string;

beforeAll(async () => {
  ctx = await createTestApp();
  await seedContent(ctx.handle.db);
  api = new ContractClient(ctx.app);
  admin = await adminSession(api, ctx);
  readingTopic = await topicIdFor(ctx, 'reading', 'N5');
  writingTopic = await topicIdFor(ctx, 'writing', 'N5');
});
afterAll(async () => {
  await ctx.close();
});

const T = (vi: string, en: string = vi) => ({ vi, en });
const PASSAGE = '田中さんは毎朝七時に起きます。八時に会社へ行きます。九時から仕事です。';
let serial = 0;

function readingPayload(overrides: Record<string, unknown> = {}) {
  serial += 1;
  const question = (n: number) => ({
    itemIndex: null,
    type: 'multiple_choice',
    prompt: T(`Câu hỏi ${n}?`, `Question ${n}?`),
    payload: { choices: ['7:00', '8:00', '9:00'], correct_index: 1 },
    feedbackCorrect: T('Đúng! Đoạn văn nói 八時.', 'Correct! The text says 八時.'),
    feedbackIncorrect: T('Chưa đúng, xem lại 八時.', 'Not quite, see 八時.'),
  });
  return {
    kind: 'reading',
    title: T(`Đọc kiểm thử quản trị ${serial}`, `Admin test reading ${serial}`),
    level: 'N5',
    tier: 'core',
    goalTags: ['jlpt'],
    topicId: readingTopic,
    difficulty: 1,
    estMinutes: 5,
    sequence: 9000 + serial,
    items: [
      {
        japanese: PASSAGE,
        reading: 'たなかさんはまいあさしちじにおきます。',
        meaning: T('Anh Tanaka dậy lúc 7 giờ.', 'Mr. Tanaka gets up at seven.'),
        examples: [],
      },
    ],
    exercises: [question(1), question(2), question(3)],
    ...overrides,
  };
}

function writingPayload(overrides: Record<string, unknown> = {}) {
  serial += 1;
  const words: [string, string, string[]][] = [
    ['水', 'みず', ['水', 'みず']],
    ['会社', 'かいしゃ', ['会社', 'かいしゃ']],
    ['電車', 'でんしゃ', ['電車', 'でんしゃ']],
  ];
  return {
    kind: 'writing',
    title: T(`Viết kiểm thử quản trị ${serial}`, `Admin test writing ${serial}`),
    level: 'N5',
    tier: 'core',
    goalTags: ['jlpt'],
    topicId: writingTopic,
    difficulty: 1,
    estMinutes: 5,
    sequence: 9000 + serial,
    items: words.map(([japanese, reading]) => ({
      japanese,
      reading,
      meaning: T(`nghĩa ${japanese}`, `meaning ${japanese}`),
      examples: [],
    })),
    exercises: words.map(([japanese, , answers], itemIndex) => ({
      itemIndex: null,
      type: 'fill_blank',
      prompt: T(`Gõ bằng tiếng Nhật: ${japanese}`, `Type in Japanese: ${japanese}`),
      payload: { accepted_answers: answers, hint: 'gợi ý' },
      feedbackCorrect: T('Chính xác!', 'Correct!'),
      feedbackIncorrect: T('Xem đáp án tham chiếu.', 'See the reference answer.'),
      // `itemIndex` luôn null: bài luyện không gắn mục (không vào ôn tập).
      ...(itemIndex < 0 ? {} : {}),
    })),
    ...overrides,
  };
}

const create = (body: unknown) =>
  api.post('/admin/units', { token: admin.token, body, validateRequest: false });
const activate = (unitId: string) =>
  api.put(`/admin/units/${unitId}/status`, { token: admin.token, body: { status: 'active' } });

describe('tạo và kích hoạt đơn vị luyện hợp lệ', () => {
  it.each([
    ['reading', readingPayload],
    ['writing', writingPayload],
  ] as const)('%s: tạo 201 rồi kích hoạt 200', async (_kind, build) => {
    const created = await create(build());
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const res = await activate(created.body.id);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
  });
});

describe('vi phạm quy tắc → 422 VALIDATION_FAILED kèm fields theo đường dẫn', () => {
  const expect422 = async (payload: unknown, field: RegExp | string) => {
    const created = await create(payload);
    expect(created.status, JSON.stringify(created.body)).toBe(201); // bản nháp lưu được
    const res = await activate(created.body.id);
    expect(res.status, JSON.stringify(res.body)).toBe(422);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    const keys = Object.keys(res.body.fields ?? {});
    expect(keys.some((k) => (typeof field === 'string' ? k === field : field.test(k)))).toBe(true);
  };

  it('PR2: bài đọc có 2 đoạn văn (2 mục) → fields.items', async () => {
    const payload: any = readingPayload();
    payload.items = [...payload.items, { ...payload.items[0], japanese: `${PASSAGE}別の文です。` }];
    await expect422(payload, 'items');
  });

  it('PR2: đoạn văn quá ngắn → fields.items[0].japanese', async () => {
    const payload: any = readingPayload();
    payload.items[0].japanese = '短い文。';
    await expect422(payload, 'items[0].japanese');
  });

  it('PR3: bài đọc chỉ có 1 câu hỏi → fields.exercises', async () => {
    const payload: any = readingPayload();
    payload.exercises = payload.exercises.slice(0, 1);
    await expect422(payload, 'exercises');
  });

  it('PR4: bài viết chỉ có 2 mục → fields.items', async () => {
    const payload: any = writingPayload();
    payload.items = payload.items.slice(0, 2);
    payload.exercises = payload.exercises.slice(0, 2);
    await expect422(payload, 'items');
  });

  it('PR5: accepted_answers trùng nhau sau chuẩn hóa → fields.exercises[0].payload.accepted_answers', async () => {
    const payload: any = writingPayload();
    payload.exercises[0].payload.accepted_answers = ['みず', ' みず '];
    await expect422(payload, 'exercises[0].payload.accepted_answers');
  });

  it('PR6: bài viết 5 phút có 7 mục → fields.exercises (vượt quỹ 45 s/câu)', async () => {
    const payload: any = writingPayload();
    const extra = ['先生', '時間', '友達', '学校'].map((japanese, i) => ({
      item: {
        japanese,
        reading: ['せんせい', 'じかん', 'ともだち', 'がっこう'][i],
        meaning: T(japanese),
      },
    }));
    for (const { item } of extra) {
      payload.items.push({ ...item, examples: [] });
      payload.exercises.push({
        ...payload.exercises[0],
        prompt: T(`Gõ: ${item.japanese}`, `Type: ${item.japanese}`),
        payload: { accepted_answers: [item.japanese, item.reading] },
      });
    }
    await expect422(payload, /^exercises/);
  });
});

describe('quyền các vai trò khác không đổi', () => {
  it('người học (không phải admin) tạo đơn vị luyện → 403', async () => {
    const learner = await onboardedLearner(api, ctx);
    const res = await api.post('/admin/units', {
      token: learner.token,
      body: readingPayload(),
      validateRequest: false,
    });
    expect(res.status).toBe(403);
  });
});
