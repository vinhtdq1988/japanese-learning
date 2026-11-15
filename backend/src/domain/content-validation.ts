import { findMissingGlyphs } from './font-coverage.js';
import { isCompleteI18nText, resolveText } from './i18n.js';
import { normalizeAnswer } from './grading.js';
import {
  CONTENT_LEVELS,
  EXERCISE_TYPES,
  KANJI_FACETS,
  LANGUAGES,
  PLACEMENT_SKILLS,
  SKILLS,
  UNIT_EST_MINUTES,
  type ContentLevel,
  type ExerciseFormat,
  type ExerciseType,
  type I18nText,
  type KanjiDetails,
  type ScopeFile,
  type Skill,
  type UnitTier,
} from './types.js';

// Quy tắc kiểm tra nội dung (research R13, data-model §2.8–2.10). Dùng ở seed và khi admin kích hoạt.
// Hàm thuần: trả danh sách lỗi (rỗng = hợp lệ) thay vì ném, để báo đủ mọi lỗi một lần.

export interface ContentIssue {
  /** Vị trí lỗi, ví dụ `items[2].reading`. Rỗng cho lỗi mức đơn vị/danh mục. */
  path: string;
  message: string;
}

export interface ExampleDraft {
  ja?: string;
  reading?: string | null;
  /** Kanji: cách đọc của chính chữ trong từ ví dụ. */
  kanjiReading?: string | null;
  translation?: Partial<I18nText>;
}

export interface ItemDraft {
  status?: 'active' | 'inactive';
  /** Loại mục khi biết (admin lưu theo đơn vị); dùng bắt mục Kanji lẫn vào đơn vị khác. */
  kind?: Skill;
  japanese?: string;
  reading?: string | null;
  meaning?: Partial<I18nText>;
  explanation?: Partial<I18nText> | null;
  examples?: ExampleDraft[];
  /** Tham chiếu chủ đề của chữ Kanji (khóa trong topics.json hoặc id); tra kỹ năng qua `topicSkillOf`. */
  topic?: string | null;
  /** Chi tiết chữ Kanji (nháp có thể thiếu hoặc thiếu trường). */
  kanjiDetails?: Partial<KanjiDetails> | null;
}

export interface ExerciseDraft {
  status?: 'active' | 'inactive';
  type?: string;
  prompt?: Partial<I18nText>;
  payload?: Record<string, unknown>;
  feedbackCorrect?: Partial<I18nText>;
  feedbackIncorrect?: Partial<I18nText>;
  /** Chỉ số (từ 0) của mục trong `items` mà bài tập kiểm tra; null/vắng = không gắn mục. */
  itemIndex?: number | null;
  /** Dạng file nội dung: trường `japanese` của mục được kiểm tra (thay cho `itemIndex`). */
  item?: string;
  facet?: string;
}

export interface UnitDraft {
  /** Id đơn vị (nếu đã lưu); dùng bỏ qua chính nó khi kiểm tra chữ Kanji duy nhất. */
  id?: string;
  kind?: Skill;
  level?: ContentLevel;
  tier?: UnitTier;
  estMinutes?: number;
  goalTags?: readonly string[];
  title?: Partial<I18nText>;
  items?: ItemDraft[];
  exercises?: ExerciseDraft[];
}

/** Ngữ cảnh ngoài đơn vị cho quy tắc nội dung Kanji (hàm thuần: mọi phụ thuộc được truyền vào). */
export interface ValidateUnitOptions {
  /** Số giây ước tính mỗi bài tập (cấu hình `REVIEW_SECONDS_PER_ITEM`); mặc định 30. */
  secondsPerExercise?: number;
  /**
   * Khóa mục chính → đơn vị `active` KHÁC đang chứa nó, theo loại của đơn vị đang kiểm (do dịch vụ truyền vào,
   * đã loại đơn vị đang kiểm): Kanji = ký tự; từ vựng = `japanese|reading`; ngữ pháp = `japanese` (FR-007).
   * Thay `existingKanjiChars` (spec 008); tên cũ vẫn được nhận cho Kanji để tương thích.
   */
  existingItemKeys?: ReadonlyMap<string, { unitId: string; unitSlug: string }>;
  /** @deprecated Dùng `existingItemKeys`. */
  existingKanjiChars?: ReadonlyMap<string, { unitId: string; unitSlug: string }>;
  /** Tra kỹ năng của chủ đề theo tham chiếu; không truyền thì chỉ kiểm tra có chủ đề. */
  topicSkillOf?: (topicRef: string) => Skill | undefined;
  /** Ký tự thiếu glyph trong phông; mặc định đọc cmap của phông đóng gói (research K9). */
  missingGlyphs?: (text: string) => string[];
}

/** Kết quả kiểm tra đầy đủ: lỗi chặn kích hoạt và cảnh báo không chặn. */
export interface UnitCheck {
  errors: ContentIssue[];
  warnings: ContentIssue[];
}

/** Số giây ước tính mặc định mỗi bài tập (khớp mặc định `REVIEW_SECONDS_PER_ITEM`). */
const DEFAULT_SECONDS_PER_EXERCISE = 30;

const isActive = (e: { status?: string }): boolean => e.status !== 'inactive';
const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';
/** Lựa chọn/vế ghép hợp lệ: chuỗi không rỗng dùng chung, hoặc văn bản dịch vi + en đầy đủ. */
const isLocalizable = (v: unknown): boolean => isNonEmptyString(v) || isCompleteI18nText(v);
/** Mọi ngôn ngữ: các giá trị phải khác nhau (nếu không người học không phân biệt được lựa chọn). */
const distinctInEveryLanguage = (values: unknown[]): boolean =>
  LANGUAGES.every(
    (lang) =>
      new Set(values.map((v) => normalizeAnswer(resolveText(v as string, lang)))).size ===
      values.length,
  );

function validateExercisePayload(
  type: ExerciseType,
  payload: unknown,
  path: string,
): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const p = (typeof payload === 'object' && payload !== null ? payload : {}) as Record<
    string,
    unknown
  >;
  switch (type) {
    case 'multiple_choice': {
      const choices = p.choices;
      if (!Array.isArray(choices) || choices.length < 2 || !choices.every(isLocalizable)) {
        issues.push({
          path: `${path}.choices`,
          message: 'cần ít nhất 2 lựa chọn là chuỗi không rỗng hoặc văn bản dịch vi + en đầy đủ',
        });
      } else if (!distinctInEveryLanguage(choices)) {
        issues.push({ path: `${path}.choices`, message: 'các lựa chọn không được trùng nhau' });
      }
      const idx = p.correct_index;
      const size = Array.isArray(choices) ? choices.length : 0;
      if (!Number.isInteger(idx) || (idx as number) < 0 || (idx as number) >= size) {
        issues.push({
          path: `${path}.correct_index`,
          message: 'correct_index phải là số nguyên nằm trong danh sách lựa chọn',
        });
      }
      break;
    }
    case 'matching': {
      const pairs = p.pairs;
      const valid =
        Array.isArray(pairs) &&
        pairs.length >= 2 &&
        pairs.every((x) => Array.isArray(x) && x.length === 2 && x.every(isLocalizable));
      if (!valid) {
        issues.push({
          path: `${path}.pairs`,
          message: 'cần ít nhất 2 cặp, mỗi cặp là [vế trái, vế phải] hợp lệ',
        });
      } else {
        const lefts = (pairs as unknown[][]).map((x) => x[0]);
        const rights = (pairs as unknown[][]).map((x) => x[1]);
        if (!distinctInEveryLanguage(lefts) || !distinctInEveryLanguage(rights)) {
          issues.push({ path: `${path}.pairs`, message: 'các vế trái/phải không được trùng nhau' });
        }
      }
      break;
    }
    case 'fill_blank': {
      const answers = p.accepted_answers;
      if (
        !Array.isArray(answers) ||
        answers.length === 0 ||
        !answers.every((a) => isNonEmptyString(a) && normalizeAnswer(a) !== '')
      ) {
        issues.push({
          path: `${path}.accepted_answers`,
          message: 'accepted_answers phải là tập hữu hạn, không rỗng, gồm các chuỗi không rỗng',
        });
      }
      break;
    }
  }
  return issues;
}

function validateItem(item: ItemDraft, kind: Skill | undefined, path: string): ContentIssue[] {
  const issues: ContentIssue[] = [];
  if (!isNonEmptyString(item.japanese)) {
    issues.push({ path: `${path}.japanese`, message: 'thiếu chữ Nhật' });
  }
  if (!isCompleteI18nText(item.meaning)) {
    issues.push({ path: `${path}.meaning`, message: 'bản dịch vi + en phải đầy đủ' });
  }
  if (kind === 'vocabulary' && !isNonEmptyString(item.reading)) {
    issues.push({ path: `${path}.reading`, message: 'từ vựng phải có cách đọc' });
  }
  if (kind === 'grammar') {
    if (!isCompleteI18nText(item.explanation)) {
      issues.push({
        path: `${path}.explanation`,
        message: 'ngữ pháp phải có giải thích vi + en đầy đủ',
      });
    }
    if (!item.examples || item.examples.length < 1) {
      issues.push({ path: `${path}.examples`, message: 'ngữ pháp phải có ít nhất 1 ví dụ' });
    }
  }
  (item.examples ?? []).forEach((ex, i) => {
    if (!isNonEmptyString(ex.ja)) {
      issues.push({ path: `${path}.examples[${i}].ja`, message: 'thiếu câu ví dụ tiếng Nhật' });
    }
    if (!isCompleteI18nText(ex.translation)) {
      issues.push({
        path: `${path}.examples[${i}].translation`,
        message: 'bản dịch ví dụ vi + en phải đầy đủ',
      });
    }
  });
  return issues;
}

function validateExercise(ex: ExerciseDraft, path: string): ContentIssue[] {
  const issues: ContentIssue[] = [];
  if (!(EXERCISE_TYPES as readonly string[]).includes(ex.type ?? '')) {
    return [
      { path: `${path}.type`, message: `loại bài tập phải thuộc ${EXERCISE_TYPES.join(', ')}` },
    ];
  }
  for (const field of ['prompt', 'feedbackCorrect', 'feedbackIncorrect'] as const) {
    if (!isCompleteI18nText(ex[field])) {
      issues.push({ path: `${path}.${field}`, message: 'bản dịch vi + en phải đầy đủ' });
    }
  }
  issues.push(...validateExercisePayload(ex.type as ExerciseType, ex.payload, `${path}.payload`));
  return issues;
}

// --- Quy tắc Kanji (research K10, data-model §3.3–§3.5) ---

/** Đúng một ký tự thuộc khối CJK Unified Ideographs (gồm Extension A). */
function isSingleKanji(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const chars = [...value];
  if (chars.length !== 1) return false;
  const code = chars[0]!.codePointAt(0)!;
  return (code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3400 && code <= 0x4dbf);
}

const KATAKANA_ONLY = /^[゠-ヿ]+$/;
const HIRAGANA_WITH_DOT = /^[぀-ゟ.]+$/;
const KANA_ONLY = /^[぀-ゟ゠-ヿー]+$/;

/** Cách đọc không có okurigana: phần trước dấu `.` (Kun `た.べる` → `た`). */
const stripOkurigana = (reading: string): string => reading.split('.')[0]!;

function validateKanjiItem(
  item: ItemDraft,
  path: string,
  options: ValidateUnitOptions,
  selfUnitId: string | undefined,
): UnitCheck {
  const errors: ContentIssue[] = [];
  const warnings: ContentIssue[] = [];
  const missingGlyphs = options.missingGlyphs ?? findMissingGlyphs;

  if (!isSingleKanji(item.japanese)) {
    errors.push({
      path: `${path}.japanese`,
      message: 'chữ Kanji phải là đúng một ký tự trong khối CJK Unified Ideographs',
    });
  } else {
    const holder = (options.existingItemKeys ?? options.existingKanjiChars)?.get(item.japanese!);
    if (holder && holder.unitId !== selfUnitId) {
      errors.push({
        path: `${path}.japanese`,
        message: `chữ 「${item.japanese}」 đã có ở bài 「${holder.unitSlug}」 đang hoạt động`,
      });
    }
    const missing = missingGlyphs(item.japanese!);
    if (missing.length > 0) {
      errors.push({
        path: `${path}.japanese`,
        message: `phông đóng gói không có glyph cho 「${missing.join('')}」`,
      });
    }
  }

  const details = item.kanjiDetails;
  const readings = new Set<string>();
  if (!details) {
    errors.push({
      path: `${path}.kanjiDetails`,
      message: 'chữ Kanji phải có thông tin âm On/Kun và số nét',
    });
  } else {
    const on = details.onReadings ?? [];
    const kun = details.kunReadings ?? [];
    if (on.length + kun.length === 0) {
      errors.push({
        path: `${path}.kanjiDetails`,
        message: 'cần ít nhất một cách đọc (âm On hoặc âm Kun)',
      });
    }
    if (!on.every((r) => typeof r === 'string' && KATAKANA_ONLY.test(r))) {
      errors.push({
        path: `${path}.kanjiDetails.onReadings`,
        message: 'âm On phải viết bằng katakana',
      });
    }
    if (!kun.every((r) => typeof r === 'string' && HIRAGANA_WITH_DOT.test(r))) {
      errors.push({
        path: `${path}.kanjiDetails.kunReadings`,
        message: 'âm Kun phải viết bằng hiragana (dấu "." phân cách okurigana)',
      });
    }
    const strokes = details.strokeCount;
    if (!Number.isInteger(strokes) || (strokes as number) < 1 || (strokes as number) > 30) {
      errors.push({
        path: `${path}.kanjiDetails.strokeCount`,
        message: 'số nét phải là số nguyên từ 1 đến 30',
      });
    }
    for (const r of [...on, ...kun]) if (typeof r === 'string') readings.add(stripOkurigana(r));
  }

  if (!isNonEmptyString(item.topic)) {
    errors.push({ path: `${path}.topicId`, message: 'chữ Kanji phải có thẻ chủ đề Kanji' });
  } else if (options.topicSkillOf && options.topicSkillOf(item.topic) !== 'kanji') {
    errors.push({
      path: `${path}.topicId`,
      message: 'chủ đề của chữ Kanji phải thuộc kỹ năng Kanji',
    });
  }

  const examples = item.examples ?? [];
  if (examples.length === 0) {
    errors.push({ path: `${path}.examples`, message: 'chữ Kanji phải có ít nhất 1 từ ví dụ' });
  } else if (examples.length === 1) {
    warnings.push({ path: `${path}.examples`, message: 'nên có từ 2 từ ví dụ trở lên' });
  }
  examples.forEach((ex, j) => {
    const at = `${path}.examples[${j}]`;
    if (isNonEmptyString(ex.ja)) {
      if (isSingleKanji(item.japanese) && !ex.ja.includes(item.japanese!)) {
        errors.push({ path: `${at}.ja`, message: `từ ví dụ phải chứa chữ 「${item.japanese}」` });
      }
      const missing = missingGlyphs(ex.ja);
      if (missing.length > 0) {
        errors.push({
          path: `${at}.ja`,
          message: `phông đóng gói không có glyph cho 「${missing.join('')}」`,
        });
      }
    }
    if (!isNonEmptyString(ex.reading) || !KANA_ONLY.test(ex.reading)) {
      errors.push({ path: `${at}.reading`, message: 'từ ví dụ phải có cách đọc bằng kana' });
    }
    if (
      isNonEmptyString(ex.kanjiReading) &&
      readings.size > 0 &&
      !readings.has(stripOkurigana(ex.kanjiReading))
    ) {
      warnings.push({
        path: `${at}.kanjiReading`,
        message: `cách đọc 「${ex.kanjiReading}」 không thuộc tập cách đọc của chữ (biến âm?)`,
      });
    }
  });
  return { errors, warnings };
}

/** Quy tắc riêng của đơn vị `kind='kanji'` (mục, bài tập, thời lượng, chữ duy nhất). */
function validateKanjiUnit(unit: UnitDraft, options: ValidateUnitOptions): UnitCheck {
  const errors: ContentIssue[] = [];
  const warnings: ContentIssue[] = [];
  const items = unit.items ?? [];
  const exercises = unit.exercises ?? [];

  const activeIndexes = items.flatMap((it, i) => (isActive(it) ? [i] : []));
  if (activeIndexes.length < 3 || activeIndexes.length > 5) {
    errors.push({
      path: 'items',
      message: `bài Kanji phải có từ 3 đến 5 chữ đang hoạt động (hiện có ${activeIndexes.length})`,
    });
  }
  if ((unit.tier ?? 'core') !== 'core') {
    errors.push({ path: 'tier', message: "bài Kanji phải có tier='core'" });
  }
  if (!unit.goalTags || unit.goalTags.length === 0) {
    errors.push({
      path: 'goalTags',
      message: 'bài Kanji phải có ít nhất một thẻ mục tiêu (goalTags)',
    });
  }

  for (const i of activeIndexes) {
    const check = validateKanjiItem(items[i]!, `items[${i}]`, options, unit.id);
    errors.push(...check.errors);
    warnings.push(...check.warnings);
  }
  // Mục không phải Kanji lẫn vào đơn vị Kanji.
  items.forEach((it, i) => {
    if (isActive(it) && it.kind !== undefined && it.kind !== 'kanji') {
      errors.push({ path: `items[${i}]`, message: 'đơn vị Kanji chỉ được chứa mục Kanji' });
    }
  });

  // Bao phủ khía cạnh: mỗi chữ active × mỗi khía cạnh phải có ≥ 1 bài tập active.
  const linked = (ex: ExerciseDraft): number | null => {
    if (typeof ex.itemIndex === 'number') return ex.itemIndex;
    if (ex.item !== undefined) {
      const at = items.findIndex((it) => it.japanese === ex.item);
      return at >= 0 ? at : null;
    }
    return null;
  };
  const covered = new Set<string>();
  const activeExercises = exercises.filter(isActive);
  exercises.forEach((ex, i) => {
    if (!isActive(ex)) return;
    const itemIndex = linked(ex);
    const facet = ex.facet ?? 'item';
    if (itemIndex !== null) {
      if (!(KANJI_FACETS as readonly string[]).includes(facet)) {
        errors.push({
          path: `exercises[${i}].facet`,
          message: `bài tập gắn chữ Kanji phải có facet thuộc ${KANJI_FACETS.join(', ')}`,
        });
      } else {
        covered.add(`${itemIndex}:${facet}`);
      }
    } else if (facet !== 'item') {
      errors.push({
        path: `exercises[${i}].facet`,
        message: "bài tập không gắn chữ phải có facet='item'",
      });
    }
  });
  const gaps: string[] = [];
  for (const i of activeIndexes) {
    for (const facet of KANJI_FACETS) {
      if (!covered.has(`${i}:${facet}`)) {
        gaps.push(`chữ 「${items[i]!.japanese ?? '?'}」 chưa có bài tập cho khía cạnh ${facet}`);
      }
    }
  }
  if (gaps.length > 0) errors.push({ path: 'exercises', message: gaps.join('; ') });

  // Thời lượng (Hiến pháp I): số bài tập × giây/câu ≤ est_minutes × 60.
  const seconds = options.secondsPerExercise ?? DEFAULT_SECONDS_PER_EXERCISE;
  if (
    (UNIT_EST_MINUTES as readonly number[]).includes(unit.estMinutes ?? NaN) &&
    activeExercises.length * seconds > unit.estMinutes! * 60
  ) {
    const budget = Math.floor((unit.estMinutes! * 60) / seconds);
    errors.push({
      path: 'exercises',
      message: `số bài tập (${activeExercises.length}) vượt quỹ ${budget} câu cho bài ${unit.estMinutes} phút`,
    });
  }
  return { errors, warnings };
}

/** Khóa mục chính của từ vựng (`japanese|reading`) hoặc ngữ pháp (`japanese`); Kanji có quy tắc riêng. */
const primaryKeyOf = (kind: Skill | undefined, item: ItemDraft): string | undefined => {
  if (!isNonEmptyString(item.japanese)) return undefined;
  if (kind === 'vocabulary') return `${item.japanese}|${item.reading ?? ''}`;
  if (kind === 'grammar') return item.japanese;
  return undefined;
};

/**
 * Đơn vị không phải Kanji không được chứa mục Kanji, bài tập chỉ có facet `item`; từ vựng/ngữ pháp không
 * được trùng mục chính với đơn vị `active` khác (FR-007, spec 008: `existingItemKeys` do dịch vụ truyền vào).
 */
function validateNonKanjiUnit(unit: UnitDraft, options: ValidateUnitOptions = {}): ContentIssue[] {
  const issues: ContentIssue[] = [];
  (unit.items ?? []).forEach((it, i) => {
    if (!isActive(it) || !options.existingItemKeys) return;
    const key = primaryKeyOf(unit.kind, it);
    const holder = key === undefined ? undefined : options.existingItemKeys.get(key);
    if (holder && holder.unitId !== unit.id) {
      issues.push({
        path: `items[${i}].japanese`,
        message: `mục 「${it.japanese}」 đã có ở bài 「${holder.unitSlug}」 đang hoạt động`,
      });
    }
  });
  (unit.items ?? []).forEach((it, i) => {
    if (isActive(it) && (it.kind === 'kanji' || it.kanjiDetails)) {
      issues.push({ path: `items[${i}]`, message: 'chỉ đơn vị Kanji được chứa mục Kanji' });
    }
  });
  (unit.exercises ?? []).forEach((ex, i) => {
    if (isActive(ex) && (ex.facet ?? 'item') !== 'item') {
      issues.push({
        path: `exercises[${i}].facet`,
        message: "bài tập của đơn vị từ vựng/ngữ pháp phải có facet='item'",
      });
    }
  });
  return issues;
}

// --- Quy tắc luyện đọc/viết (spec 007, contracts/practice-content.md §4, PR1…PR9) ---

/** Giây ước tính mỗi câu: đọc (đoạn văn + câu hỏi) 60 giây, viết (gõ bằng IME) 45 giây — cố định, không theo cấu hình ôn tập. */
const READING_SECONDS_PER_EXERCISE = 60;
const WRITING_SECONDS_PER_EXERCISE = 45;
const PASSAGE_MIN_CHARS = 20;
const PASSAGE_MAX_CHARS = 400;
const PASSAGE_MAX_CHARS_5_MIN = 200;
/** Spec 008 (FR-019): đoạn đọc N3 từ bài 10 phút được dài tới 700 ký tự (đề N3 có đoạn vừa/dài/tra cứu). */
const PASSAGE_MAX_CHARS_N3_LONG = 700;
/** Quy tắc PR3: giới hạn đoạn đọc theo trình độ và thời lượng (N4 giữ 400, bài 5 phút luôn ≤ 200). */
function passageMaxChars(unit: UnitDraft): number {
  if (unit.estMinutes === 5) return PASSAGE_MAX_CHARS_5_MIN;
  if (unit.level === 'N3' && (unit.estMinutes ?? 0) >= 10) return PASSAGE_MAX_CHARS_N3_LONG;
  return PASSAGE_MAX_CHARS;
}
const READING_QUESTIONS = { min: 2, max: 5 } as const;
const READING_CHOICES = { min: 3, max: 4 } as const;
const WRITING_ITEMS = { min: 3, max: 6 } as const;
const WRITING_ITEM_MAX_CHARS = 40;
/** Cách đọc của mục viết: kana (kể cả `ー`), khoảng trắng và dấu câu thường gặp. */
const PRACTICE_KANA_READING = /^[぀-ゟ゠-ヿー\s、。！？・,.!?]+$/;

/** Bài tập có gắn mục (`item` ở file nội dung hoặc `itemIndex` ở Admin API) — luyện đọc/viết không được gắn. */
const hasLinkedItem = (ex: ExerciseDraft): boolean =>
  ex.item !== undefined || (ex.itemIndex !== null && ex.itemIndex !== undefined);

/** Kiểm tra quỹ thời lượng `số bài × giây/câu ≤ estMinutes × 60` (PR6). */
function practiceBudgetIssue(
  unit: UnitDraft,
  exerciseCount: number,
  secondsPerExercise: number,
): ContentIssue[] {
  if (!(UNIT_EST_MINUTES as readonly number[]).includes(unit.estMinutes ?? NaN)) return [];
  if (exerciseCount * secondsPerExercise <= unit.estMinutes! * 60) return [];
  const budget = Math.floor((unit.estMinutes! * 60) / secondsPerExercise);
  return [
    {
      path: 'exercises',
      message: `số bài tập (${exerciseCount}) vượt quỹ ${budget} câu cho bài ${unit.estMinutes} phút`,
    },
  ];
}

/** PR1: thuộc tính chung của đơn vị luyện (tier core, có thẻ mục tiêu). */
function validatePracticeCommon(unit: UnitDraft, label: string): ContentIssue[] {
  const issues: ContentIssue[] = [];
  if ((unit.tier ?? 'core') !== 'core') {
    issues.push({ path: 'tier', message: `bài ${label} phải có tier='core'` });
  }
  if (!unit.goalTags || unit.goalTags.length === 0) {
    issues.push({
      path: 'goalTags',
      message: `bài ${label} phải có ít nhất một thẻ mục tiêu (goalTags)`,
    });
  }
  return issues;
}

/** Mục của đơn vị luyện phải cùng loại với đơn vị (nếu mục khai kind). */
function foreignItems(items: ItemDraft[], kind: Skill, label: string): ContentIssue[] {
  const issues: ContentIssue[] = [];
  items.forEach((it, i) => {
    if (isActive(it) && it.kind !== undefined && it.kind !== kind) {
      issues.push({ path: `items[${i}]`, message: `đơn vị ${label} chỉ được chứa mục ${label}` });
    }
  });
  return issues;
}

/** PR1, PR2, PR3, PR6 (đọc), PR7 (đã kiểm ở `validateExercise`) cho đơn vị `kind='reading'`. */
export function validateReadingUnit(
  unit: UnitDraft,
  _options: ValidateUnitOptions = {},
): ContentIssue[] {
  const issues = validatePracticeCommon(unit, 'luyện đọc');
  const items = unit.items ?? [];
  const exercises = unit.exercises ?? [];
  issues.push(...foreignItems(items, 'reading', 'luyện đọc'));

  const activeItems = items.flatMap((it, i) => (isActive(it) ? [i] : []));
  if (activeItems.length !== 1) {
    issues.push({
      path: 'items',
      message: `bài luyện đọc phải có đúng 1 mục đoạn văn đang hoạt động (hiện có ${activeItems.length})`,
    });
  }
  const maxChars = passageMaxChars(unit);
  for (const i of activeItems) {
    const length = [...(items[i]!.japanese ?? '')].length;
    if (isNonEmptyString(items[i]!.japanese) && (length < PASSAGE_MIN_CHARS || length > maxChars)) {
      issues.push({
        path: `items[${i}].japanese`,
        message: `đoạn văn phải dài ${PASSAGE_MIN_CHARS}–${maxChars} ký tự (hiện có ${length})`,
      });
    }
  }

  const activeExercises = exercises.flatMap((ex, i) => (isActive(ex) ? [i] : []));
  if (
    activeExercises.length < READING_QUESTIONS.min ||
    activeExercises.length > READING_QUESTIONS.max
  ) {
    issues.push({
      path: 'exercises',
      message: `bài luyện đọc phải có từ ${READING_QUESTIONS.min} đến ${READING_QUESTIONS.max} câu hỏi (hiện có ${activeExercises.length})`,
    });
  }
  for (const i of activeExercises) {
    const ex = exercises[i]!;
    if (ex.type !== undefined && ex.type !== 'multiple_choice') {
      issues.push({
        path: `exercises[${i}].type`,
        message: 'câu hỏi luyện đọc phải là trắc nghiệm (multiple_choice)',
      });
    }
    const choices = ex.payload?.choices;
    if (
      Array.isArray(choices) &&
      (choices.length < READING_CHOICES.min || choices.length > READING_CHOICES.max)
    ) {
      issues.push({
        path: `exercises[${i}].payload.choices`,
        message: `câu hỏi luyện đọc phải có ${READING_CHOICES.min}–${READING_CHOICES.max} lựa chọn`,
      });
    }
    if (hasLinkedItem(ex)) {
      issues.push({
        path: `exercises[${i}].item`,
        message: 'bài tập luyện đọc không được gắn mục (không vào lịch ôn)',
      });
    }
  }
  issues.push(...practiceBudgetIssue(unit, activeExercises.length, READING_SECONDS_PER_EXERCISE));
  return issues;
}

/** PR1, PR4, PR5, PR6 (viết), PR7 (đã kiểm ở `validateExercise`) cho đơn vị `kind='writing'`. */
export function validateWritingUnit(
  unit: UnitDraft,
  _options: ValidateUnitOptions = {},
): ContentIssue[] {
  const issues = validatePracticeCommon(unit, 'luyện viết');
  const items = unit.items ?? [];
  const exercises = unit.exercises ?? [];
  issues.push(...foreignItems(items, 'writing', 'luyện viết'));

  const activeItems = items.flatMap((it, i) => (isActive(it) ? [i] : []));
  if (activeItems.length < WRITING_ITEMS.min || activeItems.length > WRITING_ITEMS.max) {
    issues.push({
      path: 'items',
      message: `bài luyện viết phải có từ ${WRITING_ITEMS.min} đến ${WRITING_ITEMS.max} mục đang hoạt động (hiện có ${activeItems.length})`,
    });
  }
  for (const i of activeItems) {
    const item = items[i]!;
    if ([...(item.japanese ?? '')].length > WRITING_ITEM_MAX_CHARS) {
      issues.push({
        path: `items[${i}].japanese`,
        message: `mục luyện viết dài tối đa ${WRITING_ITEM_MAX_CHARS} ký tự`,
      });
    }
    if (!isNonEmptyString(item.reading) || !PRACTICE_KANA_READING.test(item.reading)) {
      issues.push({
        path: `items[${i}].reading`,
        message: 'mục luyện viết phải có cách đọc bằng kana',
      });
    }
  }

  const activeExercises = exercises.flatMap((ex, i) => (isActive(ex) ? [i] : []));
  if (activeExercises.length !== activeItems.length) {
    issues.push({
      path: 'exercises',
      message: `bài luyện viết phải có đúng một bài điền từ cho mỗi mục (${activeItems.length} mục, ${activeExercises.length} bài tập)`,
    });
  }
  for (const i of activeExercises) {
    const ex = exercises[i]!;
    if (ex.type !== undefined && ex.type !== 'fill_blank') {
      issues.push({
        path: `exercises[${i}].type`,
        message: 'bài tập luyện viết phải là điền từ (fill_blank)',
      });
    }
    if (hasLinkedItem(ex)) {
      issues.push({
        path: `exercises[${i}].item`,
        message: 'bài tập luyện viết không được gắn mục (không vào lịch ôn)',
      });
    }
    const answers = ex.payload?.accepted_answers;
    if (Array.isArray(answers) && answers.every((a) => typeof a === 'string')) {
      const normalized = (answers as string[]).map(normalizeAnswer).filter((a) => a !== '');
      if (new Set(normalized).size !== normalized.length) {
        issues.push({
          path: `exercises[${i}].payload.accepted_answers`,
          message: 'accepted_answers không được có hai đáp án trùng nhau sau khi chuẩn hóa',
        });
      }
    }
  }
  issues.push(...practiceBudgetIssue(unit, activeExercises.length, WRITING_SECONDS_PER_EXERCISE));
  return issues;
}

/** PR8 và PR9 áp cho cả hai loại luyện: glyph trong phông và không lẫn nội dung Kanji. */
function validatePracticeContent(unit: UnitDraft, options: ValidateUnitOptions): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const missingGlyphs = options.missingGlyphs ?? findMissingGlyphs;
  const glyphIssue = (path: string, text: string): void => {
    const missing = missingGlyphs(text);
    if (missing.length > 0) {
      issues.push({ path, message: `phông đóng gói không có glyph cho 「${missing.join('')}」` });
    }
  };
  (unit.items ?? []).forEach((it, i) => {
    if (!isActive(it)) return;
    if (isNonEmptyString(it.japanese)) glyphIssue(`items[${i}].japanese`, it.japanese);
    if (isNonEmptyString(it.reading)) glyphIssue(`items[${i}].reading`, it.reading);
    // PR9: mục luyện không thuộc chủ đề Kanji (`kanjiDetails` đã bị `validateNonKanjiUnit` chặn).
    if (isNonEmptyString(it.topic) && options.topicSkillOf?.(it.topic) === 'kanji') {
      issues.push({
        path: `items[${i}].topicId`,
        message: 'mục luyện không được thuộc chủ đề Kanji',
      });
    }
  });
  (unit.exercises ?? []).forEach((ex, i) => {
    if (!isActive(ex)) return;
    const answers = ex.payload?.accepted_answers;
    if (Array.isArray(answers)) {
      glyphIssue(
        `exercises[${i}].payload.accepted_answers`,
        answers.filter((a): a is string => typeof a === 'string').join(''),
      );
    }
    const choices = ex.payload?.choices;
    if (Array.isArray(choices)) {
      glyphIssue(
        `exercises[${i}].payload.choices`,
        choices.filter((c): c is string => typeof c === 'string').join(''),
      );
    }
  });
  return issues;
}

/**
 * Kiểm tra một đơn vị học (điều kiện để kích hoạt) và tách cảnh báo khỏi lỗi. Chỉ xét mục/bài tập `active`.
 * Đơn vị `kind='kanji'` chịu thêm quy tắc K10; hàm thuần – ngữ cảnh toàn danh mục truyền qua `options`.
 */
export function checkUnit(unit: UnitDraft, options: ValidateUnitOptions = {}): UnitCheck {
  const issues: ContentIssue[] = [];
  const warnings: ContentIssue[] = [];

  if (!(SKILLS as readonly string[]).includes(unit.kind ?? '')) {
    issues.push({ path: 'kind', message: `kind phải thuộc ${SKILLS.join(', ')}` });
  }
  if (!(CONTENT_LEVELS as readonly string[]).includes(unit.level ?? '')) {
    issues.push({ path: 'level', message: `level phải thuộc ${CONTENT_LEVELS.join(', ')}` });
  }
  if (!(UNIT_EST_MINUTES as readonly number[]).includes(unit.estMinutes ?? NaN)) {
    issues.push({
      path: 'estMinutes',
      message: `estMinutes phải thuộc ${UNIT_EST_MINUTES.join(', ')} (FR-017)`,
    });
  }
  if ((unit.tier ?? 'core') === 'foundation' && unit.level !== 'N5') {
    issues.push({ path: 'tier', message: "tier='foundation' chỉ hợp lệ với level N5" });
  }
  if (!isCompleteI18nText(unit.title)) {
    issues.push({ path: 'title', message: 'tiêu đề vi + en phải đầy đủ' });
  }

  const items = unit.items ?? [];
  const exercises = unit.exercises ?? [];
  if (!items.some(isActive)) {
    issues.push({ path: 'items', message: 'đơn vị phải có ít nhất 1 mục nội dung' });
  }
  if (!exercises.some(isActive)) {
    issues.push({ path: 'exercises', message: 'đơn vị phải có ít nhất 1 bài tập' });
  }
  items.forEach((item, i) => {
    if (isActive(item)) issues.push(...validateItem(item, unit.kind, `items[${i}]`));
  });
  exercises.forEach((ex, i) => {
    if (isActive(ex)) issues.push(...validateExercise(ex, `exercises[${i}]`));
  });

  if (unit.kind === 'kanji') {
    const kanji = validateKanjiUnit(unit, options);
    issues.push(...kanji.errors);
    warnings.push(...kanji.warnings);
  } else {
    issues.push(...validateNonKanjiUnit(unit, options));
    if (unit.kind === 'reading') issues.push(...validateReadingUnit(unit, options));
    if (unit.kind === 'writing') issues.push(...validateWritingUnit(unit, options));
    if (unit.kind === 'reading' || unit.kind === 'writing') {
      issues.push(...validatePracticeContent(unit, options));
    }
  }
  return { errors: issues, warnings };
}

/** Như `checkUnit` nhưng chỉ trả danh sách lỗi (rỗng = hợp lệ). */
export function validateUnit(unit: UnitDraft, options: ValidateUnitOptions = {}): ContentIssue[] {
  return checkUnit(unit, options).errors;
}

// --- Quy tắc biên soạn N4/N3 (spec 008, contracts/content-authoring.md §4: AU1…AU18) ---
// Chỉ áp cho đơn vị NGOÀI baseline và chỉ ở seed/lint — KHÔNG chạy qua Admin API (quản trị viên vẫn
// sửa nhanh được sự cố). Thông báo bắt đầu bằng mã quy tắc (`AU4: …`) để người soạn tra cứu.

/** Mục có siêu dữ liệu biên soạn (file nội dung). */
export interface AuthoringItem extends ItemDraft {
  scopeRef?: string;
}

/** Bài tập có siêu dữ liệu `format` (file nội dung). */
export interface AuthoringExercise extends ExerciseDraft {
  format?: string;
}

/** Đơn vị ở dạng file nội dung: thêm `topic`, `sequence`, `requires` cho các quy tắc xuyên đơn vị. */
export interface AuthoringUnit extends Omit<UnitDraft, 'items' | 'exercises'> {
  topic?: string;
  sequence?: number;
  requires?: string[];
  items?: AuthoringItem[];
  exercises?: AuthoringExercise[];
}

export interface AuthoringUnitOptions {
  /** Ký tự thiếu glyph trong phông; mặc định đọc cmap của phông đóng gói. */
  missingGlyphs?: (text: string) => string[];
  /** Chữ Hán được phép trong đoạn đọc/mục luyện viết (AU15); không truyền thì bỏ qua AU15. */
  allowedKanji?: ReadonlySet<string>;
}

/** Nhóm `format` hợp lệ theo loại đơn vị (content-authoring.md §3). Kanji/luyện viết không dùng `format`. */
export const FORMAT_GROUPS: Partial<Record<Skill, readonly ExerciseFormat[]>> = {
  vocabulary: ['kanji_reading', 'orthography', 'context_fill', 'synonym', 'usage'],
  grammar: ['form_fill', 'sentence_correct', 'sentence_order_star', 'text_grammar', 'contrast'],
  reading: ['comprehension_short', 'comprehension_mid', 'info_search'],
};

/** Cách đọc của ví dụ: kana (kể cả `ー`), khoảng trắng, dấu câu và ngoặc thường gặp. */
const KANA_WITH_PUNCT = /^[぀-ゟ゠-ヿー\s、。！？・「」『』（）()〜～…,.!?]+$/u;
const HAN = /\p{Script=Han}/u;
const HAN_G = /\p{Script=Han}/gu;
/** Ký tự "Nhật" cần có glyph: chữ Hán, kana, dấu câu/ký hiệu tiếng Nhật (AU14 bỏ qua tiếng Việt/Latin). */
const JAPANESE_CHARS =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー々〜～「」『』（）、。！？・…★＿\u3000]/gu;
const HANDWRITING = /thứ tự nét|viết tay|stroke order|handwriting/i;
const MIN_FEEDBACK_CHARS = 15;
/** Trích dẫn 「…」 trong phản hồi của câu đọc hiểu (AU16). */
const QUOTED = /「([^」]+)」/gu;

const japaneseOnly = (text: string): string => (text.match(JAPANESE_CHARS) ?? []).join('');

/** Mọi chuỗi (phẳng) trong một giá trị JSON — để quét glyph/từ cấm trong lựa chọn, đáp án, ví dụ. */
function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const v of value) collectStrings(v, out);
  else if (typeof value === 'object' && value !== null) {
    for (const v of Object.values(value)) collectStrings(v, out);
  }
  return out;
}

/** Các dạng cần tìm trong ví dụ của mẫu ngữ pháp: bỏ `〜`, ký hiệu loại từ (V/N/A…), tách theo `/`, `+`, `・`. */
function grammarForms(pattern: string): string[] {
  return pattern
    .replace(/[（(][^）)]*[）)]/gu, '')
    .split(/[/／・、+＋]/u)
    .map((part) => part.replace(/[A-Za-z〜～…\s]/gu, ''))
    .filter((part) => part !== '');
}

/**
 * Kiểm tra một đơn vị theo quy tắc biên soạn AU1–AU6, AU11, AU14–AU17 (cấp đơn vị). Quy tắc xuyên đơn
 * vị (AU7–AU10, AU12, AU13, AU18) ở `checkCatalog`. Hàm thuần.
 */
export function checkAuthoringUnit(
  unit: AuthoringUnit,
  options: AuthoringUnitOptions = {},
): UnitCheck {
  const errors: ContentIssue[] = [];
  const warnings: ContentIssue[] = [];
  const kind = unit.kind;
  const missingGlyphs = options.missingGlyphs ?? findMissingGlyphs;
  const items = unit.items ?? [];
  const exercises = unit.exercises ?? [];
  const activeItems = items.flatMap((item, i) => (isActive(item) ? [{ item, i }] : []));
  const activeExercises = exercises.flatMap((ex, i) => (isActive(ex) ? [{ ex, i }] : []));

  // AU11: mục tiêu JLPT và tầng core.
  if (!unit.goalTags?.includes('jlpt')) {
    errors.push({ path: 'goalTags', message: "AU11: goalTags phải có 'jlpt'" });
  }
  if ((unit.tier ?? 'core') !== 'core') {
    errors.push({ path: 'tier', message: "AU11: đơn vị N4/N3 phải có tier='core'" });
  }

  // AU1–AU3: ví dụ của từ vựng/ngữ pháp.
  if (kind === 'vocabulary' || kind === 'grammar') {
    for (const { item, i } of activeItems) {
      const examples = item.examples ?? [];
      if (kind === 'vocabulary' && examples.length === 0) {
        errors.push({
          path: `items[${i}].examples`,
          message: 'AU2: mục từ vựng phải có ít nhất 1 câu ví dụ',
        });
      }
      examples.forEach((ex, j) => {
        if (!isNonEmptyString(ex.reading) || !KANA_WITH_PUNCT.test(ex.reading)) {
          errors.push({
            path: `items[${i}].examples[${j}].reading`,
            message:
              'AU1: ví dụ phải có cách đọc chỉ gồm kana/dấu câu (kể cả khi dùng chữ Hán chưa học)',
          });
        }
        if (
          kind === 'vocabulary' &&
          isNonEmptyString(ex.ja) &&
          isNonEmptyString(item.japanese) &&
          !ex.ja.includes(item.japanese)
        ) {
          warnings.push({
            path: `items[${i}].examples[${j}].ja`,
            message: `AU3: câu ví dụ không chứa nguyên dạng 「${item.japanese}」 (biến cách?)`,
          });
        }
      });
      if (kind === 'grammar' && examples.length > 0 && isNonEmptyString(item.japanese)) {
        const forms = grammarForms(item.japanese);
        if (forms.length > 0 && !examples.some((ex) => forms.some((f) => ex.ja?.includes(f)))) {
          warnings.push({
            path: `items[${i}].examples`,
            message: `AU3: không ví dụ nào chứa mẫu 「${item.japanese}」`,
          });
        }
      }
    }
  }

  // AU4: mỗi mục từ vựng/ngữ pháp có bài tập gắn mục (nếu không thì không bao giờ vào lịch ôn).
  if (kind === 'vocabulary' || kind === 'grammar') {
    const linkedCount = new Map<string, number>();
    for (const { ex } of activeExercises) {
      const at = typeof ex.itemIndex === 'number' ? items[ex.itemIndex]?.japanese : ex.item;
      if (at !== undefined) linkedCount.set(at, (linkedCount.get(at) ?? 0) + 1);
    }
    for (const { item, i } of activeItems) {
      const n = linkedCount.get(item.japanese ?? '') ?? 0;
      if (n === 0) {
        errors.push({
          path: `items[${i}]`,
          message: `AU4: mục 「${item.japanese ?? '?'}」 chưa có bài tập gắn mục (không vào lịch ôn)`,
        });
      } else if (kind === 'grammar' && n < 2) {
        warnings.push({
          path: `items[${i}]`,
          message: `AU4: mẫu 「${item.japanese ?? '?'}」 chỉ có ${n} bài gắn mục (nên ≥ 2)`,
        });
      }
    }
  }

  // AU5: `format` đúng nhóm của loại.
  const group = kind ? FORMAT_GROUPS[kind] : undefined;
  for (const { ex, i } of activeExercises) {
    const format = ex.format;
    if (group) {
      if (format === undefined) {
        errors.push({
          path: `exercises[${i}].format`,
          message: `AU5: thiếu format (loại ${kind})`,
        });
      } else if (!(group as readonly string[]).includes(format)) {
        errors.push({
          path: `exercises[${i}].format`,
          message: `AU5: format 「${format}」 không thuộc nhóm của loại ${kind} (${group.join(', ')})`,
        });
      }
    } else if (format !== undefined) {
      errors.push({
        path: `exercises[${i}].format`,
        message: `AU5: loại ${kind} không dùng format`,
      });
    }
  }

  // AU6: phủ dạng đề thi.
  const formats = new Set(activeExercises.flatMap(({ ex }) => (ex.format ? [ex.format] : [])));
  if (kind === 'vocabulary') {
    const needed = unit.estMinutes === 5 ? 2 : 3;
    if (formats.size < needed) {
      errors.push({
        path: 'exercises',
        message: `AU6: từ vựng cần ≥ ${needed} format khác nhau (hiện có ${formats.size})`,
      });
    }
    if (
      activeItems.some(({ item }) => HAN.test(item.japanese ?? '')) &&
      !formats.has('kanji_reading')
    ) {
      errors.push({
        path: 'exercises',
        message: 'AU6: có mục chứa chữ Hán nhưng thiếu bài format kanji_reading',
      });
    }
  } else if (kind === 'grammar') {
    if (!formats.has('form_fill')) {
      warnings.push({
        path: 'exercises',
        message: 'AU6: ngữ pháp nên có ≥ 1 bài format form_fill',
      });
    }
    if (!formats.has('contrast') && !formats.has('sentence_correct')) {
      warnings.push({
        path: 'exercises',
        message: 'AU6: ngữ pháp nên có ≥ 1 bài format contrast hoặc sentence_correct',
      });
    }
  }

  // AU14: mọi ký tự Nhật có glyph trong phông.
  const glyph = (path: string, text: string): void => {
    const missing = missingGlyphs(japaneseOnly(text));
    if (missing.length > 0) {
      errors.push({
        path,
        message: `AU14: phông đóng gói không có glyph cho 「${missing.join('')}」`,
      });
    }
  };
  for (const { item, i } of activeItems) {
    glyph(`items[${i}].japanese`, item.japanese ?? '');
    glyph(`items[${i}].reading`, item.reading ?? '');
    (item.examples ?? []).forEach((ex, j) => {
      glyph(`items[${i}].examples[${j}].ja`, ex.ja ?? '');
      glyph(`items[${i}].examples[${j}].reading`, ex.reading ?? '');
    });
  }
  for (const { ex, i } of activeExercises) {
    glyph(`exercises[${i}]`, collectStrings([ex.prompt, ex.payload]).join(''));
  }

  // AU15: chữ Hán trong đoạn đọc và mục luyện viết thuộc tập cho phép hoặc được chú giải ở explanation.
  const allowedKanji = options.allowedKanji;
  if ((kind === 'reading' || kind === 'writing') && allowedKanji) {
    for (const { item, i } of activeItems) {
      const noted = new Set(
        collectStrings(item.explanation ?? {}).flatMap((t) => t.match(HAN_G) ?? []),
      );
      const unknown = [...new Set((item.japanese ?? '').match(HAN_G) ?? [])].filter(
        (ch) => ch !== '々' && !allowedKanji.has(ch) && !noted.has(ch),
      );
      if (unknown.length > 0) {
        errors.push({
          path: `items[${i}].japanese`,
          message: `AU15: chữ Hán 「${unknown.join('')}」 chưa thuộc danh mục Kanji ≤ trình độ của bài và chưa được chú giải ở explanation`,
        });
      }
    }
  }

  // AU16: phản hồi giải thích (cảnh báo).
  const passage = kind === 'reading' ? (activeItems[0]?.item.japanese ?? '') : '';
  for (const { ex, i } of activeExercises) {
    const at = `exercises[${i}]`;
    for (const lang of LANGUAGES) {
      const correct = ex.feedbackCorrect?.[lang]?.trim() ?? '';
      const incorrect = ex.feedbackIncorrect?.[lang]?.trim() ?? '';
      if ([...correct].length < MIN_FEEDBACK_CHARS) {
        warnings.push({
          path: `${at}.feedbackCorrect.${lang}`,
          message: `AU16: phản hồi đúng (${lang}) cần ≥ ${MIN_FEEDBACK_CHARS} ký tự và giải thích vì sao đúng`,
        });
      }
      if ([...incorrect].length < MIN_FEEDBACK_CHARS) {
        warnings.push({
          path: `${at}.feedbackIncorrect.${lang}`,
          message: `AU16: phản hồi sai (${lang}) cần ≥ ${MIN_FEEDBACK_CHARS} ký tự và giải thích vì sao sai`,
        });
      }
      if (correct !== '' && correct === incorrect) {
        warnings.push({
          path: `${at}.feedbackIncorrect.${lang}`,
          message: `AU16: phản hồi sai (${lang}) trùng phản hồi đúng`,
        });
      }
    }
    if (kind === 'reading' && passage !== '') {
      const quotes = collectStrings(ex.feedbackIncorrect ?? {}).flatMap((t) =>
        [...t.matchAll(QUOTED)].map((m) => m[1]!),
      );
      if (quotes.length === 0 || !quotes.some((q) => passage.includes(q))) {
        warnings.push({
          path: `${at}.feedbackIncorrect`,
          message:
            'AU16: phản hồi sai của câu đọc hiểu nên trích dẫn 「…」 một đoạn có trong bài đọc',
        });
      }
    }
  }

  // AU17: không luyện viết tay/thứ tự nét (ngoài phạm vi Giai đoạn 1).
  for (const { item, i } of activeItems) {
    if (HANDWRITING.test(collectStrings([item.meaning, item.explanation]).join(' '))) {
      errors.push({ path: `items[${i}]`, message: 'AU17: không được nêu viết tay/thứ tự nét' });
    }
  }
  for (const { ex, i } of activeExercises) {
    const text = collectStrings([ex.prompt, ex.payload, ex.feedbackCorrect, ex.feedbackIncorrect]);
    if (HANDWRITING.test(text.join(' '))) {
      errors.push({ path: `exercises[${i}]`, message: 'AU17: không được nêu viết tay/thứ tự nét' });
    }
  }
  return { errors, warnings };
}

// --- Danh mục đơn vị (xuyên đơn vị) ---

/** Kỹ năng áp quy tắc "nền tảng N5 5 phút" (Kanji không có tầng foundation). */
const FOUNDATION_KINDS = PLACEMENT_SKILLS;

/** Mục của đơn vị trong danh mục: đủ khóa tự nhiên để kiểm mục chính duy nhất. */
export interface CatalogItem {
  japanese?: string;
  reading?: string | null;
  scopeRef?: string;
  status?: 'active' | 'inactive';
}

/** Đơn vị trong danh mục: `items`/`name` tùy chọn; các trường biên soạn chỉ cần khi kiểm AU7–AU18. */
export type CatalogDraft = Pick<
  UnitDraft,
  'kind' | 'level' | 'tier' | 'estMinutes' | 'goalTags'
> & {
  /** Tên file (có hoặc không đuôi `.json`): dùng trong thông báo và làm đích của `requires`. */
  name?: string;
  items?: CatalogItem[];
  topic?: string;
  sequence?: number;
  requires?: string[];
  /** Số bài tập đang hoạt động (AU12). */
  exerciseCount?: number;
  /**
   * `false` = đơn vị NGOÀI baseline (áp quy tắc biên soạn mới); `true` = baseline (được miễn). Vắng mặt
   * được coi như baseline để tương thích với người gọi cũ (Admin, kiểm thử spec 001–007).
   */
  baseline?: boolean;
};

export interface CatalogOptions {
  /** Nghiệm thu `--final`: AU12 (kích thước chủ đề) thành lỗi và bật AU18. */
  final?: boolean;
  /** Danh mục phạm vi để kiểm `scopeRef` (AU8); không truyền thì chỉ kiểm ngữ pháp mới có `scopeRef`. */
  scopes?: readonly ScopeFile[];
  /** Danh sách chủ đề để kiểm `name.en` duy nhất (AU12). */
  topics?: readonly { key: string; skill: Skill; level: ContentLevel; name: Partial<I18nText> }[];
}

/** Đơn vị mới (ngoài baseline): phải khai `baseline: false` tường minh. */
const isFresh = (u: CatalogDraft): boolean => u.baseline === false;
const stem = (name: string | undefined): string => (name ?? '').replace(/\.json$/, '');
const levelIdx = (level: ContentLevel | undefined): number =>
  CONTENT_LEVELS.indexOf(level as ContentLevel);

/** Ngưỡng AU12, AU13 và AU18 (content-authoring.md §1, §4). */
const MIN_FIVE_MINUTE_RATIO = 0.3;
const TOPIC_MIN_UNITS = 2;
const TOPIC_MIN_EXERCISES = 20;
const FINAL_READING_UNITS = 30;
const FINAL_READING_TOPICS = 8;
const FINAL_READING_FORMS = 4;
const FINAL_WRITING_UNITS = 20;

/**
 * Kiểm tra danh mục đơn vị `active` (quy tắc xuyên đơn vị, R7/R13 và AU7–AU10, AU12, AU13, AU18): mỗi
 * (level × kind) trong `requiredLevels` có ≥ 1 đơn vị 5 phút (kể cả Kanji, SC-004); mỗi kind từ
 * vựng/ngữ pháp có ≥ 1 đơn vị N5 `foundation` 5 phút; mục chính duy nhất (Kanji, từ vựng, ngữ pháp);
 * `scopeRef`, `sequence`, `requires`; chủ đề; tỷ lệ 5 phút. Trả cả lỗi và cảnh báo.
 */
export function checkCatalog(
  units: CatalogDraft[],
  requiredLevels: readonly ContentLevel[] = CONTENT_LEVELS,
  options: CatalogOptions = {},
): UnitCheck {
  const errors: ContentIssue[] = [];
  const warnings: ContentIssue[] = [];
  const nameOf = (u: CatalogDraft, index: number): string => u.name ?? `#${index}`;

  for (const level of requiredLevels) {
    for (const kind of SKILLS) {
      if (!units.some((u) => u.level === level && u.kind === kind && u.estMinutes === 5)) {
        errors.push({ path: '', message: `thiếu đơn vị 5 phút cho ${level} × ${kind}` });
      }
    }
  }
  for (const kind of FOUNDATION_KINDS) {
    const ok = units.some(
      (u) => u.kind === kind && u.level === 'N5' && u.tier === 'foundation' && u.estMinutes === 5,
    );
    if (!ok) {
      errors.push({ path: '', message: `thiếu đơn vị N5 foundation 5 phút cho ${kind}` });
    }
  }

  // Mục chính duy nhất. Kanji: luôn (như spec 003). Từ vựng/ngữ pháp (AU7): chỉ báo khi ít nhất một bên
  // là đơn vị MỚI, vì baseline không sửa được bằng file.
  const holders = new Map<string, { name: string; fresh: boolean }>();
  units.forEach((u, index) => {
    const name = nameOf(u, index);
    const fresh = isFresh(u);
    for (const item of u.items ?? []) {
      if (item.status === 'inactive' || !item.japanese) continue;
      const keys: { key: string; label: string }[] = [];
      if (u.kind === 'kanji') keys.push({ key: `kanji|${item.japanese}`, label: item.japanese });
      else if (u.kind === 'vocabulary') {
        keys.push({
          key: `vocabulary|${item.japanese}|${item.reading ?? ''}`,
          label: `${item.japanese}|${item.reading ?? ''}`,
        });
      } else if (u.kind === 'grammar') {
        keys.push({ key: `grammar-text|${item.japanese}`, label: item.japanese });
        if (item.scopeRef) keys.push({ key: `grammar-ref|${item.scopeRef}`, label: item.scopeRef });
      } else continue;
      for (const { key, label } of keys) {
        const other = holders.get(key);
        if (other === undefined) {
          holders.set(key, { name, fresh });
        } else if (other.name !== name && (u.kind === 'kanji' || fresh || other.fresh)) {
          const prefix = u.kind === 'kanji' ? 'chữ' : 'AU7: mục';
          errors.push({
            path: '',
            message: `${prefix} 「${label}」 xuất hiện ở hai đơn vị 「${other.name}」 và 「${name}」`,
          });
        }
      }
    }
  });

  // AU8: `scopeRef` trỏ dòng danh mục tồn tại, cùng loại và trình độ; ngữ pháp mới bắt buộc có.
  const scopeRows = new Map<string, { kind: string; level: string }>();
  for (const scope of options.scopes ?? []) {
    if (scope.reference) continue;
    for (const row of scope.rows) scopeRows.set(row.id, { kind: scope.kind, level: scope.level });
  }
  units.forEach((u, index) => {
    const name = nameOf(u, index);
    (u.items ?? []).forEach((item, i) => {
      if (item.status === 'inactive') return;
      if (item.scopeRef !== undefined) {
        if (options.scopes === undefined) return;
        const row = scopeRows.get(item.scopeRef);
        if (!row) {
          errors.push({
            path: `${name}.items[${i}].scopeRef`,
            message: `AU8: scopeRef 「${item.scopeRef}」 không có trong danh mục phạm vi`,
          });
        } else if (row.kind !== u.kind || row.level !== u.level) {
          errors.push({
            path: `${name}.items[${i}].scopeRef`,
            message: `AU8: scopeRef 「${item.scopeRef}」 thuộc ${row.kind} ${row.level}, không khớp đơn vị ${u.kind} ${u.level}`,
          });
        }
      } else if (u.kind === 'grammar' && isFresh(u)) {
        errors.push({
          path: `${name}.items[${i}].scopeRef`,
          message: 'AU8: mẫu ngữ pháp mới phải có scopeRef trỏ dòng danh mục',
        });
      }
    });
  });

  // AU9: `sequence` theo mẫu chặng×100+vị trí, duy nhất trong (trình độ × loại) trên toàn thư viện.
  const bySequence = new Map<string, { name: string; fresh: boolean }[]>();
  units.forEach((u, index) => {
    const name = nameOf(u, index);
    if (isFresh(u)) {
      const seq = u.sequence;
      if (seq === undefined || seq < 100) {
        errors.push({
          path: `${name}.sequence`,
          message: 'AU9: sequence phải ≥ 100 (chặng × 100 + vị trí)',
        });
      } else if (seq % 10 !== 0 || seq % 100 === 0) {
        errors.push({
          path: `${name}.sequence`,
          message: `AU9: sequence ${seq} phải có dạng chặng × 100 + vị trí (10, 20, …, 90)`,
        });
      }
    }
    if (u.sequence !== undefined) {
      const key = `${u.level}|${u.kind}|${u.sequence}`;
      const list = bySequence.get(key) ?? [];
      list.push({ name, fresh: isFresh(u) });
      bySequence.set(key, list);
    }
  });
  for (const [key, list] of bySequence) {
    if (list.length > 1 && list.some((x) => x.fresh)) {
      const [level, kind, seq] = key.split('|');
      errors.push({
        path: '',
        message: `AU9: sequence ${seq} trùng trong ${level} × ${kind}: ${list.map((x) => x.name).join(', ')}`,
      });
    }
  }

  // AU10: `requires`.
  const byStem = new Map<string, CatalogDraft>();
  units.forEach((u, index) => byStem.set(stem(nameOf(u, index)), u));
  units.forEach((u, index) => {
    const name = nameOf(u, index);
    (u.requires ?? []).forEach((req, i) => {
      const at = `${name}.requires[${i}]`;
      const target = byStem.get(stem(req));
      if (!target) {
        errors.push({ path: at, message: `AU10: đơn vị 「${req}」 không tồn tại` });
        return;
      }
      const [tl, ts] = [levelIdx(target.level), target.sequence ?? 0];
      const [ul, us] = [levelIdx(u.level), u.sequence ?? 0];
      if (tl > ul) {
        errors.push({ path: at, message: `AU10: 「${req}」 thuộc trình độ cao hơn đơn vị này` });
      } else if (tl === ul && ts >= us) {
        errors.push({
          path: at,
          message: `AU10: (trình độ, sequence) của 「${req}」 phải nhỏ hơn của đơn vị này`,
        });
      }
      const goalTag = u.goalTags?.some((t) => t === 'work' || t === 'daily_conversation');
      if (goalTag && target.kind === u.kind) {
        errors.push({
          path: at,
          message:
            'AU10: đơn vị mang thẻ mục tiêu work/daily_conversation không được requires đơn vị cùng loại (có thể bị đề bạt vượt thứ tự)',
        });
      }
    });
  });
  const visiting = new Set<string>();
  const done = new Set<string>();
  const dfs = (node: string, trail: string[]): void => {
    if (done.has(node)) return;
    if (visiting.has(node)) {
      errors.push({
        path: '',
        message: `AU10: chu trình requires: ${[...trail.slice(trail.indexOf(node)), node].join(' → ')}`,
      });
      return;
    }
    visiting.add(node);
    for (const req of byStem.get(node)?.requires ?? []) {
      if (byStem.has(stem(req))) dfs(stem(req), [...trail, node]);
    }
    visiting.delete(node);
    done.add(node);
  };
  for (const name of byStem.keys()) dfs(name, []);

  // AU12: chủ đề. `name.en` trùng là LỖI (seed khớp chủ đề theo name.en nên sẽ gộp nhầm); kích thước
  // chủ đề là cảnh báo, thành lỗi ở `--final`.
  const seenTopicNames = new Map<string, string>();
  for (const topic of options.topics ?? []) {
    const en = topic.name.en?.trim();
    if (!en) continue;
    const key = `${topic.skill}|${topic.level}|${en}`;
    const other = seenTopicNames.get(key);
    if (other !== undefined) {
      errors.push({
        path: 'topics.json',
        message: `AU12: name.en 「${en}」 trùng giữa chủ đề 「${other}」 và 「${topic.key}」 (cùng ${topic.skill} × ${topic.level})`,
      });
    } else seenTopicNames.set(key, topic.key);
  }
  const topicUsage = new Map<string, { units: number; exercises: number; fresh: boolean }>();
  for (const u of units) {
    if (!u.topic || (u.kind !== 'vocabulary' && u.kind !== 'grammar' && u.kind !== 'kanji')) {
      continue;
    }
    const usage = topicUsage.get(u.topic) ?? { units: 0, exercises: 0, fresh: false };
    usage.units += 1;
    usage.exercises += u.exerciseCount ?? 0;
    usage.fresh ||= isFresh(u);
    topicUsage.set(u.topic, usage);
  }
  const sizeIssues = options.final ? errors : warnings;
  for (const [topic, usage] of topicUsage) {
    if (!usage.fresh) continue;
    if (usage.units < TOPIC_MIN_UNITS || usage.exercises < TOPIC_MIN_EXERCISES) {
      sizeIssues.push({
        path: 'topics.json',
        message: `AU12: chủ đề 「${topic}」 có ${usage.units} đơn vị, ${usage.exercises} bài tập (cần ≥ ${TOPIC_MIN_UNITS} đơn vị và ≥ ${TOPIC_MIN_EXERCISES} bài tập để thống kê mảng yếu có nghĩa)`,
      });
    }
  }

  // AU13: ≥ 30% đơn vị 5 phút mỗi (loại × trình độ) của từ vựng/ngữ pháp/Kanji.
  for (const kind of ['vocabulary', 'grammar', 'kanji'] as const) {
    for (const level of ['N4', 'N3'] as const) {
      const group = units.filter((u) => u.kind === kind && u.level === level);
      if (!group.some(isFresh)) continue;
      const five = group.filter((u) => u.estMinutes === 5).length;
      if (five / group.length < MIN_FIVE_MINUTE_RATIO) {
        warnings.push({
          path: '',
          message: `AU13: ${kind} ${level} có ${five}/${group.length} đơn vị 5 phút (cần ≥ ${MIN_FIVE_MINUTE_RATIO * 100}%)`,
        });
      }
    }
  }

  // AU18 (chỉ `--final`): số lượng luyện đọc/viết.
  if (options.final) {
    for (const level of ['N4', 'N3'] as const) {
      const reading = units.filter((u) => u.kind === 'reading' && u.level === level);
      const topics = new Set(reading.map((u) => u.topic).filter(Boolean));
      const forms = new Set(
        reading.flatMap((u) => (u.items ?? []).flatMap((i) => (i.scopeRef ? [i.scopeRef] : []))),
      );
      const writing = units.filter((u) => u.kind === 'writing' && u.level === level);
      const fail = (message: string): void => {
        errors.push({ path: '', message: `AU18: ${level} ${message}` });
      };
      if (reading.length < FINAL_READING_UNITS) {
        fail(`có ${reading.length} đơn vị reading (cần ≥ ${FINAL_READING_UNITS})`);
      }
      if (topics.size < FINAL_READING_TOPICS) {
        fail(`reading có ${topics.size} chủ đề (cần ≥ ${FINAL_READING_TOPICS})`);
      }
      if (forms.size < FINAL_READING_FORMS) {
        fail(`reading có ${forms.size} dạng qua scopeRef (cần ≥ ${FINAL_READING_FORMS})`);
      }
      if (writing.length < FINAL_WRITING_UNITS) {
        fail(`có ${writing.length} đơn vị writing (cần ≥ ${FINAL_WRITING_UNITS})`);
      }
    }
  }
  return { errors, warnings };
}

/** Như `checkCatalog` nhưng chỉ trả lỗi (kiểm tra danh mục khi seed). */
export function validateCatalog(
  units: CatalogDraft[],
  requiredLevels: readonly ContentLevel[] = CONTENT_LEVELS,
  options: CatalogOptions = {},
): ContentIssue[] {
  return checkCatalog(units, requiredLevels, options).errors;
}

/** Gộp lỗi thành chuỗi nhiều dòng để ghi nhật ký hoặc ném lỗi. */
export function formatIssues(issues: ContentIssue[]): string {
  return issues.map((i) => (i.path ? `${i.path}: ${i.message}` : i.message)).join('\n');
}
