import { describe, expect, it } from 'vitest';
import {
  checkUnit,
  validateCatalog,
  validateUnit,
  type ContentIssue,
  type ExerciseDraft,
  type ItemDraft,
  type UnitDraft,
  type ValidateUnitOptions,
} from '../../src/domain/content-validation.js';

// Kiểm thử quy tắc nội dung Kanji (T017, research K10, data-model §3.3–§3.5, FR-011, FR-021).

const T = (vi: string, en: string = vi) => ({ vi, en });
const FACETS = ['meaning', 'reading', 'word'] as const;

/** Thông tin chữ hợp lệ mặc định cho từng ký tự (On katakana, Kun hiragana, số nét). */
const DETAILS: Record<string, { on: string[]; kun: string[]; strokes: number; word: string }> = {
  三: { on: ['サン'], kun: ['み', 'み.つ'], strokes: 3, word: '三月' },
  月: { on: ['ゲツ', 'ガツ'], kun: ['つき'], strokes: 4, word: '月曜日' },
  日: { on: ['ニチ', 'ジツ'], kun: ['ひ', 'か'], strokes: 4, word: '日本' },
  四: { on: ['シ'], kun: ['よん'], strokes: 5, word: '四月' },
};

function kanjiItem(ch: string, over: Partial<ItemDraft> = {}): ItemDraft {
  const d = DETAILS[ch]!;
  return {
    japanese: ch,
    meaning: T(`nghĩa ${ch}`, `meaning ${ch}`),
    topic: 'kanji-n5-numbers',
    kanjiDetails: {
      onReadings: d.on,
      kunReadings: d.kun,
      strokeCount: d.strokes,
      components: T('thành phần', 'components'),
    },
    examples: [
      {
        ja: d.word,
        reading: 'よみ',
        kanjiReading: d.on[0],
        translation: T('từ 1', 'word 1'),
      },
      { ja: `${ch}つ`, reading: 'よみ', translation: T('từ 2', 'word 2') },
    ],
    ...over,
  };
}

function exercise(
  itemIndex: number,
  facet: string,
  over: Partial<ExerciseDraft> = {},
): ExerciseDraft {
  return {
    itemIndex,
    facet,
    type: 'multiple_choice',
    prompt: T('đề', 'prompt'),
    payload: { choices: ['a', 'b', 'c'], correct_index: 0 },
    feedbackCorrect: T('đúng', 'right'),
    feedbackIncorrect: T('sai', 'wrong'),
    ...over,
  };
}

/** Bài Kanji hợp lệ: `chars` mục, mỗi chữ đủ 3 khía cạnh. */
function kanjiUnit(chars: string[] = ['三', '月', '日'], over: Partial<UnitDraft> = {}): UnitDraft {
  return {
    kind: 'kanji',
    level: 'N5',
    tier: 'core',
    estMinutes: 5,
    goalTags: ['jlpt'],
    title: T('Bài Kanji', 'Kanji lesson'),
    items: chars.map((c) => kanjiItem(c)),
    exercises: chars.flatMap((_, i) => FACETS.map((f) => exercise(i, f))),
    ...over,
  };
}

const OPTIONS: ValidateUnitOptions = {
  secondsPerExercise: 30,
  topicSkillOf: (ref) => (ref.startsWith('kanji-') ? 'kanji' : 'vocabulary'),
};

const paths = (issues: ContentIssue[]) => issues.map((i) => i.path);
const run = (unit: UnitDraft, options: ValidateUnitOptions = OPTIONS) =>
  validateUnit(unit, options);
const withItem = (unit: UnitDraft, index: number, patch: Partial<ItemDraft>): UnitDraft => ({
  ...unit,
  items: unit.items!.map((it, i) => (i === index ? { ...it, ...patch } : it)),
});

describe('đơn vị Kanji hợp lệ', () => {
  it('bài 3 chữ × 3 khía cạnh (9 câu) cho bài 5 phút không có lỗi', () => {
    expect(run(kanjiUnit())).toEqual([]);
  });

  it('bài 4 chữ 10 phút hợp lệ; số chữ 3–5 là biên hợp lệ', () => {
    expect(run(kanjiUnit(['三', '月', '日', '四'], { estMinutes: 10 }))).toEqual([]);
  });
});

describe('quy tắc mức đơn vị', () => {
  it('2 hoặc 6 mục Kanji active → lỗi items; mục inactive không tính', () => {
    expect(paths(run(kanjiUnit(['三', '月'])))).toContain('items');
    const six = kanjiUnit(['三', '月', '日', '四', '三', '月'], { estMinutes: 15 });
    expect(paths(run(six))).toContain('items');
    const withInactive = kanjiUnit();
    withInactive.items = [...withInactive.items!, { ...kanjiItem('四'), status: 'inactive' }];
    expect(paths(run(withInactive))).not.toContain('items');
  });

  it('tier khác core → lỗi tier', () => {
    expect(paths(run(kanjiUnit(undefined, { tier: 'foundation' })))).toContain('tier');
  });

  it('goalTags rỗng → lỗi goalTags với Kanji; từ vựng/ngữ pháp rỗng vẫn hợp lệ (FR-011)', () => {
    expect(paths(run(kanjiUnit(undefined, { goalTags: [] })))).toContain('goalTags');
    const vocab: UnitDraft = {
      kind: 'vocabulary',
      level: 'N5',
      estMinutes: 5,
      goalTags: [],
      title: T('t'),
      items: [{ japanese: '水', reading: 'みず', meaning: T('nước', 'water') }],
      exercises: [exercise(0, 'item')],
    };
    expect(run(vocab)).toEqual([]);
  });

  it('thiếu bài tập active cho một khía cạnh của một chữ → lỗi exercises nêu chữ và khía cạnh', () => {
    const unit = kanjiUnit();
    unit.exercises = unit.exercises!.filter((e) => !(e.itemIndex === 1 && e.facet === 'reading'));
    const issue = run(unit).find((i) => i.path === 'exercises');
    expect(issue?.message).toContain('月');
    expect(issue?.message).toContain('reading');
  });

  it('bài tập inactive không bù cho khía cạnh còn thiếu', () => {
    const unit = kanjiUnit();
    unit.exercises = unit.exercises!.map((e) =>
      e.itemIndex === 0 && e.facet === 'word' ? { ...e, status: 'inactive' as const } : e,
    );
    expect(run(unit).some((i) => i.path === 'exercises' && i.message.includes('word'))).toBe(true);
  });

  it('bài tập gắn mục Kanji có facet item → lỗi; bài tập không gắn mục có facet khác item → lỗi', () => {
    const linked = kanjiUnit();
    linked.exercises = [...linked.exercises!, exercise(0, 'item')];
    expect(paths(run(linked))).toContain(`exercises[${linked.exercises.length - 1}].facet`);

    const unlinked = kanjiUnit();
    unlinked.exercises = [
      ...unlinked.exercises!,
      exercise(0, 'meaning', {
        itemIndex: null,
        type: 'matching',
        payload: {
          pairs: [
            ['a', 'b'],
            ['c', 'd'],
          ],
        },
      }),
    ];
    expect(paths(run(unlinked))).toContain(`exercises[${unlinked.exercises.length - 1}].facet`);
  });

  it('bài tập không gắn mục với facet item hợp lệ (ghép cặp dùng trong bài)', () => {
    const unit = kanjiUnit(undefined, { estMinutes: 10 });
    unit.exercises = [
      ...unit.exercises!,
      exercise(0, 'item', {
        itemIndex: null,
        type: 'matching',
        payload: {
          pairs: [
            ['三', 'さん'],
            ['月', 'つき'],
          ],
        },
      }),
    ];
    expect(run(unit)).toEqual([]);
  });

  it('bài tập tham chiếu mục qua trường item (japanese) cũng được liên kết (định dạng file nội dung)', () => {
    const unit = kanjiUnit();
    unit.exercises = unit.exercises!.map((e) => {
      const { itemIndex, ...rest } = e;
      return { ...rest, item: unit.items![itemIndex!]!.japanese };
    });
    expect(run(unit)).toEqual([]);
  });

  it('đơn vị từ vựng/ngữ pháp chứa mục Kanji → lỗi; đơn vị Kanji chứa mục từ vựng → lỗi', () => {
    const vocab: UnitDraft = {
      kind: 'vocabulary',
      level: 'N5',
      estMinutes: 5,
      title: T('t'),
      items: [kanjiItem('三', { reading: 'さん' })],
      exercises: [exercise(0, 'item')],
    };
    expect(paths(run(vocab))).toContain('items[0]');
    const mixed = kanjiUnit();
    mixed.items = [
      ...mixed.items!,
      { japanese: '水', reading: 'みず', meaning: T('nước', 'water'), kind: 'vocabulary' },
    ];
    expect(paths(run(mixed))).toContain('items[3]');
  });
});

describe('quy tắc thời lượng (Hiến pháp I)', () => {
  const tenExercises = (n: number) => {
    const unit = kanjiUnit();
    unit.exercises = Array.from({ length: n }, (_, i) =>
      exercise(i % 3, FACETS[Math.floor(i / 3) % 3]!),
    );
    // Bảo đảm đủ 9 tổ hợp chữ × khía cạnh trước, phần dư lặp lại.
    const base = kanjiUnit().exercises!;
    unit.exercises = [
      ...base,
      ...Array.from({ length: Math.max(0, n - 9) }, () => exercise(0, 'meaning')),
    ];
    return unit;
  };

  it('bài 5 phút: 10 bài tập OK, 11 → lỗi exercises (30 giây/câu)', () => {
    expect(run(tenExercises(10))).toEqual([]);
    expect(paths(run(tenExercises(11)))).toContain('exercises');
  });

  it('đổi secondsPerExercise sang 20 thì 15 bài tập OK, 16 → lỗi', () => {
    const opts = { ...OPTIONS, secondsPerExercise: 20 };
    expect(run(tenExercises(15), opts)).toEqual([]);
    expect(paths(run(tenExercises(16), opts))).toContain('exercises');
  });

  it('chỉ tính bài tập active', () => {
    const unit = tenExercises(12);
    unit.exercises = unit.exercises!.map((e, i) =>
      i >= 10 ? { ...e, status: 'inactive' as const } : e,
    );
    expect(run(unit)).toEqual([]);
  });
});

describe('quy tắc mức mục Kanji', () => {
  it.each([
    ['không phải ký tự Kanji', 'あ'],
    ['hai ký tự', '三月'],
    ['rỗng', ''],
    ['chữ latinh', 'A'],
  ])('japanese %s → lỗi items[0].japanese', (_label, value) => {
    expect(paths(run(withItem(kanjiUnit(), 0, { japanese: value })))).toContain(
      'items[0].japanese',
    );
  });

  it('thiếu meaning vi hoặc en → lỗi items[0].meaning', () => {
    const issues = run(withItem(kanjiUnit(), 0, { meaning: { vi: 'ba' } }));
    expect(paths(issues)).toContain('items[0].meaning');
  });

  it('thiếu kanjiDetails → lỗi items[i].kanjiDetails', () => {
    expect(paths(run(withItem(kanjiUnit(), 1, { kanjiDetails: null })))).toContain(
      'items[1].kanjiDetails',
    );
  });

  it('onReadings ∪ kunReadings rỗng → lỗi', () => {
    const unit = withItem(kanjiUnit(), 0, {
      kanjiDetails: { onReadings: [], kunReadings: [], strokeCount: 3 },
    });
    expect(paths(run(unit))).toContain('items[0].kanjiDetails');
  });

  it('chỉ có Kun hoặc chỉ có On đều hợp lệ (trường hợp biên)', () => {
    const onlyKun = withItem(kanjiUnit(), 0, {
      kanjiDetails: { onReadings: [], kunReadings: ['み'], strokeCount: 3 },
    });
    expect(run(onlyKun)).toEqual([]);
  });

  it('On không phải katakana hoặc Kun không phải hiragana → lỗi', () => {
    const badOn = withItem(kanjiUnit(), 0, {
      kanjiDetails: { onReadings: ['さん'], kunReadings: ['み'], strokeCount: 3 },
    });
    expect(paths(run(badOn))).toContain('items[0].kanjiDetails.onReadings');
    const badKun = withItem(kanjiUnit(), 0, {
      kanjiDetails: { onReadings: ['サン'], kunReadings: ['ミ'], strokeCount: 3 },
    });
    expect(paths(run(badKun))).toContain('items[0].kanjiDetails.kunReadings');
  });

  it('Kun cho phép dấu chấm phân cách okurigana', () => {
    const ok = withItem(kanjiUnit(), 0, {
      kanjiDetails: { onReadings: ['サン'], kunReadings: ['た.べる'], strokeCount: 3 },
    });
    expect(run(ok)).toEqual([]);
  });

  it.each([0, 31, 2.5, -1])('strokeCount %s → lỗi', (strokeCount) => {
    const unit = withItem(kanjiUnit(), 0, {
      kanjiDetails: { onReadings: ['サン'], kunReadings: [], strokeCount },
    });
    expect(paths(run(unit))).toContain('items[0].kanjiDetails.strokeCount');
  });

  it('thiếu topicId hoặc chủ đề có skill khác kanji → lỗi items[i].topicId', () => {
    expect(paths(run(withItem(kanjiUnit(), 2, { topic: null })))).toContain('items[2].topicId');
    expect(paths(run(withItem(kanjiUnit(), 2, { topic: 'numbers' })))).toContain(
      'items[2].topicId',
    );
  });

  it('không có từ ví dụ → lỗi; 1 từ ví dụ → chỉ cảnh báo', () => {
    const none = withItem(kanjiUnit(), 0, { examples: [] });
    expect(paths(run(none))).toContain('items[0].examples');

    const one = withItem(kanjiUnit(), 0, { examples: [kanjiItem('三').examples![0]!] });
    const { errors, warnings } = checkUnit(one, OPTIONS);
    expect(errors).toEqual([]);
    expect(paths(warnings)).toContain('items[0].examples');
  });

  it('từ ví dụ không chứa chữ, thiếu reading kana hoặc thiếu bản dịch → lỗi', () => {
    const noChar = withItem(kanjiUnit(), 0, {
      examples: [{ ja: '山', reading: 'やま', translation: T('núi', 'mountain') }],
    });
    expect(paths(run(noChar))).toContain('items[0].examples[0].ja');

    const noReading = withItem(kanjiUnit(), 0, {
      examples: [{ ja: '三月', translation: T('tháng ba', 'March') }],
    });
    expect(paths(run(noReading))).toContain('items[0].examples[0].reading');

    const latinReading = withItem(kanjiUnit(), 0, {
      examples: [{ ja: '三月', reading: 'sangatsu', translation: T('tháng ba', 'March') }],
    });
    expect(paths(run(latinReading))).toContain('items[0].examples[0].reading');

    const noTranslation = withItem(kanjiUnit(), 0, {
      examples: [{ ja: '三月', reading: 'さんがつ', translation: { vi: 'tháng ba' } }],
    });
    expect(paths(run(noTranslation))).toContain('items[0].examples[0].translation');
  });

  it('kanjiReading ngoài tập cách đọc (bỏ okurigana) → chỉ cảnh báo', () => {
    const unit = withItem(kanjiUnit(), 0, {
      examples: [
        {
          ja: '三月',
          reading: 'さんがつ',
          kanjiReading: 'ゲツ',
          translation: T('tháng ba', 'March'),
        },
        { ja: '三つ', reading: 'みっつ', kanjiReading: 'み', translation: T('ba', 'three') },
      ],
    });
    const { errors, warnings } = checkUnit(unit, OPTIONS);
    expect(errors).toEqual([]);
    expect(paths(warnings)).toEqual(['items[0].examples[0].kanjiReading']);
  });

  it('kanjiReading khớp Kun có okurigana sau khi bỏ phần sau dấu chấm', () => {
    const unit = withItem(kanjiUnit(), 0, {
      kanjiDetails: { onReadings: ['サン'], kunReadings: ['み.つ'], strokeCount: 3 },
      examples: [
        { ja: '三つ', reading: 'みっつ', kanjiReading: 'み', translation: T('ba', 'three') },
        {
          ja: '三月',
          reading: 'さんがつ',
          kanjiReading: 'サン',
          translation: T('tháng ba', 'March'),
        },
      ],
    });
    expect(checkUnit(unit, OPTIONS).warnings).toEqual([]);
  });
});

describe('phủ glyph (FR-006, research K9)', () => {
  it('ký tự thiếu glyph trong japanese hoặc ja của ví dụ → lỗi', () => {
    const opts: ValidateUnitOptions = {
      ...OPTIONS,
      missingGlyphs: (text) => [...text].filter((c) => c === '月'),
    };
    const unit = kanjiUnit();
    const issues = run(unit, opts);
    expect(paths(issues)).toContain('items[1].japanese');
    expect(
      issues.some((i) => i.path.startsWith('items[1].examples') && i.message.includes('月')),
    ).toBe(true);
  });

  it('dùng bộ đọc phông thật mặc định: chữ N5–N3 thông dụng đều có glyph', () => {
    expect(run(kanjiUnit())).toEqual([]);
    const missing = withItem(kanjiUnit(), 0, { japanese: '\u{20000}' });
    expect(paths(run(missing))).toContain('items[0].japanese');
  });
});

describe('chữ duy nhất trong danh mục (research K10)', () => {
  const existing = new Map([['三', { unitId: 'u-other', unitSlug: 'n5-kanji-numbers-1' }]]);

  it('chữ đã có ở mục Kanji active của đơn vị khác → lỗi items[i].japanese nêu đơn vị đang chứa', () => {
    const issue = run(kanjiUnit(), { ...OPTIONS, existingKanjiChars: existing }).find(
      (i) => i.path === 'items[0].japanese',
    );
    expect(issue?.message).toContain('n5-kanji-numbers-1');
  });

  it('chữ chỉ có ở đơn vị khác không active (dịch vụ không đưa vào map) hoặc ở chính đơn vị đang kiểm thì hợp lệ', () => {
    expect(run(kanjiUnit(), { ...OPTIONS, existingKanjiChars: new Map() })).toEqual([]);
    const self = new Map([['三', { unitId: 'u-self', unitSlug: 'self' }]]);
    expect(run({ ...kanjiUnit(), id: 'u-self' }, { ...OPTIONS, existingKanjiChars: self })).toEqual(
      [],
    );
  });

  it('mục inactive không bị kiểm tra trùng', () => {
    const unit = kanjiUnit();
    unit.items = [...unit.items!, { ...kanjiItem('三'), status: 'inactive' }];
    expect(run(unit, { ...OPTIONS, existingKanjiChars: new Map() })).toEqual([]);
  });
});

describe('validateCatalog với Kanji', () => {
  const unit = (
    kind: 'vocabulary' | 'grammar' | 'kanji',
    level: 'N5' | 'N4' | 'N3',
    over = {},
  ) => ({
    kind,
    level,
    tier: 'core' as const,
    estMinutes: 5,
    ...over,
  });
  const full = (level: 'N5' | 'N4' | 'N3') => [
    unit('vocabulary', level),
    unit('grammar', level),
    unit('kanji', level),
  ];
  const foundation = [
    unit('vocabulary', 'N5', { tier: 'foundation' }),
    unit('grammar', 'N5', { tier: 'foundation' }),
  ];

  it('đủ bài 5 phút cho mỗi trình độ × kỹ năng (kể cả Kanji) → hợp lệ; Kanji không cần foundation', () => {
    expect(validateCatalog([...foundation, ...full('N5'), ...full('N4'), ...full('N3')])).toEqual(
      [],
    );
  });

  it('thiếu bài Kanji 5 phút ở N5/N4/N3 → lỗi cho từng trình độ', () => {
    const units = [
      ...foundation,
      ...full('N5'),
      ...full('N4').filter((u) => u.kind !== 'kanji'),
      ...full('N3').filter((u) => u.kind !== 'kanji'),
    ];
    const messages = validateCatalog(units).map((i) => i.message);
    expect(messages.some((m) => m.includes('N4') && m.includes('kanji'))).toBe(true);
    expect(messages.some((m) => m.includes('N3') && m.includes('kanji'))).toBe(true);
    expect(messages.some((m) => m.includes('N5') && m.includes('kanji'))).toBe(false);
  });

  it('bài Kanji 10 phút không thay được bài 5 phút', () => {
    const units = [
      ...foundation,
      ...full('N5').map((u) => (u.kind === 'kanji' ? { ...u, estMinutes: 10 } : u)),
    ];
    expect(validateCatalog(units, ['N5']).some((i) => i.message.includes('kanji'))).toBe(true);
  });

  it('hai đơn vị active cùng chứa một chữ → lỗi', () => {
    const withChars = (name: string, chars: string[]) => ({
      ...unit('kanji', 'N5'),
      name,
      items: chars.map((japanese) => ({ japanese })),
    });
    const units = [
      ...foundation,
      unit('vocabulary', 'N5'),
      unit('grammar', 'N5'),
      withChars('n5-kanji-a', ['三', '月']),
      withChars('n5-kanji-b', ['月', '日']),
    ];
    const messages = validateCatalog(units, ['N5']).map((i) => i.message);
    expect(messages.some((m) => m.includes('月') && m.includes('n5-kanji-a'))).toBe(true);
  });
});
