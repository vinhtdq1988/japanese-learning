/* eslint-disable @typescript-eslint/no-explicit-any */
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedContent } from '../../src/seed/index.js';
import { ContractClient } from '../contract/client.js';
import {
  contentDirWithSyntheticRelease,
  syntheticFileName,
  syntheticVocabUnit,
} from '../fixtures/synthetic-content.js';
import { createTestApp, type TestApp } from './helpers.js';
import { getToday, onboardedLearner, query, startSession, answerAll } from './lesson-helpers.js';

// Đợt phát hành KHÔNG đổi dữ liệu có sẵn (spec 008, T017; I2, I3, I4; FR-018): seed 000-baseline → học một
// bài, trả lời, có lịch ôn → seed thêm một đợt tổng hợp → id và hàng cũ giữ nguyên từng dòng; seed lại
// không đổi gì; bản nháp ở `drafts/` không bao giờ vào CSDL.

let ctx: TestApp;
let api: ContractClient;
let dir: string;
const tempDirs: string[] = [];

beforeAll(async () => {
  ctx = await createTestApp();
  api = new ContractClient(ctx.app);
  dir = await contentDirWithSyntheticRelease(2, tempDirs);
});
afterAll(async () => {
  await ctx.close();
  await Promise.all(tempDirs.map((d) => rm(d, { recursive: true, force: true })));
});

const TABLES = [
  'learning_units',
  'content_items',
  'exercises',
  'unit_progress',
  'review_schedules',
  'study_records',
] as const;

/** Toàn bộ hàng của bảng, sắp theo id, dạng JSON để so sánh từng dòng. */
async function snapshot(table: string): Promise<any[]> {
  return JSON.parse(
    JSON.stringify(await query(ctx, `SELECT * FROM ${table} ORDER BY ${table}::text`)),
  ) as any[];
}

describe('seed theo đợt: giữ nguyên dữ liệu và tiến độ có sẵn (I2, I3)', () => {
  it('seed 000-baseline → học → seed thêm đợt: id, tiến độ, lịch ôn, bản ghi học giữ nguyên từng dòng', async () => {
    const first = await seedContent(ctx.handle.db, dir, { releases: ['000-baseline'] });
    expect(first.unitsInserted).toBe(33);
    expect(first.amendments.applied).toBe(0);

    // Người học học một bài và trả lời (một câu cố ý sai) để có tiến độ, lịch ôn và bản ghi học.
    const learner = await onboardedLearner(api, ctx);
    const plan = await getToday(api, learner);
    const session = await startSession(api, learner, plan.items[0].id);
    await answerAll(api, ctx, learner, session, { wrongIndexes: [0] });
    const done = await api.post(`/sessions/${session.id}/complete`, { token: learner.token });
    expect(done.status).toBe(200);

    const before = {} as Record<(typeof TABLES)[number], any[]>;
    for (const table of TABLES) before[table] = await snapshot(table);
    expect(before.unit_progress.length).toBeGreaterThan(0);
    expect(before.review_schedules.length).toBeGreaterThan(0);
    expect(before.study_records.length).toBeGreaterThan(0);

    const second = await seedContent(ctx.handle.db, dir, { releases: 'all' });
    expect(second).toMatchObject({ unitsInserted: 2, unitsSkipped: 33 });
    expect(second.amendments.applied).toBe(0);

    // Bảng nội dung: mọi hàng cũ còn nguyên (cùng id, cùng giá trị); chỉ tăng thêm hàng của đợt mới.
    for (const table of ['learning_units', 'content_items', 'exercises'] as const) {
      const after = await snapshot(table);
      const afterById = new Map(after.map((r) => [r.id, r]));
      for (const row of before[table])
        expect(afterById.get(row.id), `${table} ${row.id}`).toEqual(row);
      expect(after.length).toBeGreaterThan(before[table].length);
    }
    expect((await snapshot('learning_units')).length).toBe(35);
    expect((await snapshot('content_items')).length).toBe(before.content_items.length + 4);
    expect((await snapshot('exercises')).length).toBe(before.exercises.length + 8);

    // Dữ liệu người học: GIỐNG HỆT từng dòng.
    for (const table of ['unit_progress', 'review_schedules', 'study_records'] as const) {
      expect(await snapshot(table), table).toEqual(before[table]);
    }
  });

  it('đơn vị của đợt mới hiện `active` và có mục, bài tập gắn mục; siêu dữ liệu biên soạn không vào CSDL', async () => {
    const rows = await query(
      ctx,
      `SELECT lu.status::text AS status, lu.sequence, lu.tier::text AS tier,
              (SELECT count(*)::int FROM content_items ci WHERE ci.unit_id = lu.id) AS items,
              (SELECT count(*)::int FROM exercises e WHERE e.unit_id = lu.id AND e.item_id IS NOT NULL) AS linked
         FROM learning_units lu WHERE lu.title->>'en' LIKE 'Synthetic vocabulary %' ORDER BY lu.sequence`,
    );
    expect(rows).toEqual([
      { status: 'active', sequence: 410, tier: 'core', items: 2, linked: 4 },
      { status: 'active', sequence: 420, tier: 'core', items: 2, linked: 4 },
    ]);
    const columns = await query(
      ctx,
      `SELECT column_name FROM information_schema.columns
        WHERE table_name IN ('learning_units','content_items','exercises')
          AND column_name IN ('format','scope_ref','scopeRef','requires')`,
    );
    expect(columns).toEqual([]);
  });

  it('seed lại: không đổi gì (unitsInserted = 0, I3), không nhân đôi mục hay bài tập', async () => {
    const before = {
      units: (await snapshot('learning_units')).length,
      items: (await snapshot('content_items')).length,
      exercises: (await snapshot('exercises')).length,
    };
    const again = await seedContent(ctx.handle.db, dir, { releases: 'all' });
    expect(again).toMatchObject({
      unitsInserted: 0,
      unitsSkipped: 35,
      topicsInserted: 0,
      placementInserted: 0,
    });
    expect(again.amendments).toEqual({
      applied: 0,
      onReadingsAdded: 0,
      kunReadingsAdded: 0,
      examplesAdded: 0,
      exercisesAdded: 0,
    });
    expect({
      units: (await snapshot('learning_units')).length,
      items: (await snapshot('content_items')).length,
      exercises: (await snapshot('exercises')).length,
    }).toEqual(before);
  });
});

describe('bản nháp không bao giờ vào CSDL (I4, M7)', () => {
  it('thư mục nội dung tạm có drafts/ ⇒ 0 đơn vị từ nháp sau khi seed', async () => {
    const draftDir = path.join(dir, 'drafts', '009-draft');
    await mkdir(draftDir, { recursive: true });
    const draft = syntheticVocabUnit(5, { title: { vi: 'Bản nháp', en: 'Never seeded draft' } });
    await writeFile(path.join(draftDir, syntheticFileName(5)), JSON.stringify(draft));
    // Kể cả bản nháp đặt thẳng trong units/ nhưng KHÔNG thuộc manifest bị chặn đóng kín (xem content-releases).
    const summary = await seedContent(ctx.handle.db, dir, { releases: 'all' });
    expect(summary.unitsInserted).toBe(0);
    expect(
      await query(ctx, `SELECT id FROM learning_units WHERE title->>'en' = 'Never seeded draft'`),
    ).toEqual([]);
    expect(await query(ctx, `SELECT count(*)::int AS n FROM learning_units`)).toEqual([{ n: 35 }]);
  });

  it('file mồ côi trong units/ làm seed THẤT BẠI trước khi ghi bất cứ gì (đóng kín)', async () => {
    const orphan = path.join(dir, 'units', 'n4-vocabulary-orphan-01.json');
    await writeFile(orphan, JSON.stringify(syntheticVocabUnit(6)));
    try {
      await expect(seedContent(ctx.handle.db, dir, { releases: 'all' })).rejects.toThrow(/M1/);
      expect(await query(ctx, `SELECT count(*)::int AS n FROM learning_units`)).toEqual([
        { n: 35 },
      ]);
    } finally {
      await rm(orphan);
    }
  });
});
