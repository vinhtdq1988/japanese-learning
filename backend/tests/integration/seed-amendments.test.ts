/* eslint-disable @typescript-eslint/no-explicit-any */
import { rm } from 'node:fs/promises';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedContent } from '../../src/seed/index.js';
import { ContractClient } from '../contract/client.js';
import {
  copyContentDir,
  syntheticRelease,
  writeSyntheticRelease,
} from '../fixtures/synthetic-content.js';
import { createTestApp, type TestApp } from './helpers.js';
import { answerAll, kanjiLearner, kanjiUnitId, query, startSession } from './lesson-helpers.js';

// `amendments` chỉ-thêm cho Kanji hiện có (spec 008, T018; FR-018, I2, release-manifest.md §4): thêm âm
// On/Kun, ví dụ, bài tập (facet reading/word); chạy lại không nhân đôi; id mục/bài tập và lịch ôn không đổi.

const UNIT_TITLE = 'Nature kanji (空 海 林 森 風)';
const CHAR = '空';

let ctx: TestApp;
let api: ContractClient;
let dir: string;
const tempDirs: string[] = [];

const exercise = (facet: 'reading' | 'word', n: number, choices: string[]) => ({
  facet,
  type: 'multiple_choice',
  prompt: {
    vi: `「空」 trong từ ví dụ ${n} đọc là gì?`,
    en: `How is 「空」 read in example word ${n}?`,
  },
  payload: { choices, correct_index: 0 },
  feedbackCorrect: {
    vi: 'Đúng! 空 đọc là くう trong từ ghép.',
    en: 'Correct! 空 reads くう in compounds.',
  },
  feedbackIncorrect: {
    vi: 'Chưa đúng, 空 trong từ ghép đọc là くう.',
    en: 'Not quite, 空 reads くう in compounds.',
  },
});

const amendment = (over: Record<string, unknown> = {}) => ({
  unit: { kind: 'kanji', level: 'N4', titleEn: UNIT_TITLE },
  item: CHAR,
  add: {
    onReadings: ['コウ'],
    kunReadings: ['す.く'],
    examples: [
      {
        ja: '空港',
        reading: 'くうこう',
        kanjiReading: 'クウ',
        translation: { vi: 'sân bay', en: 'airport' },
      },
    ],
    exercises: [
      exercise('reading', 1, ['くう', 'そら', 'あき']),
      exercise('word', 2, ['くうこう', 'そらこう', 'あきこう']),
    ],
  },
  ...over,
});

beforeAll(async () => {
  ctx = await createTestApp();
  api = new ContractClient(ctx.app);
  dir = await copyContentDir(tempDirs);
  await writeSyntheticRelease(
    dir,
    syntheticRelease('001-amend', 0, { amendments: [amendment()], notes: 'Bổ sung cách đọc 空.' }),
    {},
  );
});
afterAll(async () => {
  await ctx.close();
  await Promise.all(tempDirs.map((d) => rm(d, { recursive: true, force: true })));
});

const snapshot = async (sqlText: string, params: unknown[] = []) =>
  JSON.parse(JSON.stringify(await query(ctx, sqlText, params))) as any[];

describe('áp amendments cho chữ Kanji đã có', () => {
  let unitId: string;
  let before: {
    items: any[];
    exercises: any[];
    schedules: any[];
    progress: any[];
    records: any[];
  };

  it('chỉ thêm: âm On/Kun, ví dụ và 2 bài tập (reading + word); id mục và bài tập cũ, lịch ôn không đổi', async () => {
    await seedContent(ctx.handle.db, dir, { releases: ['000-baseline'] });
    const learner = await kanjiLearner(api, ctx, { currentLevel: 'N4' });
    unitId = await kanjiUnitId(ctx, UNIT_TITLE);
    const session = await startSession(api, learner, unitId);
    await answerAll(api, ctx, learner, session);
    const done = await api.post(`/sessions/${session.id}/complete`, { token: learner.token });
    expect(done.status).toBe(200);

    before = {
      items: await snapshot('SELECT * FROM content_items WHERE unit_id = $1 ORDER BY id', [unitId]),
      exercises: await snapshot('SELECT * FROM exercises WHERE unit_id = $1 ORDER BY id', [unitId]),
      schedules: await snapshot('SELECT * FROM review_schedules ORDER BY review_schedules::text'),
      progress: await snapshot('SELECT * FROM unit_progress ORDER BY unit_progress::text'),
      records: await snapshot('SELECT * FROM study_records ORDER BY study_records::text'),
    };
    expect(before.schedules.length).toBe(15); // 5 chữ × 3 khía cạnh
    const oldChar = before.items.find((i) => i.japanese === CHAR);
    expect(oldChar.kanji_details.onReadings).toEqual(['クウ']);

    const summary = await seedContent(ctx.handle.db, dir, { releases: 'all' });
    expect(summary.unitsInserted).toBe(0);
    expect(summary.amendments).toEqual({
      applied: 1,
      onReadingsAdded: 1,
      kunReadingsAdded: 1,
      examplesAdded: 1,
      exercisesAdded: 2,
    });

    const items = await snapshot('SELECT * FROM content_items WHERE unit_id = $1 ORDER BY id', [
      unitId,
    ]);
    expect(items.map((i) => i.id)).toEqual(before.items.map((i) => i.id));
    const updated = items.find((i) => i.japanese === CHAR);
    // Giá trị cũ còn nguyên và đứng trước; giá trị mới nối vào cuối.
    expect(updated.kanji_details.onReadings).toEqual([...oldChar.kanji_details.onReadings, 'コウ']);
    expect(updated.kanji_details.kunReadings).toEqual([
      ...oldChar.kanji_details.kunReadings,
      'す.く',
    ]);
    expect(updated.kanji_details.strokeCount).toBe(oldChar.kanji_details.strokeCount);
    expect(updated.examples.slice(0, oldChar.examples.length)).toEqual(oldChar.examples);
    expect(updated.examples.at(-1)).toMatchObject({ ja: '空港', reading: 'くうこう' });
    // Chữ khác của đơn vị không đổi gì.
    for (const other of before.items.filter((i) => i.japanese !== CHAR)) {
      expect(items.find((i) => i.id === other.id)).toEqual(other);
    }

    const exercises = await snapshot('SELECT * FROM exercises WHERE unit_id = $1 ORDER BY id', [
      unitId,
    ]);
    expect(exercises.length).toBe(before.exercises.length + 2);
    const afterById = new Map(exercises.map((e) => [e.id, e]));
    for (const old of before.exercises) expect(afterById.get(old.id)).toEqual(old);
    const added = exercises.filter((e) => !before.exercises.some((o) => o.id === e.id));
    expect(added.map((e) => e.facet).sort()).toEqual(['reading', 'word']);
    for (const e of added) {
      expect(e.item_id).toBe(updated.id);
      expect(e.status).toBe('active');
    }

    // Lịch ôn, tiến độ, bản ghi học của người học KHÔNG đổi.
    expect(
      await snapshot('SELECT * FROM review_schedules ORDER BY review_schedules::text'),
    ).toEqual(before.schedules);
    expect(await snapshot('SELECT * FROM unit_progress ORDER BY unit_progress::text')).toEqual(
      before.progress,
    );
    expect(await snapshot('SELECT * FROM study_records ORDER BY study_records::text')).toEqual(
      before.records,
    );
  });

  it('chạy lại không nhân đôi (idempotent): không thêm âm, ví dụ, bài tập; dữ liệu giữ nguyên', async () => {
    const snap = async () => ({
      items: await snapshot('SELECT * FROM content_items WHERE unit_id = $1 ORDER BY id', [unitId]),
      exercises: await snapshot('SELECT * FROM exercises WHERE unit_id = $1 ORDER BY id', [unitId]),
    });
    const first = await snap();
    const again = await seedContent(ctx.handle.db, dir, { releases: 'all' });
    expect(again.amendments).toMatchObject({
      onReadingsAdded: 0,
      kunReadingsAdded: 0,
      examplesAdded: 0,
      exercisesAdded: 0,
    });
    expect(await snap()).toEqual(first);
  });

  it('sau gộp đơn vị vẫn đạt quy tắc Kanji: ba khía cạnh mỗi chữ và trong quỹ thời lượng', async () => {
    const exercises = await snapshot(
      `SELECT facet::text AS facet, item_id FROM exercises WHERE unit_id = $1 AND status = 'active'`,
      [unitId],
    );
    const [{ est_minutes: estMinutes }] = await snapshot(
      'SELECT est_minutes FROM learning_units WHERE id = $1',
      [unitId],
    );
    expect(exercises.length * ctx.config.REVIEW_SECONDS_PER_ITEM).toBeLessThanOrEqual(
      estMinutes * 60,
    );
    const items = await snapshot(
      `SELECT id FROM content_items WHERE unit_id = $1 AND status = 'active'`,
      [unitId],
    );
    for (const item of items) {
      for (const facet of ['meaning', 'reading', 'word']) {
        expect(
          exercises.some((e) => e.item_id === item.id && e.facet === facet),
          `${item.id} ${facet}`,
        ).toBe(true);
      }
    }
  });
});

describe('lỗi và hoàn tác', () => {
  it('bổ sung vượt quỹ thời lượng của đơn vị (so với CSDL) ⇒ seed ném lỗi và hoàn tác bổ sung đó', async () => {
    const overflowDir = await copyContentDir(tempDirs);
    const sea = amendment({ item: '海' });
    // Khớp theo file thì vừa quỹ (16 + 1 ≤ 20), nhưng CSDL đã bị chỉnh thêm bài (như một chỉnh sửa Admin).
    (sea.add as any).onReadings = [];
    (sea.add as any).kunReadings = [];
    (sea.add as any).examples = [];
    (sea.add as any).exercises = [exercise('word', 99, ['a', 'b', 'c'])];
    await writeSyntheticRelease(
      overflowDir,
      syntheticRelease('001-overflow', 0, { amendments: [sea] }),
      {},
    );

    const kanjiUnit = await kanjiUnitId(ctx, UNIT_TITLE);
    const [{ id: seaItem }] = await snapshot(
      `SELECT id FROM content_items WHERE unit_id = $1 AND japanese = '海'`,
      [kanjiUnit],
    );
    const [{ n: current }] = await snapshot(
      `SELECT count(*)::int AS n FROM exercises WHERE unit_id = $1 AND status = 'active'`,
      [kanjiUnit],
    );
    for (let i = 0; i < 20 - current; i += 1) {
      await ctx.handle.pool.query(
        `INSERT INTO exercises (unit_id, item_id, facet, type, prompt, payload, feedback_correct, feedback_incorrect, position)
         VALUES ($1, $2, 'word', 'multiple_choice', $3, $4, $5, $5, $6)`,
        [
          kanjiUnit,
          seaItem,
          JSON.stringify({ vi: `Bài thêm ${i}`, en: `Extra ${i}` }),
          JSON.stringify({ choices: ['a', 'b'], correct_index: 0 }),
          JSON.stringify({ vi: 'Đúng rồi!', en: 'Right!' }),
          100 + i,
        ],
      );
    }
    const itemsBefore = await snapshot('SELECT * FROM content_items ORDER BY id');
    const exercisesBefore = (await snapshot('SELECT id FROM exercises')).length;

    await expect(seedContent(ctx.handle.db, overflowDir, { releases: 'all' })).rejects.toThrow(
      /vượt quỹ/,
    );
    // Giao dịch của bổ sung bị hoàn tác: không thêm bài nào, mục không đổi.
    expect(await snapshot('SELECT * FROM content_items ORDER BY id')).toEqual(itemsBefore);
    expect((await snapshot('SELECT id FROM exercises')).length).toBe(exercisesBefore);
  });

  it('manifest trỏ chữ không có ⇒ seed thất bại ngay ở bước kiểm tra nội dung (M6)', async () => {
    const bad = await copyContentDir(tempDirs);
    await writeSyntheticRelease(
      bad,
      syntheticRelease('001-bad', 0, { amendments: [amendment({ item: '龍' })] }),
      {},
    );
    await expect(seedContent(ctx.handle.db, bad, { releases: 'all' })).rejects.toThrow(/M6/);
  });
});
