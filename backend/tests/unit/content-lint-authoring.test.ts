import { describe, expect, it } from 'vitest';
import {
  checkAuthoringUnit,
  checkCatalog,
  validateReadingUnit,
  type AuthoringUnit,
  type CatalogDraft,
} from '../../src/domain/content-validation.js';
import type { ScopeFile } from '../../src/domain/types.js';
import { syntheticVocabUnit } from '../fixtures/synthetic-content.js';

// Quy tắc biên soạn AU1…AU18 (spec 008, T012; contracts/content-authoring.md §4): mỗi quy tắc có ca đạt và
// ca vi phạm, đúng đường dẫn lỗi và đúng mức lỗi/cảnh báo.

const noMissingGlyphs = (): string[] => [];

/** Đơn vị từ vựng hợp lệ (2 từ kana, 4 bài 2 format) làm nền cho các ca vi phạm. */
const vocab = (over: Partial<AuthoringUnit> = {}): AuthoringUnit =>
  ({ ...syntheticVocabUnit(0), ...over }) as unknown as AuthoringUnit;

const choice = (item: string | undefined, format: string, extra: object = {}) => ({
  ...(item !== undefined ? { item } : {}),
  type: 'multiple_choice',
  format,
  prompt: { vi: 'Câu hỏi', en: 'Question' },
  payload: { choices: ['あ', 'い', 'う'], correct_index: 0 },
  feedbackCorrect: { vi: 'Đúng vì あ hợp ngữ cảnh.', en: 'Correct because あ fits.' },
  feedbackIncorrect: { vi: 'Sai vì い không hợp ngữ cảnh.', en: 'Wrong because い does not fit.' },
  ...extra,
});

/** Đơn vị ngữ pháp hợp lệ: 2 mẫu, mỗi mẫu 2 bài (form_fill + contrast). */
const grammar = (over: Partial<AuthoringUnit> = {}): AuthoringUnit =>
  ({
    kind: 'grammar',
    level: 'N4',
    tier: 'core',
    topic: 'te-form',
    estMinutes: 5,
    goalTags: ['jlpt'],
    sequence: 410,
    items: [
      {
        japanese: '〜ために',
        scopeRef: 'g-n4-001',
        meaning: { vi: 'để', en: 'in order to' },
        explanation: { vi: 'Mục đích', en: 'Purpose' },
        examples: [
          {
            ja: '日本語を勉強するために、日本へ行きます。',
            reading: 'にほんごをべんきょうするために、にほんへいきます。',
            translation: { vi: 'Để học tiếng Nhật, tôi đi Nhật.', en: 'I go to Japan to study.' },
          },
        ],
      },
      {
        japanese: '〜ように',
        scopeRef: 'g-n4-002',
        meaning: { vi: 'để (khả năng)', en: 'so that' },
        explanation: { vi: 'Mục đích', en: 'Purpose' },
        examples: [
          {
            ja: '忘れないように、メモします。',
            reading: 'わすれないように、メモします。',
            translation: { vi: 'Ghi lại để khỏi quên.', en: 'I note it so I do not forget.' },
          },
        ],
      },
    ],
    exercises: [
      choice('〜ために', 'form_fill'),
      choice('〜ために', 'contrast'),
      choice('〜ように', 'form_fill'),
      choice('〜ように', 'contrast'),
    ],
    ...over,
  }) as unknown as AuthoringUnit;

const errorsOf = (u: AuthoringUnit) =>
  checkAuthoringUnit(u, { missingGlyphs: noMissingGlyphs }).errors;
const warningsOf = (u: AuthoringUnit) =>
  checkAuthoringUnit(u, { missingGlyphs: noMissingGlyphs }).warnings;
const has = (list: { path: string; message: string }[], code: string, path?: string): boolean =>
  list.some((i) => i.message.startsWith(`${code}:`) && (path === undefined || i.path === path));

describe('đơn vị nền hợp lệ', () => {
  it('từ vựng và ngữ pháp mẫu không có lỗi lẫn cảnh báo', () => {
    for (const unit of [vocab(), grammar()]) {
      const check = checkAuthoringUnit(unit, { missingGlyphs: noMissingGlyphs });
      expect(check.errors).toEqual([]);
      expect(check.warnings).toEqual([]);
    }
  });
});

describe('AU1 – reading của ví dụ chỉ gồm kana/dấu câu (lỗi)', () => {
  it('đạt: kana, `ー`, khoảng trắng và dấu câu', () => {
    const u = vocab();
    (u.items![0]!.examples![0] as { reading: string }).reading = 'あさー、 ひる。「よる」！';
    expect(has(errorsOf(u), 'AU1')).toBe(false);
  });

  it('vi phạm: reading còn chữ Hán, ví dụ chữ Hán chưa học vẫn phải có kana', () => {
    const u = vocab();
    (u.items![1]!.examples![0] as { reading: string }).reading = 'ひる食べます';
    expect(has(errorsOf(u), 'AU1', 'items[1].examples[0].reading')).toBe(true);
  });

  it('vi phạm: thiếu reading; áp cả cho ngữ pháp', () => {
    const u = grammar();
    delete (u.items![0]!.examples![0] as { reading?: string }).reading;
    expect(has(errorsOf(u), 'AU1', 'items[0].examples[0].reading')).toBe(true);
  });
});

describe('AU2 – mục từ vựng có ≥ 1 ví dụ (lỗi)', () => {
  it('vi phạm khi từ vựng không có ví dụ', () => {
    const u = vocab();
    u.items![0]!.examples = [];
    expect(has(errorsOf(u), 'AU2', 'items[0].examples')).toBe(true);
  });

  it('không áp cho ngữ pháp (ngữ pháp đã bị validateItem bắt)', () => {
    const u = grammar();
    u.items![0]!.examples = [];
    expect(has(errorsOf(u), 'AU2')).toBe(false);
  });
});

describe('AU3 – ví dụ chứa dạng nguyên của mục (cảnh báo)', () => {
  it('cảnh báo (không phải lỗi) khi câu ví dụ không chứa từ', () => {
    const u = vocab();
    (u.items![0]!.examples![0] as { ja: string }).ja = 'ぜんぜんちがうぶん。';
    expect(has(warningsOf(u), 'AU3', 'items[0].examples[0].ja')).toBe(true);
    expect(has(errorsOf(u), 'AU3')).toBe(false);
  });

  it('ngữ pháp: chấp nhận dạng đã bỏ 〜 và ký hiệu loại từ; cảnh báo khi không ví dụ nào chứa', () => {
    const ok = grammar();
    expect(has(warningsOf(ok), 'AU3')).toBe(false);
    const bad = grammar();
    (bad.items![0]!.examples![0] as { ja: string }).ja = 'これはぺんです。';
    expect(has(warningsOf(bad), 'AU3', 'items[0].examples')).toBe(true);
  });

  it('mẫu có biến thể (a/b) hoặc ghép (Vて+いる): chỉ cần chứa một thành phần', () => {
    const u = grammar();
    u.items![0]!.japanese = 'Vて+いる';
    (u.items![0]!.examples![0] as { ja: string }).ja = '本を読んでいる。';
    expect(has(warningsOf(u), 'AU3')).toBe(false);
  });
});

describe('AU4 – mỗi mục có bài tập gắn mục', () => {
  it('lỗi khi mục từ vựng không có bài gắn mục (không vào lịch ôn)', () => {
    const u = vocab();
    u.exercises = u.exercises!.filter((e) => e.item !== 'あさ');
    expect(has(errorsOf(u), 'AU4', 'items[0]')).toBe(true);
  });

  it('bài không gắn mục không giúp mục nào được tính', () => {
    const u = vocab();
    u.exercises = [choice(undefined, 'context_fill'), choice(undefined, 'synonym')];
    expect(errorsOf(u).filter((i) => i.message.startsWith('AU4:'))).toHaveLength(2);
  });

  it('chấp nhận gắn mục bằng itemIndex (dạng Admin)', () => {
    const u = vocab();
    u.exercises = [
      choice(undefined, 'context_fill', { itemIndex: 0 }),
      choice(undefined, 'synonym', { itemIndex: 1 }),
    ];
    expect(has(errorsOf(u), 'AU4')).toBe(false);
  });

  it('ngữ pháp có đúng 1 bài gắn mục chỉ bị cảnh báo; 0 bài là lỗi', () => {
    const u = grammar();
    u.exercises = [
      choice('〜ために', 'form_fill'),
      choice('〜ように', 'form_fill'),
      choice('〜ように', 'contrast'),
    ];
    expect(has(warningsOf(u), 'AU4', 'items[0]')).toBe(true);
    expect(has(errorsOf(u), 'AU4')).toBe(false);
    u.exercises = u.exercises.filter((e) => e.item !== '〜ために');
    expect(has(errorsOf(u), 'AU4', 'items[0]')).toBe(true);
  });
});

describe('AU5 – format đúng nhóm của loại (lỗi)', () => {
  it('thiếu format ở từ vựng', () => {
    const u = vocab();
    delete (u.exercises![0] as { format?: string }).format;
    expect(has(errorsOf(u), 'AU5', 'exercises[0].format')).toBe(true);
  });

  it('format của ngữ pháp dùng cho từ vựng bị từ chối', () => {
    const u = vocab();
    (u.exercises![1] as { format?: string }).format = 'form_fill';
    expect(has(errorsOf(u), 'AU5', 'exercises[1].format')).toBe(true);
  });

  it('loại không dùng format (Kanji, viết) mà khai format thì lỗi', () => {
    const u = { ...vocab(), kind: 'kanji' } as AuthoringUnit;
    expect(has(errorsOf(u), 'AU5')).toBe(true);
    const w = { ...vocab(), kind: 'writing' } as AuthoringUnit;
    expect(has(errorsOf(w), 'AU5')).toBe(true);
  });

  it('đọc hiểu phải có format nhóm đọc', () => {
    const u = {
      kind: 'reading',
      level: 'N4',
      goalTags: ['jlpt'],
      estMinutes: 5,
      items: [{ japanese: 'これはほんです。それはぺんです。あれはかばんです。' }],
      exercises: [choice(undefined, 'form_fill'), choice(undefined, 'comprehension_short')],
    } as unknown as AuthoringUnit;
    const errors = errorsOf(u);
    expect(has(errors, 'AU5', 'exercises[0].format')).toBe(true);
    expect(has(errors, 'AU5', 'exercises[1].format')).toBe(false);
  });
});

describe('AU6 – phủ dạng đề thi', () => {
  it('từ vựng 10 phút cần ≥ 3 format; 5 phút chỉ cần ≥ 2 (lỗi)', () => {
    const five = vocab();
    expect(has(errorsOf(five), 'AU6')).toBe(false);
    const ten = vocab({ estMinutes: 10 });
    expect(has(errorsOf(ten), 'AU6', 'exercises')).toBe(true);
    const one = vocab();
    one.exercises = one.exercises!.map((e) => ({ ...e, format: 'context_fill' }));
    expect(has(errorsOf(one), 'AU6', 'exercises')).toBe(true);
  });

  it('có chữ Hán thì bắt buộc có bài kanji_reading (lỗi)', () => {
    const u = vocab();
    u.items![0]!.japanese = '朝';
    u.items![0]!.reading = 'あさ';
    u.exercises = u.exercises!.map((e) => (e.item === 'あさ' ? { ...e, item: '朝' } : e));
    expect(errorsOf(u).some((i) => i.message.includes('kanji_reading'))).toBe(true);
    (u.exercises![0] as { format?: string }).format = 'kanji_reading';
    expect(errorsOf(u).some((i) => i.message.includes('kanji_reading'))).toBe(false);
  });

  it('ngữ pháp thiếu form_fill hoặc thiếu contrast/sentence_correct chỉ bị cảnh báo', () => {
    const noFill = grammar();
    noFill.exercises = noFill.exercises!.map((e) => ({ ...e, format: 'contrast' }));
    expect(has(warningsOf(noFill), 'AU6')).toBe(true);
    expect(has(errorsOf(noFill), 'AU6')).toBe(false);
    const noContrast = grammar();
    noContrast.exercises = noContrast.exercises!.map((e) => ({ ...e, format: 'form_fill' }));
    expect(has(warningsOf(noContrast), 'AU6')).toBe(true);
    const sentence = grammar();
    sentence.exercises = sentence.exercises!.map((e, i) => ({
      ...e,
      format: i % 2 === 0 ? 'form_fill' : 'sentence_correct',
    }));
    expect(has(warningsOf(sentence), 'AU6')).toBe(false);
  });
});

describe('AU11 – goalTags có jlpt và tier core (lỗi)', () => {
  it('thiếu thẻ jlpt', () => {
    expect(has(errorsOf(vocab({ goalTags: ['work'] })), 'AU11', 'goalTags')).toBe(true);
    expect(has(errorsOf(vocab({ goalTags: [] })), 'AU11', 'goalTags')).toBe(true);
    expect(has(errorsOf(vocab({ goalTags: ['jlpt', 'work'] })), 'AU11')).toBe(false);
  });

  it("tier phải là 'core'", () => {
    expect(has(errorsOf(vocab({ tier: 'foundation' })), 'AU11', 'tier')).toBe(true);
    expect(has(errorsOf(vocab({ tier: undefined })), 'AU11')).toBe(false);
  });
});

describe('AU14 – mọi ký tự Nhật có glyph (lỗi)', () => {
  it('báo ký tự thiếu glyph ở mục, ví dụ và bài tập; bỏ qua chữ Việt/Latin', () => {
    const seen: string[] = [];
    const check = checkAuthoringUnit(
      vocab({
        items: [
          {
            japanese: 'あ\u{20000}',
            reading: 'あ',
            meaning: { vi: 'x', en: 'x' },
            examples: [
              {
                ja: 'あ',
                reading: 'あ',
                translation: { vi: 'x', en: 'x' },
              },
            ],
          },
        ],
        exercises: [choice('あ', 'context_fill'), choice('あ', 'synonym')],
      }),
      {
        missingGlyphs: (text) => {
          seen.push(text);
          return [...text].filter((c) => c === '\u{20000}');
        },
      },
    );
    expect(has(check.errors, 'AU14', 'items[0].japanese')).toBe(true);
    expect(has(check.errors, 'AU14', 'items[0].examples[0].ja')).toBe(false);
    // Chữ Việt/Latin (ạ, ế, "Question") không được đưa vào kiểm tra glyph.
    expect(seen.join('')).not.toMatch(/[A-Za-zạế]/);
  });

  it('dùng phông thật: ký tự ngoài phông bị báo', () => {
    const u = vocab();
    (u.items![0]!.examples![0] as { ja: string }).ja = 'あさ\u{20000}';
    expect(has(checkAuthoringUnit(u).errors, 'AU14', 'items[0].examples[0].ja')).toBe(true);
  });
});

describe('AU15 – chữ Hán của đoạn đọc / mục viết thuộc tập cho phép (lỗi)', () => {
  const reading = (japanese: string, explanation?: object): AuthoringUnit =>
    ({
      kind: 'reading',
      level: 'N4',
      goalTags: ['jlpt'],
      estMinutes: 10,
      items: [{ japanese, ...(explanation ? { explanation } : {}) }],
      exercises: [choice(undefined, 'comprehension_short')],
    }) as unknown as AuthoringUnit;
  const run = (u: AuthoringUnit, allowed?: Set<string>) =>
    checkAuthoringUnit(u, { missingGlyphs: noMissingGlyphs, allowedKanji: allowed }).errors;

  it('chữ ngoài tập cho phép bị báo, liệt kê đủ chữ', () => {
    const errors = run(reading('私は図書館へ行きます。'), new Set(['私', '行']));
    expect(has(errors, 'AU15', 'items[0].japanese')).toBe(true);
    expect(errors.find((e) => e.message.startsWith('AU15'))!.message).toContain('図書館');
  });

  it('chữ được chú giải ở explanation thì được phép', () => {
    const errors = run(
      reading('私は図書館へ行きます。', {
        vi: 'Chú giải: 図書館 là thư viện',
        en: '図書館 means library',
      }),
      new Set(['私', '行']),
    );
    expect(has(errors, 'AU15')).toBe(false);
  });

  it('không truyền allowedKanji thì bỏ qua AU15; không áp cho từ vựng', () => {
    expect(has(run(reading('図書館へ行きます。')), 'AU15')).toBe(false);
    const vocabulary = vocab();
    expect(
      has(
        checkAuthoringUnit(vocabulary, {
          missingGlyphs: noMissingGlyphs,
          allowedKanji: new Set(),
        }).errors,
        'AU15',
      ),
    ).toBe(false);
  });

  it('áp cho mục luyện viết', () => {
    const writing = {
      kind: 'writing',
      level: 'N4',
      goalTags: ['jlpt'],
      estMinutes: 5,
      items: [{ japanese: '図書館', reading: 'としょかん' }],
      exercises: [],
    } as unknown as AuthoringUnit;
    expect(has(run(writing, new Set(['私'])), 'AU15')).toBe(true);
  });
});

describe('AU16 – phản hồi giải thích (cảnh báo)', () => {
  it('phản hồi sai trùng phản hồi đúng, hoặc quá ngắn ⇒ cảnh báo', () => {
    const same = vocab();
    (same.exercises![0] as { feedbackIncorrect?: object }).feedbackIncorrect = (
      same.exercises![0] as { feedbackCorrect: object }
    ).feedbackCorrect;
    expect(has(warningsOf(same), 'AU16', 'exercises[0].feedbackIncorrect.vi')).toBe(true);
    const short = vocab();
    (short.exercises![1] as { feedbackIncorrect?: object }).feedbackIncorrect = {
      vi: 'Sai.',
      en: 'No.',
    };
    expect(has(warningsOf(short), 'AU16', 'exercises[1].feedbackIncorrect.vi')).toBe(true);
    expect(has(errorsOf(short), 'AU16')).toBe(false);
  });

  it('câu đọc hiểu: feedbackIncorrect phải trích dẫn 「…」 có trong đoạn', () => {
    const passage = 'わたしはまいあさろくじにおきます。それからごはんをたべます。';
    const base = {
      kind: 'reading',
      level: 'N4',
      goalTags: ['jlpt'],
      estMinutes: 5,
      items: [{ japanese: passage }],
    };
    const build = (incorrect: { vi: string; en: string }) =>
      ({
        ...base,
        exercises: [choice(undefined, 'comprehension_short', { feedbackIncorrect: incorrect })],
      }) as unknown as AuthoringUnit;
    const noQuote = build({
      vi: 'Sai vì đoạn văn nói khác hẳn.',
      en: 'Wrong because the text says otherwise.',
    });
    expect(has(warningsOf(noQuote), 'AU16', 'exercises[0].feedbackIncorrect')).toBe(true);
    const outside = build({
      vi: 'Sai vì 「よるにおきます」 không có.',
      en: 'Wrong because 「よるにおきます」 is absent.',
    });
    expect(has(warningsOf(outside), 'AU16', 'exercises[0].feedbackIncorrect')).toBe(true);
    const quoted = build({
      vi: 'Sai vì đoạn nói 「ろくじにおきます」.',
      en: 'Wrong because the text says 「ろくじにおきます」.',
    });
    expect(has(warningsOf(quoted), 'AU16', 'exercises[0].feedbackIncorrect')).toBe(false);
  });
});

describe('AU17 – không luyện viết tay/thứ tự nét (lỗi)', () => {
  it('bài tập hoặc mục nhắc thứ tự nét/viết tay bị từ chối', () => {
    const u = vocab();
    (u.exercises![0] as { prompt: object }).prompt = {
      vi: 'Hãy viết tay chữ này',
      en: 'Write it by hand',
    };
    expect(has(errorsOf(u), 'AU17', 'exercises[0]')).toBe(true);
    const item = vocab();
    item.items![0]!.explanation = { vi: 'Xem thứ tự nét', en: 'See the stroke order' };
    expect(has(errorsOf(item), 'AU17', 'items[0]')).toBe(true);
    expect(has(errorsOf(vocab()), 'AU17')).toBe(false);
  });
});

// --- Quy tắc xuyên đơn vị ---

const cat = (name: string, over: Partial<CatalogDraft> = {}): CatalogDraft => ({
  name,
  kind: 'vocabulary',
  level: 'N4',
  tier: 'core',
  estMinutes: 5,
  goalTags: ['jlpt'],
  topic: 'transport-places',
  sequence: 410,
  baseline: false,
  items: [{ japanese: 'あさ', reading: 'あさ' }],
  exerciseCount: 4,
  ...over,
});

const catalog = (units: CatalogDraft[], options = {}) =>
  checkCatalog(units, [], { scopes: [], ...options });
const catErrors = (units: CatalogDraft[], options = {}) => catalog(units, options).errors;
const catWarnings = (units: CatalogDraft[], options = {}) => catalog(units, options).warnings;

describe('AU7 – mục chính duy nhất (lỗi)', () => {
  it('từ vựng trùng japanese|reading ở hai đơn vị MỚI', () => {
    const errors = catErrors([cat('a.json', { sequence: 410 }), cat('b.json', { sequence: 420 })]);
    expect(has(errors, 'AU7')).toBe(true);
    expect(errors.find((e) => e.message.startsWith('AU7'))!.message).toContain('あさ|あさ');
  });

  it('cùng chữ khác cách đọc là hai mục khác nhau (方 かた / ほう)', () => {
    const a = cat('a.json', { items: [{ japanese: '方', reading: 'かた' }] });
    const b = cat('b.json', { sequence: 420, items: [{ japanese: '方', reading: 'ほう' }] });
    expect(has(catErrors([a, b]), 'AU7')).toBe(false);
  });

  it('đơn vị mới trùng mục của baseline ⇒ lỗi; hai đơn vị baseline trùng nhau ⇒ miễn', () => {
    const base = cat('base.json', { baseline: true, sequence: 10 });
    expect(has(catErrors([base, cat('new.json')]), 'AU7')).toBe(true);
    const base2 = cat('base2.json', { baseline: true, sequence: 20 });
    expect(has(catErrors([base, base2]), 'AU7')).toBe(false);
  });

  it('ngữ pháp trùng scopeRef hoặc trùng japanese', () => {
    const g = (name: string, seq: number, ref: string, text: string) =>
      cat(name, {
        kind: 'grammar',
        sequence: seq,
        items: [{ japanese: text, scopeRef: ref }],
      });
    expect(
      has(catErrors([g('a.json', 410, 'g-n4-001', 'X'), g('b.json', 420, 'g-n4-001', 'Y')]), 'AU7'),
    ).toBe(true);
    expect(
      has(catErrors([g('a.json', 410, 'g-n4-001', 'X'), g('b.json', 420, 'g-n4-002', 'X')]), 'AU7'),
    ).toBe(true);
    expect(
      has(catErrors([g('a.json', 410, 'g-n4-001', 'X'), g('b.json', 420, 'g-n4-002', 'Y')]), 'AU7'),
    ).toBe(false);
  });

  it('Kanji trùng vẫn là lỗi kể cả giữa hai đơn vị baseline (quy tắc cũ của spec 003)', () => {
    const k = (name: string) =>
      cat(name, { kind: 'kanji', baseline: true, items: [{ japanese: '生' }] });
    expect(catErrors([k('a.json'), k('b.json')]).some((e) => e.message.includes('生'))).toBe(true);
  });

  it('mục chỉ làm ví dụ không phải mục chính (không có trong items thì không bị tính)', () => {
    const a = cat('a.json');
    const b = cat('b.json', { sequence: 420, items: [{ japanese: 'ひる', reading: 'ひる' }] });
    expect(has(catErrors([a, b]), 'AU7')).toBe(false);
  });
});

describe('AU8 – scopeRef trỏ dòng danh mục đúng loại và trình độ (lỗi)', () => {
  const scope = (kind: 'grammar' | 'vocabulary', level: 'N4' | 'N3', ids: string[]): ScopeFile => ({
    kind,
    level,
    reference: false,
    sources: { s1: { name: 'n', note: 'n' } },
    rows: ids.map((id) => ({ id, key: id, sources: ['s1'], label: { vi: 'a', en: 'a' } })),
  });
  const g = (ref: string | undefined, over: Partial<CatalogDraft> = {}): CatalogDraft =>
    cat('g.json', {
      kind: 'grammar',
      items: [{ japanese: 'X', ...(ref ? { scopeRef: ref } : {}) }],
      ...over,
    });

  it('đạt khi scopeRef tồn tại cùng loại và trình độ', () => {
    expect(
      has(catErrors([g('g-n4-001')], { scopes: [scope('grammar', 'N4', ['g-n4-001'])] }), 'AU8'),
    ).toBe(false);
  });

  it('scopeRef không tồn tại, hoặc khác loại/trình độ ⇒ lỗi với đường dẫn tới mục', () => {
    const scopes = [scope('grammar', 'N3', ['g-n3-001']), scope('vocabulary', 'N4', ['v-n4-0001'])];
    const missing = catErrors([g('g-n4-999')], { scopes });
    expect(has(missing, 'AU8', 'g.json.items[0].scopeRef')).toBe(true);
    expect(has(catErrors([g('g-n3-001')], { scopes }), 'AU8')).toBe(true);
    expect(has(catErrors([g('v-n4-0001')], { scopes }), 'AU8')).toBe(true);
  });

  it('ngữ pháp mới bắt buộc có scopeRef; baseline không bắt buộc', () => {
    expect(has(catErrors([g(undefined)]), 'AU8', 'g.json.items[0].scopeRef')).toBe(true);
    expect(has(catErrors([g(undefined, { baseline: true })]), 'AU8')).toBe(false);
  });

  it('từ vựng không bắt buộc scopeRef', () => {
    expect(has(catErrors([cat('v.json')]), 'AU8')).toBe(false);
  });
});

describe('AU9 – sequence theo chặng×100+vị trí, duy nhất (lỗi)', () => {
  it('đạt: 410, 420, … 490', () => {
    expect(has(catErrors([cat('a.json', { sequence: 490 })]), 'AU9')).toBe(false);
  });

  it('vi phạm: < 100, thiếu, không phải bội của 10, vị trí 0', () => {
    for (const sequence of [50, undefined, 415, 500]) {
      expect(
        has(catErrors([cat('a.json', { sequence })]), 'AU9', 'a.json.sequence'),
        String(sequence),
      ).toBe(true);
    }
  });

  it('trùng trong (trình độ × loại) ⇒ lỗi; khác loại hoặc khác trình độ thì không', () => {
    expect(has(catErrors([cat('a.json'), cat('b.json', { items: [] })]), 'AU9')).toBe(true);
    const other = cat('c.json', { kind: 'grammar', items: [{ japanese: 'X', scopeRef: 'r' }] });
    expect(
      catErrors([cat('a.json'), other]).some((e) => e.message.includes('sequence 410 trùng')),
    ).toBe(false);
    expect(
      catErrors([cat('a.json'), cat('d.json', { level: 'N3', items: [] })]).some((e) =>
        e.message.includes('sequence 410 trùng'),
      ),
    ).toBe(false);
  });

  it('baseline miễn mẫu nhưng vẫn tính trong tính duy nhất toàn thư viện', () => {
    const base = cat('base.json', { baseline: true, sequence: 100 });
    expect(has(catErrors([base]), 'AU9')).toBe(false);
    const clash = cat('new.json', { sequence: 100 });
    const errors = catErrors([base, clash]);
    expect(has(errors, 'AU9', 'new.json.sequence')).toBe(true);
    expect(errors.some((e) => e.message.includes('trùng'))).toBe(true);
  });
});

describe('AU10 – requires (lỗi)', () => {
  const grammarUnit = (name: string, sequence: number, over: Partial<CatalogDraft> = {}) =>
    cat(name, {
      kind: 'grammar',
      sequence,
      items: [{ japanese: name, scopeRef: `g-${name}` }],
      ...over,
    });

  it('đạt: đích tồn tại, cùng trình độ, sequence nhỏ hơn (có hoặc không đuôi .json)', () => {
    const a = grammarUnit('nai-form.json', 410);
    const b = grammarUnit('passive.json', 420, { requires: ['nai-form'] });
    const c = grammarUnit('causative.json', 430, { requires: ['nai-form.json', 'passive'] });
    expect(has(catErrors([a, b, c]), 'AU10')).toBe(false);
  });

  it('đích không tồn tại ⇒ lỗi với đường dẫn requires[i]', () => {
    const b = grammarUnit('passive.json', 420, { requires: ['khong-co'] });
    expect(has(catErrors([b]), 'AU10', 'passive.json.requires[0]')).toBe(true);
  });

  it('đích ở trình độ cao hơn, hoặc sequence không nhỏ hơn ⇒ lỗi', () => {
    const n3 = grammarUnit('n3.json', 410, { level: 'N3' });
    expect(has(catErrors([n3, grammarUnit('n4.json', 420, { requires: ['n3'] })]), 'AU10')).toBe(
      true,
    );
    const later = grammarUnit('later.json', 430);
    expect(
      has(catErrors([later, grammarUnit('early.json', 420, { requires: ['later'] })]), 'AU10'),
    ).toBe(true);
    const same = grammarUnit('same.json', 420);
    expect(
      has(catErrors([same, grammarUnit('self.json', 420, { requires: ['same'] })]), 'AU10'),
    ).toBe(true);
  });

  it('trình độ thấp hơn thì được dù sequence lớn hơn', () => {
    const n4 = grammarUnit('n4.json', 490);
    const n3 = grammarUnit('n3.json', 410, { level: 'N3', requires: ['n4'] });
    expect(has(catErrors([n4, n3]), 'AU10')).toBe(false);
  });

  it('chu trình requires bị báo', () => {
    const a = grammarUnit('a.json', 410, { requires: ['b'] });
    const b = grammarUnit('b.json', 420, { requires: ['a'] });
    expect(catErrors([a, b]).some((e) => e.message.includes('chu trình'))).toBe(true);
  });

  it('thẻ work/daily_conversation: KHÔNG requires đơn vị cùng loại; khác loại thì được', () => {
    const base = grammarUnit('base.json', 410);
    const work = grammarUnit('work.json', 420, { goalTags: ['jlpt', 'work'], requires: ['base'] });
    expect(has(catErrors([base, work]), 'AU10', 'work.json.requires[0]')).toBe(true);
    const talk = grammarUnit('talk.json', 420, {
      goalTags: ['jlpt', 'daily_conversation'],
      requires: ['base'],
    });
    expect(has(catErrors([base, talk]), 'AU10')).toBe(true);
    const vocabBase = cat('vbase.json', { sequence: 410 });
    const workGrammar = grammarUnit('wg.json', 420, {
      goalTags: ['jlpt', 'work'],
      requires: ['vbase'],
    });
    expect(has(catErrors([vocabBase, workGrammar]), 'AU10')).toBe(false);
    const plain = grammarUnit('plain.json', 420, { requires: ['base'] });
    expect(has(catErrors([base, plain]), 'AU10')).toBe(false);
  });
});

describe('AU12 – chủ đề', () => {
  const topic = (key: string, en: string, skill = 'vocabulary', level = 'N4') =>
    ({ key, skill, level, name: { vi: 'x', en } }) as never;

  it('name.en trùng trong (kỹ năng × trình độ) là LỖI (seed khớp theo name.en)', () => {
    const errors = catErrors([], {
      topics: [topic('a', 'Health'), topic('b', 'Health')],
    });
    expect(has(errors, 'AU12', 'topics.json')).toBe(true);
    const fine = catErrors([], {
      topics: [
        topic('a', 'Health'),
        topic('b', 'Health', 'vocabulary', 'N3'),
        topic('c', 'Health', 'grammar'),
      ],
    });
    expect(has(fine, 'AU12')).toBe(false);
  });

  it('chủ đề của đơn vị mới < 2 đơn vị hoặc < 20 bài ⇒ cảnh báo, ở --final thành lỗi', () => {
    const one = [cat('a.json', { exerciseCount: 30 })];
    expect(has(catWarnings(one), 'AU12', 'topics.json')).toBe(true);
    expect(has(catErrors(one), 'AU12')).toBe(false);
    expect(has(catErrors(one, { final: true }), 'AU12', 'topics.json')).toBe(true);
    const few = [
      cat('a.json', { exerciseCount: 4 }),
      cat('b.json', { sequence: 420, items: [], exerciseCount: 4 }),
    ];
    expect(has(catWarnings(few), 'AU12')).toBe(true);
  });

  it('đủ 2 đơn vị và ≥ 20 bài tập ⇒ đạt; chủ đề chỉ có baseline không bị xét', () => {
    const ok = [
      cat('a.json', { exerciseCount: 10 }),
      cat('b.json', { sequence: 420, items: [], exerciseCount: 10 }),
    ];
    expect(has(catWarnings(ok), 'AU12')).toBe(false);
    const base = [cat('a.json', { baseline: true, exerciseCount: 4 })];
    expect(has(catWarnings(base), 'AU12')).toBe(false);
  });
});

describe('AU13 – ≥ 30% đơn vị 5 phút mỗi (loại × trình độ) (cảnh báo)', () => {
  it('cảnh báo khi < 30%; đạt khi đủ', () => {
    const ten = (name: string, seq: number) =>
      cat(name, { estMinutes: 10, sequence: seq, items: [], exerciseCount: 20 });
    const units = [ten('a.json', 410), ten('b.json', 420), ten('c.json', 430), ten('d.json', 440)];
    expect(has(catWarnings(units), 'AU13')).toBe(true);
    const mixed = [
      ...units,
      cat('e.json', { sequence: 450, items: [] }),
      cat('f.json', { sequence: 460, items: [] }),
    ];
    expect(has(catWarnings(mixed), 'AU13')).toBe(false);
    expect(has(catErrors(units), 'AU13')).toBe(false);
  });

  it('chỉ xét nhóm có đơn vị mới (baseline luôn được miễn)', () => {
    const base = cat('a.json', { baseline: true, estMinutes: 10 });
    expect(has(catWarnings([base]), 'AU13')).toBe(false);
  });
});

describe('AU18 – số đơn vị đọc/viết (chỉ --final)', () => {
  it('không báo khi không --final; --final báo thiếu đọc/viết cho cả N4 và N3', () => {
    expect(has(catErrors([]), 'AU18')).toBe(false);
    const errors = catErrors([], { final: true });
    expect(errors.filter((e) => e.message.startsWith('AU18:'))).toHaveLength(8);
    expect(errors.some((e) => e.message.includes('N4') && e.message.includes('reading'))).toBe(
      true,
    );
    expect(errors.some((e) => e.message.includes('N3') && e.message.includes('writing'))).toBe(
      true,
    );
  });

  it('đạt khi ≥ 30 đọc (≥ 8 chủ đề, ≥ 4 dạng) và ≥ 20 viết mỗi trình độ', () => {
    const units: CatalogDraft[] = [];
    for (const level of ['N4', 'N3'] as const) {
      for (let i = 0; i < 30; i += 1) {
        units.push(
          cat(`${level}-r${i}.json`, {
            kind: 'reading',
            level,
            sequence: 1000 + i * 10,
            topic: `reading-${i % 8}`,
            items: [{ japanese: 'x', scopeRef: `r-${level.toLowerCase()}-form-${i % 4}` }],
          }),
        );
      }
      for (let i = 0; i < 20; i += 1) {
        units.push(
          cat(`${level}-w${i}.json`, {
            kind: 'writing',
            level,
            sequence: 2000 + i * 10,
            items: [],
          }),
        );
      }
    }
    const errors = catErrors(units, { final: true });
    expect(errors.filter((e) => e.message.startsWith('AU18:'))).toEqual([]);
  });
});

describe('PR3 – giới hạn đoạn đọc (FR-019)', () => {
  const unit = (level: 'N4' | 'N3', estMinutes: number, length: number, extra = '') => ({
    kind: 'reading' as const,
    level,
    estMinutes,
    goalTags: ['jlpt'],
    items: [{ japanese: `${'あ'.repeat(length)}${extra}` }],
    exercises: [0, 1].map(() => ({
      type: 'multiple_choice',
      payload: { choices: ['a', 'b', 'c'], correct_index: 0 },
    })),
  });
  const passageIssue = (u: ReturnType<typeof unit>) =>
    validateReadingUnit(u).find((i) => i.path === 'items[0].japanese');

  it('N3 bài ≥ 10 phút: tối đa 700 ký tự', () => {
    expect(passageIssue(unit('N3', 10, 700))).toBeUndefined();
    expect(passageIssue(unit('N3', 15, 700))).toBeUndefined();
    expect(passageIssue(unit('N3', 10, 701))?.message).toContain('20–700');
  });

  it('N4 giữ 400; bài 5 phút luôn ≤ 200 (kể cả N3)', () => {
    expect(passageIssue(unit('N4', 10, 400))).toBeUndefined();
    expect(passageIssue(unit('N4', 10, 401))?.message).toContain('20–400');
    expect(passageIssue(unit('N4', 15, 450))).toBeDefined();
    expect(passageIssue(unit('N3', 5, 200))).toBeUndefined();
    expect(passageIssue(unit('N3', 5, 201))?.message).toContain('20–200');
  });

  it('cho phép xuống dòng \\n trong đoạn', () => {
    const u = unit('N3', 10, 100, '\nあいうえお\n');
    expect(passageIssue(u)).toBeUndefined();
  });
});
