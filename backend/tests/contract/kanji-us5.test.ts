/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedContent } from '../../src/seed/index.js';
import {
  adminSession,
  kanjiUnitPayload,
  topicIdFor,
  type AdminSession,
} from '../integration/admin-helpers.js';
import { createTestApp, type TestApp } from '../integration/helpers.js';
import { ContractClient } from './client.js';

// Kiểm thử hợp đồng US5 Kanji (T075): `/admin/*` nhận và trả bài Kanji đúng OpenAPI 1.11.0 – `kind=kanji`,
// `items[].topicId`, `items[].kanjiDetails`, `exercises[].facet`, kích hoạt 422 theo đường dẫn, bộ lọc
// `kind`/`skill`, placement không nhận Kanji. Request/response được ContractClient đối chiếu openapi.yaml.

let ctx: TestApp;
let api: ContractClient;
let admin: AdminSession;
let unitTopic: string;
let itemTopic: string;

beforeAll(async () => {
  ctx = await createTestApp();
  await seedContent(ctx.handle.db);
  api = new ContractClient(ctx.app);
  admin = await adminSession(api, ctx);
  unitTopic = await topicIdFor(ctx, 'kanji', 'N5');
  itemTopic = unitTopic;
});
afterAll(async () => {
  await ctx.close();
});

const asAdmin = {
  get token() {
    return admin.token;
  },
};

describe('POST/PUT /admin/units với kind=kanji', () => {
  it('POST 201 lưu bản nháp và trả lại topicId, kanjiDetails, facet; GET chi tiết khớp', async () => {
    const created = await api.post('/admin/units', {
      ...asAdmin,
      body: kanjiUnitPayload(unitTopic, itemTopic),
    });
    expect(created.status).toBe(201);
    expect(created.body.kind).toBe('kanji');
    expect(created.body.status).toBe('draft');
    expect(created.body.items).toHaveLength(3);
    expect(created.body.items[0]).toMatchObject({
      japanese: '山',
      reading: null,
      topicId: itemTopic,
      kanjiDetails: { onReadings: ['サン'], kunReadings: ['やま'], strokeCount: 3 },
    });
    expect(created.body.items[0].examples[1].kanjiReading).toBe('サン');
    expect(created.body.exercises).toHaveLength(9);
    expect(created.body.exercises.slice(0, 3).map((e: any) => e.facet)).toEqual([
      'meaning',
      'reading',
      'word',
    ]);

    const detail = await api.get(`/admin/units/${created.body.id}`, { ...asAdmin });
    expect(detail.status).toBe(200);
    expect(detail.body).toEqual(created.body);
  });

  it('bài tập không khai báo facet mặc định là item; mục từ vựng bỏ qua trường Kanji', async () => {
    const vocabTopic = await topicIdFor(ctx, 'vocabulary', 'N5');
    const created = await api.post('/admin/units', {
      ...asAdmin,
      body: {
        kind: 'vocabulary',
        title: { vi: 'Từ vựng nháp', en: 'Draft vocabulary' },
        level: 'N5',
        topicId: vocabTopic,
        difficulty: 1,
        estMinutes: 5,
        items: [
          {
            japanese: '試験',
            reading: 'しけん',
            meaning: { vi: 'kỳ thi', en: 'exam' },
            // Với kind khác kanji, hai trường này bị bỏ qua (không lưu).
            topicId: vocabTopic,
            kanjiDetails: { onReadings: ['シ'], kunReadings: [], strokeCount: 1 },
          },
        ],
        exercises: [
          {
            itemIndex: 0,
            type: 'fill_blank',
            prompt: { vi: 'Viết cách đọc.', en: 'Write the reading.' },
            payload: { accepted_answers: ['しけん'] },
            feedbackCorrect: { vi: 'Đúng!', en: 'Correct!' },
            feedbackIncorrect: { vi: 'Sai.', en: 'Wrong.' },
          },
        ],
      },
    });
    expect(created.status).toBe(201);
    expect(created.body.items[0].topicId).toBeNull();
    expect(created.body.items[0].kanjiDetails).toBeNull();
    expect(created.body.exercises[0].facet).toBe('item');
  });

  it('lưu nháp chấp nhận chữ thiếu topicId/kanjiDetails; PUT 200 đổi facet; sai kiểu → 422', async () => {
    const draft = kanjiUnitPayload(unitTopic, itemTopic);
    (draft.items[1] as any).topicId = null;
    (draft.items[1] as any).kanjiDetails = null;
    const created = await api.post('/admin/units', { ...asAdmin, body: draft });
    expect(created.status).toBe(201);
    expect(created.body.items[1]).toMatchObject({ topicId: null, kanjiDetails: null });

    const unit = created.body;
    const edited = await api.put(`/admin/units/${unit.id}`, {
      ...asAdmin,
      body: {
        ...unit,
        exercises: unit.exercises.map((e: any, i: number) =>
          i === 0 ? { ...e, facet: 'reading' } : e,
        ),
      },
    });
    expect(edited.status).toBe(200);
    expect(edited.body.exercises[0].facet).toBe('reading');

    const badFacet = await api.put(`/admin/units/${unit.id}`, {
      ...asAdmin,
      body: {
        ...unit,
        exercises: unit.exercises.map((e: any, i: number) =>
          i === 0 ? { ...e, facet: 'stroke' } : e,
        ),
      },
      validateRequest: false,
    });
    expect(badFacet.status).toBe(422);
    expect(badFacet.body.code).toBe('VALIDATION_FAILED');
    expect(badFacet.body.fields['exercises.0.facet']).toBeTruthy();

    const badStrokes = await api.post('/admin/units', {
      ...asAdmin,
      body: kanjiUnitPayload(unitTopic, itemTopic, {
        items: [
          {
            japanese: '山',
            meaning: { vi: 'núi', en: 'mountain' },
            kanjiDetails: { onReadings: [], kunReadings: ['やま'], strokeCount: 99 },
          },
        ],
      }),
      validateRequest: false,
    });
    expect(badStrokes.status).toBe(422);
    expect(badStrokes.body.fields['items.0.kanjiDetails.strokeCount']).toBeTruthy();
  });
});

describe('PUT /admin/units/{unitId}/status → active', () => {
  it('422 VALIDATION_FAILED với fields theo đường dẫn (gồm goalTags rỗng) và giữ trạng thái draft', async () => {
    const payload = kanjiUnitPayload(unitTopic, itemTopic, { goalTags: [] });
    // Chỉ 2 chữ, chữ thứ hai thiếu chủ đề.
    payload.items = payload.items.slice(0, 2);
    (payload.items[1] as any).topicId = null;
    payload.exercises = payload.exercises.slice(0, 6);
    const created = await api.post('/admin/units', { ...asAdmin, body: payload });
    expect(created.status).toBe(201);

    const res = await api.put(`/admin/units/${created.body.id}/status`, {
      ...asAdmin,
      body: { status: 'active' },
    });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(res.body.fields.items).toContain('3 đến 5');
    expect(res.body.fields['items[1].topicId']).toBeTruthy();
    expect(res.body.fields.goalTags).toBeTruthy();

    const detail = await api.get(`/admin/units/${created.body.id}`, { ...asAdmin });
    expect(detail.body.status).toBe('draft');
  });

  it('200 kích hoạt bài Kanji đủ điều kiện', async () => {
    const created = await api.post('/admin/units', {
      ...asAdmin,
      body: kanjiUnitPayload(unitTopic, itemTopic, {
        title: { vi: 'Kanji hợp lệ', en: 'Valid kanji' },
      }),
    });
    expect(created.status).toBe(201);
    const res = await api.put(`/admin/units/${created.body.id}/status`, {
      ...asAdmin,
      body: { status: 'active' },
    });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('active');

    // Chuyển về inactive để chữ không còn bị tính là "đã có ở bài đang hoạt động" ở các test khác.
    const off = await api.put(`/admin/units/${created.body.id}/status`, {
      ...asAdmin,
      body: { status: 'inactive' },
    });
    expect(off.status).toBe(200);
  });
});

describe('bộ lọc và phạm vi loại trừ', () => {
  it('GET /admin/units?kind=kanji chỉ trả bài Kanji; kind lạ → 422', async () => {
    const res = await api.get('/admin/units?kind=kanji', { ...asAdmin });
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(7);
    expect(res.body.every((u: any) => u.kind === 'kanji')).toBe(true);

    const bad = await api.get('/admin/units?kind=bogus', { ...asAdmin });
    expect(bad.status).toBe(422);
    expect(bad.body.fields.kind).toBeTruthy();
  });

  it('GET /admin/topics?skill=kanji trả đúng 6 chủ đề Kanji; không lọc trả mọi kỹ năng', async () => {
    const res = await api.get('/admin/topics?skill=kanji', { ...asAdmin });
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(6);
    expect(res.body.every((t: any) => t.skill === 'kanji')).toBe(true);

    const all = await api.get('/admin/topics', { ...asAdmin });
    expect(new Set(all.body.map((t: any) => t.skill))).toEqual(
      new Set(['vocabulary', 'grammar', 'kanji']),
    );

    const bad = await api.get('/admin/topics?skill=bogus', { ...asAdmin });
    expect(bad.status).toBe(422);
  });

  it('AdminPlacementQuestion.skill = kanji → 422 (placement không có Kanji)', async () => {
    const res = await api.post('/admin/placement-questions', {
      ...asAdmin,
      body: {
        level: 'N5',
        skill: 'kanji',
        topicId: unitTopic,
        prompt: '「山」の意味は？',
        choices: ['núi', 'sông', 'ruộng', 'lửa'],
        correctChoice: 0,
      },
      validateRequest: false,
    });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(res.body.fields.skill).toBeTruthy();
  });
});
