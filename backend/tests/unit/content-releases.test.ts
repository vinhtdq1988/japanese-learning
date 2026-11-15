import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { formatIssues } from '../../src/domain/content-validation.js';
import {
  BASELINE_UNIT_COUNT,
  loadContent,
  resolveReleaseSelection,
  validateContent,
  validateReleases,
  type ReleaseFile,
} from '../../src/seed/content.js';
import {
  contentDirWithSyntheticRelease,
  copyContentDir,
  syntheticFileName,
  syntheticRelease,
  syntheticVocabUnit,
  writeSyntheticRelease,
} from '../fixtures/synthetic-content.js';

// Kiểm thử đợt phát hành đóng kín (spec 008, T011; release-manifest.md §3: M1…M7 và §5: chọn đợt).

const tempDirs: string[] = [];
afterAll(async () => {
  await Promise.all(tempDirs.map((d) => rm(d, { recursive: true, force: true })));
});

const messagesOf = async (dir: string, releases: 'all' | string[] = 'all'): Promise<string> =>
  formatIssues(await validateContent(await loadContent(dir, { releases }), dir));

describe('đợt tổng hợp hợp lệ', () => {
  it('không lỗi; đơn vị chỉ được nạp khi đợt của nó được chọn', async () => {
    const dir = await contentDirWithSyntheticRelease(2, tempDirs);
    expect(await messagesOf(dir)).toBe('');
    const all = await loadContent(dir, { releases: 'all' });
    expect(all.units).toHaveLength(35);
    expect(all.selectedReleases).toEqual(['000-baseline', '001-synthetic']);
    const baselineOnly = await loadContent(dir, { releases: ['000-baseline'] });
    expect(baselineOnly.units).toHaveLength(33);
    expect(baselineOnly.units.map((u) => u.file)).not.toContain(syntheticFileName(0));
    // Chọn một đợt không làm mất cờ kiểm tra file mồ côi: unitFiles luôn đủ.
    expect(baselineOnly.unitFiles).toHaveLength(35);
    expect(await messagesOf(dir, ['000-baseline'])).toBe('');
    const only = await loadContent(dir, { releases: ['001-synthetic'] });
    expect(only.units.map((u) => u.file)).toEqual([syntheticFileName(0), syntheticFileName(1)]);
  });

  it('chọn đợt không có thật thì báo lỗi rõ ràng', async () => {
    const dir = await copyContentDir(tempDirs);
    await expect(loadContent(dir, { releases: ['999-khong-co'] })).rejects.toThrow(/999-khong-co/);
  });
});

describe('M1 – đóng kín: file mồ côi', () => {
  it('file trong units/ không thuộc manifest nào ⇒ lỗi', async () => {
    const dir = await copyContentDir(tempDirs);
    await writeFile(
      path.join(dir, 'units', 'n4-vocabulary-orphan-01.json'),
      JSON.stringify(syntheticVocabUnit(0)),
    );
    const messages = await messagesOf(dir);
    expect(messages).toContain('M1');
    expect(messages).toContain('n4-vocabulary-orphan-01.json');
  });

  it('mồ côi bị bắt kể cả khi chỉ chọn đợt baseline (không chọn thì không được lọt)', async () => {
    const dir = await copyContentDir(tempDirs);
    await writeFile(path.join(dir, 'units', 'n4-vocabulary-orphan-01.json'), '{}');
    expect(await messagesOf(dir, ['000-baseline'])).toContain('M1');
  });

  it('một file nằm ở hai manifest ⇒ lỗi', async () => {
    const dir = await contentDirWithSyntheticRelease(1, tempDirs);
    await writeSyntheticRelease(dir, syntheticRelease('002-copy', 1), {});
    const messages = await messagesOf(dir);
    expect(messages).toContain('M1');
    expect(messages).toContain('nhiều manifest');
  });
});

describe('M2 – manifest trỏ file không tồn tại', () => {
  it('báo đường dẫn manifest và tên file thiếu', async () => {
    const dir = await copyContentDir(tempDirs);
    await writeSyntheticRelease(dir, syntheticRelease('001-missing', 1), {});
    const messages = await messagesOf(dir);
    expect(messages).toContain('M2');
    expect(messages).toContain('releases/001-missing.json.units[0].file');
    expect(messages).toContain(syntheticFileName(0));
  });
});

describe('M3 – hồ sơ duyệt (đợt không phải baseline)', () => {
  const withRef = async (patch: Record<string, unknown>): Promise<string> => {
    const dir = await copyContentDir(tempDirs);
    const release = syntheticRelease('001-synthetic', 1);
    release.units[0] = { ...release.units[0]!, ...patch } as ReleaseFile['units'][number];
    await writeSyntheticRelease(dir, release, { [syntheticFileName(0)]: syntheticVocabUnit(0) });
    return messagesOf(dir);
  };

  it('thiếu reviewer ⇒ lỗi', async () => {
    expect(await withRef({ reviewer: '' })).toContain('M3');
  });

  it('thiếu reviewedOn hoặc reviewedOn sau ngày đợt ⇒ lỗi', async () => {
    expect(await withRef({ reviewedOn: undefined })).toContain('M3');
    const late = await withRef({ reviewedOn: '2027-01-01' });
    expect(late).toContain('M3');
    expect(late).toContain('không được sau ngày đợt');
  });

  it('checklist khác true ⇒ lỗi', async () => {
    expect(await withRef({ checklist: false })).toContain('M3');
    expect(await withRef({ checklist: undefined })).toContain('M3');
  });

  it('baseline được MIỄN reviewer/reviewedOn/checklist (hồ sơ lịch sử)', async () => {
    const dir = await copyContentDir(tempDirs);
    const baseline = JSON.parse(
      await readFile(path.join(dir, 'releases', '000-baseline.json'), 'utf8'),
    ) as ReleaseFile;
    expect(baseline.units.every((u) => u.reviewer === undefined)).toBe(true);
    expect(await messagesOf(dir)).toBe('');
  });
});

describe('M4 – id, ngày, nguồn', () => {
  it('id trùng giữa hai manifest hoặc không khớp tên file ⇒ lỗi', async () => {
    const dir = await copyContentDir(tempDirs);
    await writeFile(
      path.join(dir, 'releases', '001-a.json'),
      JSON.stringify(syntheticRelease('001-a', 0)),
    );
    await writeFile(
      path.join(dir, 'releases', '001-b.json'),
      JSON.stringify(syntheticRelease('001-a', 0)),
    );
    const messages = await messagesOf(dir);
    expect(messages).toContain('M4');
    expect(messages).toContain('trùng');
    expect(messages).toContain('phải khớp tên file');
  });

  it('đợt không phải baseline thiếu sources ⇒ lỗi', async () => {
    const dir = await copyContentDir(tempDirs);
    await writeSyntheticRelease(dir, syntheticRelease('001-nosrc', 0, { sources: [] }), {});
    expect(await messagesOf(dir)).toContain('sources');
  });

  it('ngày không hợp lệ (30/02) ⇒ lỗi', async () => {
    const dir = await copyContentDir(tempDirs);
    await writeSyntheticRelease(dir, syntheticRelease('001-date', 0, { date: '2026-02-30' }), {});
    expect(await messagesOf(dir)).toContain('M4');
  });
});

describe('M5 – baseline đúng 33 file', () => {
  it(`hằng số BASELINE_UNIT_COUNT = ${BASELINE_UNIT_COUNT} và manifest thật khớp`, async () => {
    expect(BASELINE_UNIT_COUNT).toBe(33);
    const content = await loadContent(undefined, { releases: ['000-baseline'] });
    expect(content.units).toHaveLength(33);
    const levels = content.units.reduce<Record<string, number>>((acc, u) => {
      acc[u.level] = (acc[u.level] ?? 0) + 1;
      return acc;
    }, {});
    expect(levels).toEqual({ N5: 13, N4: 10, N3: 10 });
  });

  it('baseline liệt kê thiếu một file ⇒ lỗi (kể cả file trở thành mồ côi)', async () => {
    const dir = await copyContentDir(tempDirs);
    const file = path.join(dir, 'releases', '000-baseline.json');
    const doc = JSON.parse(await readFile(file, 'utf8')) as ReleaseFile;
    doc.units.pop();
    await writeFile(file, JSON.stringify(doc));
    const messages = await messagesOf(dir);
    expect(messages).toContain('M5');
    expect(messages).toContain('đúng 33 file');
    expect(messages).toContain('M1');
  });

  it('manifest khác đặt baseline: true ⇒ lỗi', async () => {
    const dir = await copyContentDir(tempDirs);
    await writeSyntheticRelease(dir, syntheticRelease('001-fake', 0, { baseline: true }), {});
    expect(await messagesOf(dir)).toContain('chỉ đợt 000-baseline');
  });

  it('thiếu đợt 000-baseline ⇒ lỗi', async () => {
    const dir = await copyContentDir(tempDirs);
    await rm(path.join(dir, 'releases', '000-baseline.json'));
    const messages = await messagesOf(dir);
    expect(messages).toContain('thiếu đợt 000-baseline');
    expect(messages).toContain('M1');
  });

  it('validateReleases là hàm thuần: nhận manifest và danh sách file', () => {
    const baseline: ReleaseFile = {
      file: '000-baseline.json',
      id: '000-baseline',
      date: '2026-11-14',
      title: { vi: 'a', en: 'b' },
      baseline: true,
      units: Array.from({ length: 33 }, (_, i) => ({ file: `u${i}.json` })),
    };
    const files = baseline.units.map((u) => u.file);
    expect(validateReleases([baseline], files)).toEqual([]);
    expect(validateReleases([baseline], [...files, 'extra.json']).map((i) => i.message)).toEqual([
      expect.stringContaining('M1'),
    ]);
  });
});

describe('M6 – amendments', () => {
  const kanjiUnit = 'n4-kanji-nature.json';

  const withAmendment = async (amendment: unknown): Promise<string> => {
    const dir = await copyContentDir(tempDirs);
    await writeSyntheticRelease(
      dir,
      syntheticRelease('001-amend', 0, { amendments: [amendment] }),
      {},
    );
    return messagesOf(dir);
  };

  const firstKanji = async (): Promise<{ title: string; char: string }> => {
    const doc = JSON.parse(
      await readFile(path.join(process.cwd(), '..', 'content', 'units', kanjiUnit), 'utf8'),
    ) as { title: { en: string }; items: { japanese: string }[] };
    return { title: doc.title.en, char: doc.items[0]!.japanese };
  };

  it('đơn vị đích không tồn tại ⇒ lỗi', async () => {
    const messages = await withAmendment({
      unit: { kind: 'kanji', level: 'N4', titleEn: 'Không có đơn vị này' },
      item: '山',
      add: { onReadings: ['サン'] },
    });
    expect(messages).toContain('M6');
    expect(messages).toContain('Không có đơn vị này');
  });

  it('chữ đích không có trong đơn vị ⇒ lỗi', async () => {
    const { title } = await firstKanji();
    const messages = await withAmendment({
      unit: { kind: 'kanji', level: 'N4', titleEn: title },
      item: '龍',
      add: { onReadings: ['リュウ'] },
    });
    expect(messages).toContain('M6');
    expect(messages).toContain('龍');
  });

  it('bổ sung hợp lệ (thêm âm On) ⇒ không lỗi', async () => {
    const { title, char } = await firstKanji();
    const messages = await withAmendment({
      unit: { kind: 'kanji', level: 'N4', titleEn: title },
      item: char,
      add: { onReadings: ['ゾウ'] },
    });
    expect(messages).toBe('');
  });

  it('thêm quá nhiều bài tập làm vượt quỹ thời lượng ⇒ lỗi nêu phương án ở notes', async () => {
    const { title, char } = await firstKanji();
    const extra = Array.from({ length: 40 }, (_, i) => ({
      facet: 'word',
      type: 'multiple_choice',
      prompt: { vi: `Câu hỏi thêm ${i}`, en: `Extra question ${i}` },
      payload: { choices: ['あ', 'い'], correct_index: 0 },
      feedbackCorrect: { vi: 'Đúng rồi, chọn あ.', en: 'Correct, pick あ.' },
      feedbackIncorrect: { vi: 'Sai rồi, hãy chọn あ.', en: 'Wrong, pick あ instead.' },
    }));
    const messages = await withAmendment({
      unit: { kind: 'kanji', level: 'N4', titleEn: title },
      item: char,
      add: { exercises: extra },
    });
    expect(messages).toContain('M6');
    expect(messages).toContain('vượt quỹ');
    expect(messages).toContain('notes');
  });
});

describe('M7 – bản nháp không bao giờ được nạp', () => {
  it('file ở drafts/ không vào units dù hợp lệ hay không', async () => {
    const dir = await copyContentDir(tempDirs);
    await mkdir(path.join(dir, 'drafts', '001-synthetic'), { recursive: true });
    await writeFile(
      path.join(dir, 'drafts', '001-synthetic', syntheticFileName(0)),
      JSON.stringify(syntheticVocabUnit(0)),
    );
    await writeFile(path.join(dir, 'drafts', '001-synthetic', 'hong.json'), '{ không phải JSON');
    const content = await loadContent(dir, { releases: 'all' });
    expect(content.units).toHaveLength(33);
    expect(content.unitFiles).toHaveLength(33);
    expect(await messagesOf(dir)).toBe('');
  });

  it('cũng không nạp khi manifest tình cờ trỏ tới tên file chỉ có ở drafts/ (⇒ M2)', async () => {
    const dir = await copyContentDir(tempDirs);
    await mkdir(path.join(dir, 'drafts', '001-synthetic'), { recursive: true });
    await writeFile(
      path.join(dir, 'drafts', '001-synthetic', syntheticFileName(0)),
      JSON.stringify(syntheticVocabUnit(0)),
    );
    await writeSyntheticRelease(dir, syntheticRelease('001-synthetic', 1), {});
    const content = await loadContent(dir, { releases: 'all' });
    expect(content.units.map((u) => u.file)).not.toContain(syntheticFileName(0));
    expect(await messagesOf(dir)).toContain('M2');
  });
});

describe('CONTENT_RELEASES và tham số releases (D7)', () => {
  it('resolveReleaseSelection: vắng mặt = all; all; danh sách; tham số thắng biến môi trường', () => {
    expect(resolveReleaseSelection(undefined, {})).toBe('all');
    expect(resolveReleaseSelection(undefined, { CONTENT_RELEASES: 'all' })).toBe('all');
    expect(resolveReleaseSelection(undefined, { CONTENT_RELEASES: '' })).toBe('all');
    expect(resolveReleaseSelection(undefined, { CONTENT_RELEASES: '000-baseline, 001-x' })).toEqual(
      ['000-baseline', '001-x'],
    );
    expect(resolveReleaseSelection('all', { CONTENT_RELEASES: '000-baseline' })).toBe('all');
    expect(resolveReleaseSelection(['001-x'], { CONTENT_RELEASES: 'all' })).toEqual(['001-x']);
  });

  it('vitest đặt CONTENT_RELEASES=000-baseline nên loadContent mặc định chỉ có 33 đơn vị', async () => {
    const dir = await contentDirWithSyntheticRelease(1, tempDirs);
    expect(process.env.CONTENT_RELEASES).toBe('000-baseline');
    expect((await loadContent(dir)).units).toHaveLength(33);
    expect((await loadContent(dir, { releases: 'all' })).units).toHaveLength(34);
  });

  it('biến môi trường chọn đợt khi không truyền tham số; tham số thắng', async () => {
    const dir = await contentDirWithSyntheticRelease(1, tempDirs);
    const saved = process.env.CONTENT_RELEASES;
    try {
      process.env.CONTENT_RELEASES = 'all';
      expect((await loadContent(dir)).units).toHaveLength(34);
      expect((await loadContent(dir, { releases: ['000-baseline'] })).units).toHaveLength(33);
      process.env.CONTENT_RELEASES = '001-synthetic';
      expect((await loadContent(dir)).units).toHaveLength(1);
      delete process.env.CONTENT_RELEASES;
      expect((await loadContent(dir)).units).toHaveLength(34);
    } finally {
      if (saved === undefined) delete process.env.CONTENT_RELEASES;
      else process.env.CONTENT_RELEASES = saved;
    }
  });

  it('cp mặc định giữ nguyên cấu trúc thư mục (releases/, scope/, drafts/)', async () => {
    const dir = await copyContentDir(tempDirs);
    await cp(dir, `${dir}-copy`, { recursive: true });
    tempDirs.push(`${dir}-copy`);
    const content = await loadContent(`${dir}-copy`, { releases: 'all' });
    expect(content.releases.map((r) => r.id)).toContain('000-baseline');
  });
});
