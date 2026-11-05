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
  type ExerciseType,
  type I18nText,
  type KanjiDetails,
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
  /** Chữ Kanji → đơn vị `active` KHÁC đang chứa nó (do dịch vụ truyền vào, đã loại đơn vị đang kiểm). */
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
    const holder = options.existingKanjiChars?.get(item.japanese!);
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

/** Đơn vị không phải Kanji không được chứa mục Kanji, bài tập chỉ có facet `item`. */
function validateNonKanjiUnit(unit: UnitDraft): ContentIssue[] {
  const issues: ContentIssue[] = [];
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
    issues.push(...validateNonKanjiUnit(unit));
  }
  return { errors: issues, warnings };
}

/** Như `checkUnit` nhưng chỉ trả danh sách lỗi (rỗng = hợp lệ). */
export function validateUnit(unit: UnitDraft, options: ValidateUnitOptions = {}): ContentIssue[] {
  return checkUnit(unit, options).errors;
}

/** Kỹ năng áp quy tắc "nền tảng N5 5 phút" (Kanji không có tầng foundation). */
const FOUNDATION_KINDS = PLACEMENT_SKILLS;

/** Đơn vị trong danh mục: `items`/`name` tùy chọn để kiểm tra chữ Kanji duy nhất toàn cục. */
export type CatalogDraft = Pick<UnitDraft, 'kind' | 'level' | 'tier' | 'estMinutes'> & {
  name?: string;
  items?: { japanese?: string; status?: 'active' | 'inactive' }[];
};

/**
 * Kiểm tra danh mục đơn vị `active` (quy tắc xuyên đơn vị, R7/R13): mỗi (level × kind) trong
 * `requiredLevels` có ≥ 1 đơn vị 5 phút (kể cả Kanji, SC-004); mỗi kind từ vựng/ngữ pháp có ≥ 1 đơn vị
 * N5 `foundation` 5 phút (không áp dụng cho Kanji); mỗi chữ Kanji chỉ thuộc MỘT đơn vị (research K10).
 * `requiredLevels` mặc định là mọi trình độ; seed chỉ yêu cầu N5 và các trình độ đã có nội dung (xem `seed/content.ts`).
 */
export function validateCatalog(
  units: CatalogDraft[],
  requiredLevels: readonly ContentLevel[] = CONTENT_LEVELS,
): ContentIssue[] {
  const issues: ContentIssue[] = [];
  for (const level of requiredLevels) {
    for (const kind of SKILLS) {
      if (!units.some((u) => u.level === level && u.kind === kind && u.estMinutes === 5)) {
        issues.push({ path: '', message: `thiếu đơn vị 5 phút cho ${level} × ${kind}` });
      }
    }
  }
  for (const kind of FOUNDATION_KINDS) {
    const ok = units.some(
      (u) => u.kind === kind && u.level === 'N5' && u.tier === 'foundation' && u.estMinutes === 5,
    );
    if (!ok) {
      issues.push({ path: '', message: `thiếu đơn vị N5 foundation 5 phút cho ${kind}` });
    }
  }
  const holders = new Map<string, string>();
  units.forEach((u, index) => {
    if (u.kind !== 'kanji') return;
    const name = u.name ?? `#${index}`;
    for (const item of u.items ?? []) {
      if (item.status === 'inactive' || !item.japanese) continue;
      const other = holders.get(item.japanese);
      if (other !== undefined && other !== name) {
        issues.push({
          path: '',
          message: `chữ 「${item.japanese}」 xuất hiện ở hai đơn vị 「${other}」 và 「${name}」`,
        });
      } else {
        holders.set(item.japanese, name);
      }
    }
  });
  return issues;
}

/** Gộp lỗi thành chuỗi nhiều dòng để ghi nhật ký hoặc ném lỗi. */
export function formatIssues(issues: ContentIssue[]): string {
  return issues.map((i) => (i.path ? `${i.path}: ${i.message}` : i.message)).join('\n');
}
