/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedContent } from '../../src/seed/index.js';
import { ContractClient } from '../contract/client.js';
import {
  adminSession,
  kanjiUnitPayload,
  topicIdFor,
  vocabUnitPayload,
  type AdminSession,
} from './admin-helpers.js';
import { createTestApp, type TestApp } from './helpers.js';

// Kích hoạt qua Admin API chặn mục chính trùng với đơn vị `active` khác ở MỌI loại (spec 008, T019; FR-007,
// research D4): từ vựng theo `japanese|reading`, ngữ pháp theo `japanese`, Kanji theo ký tự (như spec 003).
// Quy tắc biên soạn AU4–AU13 KHÔNG chạy qua Admin (quản trị viên vẫn sửa nhanh được sự cố).

let ctx: TestApp;
let api: ContractClient;
let admin: AdminSession;
let vocabTopic: string;
let grammarTopic: string;
let kanjiTopic: string;

beforeAll(async () => {
  ctx = await createTestApp();
  await seedContent(ctx.handle.db);
  api = new ContractClient(ctx.app);
  admin = await adminSession(api, ctx);
  vocabTopic = await topicIdFor(ctx, 'vocabulary', 'N5');
  grammarTopic = await topicIdFor(ctx, 'grammar', 'N5');
  kanjiTopic = await topicIdFor(ctx, 'kanji', 'N5');
});
afterAll(async () => {
  await ctx.close();
});

const auth = () => ({ token: admin.token });

const createUnit = async (body: unknown) => {
  const res = await api.post('/admin/units', { ...auth(), body, validateRequest: false });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body as { id: string };
};
const activate = (id: string) =>
  api.put(`/admin/units/${id}/status`, { ...auth(), body: { status: 'active' } });

/** Từ vựng mẫu của `vocabUnitPayload`: `試験|しけん` và `宿題|しゅくだい`. */
const vocab = (title: string, mutate?: (p: any) => void) => {
  const payload: any = vocabUnitPayload(vocabTopic, { title: { vi: title, en: title } });
  mutate?.(payload);
  return payload;
};

/** Ngữ pháp 1 mẫu đạt quy tắc cũ, KHÔNG có siêu dữ liệu biên soạn (scopeRef/format/sequence chặng). */
const grammar = (title: string, pattern: string) => ({
  kind: 'grammar',
  title: { vi: title, en: title },
  level: 'N5',
  tier: 'core',
  goalTags: ['daily_conversation'],
  topicId: grammarTopic,
  difficulty: 1,
  estMinutes: 5,
  sequence: 7,
  items: [
    {
      japanese: pattern,
      reading: null,
      meaning: { vi: 'mẫu thử', en: 'test pattern' },
      explanation: { vi: 'Giải thích mẫu thử.', en: 'Explanation of the test pattern.' },
      examples: [
        {
          ja: `これは${pattern}です。`,
          reading: `これは${pattern}です。`,
          translation: { vi: 'Đây là mẫu thử.', en: 'This is a test pattern.' },
        },
      ],
    },
  ],
  exercises: [
    {
      itemIndex: 0,
      type: 'multiple_choice',
      prompt: { vi: 'Chọn mẫu đúng', en: 'Choose the right pattern' },
      payload: { choices: [pattern, 'あ', 'い'], correct_index: 0 },
      feedbackCorrect: { vi: 'Đúng!', en: 'Correct!' },
      feedbackIncorrect: { vi: 'Chưa đúng.', en: 'Not quite.' },
    },
  ],
});

describe('từ vựng: trùng japanese|reading với đơn vị active khác', () => {
  let firstTitle: string;

  it('đơn vị đầu kích hoạt được; đơn vị thứ hai chứa cùng mục bị 422 kèm trường items[i].japanese', async () => {
    firstTitle = 'Admin first vocabulary';
    const first = await createUnit(vocab(firstTitle));
    expect((await activate(first.id)).status).toBe(200);

    // Mục thứ hai (宿題|しゅくだい) trùng; mục đầu đổi sang từ khác nên chỉ vị trí 1 bị báo.
    const second = await createUnit(
      vocab('Admin second vocabulary', (p) => {
        p.items[0].japanese = '勉強';
        p.items[0].reading = 'べんきょう';
        p.exercises = p.exercises.filter((e: any) => e.itemIndex !== 0);
        p.exercises.push({
          itemIndex: 0,
          type: 'multiple_choice',
          prompt: { vi: '「勉強」nghĩa là gì?', en: 'What does 「勉強」 mean?' },
          payload: { choices: ['học / study', 'ăn / eat', 'ngủ / sleep'], correct_index: 0 },
          feedbackCorrect: { vi: 'Đúng!', en: 'Correct!' },
          feedbackIncorrect: { vi: 'Chưa đúng.', en: 'Not quite.' },
        });
      }),
    );
    const res = await activate(second.id);
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(res.body.fields).toEqual({
      'items[1].japanese': `mục 「宿題」 đã có ở bài 「${firstTitle}」 đang hoạt động`,
    });
  });

  it('cùng chữ nhưng KHÁC cách đọc là mục khác: kích hoạt được (khóa japanese|reading)', async () => {
    const unit = await createUnit(
      vocab('Admin other reading', (p) => {
        p.items[0].japanese = '試験';
        p.items[0].reading = 'ためし'; // đọc khác so với しけん
        p.items[1].japanese = '別の言葉';
        p.items[1].reading = 'べつのことば';
        p.exercises[1].payload = { accepted_answers: ['べつのことば'] };
        p.exercises[1].prompt = { vi: 'Viết cách đọc', en: 'Write the reading' };
      }),
    );
    const res = await activate(unit.id);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
  });

  it('đơn vị tự trùng chính nó không bị báo: sửa đơn vị đang active vẫn lưu được', async () => {
    const [{ id }] = (
      await ctx.handle.pool.query(`SELECT id FROM learning_units WHERE title->>'en' = $1`, [
        firstTitle,
      ])
    ).rows;
    const detail = await api.get(`/admin/units/${id}`, auth());
    expect(detail.status).toBe(200);
    const body = { ...detail.body };
    body.title = { vi: firstTitle, en: firstTitle };
    const res = await api.put(`/admin/units/${id}`, { ...auth(), body, validateRequest: false });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
  });

  it('đơn vị inactive không chặn: sau khi vô hiệu hóa bài đầu, bài thứ hai chứa cùng mục kích hoạt được', async () => {
    const [{ id }] = (
      await ctx.handle.pool.query(`SELECT id FROM learning_units WHERE title->>'en' = $1`, [
        firstTitle,
      ])
    ).rows;
    expect(
      (await api.put(`/admin/units/${id}/status`, { ...auth(), body: { status: 'inactive' } }))
        .status,
    ).toBe(200);
    const again = await createUnit(vocab('Admin vocabulary after inactive'));
    expect((await activate(again.id)).status).toBe(200);
  });
});

describe('ngữ pháp: trùng japanese với đơn vị active khác', () => {
  it('bài thứ hai có cùng mẫu bị 422 với "mục 「…」 đã có ở bài 「…」 đang hoạt động"', async () => {
    const first = await createUnit(grammar('Admin grammar one', '〜てみる'));
    expect((await activate(first.id)).status).toBe(200);
    const second = await createUnit(grammar('Admin grammar two', '〜てみる'));
    const res = await activate(second.id);
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(res.body.fields['items[0].japanese']).toBe(
      'mục 「〜てみる」 đã có ở bài 「Admin grammar one」 đang hoạt động',
    );
  });

  it('mẫu khác thì kích hoạt được dù thiếu mọi siêu dữ liệu biên soạn (AU4–AU13 KHÔNG chạy qua Admin)', async () => {
    // Không scopeRef, không format, sequence = 7 (không theo chặng), chỉ 1 bài gắn mục.
    const unit = await createUnit(grammar('Admin grammar three', '〜ておく'));
    const res = await activate(unit.id);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
  });
});

describe('Kanji: trùng chữ vẫn bị chặn như cũ', () => {
  it('chữ đã có ở bài active khác ⇒ 422 với trường items[i].japanese', async () => {
    const first = await createUnit(
      kanjiUnitPayload(kanjiTopic, kanjiTopic, {
        title: { vi: 'Kanji admin một', en: 'Admin kanji one' },
      }),
    );
    expect((await activate(first.id)).status).toBe(200);
    const second = await createUnit(
      kanjiUnitPayload(kanjiTopic, kanjiTopic, {
        title: { vi: 'Kanji admin hai', en: 'Admin kanji two' },
      }),
    );
    const res = await activate(second.id);
    expect(res.status).toBe(422);
    expect(res.body.fields['items[0].japanese']).toBe(
      'chữ 「山」 đã có ở bài 「Admin kanji one」 đang hoạt động',
    );
  });
});
