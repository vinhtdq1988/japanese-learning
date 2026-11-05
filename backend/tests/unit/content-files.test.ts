import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { formatIssues } from '../../src/domain/content-validation.js';
import { findMissingGlyphs } from '../../src/domain/font-coverage.js';
import {
  DEFAULT_CONTENT_DIR,
  loadContent,
  validateContent,
  type LoadedContent,
} from '../../src/seed/content.js';

// Kiểm tra nội dung thật trong `content/` (T025, T027, T028) – cùng quy tắc mà `pnpm seed` áp dụng.

const tempDirs: string[] = [];
afterAll(async () => {
  await Promise.all(tempDirs.map((d) => rm(d, { recursive: true, force: true })));
});

describe('nội dung N5 và bộ placement trong content/', () => {
  it('toàn bộ nội dung hợp lệ theo JSON Schema và quy tắc nội dung', async () => {
    const content = await loadContent();
    const issues = await validateContent(content);
    expect(formatIssues(issues)).toBe('');
  });

  it('có ≥ 1 đơn vị 5 phút cho mỗi N5 × kind và ≥ 1 đơn vị foundation 5 phút cho mỗi kind', async () => {
    const { units } = await loadContent();
    for (const kind of ['vocabulary', 'grammar'] as const) {
      expect(units.some((u) => u.level === 'N5' && u.kind === kind && u.estMinutes === 5)).toBe(
        true,
      );
      expect(
        units.some(
          (u) =>
            u.level === 'N5' && u.kind === kind && u.tier === 'foundation' && u.estMinutes === 5,
        ),
      ).toBe(true);
    }
  });

  it('mỗi trình độ N5/N4/N3 × kind có ≥ 1 đơn vị 5 phút (T114, FR-017)', async () => {
    const { units } = await loadContent();
    for (const level of ['N5', 'N4', 'N3'] as const) {
      for (const kind of ['vocabulary', 'grammar'] as const) {
        expect(
          units.some((u) => u.level === level && u.kind === kind && u.estMinutes === 5),
          `${level} × ${kind}`,
        ).toBe(true);
      }
    }
  });

  it('mỗi mảng N4 và N3 có ít nhất một đơn vị và đơn vị N4/N3 là tier core', async () => {
    const { topics, units } = await loadContent();
    const used = new Set(units.map((u) => u.topic));
    for (const t of topics.filter((x) => x.level !== 'N5')) {
      expect(used.has(t.key), `mảng ${t.key}`).toBe(true);
    }
    for (const u of units.filter((x) => x.level !== 'N5')) expect(u.tier).toBe('core');
  });

  it('tập dùng thử gồm 1 từ vựng + 1 ngữ pháp, tổng ≤ 10 phút (FR-037)', async () => {
    const { units } = await loadContent();
    const trial = units.filter((u) => u.isTrial);
    expect(trial.map((u) => u.kind).sort()).toEqual(['grammar', 'vocabulary']);
    expect(trial.reduce((s, u) => s + u.estMinutes, 0)).toBeLessThanOrEqual(10);
  });

  it('bộ placement đúng 20 câu: 8 N5, 6 N4, 6 N3, vị trí 1..20', async () => {
    const { placement } = await loadContent();
    const count = (level: string) => placement.questions.filter((q) => q.level === level).length;
    expect(placement.questions).toHaveLength(20);
    expect([count('N5'), count('N4'), count('N3')]).toEqual([8, 6, 6]);
    expect(placement.questions.map((q) => q.position).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 1),
    );
    // Hồ sơ đại diện giả định N5 ở vị trí 1–8, N4 ở 9–14, N3 ở 15–20.
    for (const q of placement.questions) {
      const expected = q.position <= 8 ? 'N5' : q.position <= 14 ? 'N4' : 'N3';
      expect(q.level).toBe(expected);
    }
  });

  it('mỗi mảng có ít nhất một câu placement hoặc một đơn vị tham chiếu tới (không có mảng mồ côi N5)', async () => {
    const { topics, units, placement } = await loadContent();
    const used = new Set([
      ...units.map((u) => u.topic),
      ...placement.questions.map((q) => q.topic),
    ]);
    for (const t of topics.filter((x) => x.level === 'N5')) expect(used.has(t.key)).toBe(true);
  });
});

describe('validateContent phát hiện nội dung sai', () => {
  async function withMutation(
    mutate: (dir: string) => Promise<void>,
  ): Promise<{ content: LoadedContent; dir: string }> {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'content-'));
    tempDirs.push(dir);
    await cp(DEFAULT_CONTENT_DIR, dir, { recursive: true });
    await mutate(dir);
    return { content: await loadContent(dir), dir };
  }

  it('báo thiếu bản dịch tiếng Anh theo JSON Schema', async () => {
    const { content, dir } = await withMutation(async (d) => {
      const file = path.join(d, 'units', 'n5-vocabulary-greetings.json');
      const doc = JSON.parse(await readFile(file, 'utf8'));
      delete doc.title.en;
      await writeFile(file, JSON.stringify(doc));
    });
    const messages = formatIssues(await validateContent(content, dir));
    expect(messages).toContain('n5-vocabulary-greetings.json');
    expect(messages).toContain('en');
  });

  it('báo bộ placement sai số lượng theo trình độ', async () => {
    const { content, dir } = await withMutation(async (d) => {
      const file = path.join(d, 'placement', 'placement-v1.json');
      const doc = JSON.parse(await readFile(file, 'utf8'));
      doc.questions[8].level = 'N5'; // 9 câu N5, 5 câu N4
      await writeFile(file, JSON.stringify(doc));
    });
    const messages = formatIssues(await validateContent(content, dir));
    expect(messages).toContain('cần đúng 8 câu N5, hiện có 9');
    expect(messages).toContain('cần đúng 6 câu N4, hiện có 5');
  });

  it('báo mảng không tồn tại và bài tập trỏ tới mục không có', async () => {
    const { content, dir } = await withMutation(async (d) => {
      const file = path.join(d, 'units', 'n5-grammar-particles.json');
      const doc = JSON.parse(await readFile(file, 'utf8'));
      doc.topic = 'khong-ton-tai';
      doc.exercises[0].item = 'không có mục này';
      await writeFile(file, JSON.stringify(doc));
    });
    const messages = formatIssues(await validateContent(content, dir));
    expect(messages).toContain('không có mảng "khong-ton-tai"');
    expect(messages).toContain('không có mục "không có mục này"');
  });
});

// --- Thư viện Kanji (spec 003: T019, FR-006, FR-011, SC-004) ---

describe('thư viện Kanji trong content/', () => {
  const SECONDS_PER_EXERCISE = 30;
  const kanjiUnits = async () =>
    (await loadContent()).units.filter((u) => u.file.includes('-kanji-'));

  it('mọi file *-kanji-*.json là đơn vị kind=kanji hợp lệ theo schema 1.1.0 và quy tắc nội dung', async () => {
    const content = await loadContent();
    const units = content.units.filter((u) => u.file.includes('-kanji-'));
    expect(units).toHaveLength(7);
    for (const u of units) expect(u.kind, u.file).toBe('kanji');
    expect(formatIssues(await validateContent(content))).toBe('');
  });

  it('mọi ký tự của japanese và examples[].ja có glyph trong phông (FR-006)', async () => {
    for (const u of await kanjiUnits()) {
      for (const item of u.items) {
        expect(findMissingGlyphs(item.japanese), `${u.file}: ${item.japanese}`).toEqual([]);
        for (const ex of item.examples ?? []) {
          expect(findMissingGlyphs(ex.ja), `${u.file}: ${ex.ja}`).toEqual([]);
        }
      }
    }
  });

  it('mỗi trình độ N5, N4, N3 có ≥ 1 bài Kanji 5 phút (SC-004)', async () => {
    const units = await kanjiUnits();
    for (const level of ['N5', 'N4', 'N3'] as const) {
      expect(
        units.some((u) => u.level === level && u.estMinutes === 5),
        level,
      ).toBe(true);
    }
  });

  it('mỗi bài Kanji có goalTags không rỗng, tier core, 3–5 chữ (FR-011)', async () => {
    for (const u of await kanjiUnits()) {
      expect(u.goalTags?.length ?? 0, u.file).toBeGreaterThan(0);
      expect(u.tier ?? 'core', u.file).toBe('core');
      expect(u.items.length, u.file).toBeGreaterThanOrEqual(3);
      expect(u.items.length, u.file).toBeLessThanOrEqual(5);
    }
  });

  it('không chữ Kanji nào xuất hiện ở hai bài (research K10 "chữ duy nhất")', async () => {
    const seen = new Map<string, string>();
    for (const u of await kanjiUnits()) {
      for (const item of u.items) {
        expect(seen.get(item.japanese), `${item.japanese} ở ${u.file}`).toBeUndefined();
        seen.set(item.japanese, u.file);
      }
    }
    expect(seen.size).toBe(27);
  });

  it('số bài tập mỗi bài nằm trong quỹ thời lượng estMinutes (30 giây/câu)', async () => {
    for (const u of await kanjiUnits()) {
      expect(u.exercises.length * SECONDS_PER_EXERCISE, u.file).toBeLessThanOrEqual(
        u.estMinutes * 60,
      );
    }
  });

  it('mỗi chữ có đủ bài tập cho ba khía cạnh nghĩa, cách đọc, từ chứa chữ', async () => {
    for (const u of await kanjiUnits()) {
      for (const item of u.items) {
        for (const facet of ['meaning', 'reading', 'word']) {
          expect(
            u.exercises.some((e) => e.item === item.japanese && e.facet === facet),
            `${u.file}: ${item.japanese} × ${facet}`,
          ).toBe(true);
        }
      }
    }
  });

  it('không có nội dung luyện viết tay/thứ tự nét (ngoài phạm vi Giai đoạn 1)', async () => {
    for (const u of await kanjiUnits()) {
      const text = JSON.stringify(u.exercises).toLowerCase();
      expect(text, u.file).not.toMatch(/thứ tự nét|viết tay|stroke order|handwriting/);
    }
  });

  it('mọi file đơn vị cũ (từ vựng, ngữ pháp) vẫn hợp lệ với schema 1.1.0', async () => {
    const content = await loadContent();
    const old = { ...content, units: content.units.filter((u) => !u.file.includes('-kanji-')) };
    expect(formatIssues(await validateContent(old))).not.toContain('schema');
    for (const u of old.units) expect(['vocabulary', 'grammar']).toContain(u.kind);
  });

  async function validateMutated(mutate: (unitsDir: string) => Promise<void>): Promise<string> {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'content-kanji-'));
    tempDirs.push(dir);
    await cp(DEFAULT_CONTENT_DIR, dir, { recursive: true });
    await mutate(path.join(dir, 'units'));
    return formatIssues(await validateContent(await loadContent(dir), dir));
  }

  it('báo lỗi khi một chữ thiếu bài tập cho một khía cạnh', async () => {
    const messages = await validateMutated(async (units) => {
      const file = path.join(units, 'n5-kanji-numbers-1.json');
      const doc = JSON.parse(await readFile(file, 'utf8'));
      doc.exercises = doc.exercises.filter(
        (e: { item?: string; facet?: string }) => !(e.item === '二' && e.facet === 'reading'),
      );
      await writeFile(file, JSON.stringify(doc));
    });
    expect(messages).toContain('n5-kanji-numbers-1.json.exercises');
    expect(messages).toContain('二');
    expect(messages).toContain('reading');
  });

  it('báo lỗi khi cùng một chữ nằm ở hai bài', async () => {
    const messages = await validateMutated(async (units) => {
      const file = path.join(units, 'n5-kanji-numbers-2.json');
      const doc = JSON.parse(await readFile(file, 'utf8'));
      // Đổi 四 thành 三 (đã có ở bài số đếm 1) trong mục và bài tập.
      doc.items[0].japanese = '三';
      for (const e of doc.exercises) if (e.item === '四') e.item = '三';
      await writeFile(file, JSON.stringify(doc));
    });
    expect(messages).toContain('三');
    expect(messages).toMatch(/hai đơn vị|đã có ở bài/);
  });

  it('báo lỗi khi bài Kanji thiếu goalTags', async () => {
    const messages = await validateMutated(async (units) => {
      const file = path.join(units, 'n4-kanji-people-body.json');
      const doc = JSON.parse(await readFile(file, 'utf8'));
      doc.goalTags = [];
      await writeFile(file, JSON.stringify(doc));
    });
    expect(messages).toContain('n4-kanji-people-body.json');
    expect(messages).toContain('goalTags');
  });

  it('báo lỗi khi chữ Kanji nằm ngoài phông', async () => {
    const messages = await validateMutated(async (units) => {
      const file = path.join(units, 'n3-kanji-work.json');
      const doc = JSON.parse(await readFile(file, 'utf8'));
      doc.items[0].examples[0].ja = `${doc.items[0].japanese}\u{20000}`;
      await writeFile(file, JSON.stringify(doc));
    });
    expect(messages).toContain('glyph');
  });
});
