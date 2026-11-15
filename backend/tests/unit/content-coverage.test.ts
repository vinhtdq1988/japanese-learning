import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { checkFinalThresholds } from '../../src/domain/content-scope.js';
import { DEFAULT_CONTENT_DIR } from '../../src/seed/content.js';
import {
  computeCoverage,
  computeStats,
  formatCoverageTable,
  formatStatsTable,
  parseArgs,
  runCoverageCli,
} from '../../src/seed/coverage.js';
import { lintLibrary, runLintCli } from '../../src/seed/lint.js';
import {
  contentDirWithSyntheticRelease,
  copyContentDir,
  syntheticFileName,
  syntheticVocabUnit,
} from '../fixtures/synthetic-content.js';

// Kiểm thử độ phủ trên `content/` THẬT (spec 008, T015) cùng CLI `content:coverage` / `content:lint`.
// Mức bất biến luôn chạy; ngưỡng nghiệm thu `--final` chỉ chạy khi đặt COVERAGE_FINAL=1 (đợt 014).

const tempDirs: string[] = [];
afterAll(async () => {
  await Promise.all(tempDirs.map((d) => rm(d, { recursive: true, force: true })));
});

describe('độ phủ trên content/ thật (releases: all)', () => {
  it('bất biến luôn đạt: scopeRef hợp lệ, mục chính duy nhất, exclude.reason không rỗng, khóa không trùng', async () => {
    const { report, scopeIssues } = await computeCoverage(DEFAULT_CONTENT_DIR, { releases: 'all' });
    expect(scopeIssues).toEqual([]);
    expect(report.violations).toEqual([]);
  });

  it('có đủ 8 ô loại × trình độ và số liệu nhất quán (tổng = phủ + loại trừ + chưa phủ)', async () => {
    const { report } = await computeCoverage(DEFAULT_CONTENT_DIR, { releases: 'all' });
    expect(report.byKindLevel.map((c) => `${c.kind}-${c.level}`).sort()).toEqual(
      [
        'grammar-N3',
        'grammar-N4',
        'kanji-N3',
        'kanji-N4',
        'reading-N3',
        'reading-N4',
        'vocabulary-N3',
        'vocabulary-N4',
      ].sort(),
    );
    for (const cell of report.byKindLevel) {
      expect(cell.covered + cell.excluded + cell.uncovered, `${cell.kind} ${cell.level}`).toBe(
        cell.total,
      );
      expect(cell.percent).toBeGreaterThanOrEqual(0);
      expect(cell.percent).toBeLessThanOrEqual(1);
    }
    expect(report.uncovered.length).toBe(report.byKindLevel.reduce((s, c) => s + c.uncovered, 0));
  });

  it('id dòng danh mục duy nhất và khóa duy nhất theo loại trong toàn bộ danh mục thật', async () => {
    const { content } = await computeCoverage(DEFAULT_CONTENT_DIR, { releases: 'all' });
    const ids = new Set<string>();
    const keys = new Set<string>();
    for (const scope of content.scopes.filter((s) => !s.reference)) {
      for (const row of scope.rows) {
        expect(ids.has(row.id), row.id).toBe(false);
        ids.add(row.id);
        if (scope.kind === 'kanji' || scope.kind === 'vocabulary') {
          const k = `${scope.kind}|${row.key}`;
          expect(keys.has(k), k).toBe(false);
          keys.add(k);
        }
        if (row.exclude) expect(row.exclude.reason.trim()).not.toBe('');
      }
    }
  });

  it.runIf(process.env.COVERAGE_FINAL === '1')(
    'ngưỡng --final: ngữ pháp/Kanji ≥ 95%, từ vựng ≥ 90%, 0 chưa phủ (SC-001, SC-002)',
    async () => {
      const { report } = await computeCoverage(DEFAULT_CONTENT_DIR, { releases: 'all' });
      expect(checkFinalThresholds(report)).toEqual([]);
    },
  );
});

describe('CLI content:coverage', () => {
  it('chạy được trên danh mục khung và thoát 0; bảng có đủ cột và 8 hàng', async () => {
    const lines: string[] = [];
    const code = await runCoverageCli([], (l) => lines.push(l));
    expect(code).toBe(0);
    const table = lines.join('\n');
    expect(table).toContain('LOẠI');
    expect(table).toContain('CHƯA PHỦ');
    expect(table).toContain('NGƯỠNG');
    expect(
      table.split('\n').filter((l) => /^(grammar|vocabulary|kanji|reading)\s/.test(l)),
    ).toHaveLength(8);
  });

  it('--final thoát 1 khi thư viện chưa đạt ngưỡng (không nghiệm thu khống)', async () => {
    const lines: string[] = [];
    const code = await runCoverageCli(['--final'], (l) => lines.push(l));
    expect(code).toBe(1);
    expect(lines.join('\n')).toMatch(/Chưa đạt nghiệm thu|danh mục rỗng/);
  });

  it('--kind/--level lọc bảng; --list-uncovered liệt kê dòng chưa phủ', async () => {
    const lines: string[] = [];
    const code = await runCoverageCli(
      ['--kind', 'grammar', '--level', 'n4', '--list-uncovered'],
      (l) => lines.push(l),
    );
    expect(code).toBe(0);
    const out = lines.join('\n');
    expect(out.split('\n').filter((l) => /^(grammar|vocabulary|kanji|reading)\s/.test(l))).toEqual([
      expect.stringMatching(/^grammar\s+N4/),
    ]);
    expect(out).toMatch(/Chưa phủ \(\d+\)/);
  });

  it('--stats in số đơn vị/phút/mục/chủ đề theo loại × trình độ × thời lượng và so với D17', async () => {
    const lines: string[] = [];
    expect(await runCoverageCli(['--stats'], (l) => lines.push(l))).toBe(0);
    const out = lines.join('\n');
    expect(out).toContain('5 PHÚT');
    expect(out).toContain('10 PHÚT');
    expect(out).toContain('MỤC TIÊU D17');
  });

  it('thống kê trên thư viện thật khớp tổng số đơn vị', async () => {
    const { content } = await computeCoverage(DEFAULT_CONTENT_DIR, { releases: 'all' });
    const cells = computeStats(content);
    expect(cells.reduce((s, c) => s + c.units, 0)).toBe(content.units.length);
    expect(cells.reduce((s, c) => s + c.minutes, 0)).toBe(
      content.units.reduce((s, u) => s + u.estMinutes, 0),
    );
    expect(formatStatsTable(cells)).toContain('vocabulary');
  });

  it('tham số sai bị từ chối; --level chỉ nhận N4/N3', () => {
    expect(() => parseArgs(['--kind', 'writing'])).toThrow(/--kind/);
    expect(() => parseArgs(['--level', 'N5'])).toThrow(/--level/);
    expect(() => parseArgs(['--khong-co'])).toThrow(/không hợp lệ/);
    expect(parseArgs(['--final', '--list-uncovered']).final).toBe(true);
  });

  it('báo cáo trên thư mục có danh mục thật được điền: phủ, loại trừ và vi phạm hiện ra trong bảng', async () => {
    const dir = await copyContentDir(tempDirs);
    const file = path.join(dir, 'scope', 'n4-grammar.json');
    const scope = JSON.parse(await readFile(file, 'utf8'));
    scope.sources = { s1: { name: 'Nguồn thử', note: 'Phạm vi thử' } };
    scope.rows = [
      { id: 'g-n4-901', key: '〜ために', label: { vi: 'để', en: 'in order to' }, sources: ['s1'] },
      {
        id: 'g-n4-902',
        key: '〜ものだ',
        label: { vi: 'x', en: 'y' },
        sources: ['s1'],
        exclude: { reason: 'Thuộc N2' },
      },
    ];
    await writeFile(file, JSON.stringify(scope));
    const { report } = await computeCoverage(dir, { releases: 'all' });
    const table = formatCoverageTable(report, { kind: 'grammar', level: 'N4' });
    expect(table).toMatch(/grammar\s+N4\s+2\s+0\s+1\s+1/);
    expect(report.excluded).toEqual([{ id: 'g-n4-902', key: '〜ものだ', reason: 'Thuộc N2' }]);
  });
});

describe('CLI content:lint', () => {
  it('thư viện thật sạch: 0 lỗi, mã thoát 0; cảnh báo còn lại chỉ thuộc AU3/AU13', async () => {
    const lines: string[] = [];
    expect(await runLintCli([], (l) => lines.push(l))).toBe(0);
    expect(lines.at(-1)).toMatch(/^Tổng: 0 lỗi, \d+ cảnh báo\.$/);
    // AU3 (ví dụ không chứa nguyên văn mẫu ngữ pháp dạng 〜) được chấp nhận ở `notes` của manifest đợt.
    const warnings = lines.filter((l) => l.startsWith('CẢNH BÁO'));
    expect(warnings.filter((l) => !l.includes('AU3:'))).toEqual([]);
  });

  it('--final báo AU18 (thiếu đơn vị đọc/viết) và thoát 1', async () => {
    const lines: string[] = [];
    expect(await runLintCli(['--final'], (l) => lines.push(l))).toBe(1);
    expect(lines.join('\n')).toContain('AU18');
  });

  it('tham số lạ bị từ chối', async () => {
    await expect(runLintCli(['--bay-ba'])).rejects.toThrow(/không hợp lệ/);
  });

  it('--drafts kiểm bản nháp ở drafts/<đợt>/ mà không nạp chúng', async () => {
    const dir = await copyContentDir(tempDirs);
    const draftDir = path.join(dir, 'drafts', '001-synthetic');
    await mkdir(draftDir, { recursive: true });
    const bad = syntheticVocabUnit(0);
    (bad.items[0] as { examples: { reading: string }[] }).examples[0]!.reading = 'あさ食べる';
    await writeFile(path.join(draftDir, syntheticFileName(0)), JSON.stringify(bad));
    await writeFile(
      path.join(draftDir, syntheticFileName(1)),
      JSON.stringify(syntheticVocabUnit(1)),
    );

    const withoutDrafts = await lintLibrary(dir);
    expect(withoutDrafts.errors).toEqual([]);
    expect(withoutDrafts.draftFiles).toEqual([]);

    const run = await lintLibrary(dir, { drafts: true });
    expect(run.draftFiles.sort()).toEqual([syntheticFileName(0), syntheticFileName(1)]);
    const messages = run.errors.map((e) => `${e.path}: ${e.message}`).join('\n');
    expect(messages).toContain(`${syntheticFileName(0)}.items[0].examples[0].reading`);
    expect(messages).toContain('AU1');
    expect(messages).not.toContain(syntheticFileName(1));
  });

  it('--drafts báo bản nháp trùng mục chính với đơn vị đã duyệt và trùng tên file với units/', async () => {
    const dir = await contentDirWithSyntheticRelease(1, tempDirs);
    const draftDir = path.join(dir, 'drafts', '002-synthetic');
    await mkdir(draftDir, { recursive: true });
    // Nháp trùng TÊN FILE với đơn vị đã duyệt.
    await writeFile(
      path.join(draftDir, syntheticFileName(0)),
      JSON.stringify(syntheticVocabUnit(0)),
    );
    // Nháp khác tên nhưng cùng từ (mục chính trùng) và cùng sequence.
    const dup = syntheticVocabUnit(0, { title: { vi: 'Bản nháp trùng', en: 'Draft duplicate' } });
    await writeFile(path.join(draftDir, 'n4-vocabulary-synthetic-09.json'), JSON.stringify(dup));
    const run = await lintLibrary(dir, { drafts: true });
    const messages = run.errors.map((e) => `${e.path}: ${e.message}`).join('\n');
    expect(messages).toContain('trùng tên file với đơn vị đã duyệt');
    expect(messages).toContain('AU7');
    expect(messages).toContain('AU9');
  });
});
