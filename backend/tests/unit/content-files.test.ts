import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { formatIssues } from '../../src/domain/content-validation.js';
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
