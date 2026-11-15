import type { Amendment, ExerciseType, I18nText, KanjiDetails } from './types.js';

// Bổ sung CHỈ-THÊM cho chữ Kanji đã có (spec 008, release-manifest.md §4, data-model §4.1). Phần thuần
// hàm dùng chung cho kiểm tra (đơn vị sau gộp phải đạt quy tắc Kanji) và seed (xem `seed/amendments.ts`):
// khóa so khớp — âm = chuỗi; ví dụ = `ja`; bài tập = `(item, facet, prompt.en)`. KHÔNG xóa/đổi giá trị cũ.

interface AmendableExample {
  ja: string;
  reading?: string;
  kanjiReading?: string;
  translation: I18nText;
}

interface AmendableExercise {
  item?: string;
  facet?: string;
  type: ExerciseType;
  prompt: I18nText;
  payload: Record<string, unknown>;
  feedbackCorrect: I18nText;
  feedbackIncorrect: I18nText;
}

export interface AmendableItem {
  japanese: string;
  kanjiDetails?: KanjiDetails;
  examples?: AmendableExample[];
}

export interface AmendableUnit {
  items: AmendableItem[];
  exercises: AmendableExercise[];
}

/** Số phần tử thực sự được thêm (0 ở mọi trường = lần áp lặp lại, không đổi gì). */
export interface AmendmentDelta {
  onReadings: number;
  kunReadings: number;
  examples: number;
  exercises: number;
}

/** Khóa so khớp bài tập: bài của chữ + khía cạnh + đề tiếng Anh. */
export const exerciseAmendKey = (item: string, facet: string, promptEn: string): string =>
  `${item}\u0000${facet}\u0000${promptEn}`;

/** Bổ sung có thực sự thêm gì không. */
export const isNoopDelta = (d: AmendmentDelta): boolean =>
  d.onReadings + d.kunReadings + d.examples + d.exercises === 0;

/**
 * Áp một `Amendment` lên bản sao của đơn vị. Trả đơn vị mới (không đổi `unit` gốc) và số phần tử đã thêm.
 * Ném lỗi khi không có chữ đích trong đơn vị (kiểm tra tồn tại thuộc quy tắc M6 của bộ nạp).
 */
export function mergeAmendment<U extends AmendableUnit>(
  unit: U,
  amendment: Amendment,
): { unit: U; delta: AmendmentDelta } {
  const index = unit.items.findIndex((i) => i.japanese === amendment.item);
  if (index < 0) throw new Error(`không có chữ 「${amendment.item}」 trong đơn vị`);
  const delta: AmendmentDelta = { onReadings: 0, kunReadings: 0, examples: 0, exercises: 0 };
  const copy = structuredClone(unit);
  const item = copy.items[index]!;
  const add = amendment.add;

  const details: KanjiDetails = item.kanjiDetails ?? {
    onReadings: [],
    kunReadings: [],
    strokeCount: 1,
  };
  for (const on of add.onReadings ?? []) {
    if (!details.onReadings.includes(on)) {
      details.onReadings.push(on);
      delta.onReadings += 1;
    }
  }
  for (const kun of add.kunReadings ?? []) {
    if (!details.kunReadings.includes(kun)) {
      details.kunReadings.push(kun);
      delta.kunReadings += 1;
    }
  }
  if (delta.onReadings + delta.kunReadings > 0 || item.kanjiDetails) item.kanjiDetails = details;

  const examples = (item.examples ??= []);
  for (const ex of add.examples ?? []) {
    if (!examples.some((e) => e.ja === ex.ja)) {
      examples.push({ ...ex });
      delta.examples += 1;
    }
  }

  const keys = new Set(
    copy.exercises.map((e) => exerciseAmendKey(e.item ?? '', e.facet ?? 'item', e.prompt.en)),
  );
  for (const ex of add.exercises ?? []) {
    const itemKey = ex.item ?? amendment.item;
    const key = exerciseAmendKey(itemKey, ex.facet, ex.prompt.en);
    if (keys.has(key)) continue;
    keys.add(key);
    copy.exercises.push({ ...ex, item: itemKey });
    delta.exercises += 1;
  }
  return { unit: copy, delta };
}
