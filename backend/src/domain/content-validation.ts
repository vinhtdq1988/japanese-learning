import { isCompleteI18nText, resolveText } from './i18n.js';
import { normalizeAnswer } from './grading.js';
import {
  CONTENT_LEVELS,
  EXERCISE_TYPES,
  LANGUAGES,
  SKILLS,
  UNIT_EST_MINUTES,
  type ContentLevel,
  type ExerciseType,
  type I18nText,
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

export interface ItemDraft {
  status?: 'active' | 'inactive';
  japanese?: string;
  reading?: string | null;
  meaning?: Partial<I18nText>;
  explanation?: Partial<I18nText> | null;
  examples?: { ja?: string; translation?: Partial<I18nText> }[];
}

export interface ExerciseDraft {
  status?: 'active' | 'inactive';
  type?: string;
  prompt?: Partial<I18nText>;
  payload?: Record<string, unknown>;
  feedbackCorrect?: Partial<I18nText>;
  feedbackIncorrect?: Partial<I18nText>;
}

export interface UnitDraft {
  kind?: Skill;
  level?: ContentLevel;
  tier?: UnitTier;
  estMinutes?: number;
  title?: Partial<I18nText>;
  items?: ItemDraft[];
  exercises?: ExerciseDraft[];
}

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

/** Kiểm tra một đơn vị học (điều kiện để kích hoạt). Chỉ xét mục/bài tập `active`. */
export function validateUnit(unit: UnitDraft): ContentIssue[] {
  const issues: ContentIssue[] = [];

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
  return issues;
}

/**
 * Kiểm tra danh mục đơn vị `active` (quy tắc xuyên đơn vị, R7/R13): mỗi (level × kind) trong
 * `requiredLevels` có ≥ 1 đơn vị 5 phút; mỗi kind có ≥ 1 đơn vị N5 `foundation` 5 phút.
 * `requiredLevels` mặc định là mọi trình độ; seed chỉ yêu cầu N5 và các trình độ đã có nội dung (xem `seed/content.ts`).
 */
export function validateCatalog(
  units: Pick<UnitDraft, 'kind' | 'level' | 'tier' | 'estMinutes'>[],
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
  for (const kind of SKILLS) {
    const ok = units.some(
      (u) => u.kind === kind && u.level === 'N5' && u.tier === 'foundation' && u.estMinutes === 5,
    );
    if (!ok) {
      issues.push({ path: '', message: `thiếu đơn vị N5 foundation 5 phút cho ${kind}` });
    }
  }
  return issues;
}

/** Gộp lỗi thành chuỗi nhiều dòng để ghi nhật ký hoặc ném lỗi. */
export function formatIssues(issues: ContentIssue[]): string {
  return issues.map((i) => (i.path ? `${i.path}: ${i.message}` : i.message)).join('\n');
}
