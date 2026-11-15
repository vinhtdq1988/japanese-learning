import { describe, expect, it } from 'vitest';
import {
  validateCatalog,
  validateUnit,
  type CatalogDraft,
  type ContentIssue,
  type ExerciseDraft,
  type ItemDraft,
  type UnitDraft,
  type ValidateUnitOptions,
} from '../../src/domain/content-validation.js';

// Kiểm thử quy tắc nội dung luyện đọc/viết PR1…PR9 (T042, contracts/practice-content.md §4).

const T = (vi: string, en: string = vi) => ({ vi, en });

/** Đoạn văn hợp lệ: 31 ký tự (≥ 20, ≤ 200). */
const PASSAGE = '田中さんは毎朝七時に起きます。八時に会社へ行きます。九時から仕事です。';

const OPTIONS: ValidateUnitOptions = {
  topicSkillOf: (ref) =>
    ref.startsWith('kanji-') ? 'kanji' : ref.startsWith('reading-') ? 'reading' : 'writing',
  // Phông giả lập: chỉ chữ 〇 thiếu glyph.
  missingGlyphs: (text) => [...text].filter((c) => c === '〇'),
};

const paths = (issues: ContentIssue[]) => issues.map((i) => i.path);
const run = (unit: UnitDraft, options: ValidateUnitOptions = OPTIONS) =>
  validateUnit(unit, options);

function choice(over: Partial<ExerciseDraft> = {}): ExerciseDraft {
  return {
    type: 'multiple_choice',
    prompt: T('Câu hỏi?', 'Question?'),
    payload: { choices: ['7:00', '8:00', '9:00'], correct_index: 1 },
    feedbackCorrect: T('Đúng!', 'Correct!'),
    feedbackIncorrect: T('Chưa đúng.', 'Not quite.'),
    ...over,
  };
}

/** Bài đọc hợp lệ: 1 đoạn văn, `n` câu hỏi, 5 phút. */
function readingUnit(n = 3, over: Partial<UnitDraft> = {}): UnitDraft {
  return {
    kind: 'reading',
    level: 'N5',
    tier: 'core',
    estMinutes: 5,
    goalTags: ['jlpt'],
    title: T('Đọc: Một ngày', 'Reading: A day'),
    items: [
      {
        kind: 'reading',
        japanese: PASSAGE,
        reading: 'たなかさんはまいあさしちじにおきます。',
        meaning: T('Anh Tanaka mỗi sáng thức dậy lúc 7 giờ.', 'Mr. Tanaka gets up at seven.'),
      },
    ],
    exercises: Array.from({ length: n }, () => choice()),
    ...over,
  };
}

function writingItem(japanese: string, reading: string, over: Partial<ItemDraft> = {}): ItemDraft {
  return {
    kind: 'writing',
    japanese,
    reading,
    meaning: T(`nghĩa ${japanese}`, `meaning ${japanese}`),
    ...over,
  };
}

function fill(answers: string[], over: Partial<ExerciseDraft> = {}): ExerciseDraft {
  return {
    type: 'fill_blank',
    prompt: T('Gõ bằng tiếng Nhật', 'Type in Japanese'),
    payload: { accepted_answers: answers, hint: 'gợi ý' },
    feedbackCorrect: T('Chính xác!', 'Correct!'),
    feedbackIncorrect: T('Đáp án tham chiếu.', 'Reference answer.'),
    ...over,
  };
}

const WORDS: [string, string, string[]][] = [
  ['おはようございます', 'おはようございます', ['おはようございます', 'おはよう ございます']],
  ['水', 'みず', ['水', 'みず']],
  ['会社', 'かいしゃ', ['会社', 'かいしゃ']],
  ['電車', 'でんしゃ', ['電車', 'でんしゃ']],
  ['先生', 'せんせい', ['先生', 'せんせい']],
  ['時間', 'じかん', ['時間', 'じかん']],
  ['友達', 'ともだち', ['友達', 'ともだち']],
];

/** Bài viết hợp lệ: `n` mục, mỗi mục 1 bài `fill_blank` không gắn mục, 5 phút. */
function writingUnit(n = 3, over: Partial<UnitDraft> = {}): UnitDraft {
  const words = WORDS.slice(0, n);
  return {
    kind: 'writing',
    level: 'N5',
    tier: 'core',
    estMinutes: 5,
    goalTags: ['jlpt'],
    title: T('Viết: Lời chào', 'Writing: Greetings'),
    items: words.map(([ja, kana]) => writingItem(ja, kana)),
    exercises: words.map(([, , answers]) => fill(answers)),
    ...over,
  };
}

const withItem = (unit: UnitDraft, index: number, patch: Partial<ItemDraft>): UnitDraft => ({
  ...unit,
  items: unit.items!.map((it, i) => (i === index ? { ...it, ...patch } : it)),
});
const withExercise = (
  unit: UnitDraft,
  index: number,
  patch: Partial<ExerciseDraft>,
): UnitDraft => ({
  ...unit,
  exercises: unit.exercises!.map((e, i) => (i === index ? { ...e, ...patch } : e)),
});

describe('đơn vị luyện đọc/viết hợp lệ', () => {
  it('bài đọc 1 đoạn + 2…5 câu (5 phút) không có lỗi', () => {
    expect(run(readingUnit(2))).toEqual([]);
    expect(run(readingUnit(5))).toEqual([]);
  });

  it('bài viết 3…6 mục × 1 bài fill_blank (5 phút) không có lỗi', () => {
    expect(run(writingUnit(3))).toEqual([]);
    expect(run(writingUnit(6))).toEqual([]);
  });

  it('dạng file nội dung (mục không khai kind) cũng hợp lệ', () => {
    const unit = readingUnit(3);
    unit.items = unit.items!.map(({ kind: _kind, ...rest }) => rest);
    expect(run(unit)).toEqual([]);
  });
});

describe('PR1 — đặc tính chung', () => {
  it.each([['reading' as const], ['writing' as const]])('%s: tier khác core → lỗi tier', (kind) => {
    const unit = kind === 'reading' ? readingUnit() : writingUnit();
    expect(paths(run({ ...unit, tier: 'foundation' }))).toContain('tier');
  });

  it.each([['reading' as const], ['writing' as const]])(
    '%s: goalTags rỗng → lỗi goalTags',
    (kind) => {
      const unit = kind === 'reading' ? readingUnit() : writingUnit();
      expect(paths(run({ ...unit, goalTags: [] }))).toContain('goalTags');
    },
  );

  it('estMinutes ngoài {5, 10, 15} → lỗi estMinutes; 15 là hợp lệ', () => {
    expect(paths(run(readingUnit(3, { estMinutes: 7 })))).toContain('estMinutes');
    expect(paths(run(readingUnit(3, { estMinutes: 15 })))).not.toContain('estMinutes');
  });
});

describe('PR2 — đoạn văn của bài đọc', () => {
  it('0 hoặc 2 mục đọc active → lỗi items; mục inactive không tính', () => {
    expect(paths(run(readingUnit(3, { items: [] })))).toContain('items');
    const two = readingUnit();
    two.items = [...two.items!, { ...two.items![0]!, japanese: `${PASSAGE}もう一つ` }];
    expect(paths(run(two))).toContain('items');
    const withInactive = readingUnit();
    withInactive.items = [
      ...withInactive.items!,
      { ...withInactive.items![0]!, status: 'inactive' },
    ];
    expect(paths(run(withInactive))).not.toContain('items');
  });

  it('đoạn văn dưới 20 ký tự → lỗi items[0].japanese', () => {
    expect(paths(run(withItem(readingUnit(), 0, { japanese: '短い文です。' })))).toContain(
      'items[0].japanese',
    );
  });

  it('đoạn văn 20 ký tự hợp lệ (biên dưới)', () => {
    const exactly20 = 'あ'.repeat(20);
    expect(paths(run(withItem(readingUnit(), 0, { japanese: exactly20 })))).not.toContain(
      'items[0].japanese',
    );
  });

  it('bài 5 phút: đoạn văn > 200 ký tự → lỗi; 200 ký tự hợp lệ', () => {
    expect(paths(run(withItem(readingUnit(), 0, { japanese: 'あ'.repeat(201) })))).toContain(
      'items[0].japanese',
    );
    expect(paths(run(withItem(readingUnit(), 0, { japanese: 'あ'.repeat(200) })))).not.toContain(
      'items[0].japanese',
    );
  });

  it('bài 10 phút cho đến 400 ký tự; 401 ký tự → lỗi', () => {
    const ten = readingUnit(3, { estMinutes: 10 });
    expect(paths(run(withItem(ten, 0, { japanese: 'あ'.repeat(400) })))).not.toContain(
      'items[0].japanese',
    );
    expect(paths(run(withItem(ten, 0, { japanese: 'あ'.repeat(401) })))).toContain(
      'items[0].japanese',
    );
  });

  it('thiếu bản dịch vi hoặc en → lỗi items[0].meaning', () => {
    expect(paths(run(withItem(readingUnit(), 0, { meaning: { vi: 'chỉ có vi' } })))).toContain(
      'items[0].meaning',
    );
  });
});

describe('PR3 — câu hỏi của bài đọc', () => {
  it('1 hoặc 6 bài tập → lỗi exercises; 2 và 5 hợp lệ', () => {
    expect(paths(run(readingUnit(1)))).toContain('exercises');
    expect(paths(run(readingUnit(6, { estMinutes: 10 })))).toContain('exercises');
    expect(paths(run(readingUnit(2)))).not.toContain('exercises');
    expect(paths(run(readingUnit(5)))).not.toContain('exercises');
  });

  it('bài không phải multiple_choice → lỗi exercises[i].type', () => {
    const unit = withExercise(readingUnit(), 1, {
      type: 'fill_blank',
      payload: { accepted_answers: ['はい'] },
    });
    expect(paths(run(unit))).toContain('exercises[1].type');
  });

  it('2 lựa chọn hoặc 5 lựa chọn → lỗi; 3 và 4 hợp lệ', () => {
    const at = (choices: string[]) =>
      run(withExercise(readingUnit(), 0, { payload: { choices, correct_index: 0 } }));
    expect(paths(at(['a', 'b']))).toContain('exercises[0].payload.choices');
    expect(paths(at(['a', 'b', 'c', 'd', 'e']))).toContain('exercises[0].payload.choices');
    expect(paths(at(['a', 'b', 'c']))).not.toContain('exercises[0].payload.choices');
    expect(paths(at(['a', 'b', 'c', 'd']))).not.toContain('exercises[0].payload.choices');
  });

  it('correct_index ngoài danh sách → lỗi exercises[i].payload.correct_index', () => {
    const unit = withExercise(readingUnit(), 2, {
      payload: { choices: ['a', 'b', 'c'], correct_index: 3 },
    });
    expect(paths(run(unit))).toContain('exercises[2].payload.correct_index');
  });

  it('bài tập gắn mục (item hoặc itemIndex) → lỗi exercises[i].item', () => {
    expect(paths(run(withExercise(readingUnit(), 0, { item: PASSAGE })))).toContain(
      'exercises[0].item',
    );
    expect(paths(run(withExercise(readingUnit(), 1, { itemIndex: 0 })))).toContain(
      'exercises[1].item',
    );
  });

  it('bài tập inactive không tính vào số câu', () => {
    const unit = readingUnit(5);
    unit.exercises = [...unit.exercises!, { ...choice(), status: 'inactive' }];
    expect(paths(run(unit))).not.toContain('exercises');
  });
});

describe('PR4 — mục của bài viết', () => {
  it('2 hoặc 7 mục → lỗi items; 3 và 6 hợp lệ', () => {
    expect(paths(run(writingUnit(2)))).toContain('items');
    const seven = writingUnit(7, { estMinutes: 10 });
    expect(paths(run(seven))).toContain('items');
    expect(paths(run(writingUnit(3)))).not.toContain('items');
  });

  it('thiếu reading hoặc reading không phải kana → lỗi items[i].reading', () => {
    expect(paths(run(withItem(writingUnit(), 1, { reading: undefined })))).toContain(
      'items[1].reading',
    );
    expect(paths(run(withItem(writingUnit(), 1, { reading: 'mizu' })))).toContain(
      'items[1].reading',
    );
  });

  it('thiếu nghĩa vi hoặc en → lỗi items[i].meaning', () => {
    expect(paths(run(withItem(writingUnit(), 2, { meaning: { en: 'only en' } })))).toContain(
      'items[2].meaning',
    );
  });

  it('mục dài quá 40 ký tự → lỗi items[i].japanese', () => {
    expect(paths(run(withItem(writingUnit(), 0, { japanese: 'あ'.repeat(41) })))).toContain(
      'items[0].japanese',
    );
  });

  it('số bài fill_blank khác số mục → lỗi exercises', () => {
    const unit = writingUnit(4);
    unit.exercises = unit.exercises!.slice(0, 3);
    expect(paths(run(unit))).toContain('exercises');
  });

  it('bài tập không phải fill_blank → lỗi exercises[i].type', () => {
    const unit = withExercise(writingUnit(), 0, {
      type: 'multiple_choice',
      payload: { choices: ['a', 'b'], correct_index: 0 },
    });
    expect(paths(run(unit))).toContain('exercises[0].type');
  });

  it('bài tập gắn mục → lỗi exercises[i].item', () => {
    expect(paths(run(withExercise(writingUnit(), 0, { item: 'おはようございます' })))).toContain(
      'exercises[0].item',
    );
  });
});

describe('PR5 — accepted_answers', () => {
  it('rỗng hoặc có phần tử rỗng → lỗi exercises[i].payload.accepted_answers', () => {
    expect(
      paths(run(withExercise(writingUnit(), 0, { payload: { accepted_answers: [] } }))),
    ).toContain('exercises[0].payload.accepted_answers');
    expect(
      paths(run(withExercise(writingUnit(), 0, { payload: { accepted_answers: ['水', '  '] } }))),
    ).toContain('exercises[0].payload.accepted_answers');
  });

  it('hai phần tử trùng nhau sau chuẩn hóa NFKC/khoảng trắng/chữ thường → lỗi', () => {
    const unit = withExercise(writingUnit(), 1, {
      payload: { accepted_answers: ['みず', ' みず ', 'ＡＢ', 'ab'] },
    });
    const issue = run(unit).find((i) => i.path === 'exercises[1].payload.accepted_answers');
    expect(issue?.message).toMatch(/trùng/);
  });

  it('các dạng Kanji và hiragana khác nhau không bị coi là trùng', () => {
    expect(
      run(
        withExercise(writingUnit(), 1, { payload: { accepted_answers: ['水', 'みず', 'ミズ'] } }),
      ),
    ).toEqual([]);
  });
});

describe('PR6 — quỹ thời lượng', () => {
  it('bài đọc 5 phút có 6 câu → lỗi exercises (PR3 và PR6 cùng chặn); 5 câu 10 phút hợp lệ', () => {
    expect(paths(run(readingUnit(6)))).toContain('exercises');
    expect(run(readingUnit(5, { estMinutes: 10 }))).toEqual([]);
  });

  it('bài viết 5 phút có 6 mục (6 × 45 = 270 ≤ 300) hợp lệ; 10 phút vẫn hợp lệ', () => {
    expect(run(writingUnit(6))).toEqual([]);
    expect(run(writingUnit(6, { estMinutes: 10 }))).toEqual([]);
  });

  it('bài viết 5 phút có 7 mục → vượt quỹ (7 × 45 = 315 > 300)', () => {
    const unit = writingUnit(7);
    const issue = run(unit).find((i) => i.path === 'exercises' && i.message.includes('quỹ'));
    expect(issue).toBeDefined();
  });

  it('quỹ tính theo 60 s/câu (đọc) và 45 s/câu (viết), không theo secondsPerExercise', () => {
    expect(run(readingUnit(5), { ...OPTIONS, secondsPerExercise: 120 })).toEqual([]);
    expect(run(writingUnit(6), { ...OPTIONS, secondsPerExercise: 120 })).toEqual([]);
  });
});

describe('PR7 — phản hồi đúng/sai', () => {
  it.each([['feedbackCorrect' as const], ['feedbackIncorrect' as const]])(
    'thiếu %s en → lỗi',
    (field) => {
      const unit = withExercise(readingUnit(), 0, { [field]: { vi: 'chỉ có vi' } });
      expect(paths(run(unit))).toContain(`exercises[0].${field}`);
      const writing = withExercise(writingUnit(), 0, { [field]: { vi: '', en: '' } });
      expect(paths(run(writing))).toContain(`exercises[0].${field}`);
    },
  );
});

describe('PR8 — glyph trong phông', () => {
  it('ký tự thiếu glyph trong đoạn văn, mục viết hoặc đáp án → lỗi nêu ký tự', () => {
    const reading = withItem(readingUnit(), 0, { japanese: `${PASSAGE}〇` });
    expect(run(reading).find((i) => i.path === 'items[0].japanese')?.message).toContain('〇');

    const writing = withItem(writingUnit(), 1, { japanese: '〇' });
    expect(paths(run(writing))).toContain('items[1].japanese');

    const answers = withExercise(writingUnit(), 2, {
      payload: { accepted_answers: ['会社', '〇'] },
    });
    expect(paths(run(answers))).toContain('exercises[2].payload.accepted_answers');
  });
});

describe('PR9 — không có nội dung Kanji lẫn vào', () => {
  it('mục luyện có kanjiDetails → lỗi', () => {
    const unit = withItem(writingUnit(), 0, {
      kanjiDetails: { onReadings: ['スイ'], kunReadings: ['みず'], strokeCount: 4 },
    });
    expect(paths(run(unit))).toContain('items[0]');
  });

  it('mục luyện thuộc chủ đề Kanji → lỗi items[i].topicId', () => {
    const unit = withItem(writingUnit(), 1, { topic: 'kanji-n5-numbers' });
    expect(paths(run(unit))).toContain('items[1].topicId');
  });

  it('mục luyện không khai chủ đề riêng vẫn hợp lệ (chủ đề lấy từ đơn vị)', () => {
    expect(run(writingUnit())).toEqual([]);
  });
});

describe('validateCatalog — mỗi (trình độ × reading/writing) có ≥ 1 bài 5 phút', () => {
  const unit = (
    kind: CatalogDraft['kind'],
    level: 'N5' | 'N4' | 'N3',
    over: Partial<CatalogDraft> = {},
  ): CatalogDraft => ({
    kind,
    level,
    tier: 'core',
    estMinutes: 5,
    ...over,
  });
  const full = (level: 'N5' | 'N4' | 'N3'): CatalogDraft[] =>
    (['vocabulary', 'grammar', 'kanji', 'reading', 'writing'] as const).map((k) => unit(k, level));
  const foundation = [
    unit('vocabulary', 'N5', { tier: 'foundation' }),
    unit('grammar', 'N5', { tier: 'foundation' }),
  ];

  it('đủ năm kỹ năng cho mỗi trình độ → hợp lệ', () => {
    expect(validateCatalog([...foundation, ...full('N5'), ...full('N4'), ...full('N3')])).toEqual(
      [],
    );
  });

  it('thiếu bài đọc 5 phút ở N4 và bài viết 5 phút ở N3 → lỗi đúng trình độ', () => {
    const units = [
      ...foundation,
      ...full('N5'),
      ...full('N4').filter((u) => u.kind !== 'reading'),
      ...full('N3').filter((u) => u.kind !== 'writing'),
    ];
    const messages = validateCatalog(units).map((i) => i.message);
    expect(messages.some((m) => m.includes('N4') && m.includes('reading'))).toBe(true);
    expect(messages.some((m) => m.includes('N3') && m.includes('writing'))).toBe(true);
    expect(
      messages.some((m) => m.includes('N5') && (m.includes('reading') || m.includes('writing'))),
    ).toBe(false);
  });

  it('bài 10 phút không thay được bài 5 phút', () => {
    const units = [
      ...foundation,
      ...full('N5').map((u) => (u.kind === 'writing' ? { ...u, estMinutes: 10 as const } : u)),
    ];
    expect(validateCatalog(units, ['N5']).some((i) => i.message.includes('writing'))).toBe(true);
  });
});
