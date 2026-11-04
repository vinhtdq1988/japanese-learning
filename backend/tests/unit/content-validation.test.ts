import { describe, expect, it } from 'vitest';
import {
  validateCatalog,
  validateUnit,
  type ExerciseDraft,
  type ItemDraft,
  type UnitDraft,
} from '../../src/domain/content-validation.js';

const t = (vi: string, en = vi) => ({ vi, en });

const vocabItem = (over: ItemDraft = {}): ItemDraft => ({
  japanese: '水',
  reading: 'みず',
  meaning: t('nước', 'water'),
  ...over,
});

const grammarItem = (over: ItemDraft = {}): ItemDraft => ({
  japanese: 'AはBです',
  meaning: t('A là B', 'A is B'),
  explanation: t('Giải thích', 'Explanation'),
  examples: [{ ja: '私は学生です。', translation: t('Tôi là sinh viên.', 'I am a student.') }],
  ...over,
});

const mc = (over: Partial<ExerciseDraft> = {}): ExerciseDraft => ({
  type: 'multiple_choice',
  prompt: t('Câu hỏi', 'Question'),
  payload: { choices: ['a', 'b'], correct_index: 0 },
  feedbackCorrect: t('Đúng', 'Right'),
  feedbackIncorrect: t('Sai', 'Wrong'),
  ...over,
});

const unit = (over: UnitDraft = {}): UnitDraft => ({
  kind: 'vocabulary',
  level: 'N5',
  tier: 'core',
  estMinutes: 5,
  title: t('Tiêu đề', 'Title'),
  items: [vocabItem()],
  exercises: [mc()],
  ...over,
});

const paths = (u: UnitDraft): string[] => validateUnit(u).map((i) => i.path);

describe('validateUnit – cấp đơn vị', () => {
  it('chấp nhận đơn vị hợp lệ', () => {
    expect(validateUnit(unit())).toEqual([]);
    expect(validateUnit(unit({ kind: 'grammar', items: [grammarItem()] }))).toEqual([]);
  });

  it('est_minutes chỉ ∈ {5, 10, 15} (FR-017)', () => {
    expect(paths(unit({ estMinutes: 7 }))).toContain('estMinutes');
    expect(paths(unit({ estMinutes: 20 }))).toContain('estMinutes');
    for (const m of [5, 10, 15]) expect(validateUnit(unit({ estMinutes: m }))).toEqual([]);
  });

  it("tier='foundation' chỉ cho N5", () => {
    expect(paths(unit({ tier: 'foundation', level: 'N4' }))).toContain('tier');
    expect(validateUnit(unit({ tier: 'foundation', level: 'N5' }))).toEqual([]);
  });

  it('cần ≥ 1 mục và ≥ 1 bài tập đang active', () => {
    expect(paths(unit({ items: [] }))).toContain('items');
    expect(paths(unit({ exercises: [] }))).toContain('exercises');
    expect(paths(unit({ items: [vocabItem({ status: 'inactive' })] }))).toContain('items');
    expect(paths(unit({ exercises: [mc({ status: 'inactive' })] }))).toContain('exercises');
  });

  it('bản dịch vi + en của tiêu đề phải đầy đủ', () => {
    expect(paths(unit({ title: { vi: 'Chỉ tiếng Việt' } }))).toContain('title');
  });

  it('bỏ qua kiểm tra chi tiết mục/bài tập inactive', () => {
    const u = unit({
      items: [vocabItem(), vocabItem({ status: 'inactive', reading: null })],
      exercises: [mc(), mc({ status: 'inactive', payload: {} })],
    });
    expect(validateUnit(u)).toEqual([]);
  });
});

describe('validateUnit – mục nội dung', () => {
  it('từ vựng phải có cách đọc và nghĩa vi + en', () => {
    expect(paths(unit({ items: [vocabItem({ reading: null })] }))).toContain('items[0].reading');
    expect(paths(unit({ items: [vocabItem({ meaning: { vi: 'chỉ vi' } })] }))).toContain(
      'items[0].meaning',
    );
  });

  it('ngữ pháp phải có giải thích đầy đủ và ≥ 1 ví dụ', () => {
    const g = (item: ItemDraft) => paths(unit({ kind: 'grammar', items: [item] }));
    expect(g(grammarItem({ explanation: null }))).toContain('items[0].explanation');
    expect(g(grammarItem({ examples: [] }))).toContain('items[0].examples');
    expect(g(grammarItem({ examples: [{ ja: 'x', translation: { vi: 'chỉ vi' } }] }))).toContain(
      'items[0].examples[0].translation',
    );
  });
});

describe('validateUnit – bài tập', () => {
  const exPaths = (ex: ExerciseDraft) => paths(unit({ exercises: [ex] }));

  it('multiple_choice: correct_index nằm trong choices, ≥ 2 lựa chọn không trùng', () => {
    expect(exPaths(mc({ payload: { choices: ['a', 'b'], correct_index: 2 } }))).toContain(
      'exercises[0].payload.correct_index',
    );
    expect(exPaths(mc({ payload: { choices: ['a', 'b'], correct_index: -1 } }))).toContain(
      'exercises[0].payload.correct_index',
    );
    expect(exPaths(mc({ payload: { choices: ['a'], correct_index: 0 } }))).toContain(
      'exercises[0].payload.choices',
    );
    expect(exPaths(mc({ payload: { choices: ['a', 'A '], correct_index: 0 } }))).toContain(
      'exercises[0].payload.choices',
    );
  });

  it('multiple_choice: lựa chọn song ngữ phải đủ vi + en và khác nhau ở mọi ngôn ngữ', () => {
    const ok = mc({
      payload: { choices: [t('Nước', 'Water'), t('Trà', 'Tea')], correct_index: 0 },
    });
    expect(exPaths(ok)).toEqual([]);
    const missing = mc({
      payload: { choices: [{ vi: 'Nước' }, t('Trà', 'Tea')], correct_index: 0 },
    });
    expect(exPaths(missing)).toContain('exercises[0].payload.choices');
    const dupEn = mc({
      payload: { choices: [t('Nước', 'Water'), t('Nước lọc', 'Water')], correct_index: 0 },
    });
    expect(exPaths(dupEn)).toContain('exercises[0].payload.choices');
  });

  it('matching: ≥ 2 cặp hợp lệ, vế không trùng', () => {
    const m = (pairs: unknown) =>
      ({ type: 'matching', payload: { pairs } }) as Partial<ExerciseDraft>;
    expect(
      exPaths(
        mc(
          m([
            ['a', 'b'],
            ['c', 'd'],
          ]),
        ),
      ),
    ).toEqual([]);
    expect(exPaths(mc(m([['a', 'b']])))).toContain('exercises[0].payload.pairs');
    expect(
      exPaths(
        mc(
          m([
            ['a', 'b'],
            ['a', 'd'],
          ]),
        ),
      ),
    ).toContain('exercises[0].payload.pairs');
    expect(
      exPaths(
        mc(
          m([
            ['a', 'b'],
            ['c', ''],
          ]),
        ),
      ),
    ).toContain('exercises[0].payload.pairs');
  });

  it('fill_blank: accepted_answers hữu hạn, không rỗng', () => {
    const f = (payload: unknown) => ({ type: 'fill_blank', payload }) as Partial<ExerciseDraft>;
    expect(exPaths(mc(f({ accepted_answers: ['は'] })))).toEqual([]);
    expect(exPaths(mc(f({ accepted_answers: [] })))).toContain(
      'exercises[0].payload.accepted_answers',
    );
    expect(exPaths(mc(f({ accepted_answers: ['  '] })))).toContain(
      'exercises[0].payload.accepted_answers',
    );
    expect(exPaths(mc(f({})))).toContain('exercises[0].payload.accepted_answers');
  });

  it('loại bài tập lạ và phản hồi thiếu bản dịch bị từ chối', () => {
    expect(exPaths(mc({ type: 'essay' }))).toContain('exercises[0].type');
    expect(exPaths(mc({ feedbackCorrect: { vi: 'chỉ vi' } }))).toContain(
      'exercises[0].feedbackCorrect',
    );
  });
});

describe('validateCatalog – quy tắc xuyên đơn vị', () => {
  const full = (level: 'N5' | 'N4' | 'N3') =>
    (['vocabulary', 'grammar'] as const).map((kind) => ({
      kind,
      level,
      tier: 'core' as const,
      estMinutes: 5 as const,
    }));
  const foundation = (['vocabulary', 'grammar'] as const).map((kind) => ({
    kind,
    level: 'N5' as const,
    tier: 'foundation' as const,
    estMinutes: 5 as const,
  }));

  it('đạt khi mỗi level × kind có đơn vị 5 phút và mỗi kind có N5 foundation 5 phút', () => {
    const units = [...foundation, ...full('N5'), ...full('N4'), ...full('N3')];
    expect(validateCatalog(units)).toEqual([]);
  });

  it('báo thiếu đơn vị 5 phút cho level × kind', () => {
    const units = [...foundation, ...full('N5'), ...full('N4')];
    const messages = validateCatalog(units).map((i) => i.message);
    expect(messages).toContain('thiếu đơn vị 5 phút cho N3 × vocabulary');
    expect(messages).toContain('thiếu đơn vị 5 phút cho N3 × grammar');
  });

  it('báo thiếu N5 foundation 5 phút cho từng kind', () => {
    const units = [
      ...full('N5'),
      {
        kind: 'vocabulary' as const,
        level: 'N5' as const,
        tier: 'foundation' as const,
        estMinutes: 10 as const,
      },
    ];
    const messages = validateCatalog(units, ['N5']).map((i) => i.message);
    expect(messages).toContain('thiếu đơn vị N5 foundation 5 phút cho vocabulary');
    expect(messages).toContain('thiếu đơn vị N5 foundation 5 phút cho grammar');
  });

  it('chỉ kiểm tra các level được yêu cầu', () => {
    expect(validateCatalog([...foundation, ...full('N5')], ['N5'])).toEqual([]);
  });
});
