/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedContent } from '../../src/seed/index.js';
import { ContractClient } from '../contract/client.js';
import {
  adminSession,
  kanjiUnitPayload,
  rows,
  topicIdFor,
  vocabUnitPayload,
  type AdminSession,
} from './admin-helpers.js';
import { createTestApp, type TestApp } from './helpers.js';
import { kanjiLearner, query, startSession, studyPlanItem } from './lesson-helpers.js';

// Kiểm thử tích hợp US5 Kanji (T076) trên PostgreSQL thật: admin soạn, kiểm tra, kích hoạt bài Kanji bằng
// công cụ hiện có (quickstart KJ9). Quy tắc nội dung K10 chỉ chặn lúc kích hoạt; bản nháp lưu dở dang được.

/** Bản sao phần tử không có `id` (để PUT tạo phần tử mới thay vì sửa phần tử cũ). */
const withoutId = (element: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(element).filter(([key]) => key !== 'id'));

interface Env {
  ctx: TestApp;
  api: ContractClient;
  admin: AdminSession;
  kanjiN5: string;
  kanjiN4: string;
}

async function setup(configOverrides: Record<string, string> = {}): Promise<Env> {
  const ctx = await createTestApp({}, configOverrides);
  await seedContent(ctx.handle.db);
  const api = new ContractClient(ctx.app);
  const admin = await adminSession(api, ctx);
  return {
    ctx,
    api,
    admin,
    kanjiN5: await topicIdFor(ctx, 'kanji', 'N5'),
    kanjiN4: await topicIdFor(ctx, 'kanji', 'N4'),
  };
}

describe('quản trị bài Kanji (cấu hình mặc định, 30 giây/câu)', () => {
  let env: Env;
  const auth = () => ({ token: env.admin.token });
  const logsFor = (targetId: string) =>
    rows(env.ctx, 'SELECT * FROM admin_action_logs WHERE target_id = $1 ORDER BY occurred_at, id', [
      targetId,
    ]);
  const createUnit = async (body: unknown) => {
    const res = await env.api.post('/admin/units', { ...auth(), body, validateRequest: false });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    return res.body;
  };
  const setStatus = (unitId: string, status: 'active' | 'inactive') =>
    env.api.put(`/admin/units/${unitId}/status`, { ...auth(), body: { status } });

  beforeAll(async () => {
    env = await setup();
  });
  afterAll(async () => {
    await env.ctx.close();
  });

  it('lưu nháp không bị chặn bởi quy tắc K10: chữ thiếu topicId/kanjiDetails vẫn được lưu', async () => {
    const payload = kanjiUnitPayload(env.kanjiN5, env.kanjiN5, { goalTags: [] }, [0]);
    // Nháp dở dang: chữ thiếu chủ đề và chi tiết, bài tập gắn chữ nhưng facet còn mặc định.
    (payload.items[0] as any).topicId = null;
    (payload.items[0] as any).kanjiDetails = null;
    payload.exercises = [{ ...payload.exercises[0]!, facet: 'item' }];
    const unit = await createUnit(payload);

    expect(unit.status).toBe('draft');
    const [item] = await rows(
      env.ctx,
      'SELECT topic_id, kanji_details FROM content_items WHERE unit_id = $1',
      [unit.id],
    );
    expect(item.topic_id).toBeNull();
    expect(item.kanji_details).toBeNull();
  });

  it('kích hoạt bài 2 chữ có chữ thiếu chủ đề → 422 liệt kê mọi lỗi và giữ bản nháp', async () => {
    const payload = kanjiUnitPayload(env.kanjiN5, env.kanjiN5, {}, [0, 1]);
    (payload.items[1] as any).topicId = null;
    const unit = await createUnit(payload);

    const res = await setStatus(unit.id, 'active');
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(res.body.fields.items).toContain('3 đến 5');
    expect(res.body.fields['items[1].topicId']).toBeTruthy();

    const [row] = await rows(env.ctx, 'SELECT status FROM learning_units WHERE id = $1', [unit.id]);
    expect(row.status).toBe('draft');
  });

  it('chữ đã có ở bài active khác → 422 nêu bài đang chứa; vô hiệu hóa bài kia thì kích hoạt được', async () => {
    const a = await createUnit(
      kanjiUnitPayload(env.kanjiN5, env.kanjiN5, { title: { vi: 'Bài A', en: 'Kanji A' } }),
    );
    expect((await setStatus(a.id, 'active')).status).toBe(200);

    // Bài B chứa lại chữ 山 (đã ở bài A) cùng hai chữ mới.
    const b = await createUnit(
      kanjiUnitPayload(
        env.kanjiN5,
        env.kanjiN5,
        { title: { vi: 'Bài B', en: 'Kanji B' } },
        [0, 3, 4],
      ),
    );
    const blocked = await setStatus(b.id, 'active');
    expect(blocked.status).toBe(422);
    expect(blocked.body.fields['items[0].japanese']).toContain('Kanji A');

    // Chữ chỉ trùng với bài `inactive` thì hợp lệ.
    expect((await setStatus(a.id, 'inactive')).status).toBe(200);
    expect((await setStatus(b.id, 'active')).status).toBe(200);
    expect((await setStatus(b.id, 'inactive')).status).toBe(200);
  });

  it('bài 5 phút có 11 bài tập → 422 exercises; còn 10 bài tập thì kích hoạt được (30 giây/câu)', async () => {
    const payload = kanjiUnitPayload(env.kanjiN5, env.kanjiN5);
    const extra = (n: number) => Array.from({ length: n }, () => ({ ...payload.exercises[0]! }));
    const unit = await createUnit({ ...payload, exercises: [...payload.exercises, ...extra(2)] });
    expect(unit.exercises).toHaveLength(11);

    const blocked = await setStatus(unit.id, 'active');
    expect(blocked.status).toBe(422);
    expect(blocked.body.fields.exercises).toContain('vượt quỹ 10 câu');

    const fixed = await env.api.put(`/admin/units/${unit.id}`, {
      ...auth(),
      body: { ...unit, exercises: unit.exercises.slice(0, 10) },
    });
    expect(fixed.status).toBe(200);
    expect((await setStatus(unit.id, 'active')).status).toBe(200);
    expect((await setStatus(unit.id, 'inactive')).status).toBe(200);
  });

  it('goalTags rỗng: bài Kanji → 422 goalTags; bài từ vựng/ngữ pháp vẫn kích hoạt được', async () => {
    const kanji = await createUnit(kanjiUnitPayload(env.kanjiN5, env.kanjiN5, { goalTags: [] }));
    const blocked = await setStatus(kanji.id, 'active');
    expect(blocked.status).toBe(422);
    expect(blocked.body.fields.goalTags).toBeTruthy();

    const vocabTopic = await topicIdFor(env.ctx, 'vocabulary', 'N5');
    const vocab = await createUnit(vocabUnitPayload(vocabTopic, { goalTags: [] }));
    expect((await setStatus(vocab.id, 'active')).status).toBe(200);
  });

  it('chữ thiếu glyph trong phông đóng gói → 422 items[i].japanese', async () => {
    const payload = kanjiUnitPayload(env.kanjiN5, env.kanjiN5);
    // U+3400 nằm trong khối CJK Extension A nhưng phông không có glyph.
    (payload.items[0] as any).japanese = '㐀';
    const unit = await createUnit(payload);
    const res = await setStatus(unit.id, 'active');
    expect(res.status).toBe(422);
    expect(res.body.fields['items[0].japanese']).toContain('glyph');
  });

  it('đổi sequence của hai bài Kanji đổi thứ tự trong GET /admin/units?kind=kanji và ghi nhật ký unit.update', async () => {
    const u1 = await createUnit(
      kanjiUnitPayload(env.kanjiN5, env.kanjiN5, { sequence: 8001, title: { vi: 'U1', en: 'U1' } }),
    );
    const u2 = await createUnit(
      kanjiUnitPayload(env.kanjiN5, env.kanjiN5, { sequence: 8002, title: { vi: 'U2', en: 'U2' } }),
    );
    const order = async () =>
      (await env.api.get('/admin/units?kind=kanji', auth())).body
        .map((u: any) => u.id)
        .filter((id: string) => id === u1.id || id === u2.id);
    expect(await order()).toEqual([u1.id, u2.id]);

    for (const [unit, sequence] of [
      [u1, 8002],
      [u2, 8001],
    ] as const) {
      const res = await env.api.put(`/admin/units/${unit.id}`, {
        ...auth(),
        body: { ...unit, sequence },
      });
      expect(res.status).toBe(200);
    }
    expect(await order()).toEqual([u2.id, u1.id]);

    const logs = await logsFor(u1.id);
    expect(logs.map((l: any) => l.action)).toEqual(['unit.create', 'unit.update']);
    expect(logs[1]!.diff.fields.sequence).toEqual({ from: 8001, to: 8002 });
  });

  it('nhật ký có unit.create, unit.update, unit.set_status kèm người thực hiện, thời gian và diff Kanji (FR-023)', async () => {
    const unit = await createUnit(
      kanjiUnitPayload(env.kanjiN5, env.kanjiN5, { title: { vi: 'Nhật ký', en: 'Audit' } }),
    );
    expect((await setStatus(unit.id, 'active')).status).toBe(200);
    const edited = await env.api.put(`/admin/units/${unit.id}`, {
      ...auth(),
      body: {
        ...unit,
        items: unit.items.map((it: any, i: number) =>
          i === 0 ? { ...it, kanjiDetails: { ...it.kanjiDetails, strokeCount: 4 } } : it,
        ),
        exercises: unit.exercises.map((ex: any, i: number) =>
          i === 0 ? { ...ex, facet: 'reading' } : ex,
        ),
      },
    });
    // Đổi facet của bài tập đầu thành reading làm chữ đầu thiếu khía cạnh meaning → bị chặn, toàn bộ hoàn tác.
    expect(edited.status).toBe(422);
    expect(edited.body.fields.exercises).toContain('meaning');

    const ok = await env.api.put(`/admin/units/${unit.id}`, {
      ...auth(),
      body: {
        ...unit,
        items: unit.items.map((it: any, i: number) =>
          i === 0 ? { ...it, kanjiDetails: { ...it.kanjiDetails, strokeCount: 4 } } : it,
        ),
        // Bài tập đầu chuyển sang reading nhưng thêm một bài meaning thay thế (10 câu ≤ quỹ 10).
        exercises: [
          ...unit.exercises.map((ex: any, i: number) =>
            i === 0 ? { ...ex, facet: 'reading' } : ex,
          ),
          { ...withoutId(unit.exercises[0]), facet: 'meaning' },
        ],
      },
    });
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);

    const logs = await logsFor(unit.id);
    expect(logs.map((l: any) => l.action)).toEqual([
      'unit.create',
      'unit.set_status',
      'unit.update',
    ]);
    for (const log of logs) {
      expect(log.actor_id).toBe(env.admin.userId);
      expect(log.occurred_at).toBeInstanceOf(Date);
    }
    // Tạo mới: giá trị đầu của topicId/kanjiDetails/facet nằm trong diff.
    const created = logs[0]!.diff.kanji;
    expect(Object.values(created.items).some((c: any) => c.kanjiDetails && c.topicId)).toBe(true);
    expect(Object.values(created.exercises).some((c: any) => c.facet?.to === 'meaning')).toBe(true);
    // Sửa: từ/đến của kanjiDetails và facet.
    const update = logs[2]!.diff;
    const itemChange: any = Object.values(update.items.changes)[0];
    expect(itemChange.kanjiDetails.from.strokeCount).toBe(3);
    expect(itemChange.kanjiDetails.to.strokeCount).toBe(4);
    const facetChange: any = Object.values(update.exercises.changes)[0];
    expect(facetChange.facet).toEqual({ from: 'meaning', to: 'reading' });

    expect((await setStatus(unit.id, 'inactive')).status).toBe(200);
  });

  it('bài active vừa kích hoạt xuất hiện ngay với người học N4 đã chọn Kanji (SC-009: ≤ 5 phút)', async () => {
    const unit = await createUnit(
      kanjiUnitPayload(env.kanjiN4, env.kanjiN4, {
        level: 'N4',
        sequence: -100000,
        title: { vi: 'Kanji N4 mới', en: 'New N4 kanji' },
      }),
    );
    expect((await setStatus(unit.id, 'active')).status).toBe(200);

    const learner = await kanjiLearner(env.api, env.ctx, {
      skills: ['kanji'],
      currentLevel: 'N4',
      goalType: 'jlpt',
      targetLevel: 'N4',
    });
    const extra = await env.api.post('/today/extra', { token: learner.token });
    expect(extra.status).toBe(200);
    expect(extra.body.id).toBe(unit.id);
    expect(extra.body.kind).toBe('kanji');

    // Tắt bài để chữ của nó không cản kích hoạt bài N4 ở test sau.
    expect((await setStatus(unit.id, 'inactive')).status).toBe(200);
  });

  it('sửa nghĩa chữ đang có lịch ôn và bỏ một bài tập → bài tập inactive, lịch ôn/lịch sử nguyên vẹn, phiên mới không còn bài tập đó', async () => {
    const base = kanjiUnitPayload(env.kanjiN4, env.kanjiN4, {
      level: 'N4',
      sequence: -200000,
      title: { vi: 'Kanji N4 sửa', en: 'Editable N4 kanji' },
    });
    // Thêm một bài meaning thứ hai cho chữ đầu để bỏ nó vẫn còn đủ khía cạnh (10 câu ≤ quỹ 10).
    const unit = await createUnit({ ...base, exercises: [...base.exercises, base.exercises[0]] });
    expect(unit.exercises).toHaveLength(10);
    expect((await setStatus(unit.id, 'active')).status).toBe(200);

    const learner = await kanjiLearner(env.api, env.ctx, {
      skills: ['kanji'],
      currentLevel: 'N4',
      goalType: 'jlpt',
      targetLevel: 'N4',
    });
    const extra = await env.api.post('/today/extra', { token: learner.token });
    expect(extra.body.id).toBe(unit.id);
    await studyPlanItem(env.api, env.ctx, learner, unit.id);

    const counts = async () => ({
      schedules: (
        await query(env.ctx, 'SELECT count(*)::int AS n FROM review_schedules WHERE user_id = $1', [
          learner.userId,
        ])
      )[0].n,
      records: (
        await query(env.ctx, 'SELECT count(*)::int AS n FROM study_records WHERE user_id = $1', [
          learner.userId,
        ])
      )[0].n,
    });
    const before = await counts();
    expect(before.schedules).toBe(9);

    const dropped = unit.exercises[9];
    const edited = await env.api.put(`/admin/units/${unit.id}`, {
      ...auth(),
      body: {
        ...unit,
        items: unit.items.map((it: any, i: number) =>
          i === 0 ? { ...it, meaning: { vi: 'ngọn núi', en: 'a mountain' } } : it,
        ),
        exercises: unit.exercises.slice(0, 9),
      },
    });
    expect(edited.status, JSON.stringify(edited.body)).toBe(200);
    expect(edited.body.items[0].meaning.en).toBe('a mountain');
    const status = edited.body.exercises.find((e: any) => e.id === dropped.id).status;
    expect(status).toBe('inactive');

    expect(await counts()).toEqual(before);

    const other = await kanjiLearner(env.api, env.ctx, {
      skills: ['kanji'],
      currentLevel: 'N4',
      goalType: 'jlpt',
      targetLevel: 'N4',
    });
    const session = await startSession(env.api, other, unit.id);
    expect(session.exercises).toHaveLength(9);
    expect(session.exercises.map((e: any) => e.id)).not.toContain(dropped.id);
  });
});

describe('quản trị bài Kanji với cấu hình REVIEW_SECONDS_PER_ITEM = 20', () => {
  let env: Env;

  beforeAll(async () => {
    env = await setup({ REVIEW_SECONDS_PER_ITEM: '20' });
  });
  afterAll(async () => {
    await env.ctx.close();
  });

  it('ngưỡng thời lượng đổi theo cấu hình: bài 5 phút nhận 15 bài tập, 16 bị 422', async () => {
    const base = kanjiUnitPayload(env.kanjiN5, env.kanjiN5);
    const withExercises = async (count: number, en: string) => {
      const exercises = Array.from(
        { length: count },
        (_, i) => base.exercises[i % base.exercises.length]!,
      );
      const res = await env.api.post('/admin/units', {
        token: env.admin.token,
        body: { ...base, title: { vi: en, en }, exercises },
        validateRequest: false,
      });
      expect(res.status, JSON.stringify(res.body)).toBe(201);
      return res.body;
    };
    const ok = await withExercises(15, 'Fifteen');
    const activated = await env.api.put(`/admin/units/${ok.id}/status`, {
      token: env.admin.token,
      body: { status: 'active' },
    });
    expect(activated.status, JSON.stringify(activated.body)).toBe(200);
    // Tắt bài vừa kích hoạt: chữ của nó không cản kiểm tra bài thứ hai.
    await env.api.put(`/admin/units/${ok.id}/status`, {
      token: env.admin.token,
      body: { status: 'inactive' },
    });

    const tooMany = await withExercises(16, 'Sixteen');
    const blocked = await env.api.put(`/admin/units/${tooMany.id}/status`, {
      token: env.admin.token,
      body: { status: 'active' },
    });
    expect(blocked.status).toBe(422);
    expect(blocked.body.fields.exercises).toContain('vượt quỹ 15 câu');
  });
});
