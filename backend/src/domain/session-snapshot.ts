import { localize, resolveText, type Localizable } from './i18n.js';
import type { ExerciseType, I18nText, Language, Skill } from './types.js';

// Ảnh chụp (snapshot) nội dung của một phiên học (R12). Chụp một lần lúc bắt đầu phiên, đã bản địa
// hóa theo ngôn ngữ của người học, nên admin sửa nội dung giữa chừng không đổi bài tập của phiên đang
// học. Snapshot chứa cả đáp án (server dùng để chấm); dạng gửi cho người học (`publicExercise`) thì không.

export const SNAPSHOT_VERSION = 1;

export interface SnapshotItem {
  id: string;
  kind: Skill;
  japanese: string;
  reading: string | null;
  meaning: string;
  /** Vắng mặt khi mục không có giải thích (schema `ContentItem.explanation` không nhận null). */
  explanation?: string;
  examples: { ja: string; reading: string | null; translation: string }[];
}

export interface SnapshotExercise {
  id: string;
  itemId: string | null;
  topicId: string;
  type: ExerciseType;
  prompt: string;
  /** Payload gốc kèm đáp án (`correct_index`, `pairs`, `accepted_answers`); chỉ dùng phía server. */
  payload: Record<string, unknown>;
  feedbackCorrect: string;
  feedbackIncorrect: string;
}

export interface SessionSnapshot {
  version: typeof SNAPSHOT_VERSION;
  language: Language;
  /** Tiêu đề hiển thị của phiên (đơn vị học, hoặc "Ôn tập" với phiên ôn). */
  title: string;
  /** Đơn vị học của phiên; null với phiên ôn (mục đến từ nhiều đơn vị). */
  unitId: string | null;
  items: SnapshotItem[];
  exercises: SnapshotExercise[];
}

/** Dòng CSDL tối thiểu để dựng snapshot (tách khỏi Drizzle để hàm thuần, dễ kiểm thử). */
export interface ItemSource {
  id: string;
  kind: Skill;
  japanese: string;
  reading: string | null;
  meaning: I18nText;
  explanation: I18nText | null;
  examples: { ja: string; reading?: string | null; translation: I18nText }[];
  position: number;
  status: 'active' | 'inactive';
}

export interface ExerciseSource {
  id: string;
  itemId: string | null;
  /** Mảng nội dung của bài tập (mảng của đơn vị chứa nó). */
  topicId: string;
  type: ExerciseType;
  prompt: I18nText;
  payload: Record<string, unknown>;
  feedbackCorrect: I18nText;
  feedbackIncorrect: I18nText;
  position: number;
  status: 'active' | 'inactive';
}

const byPositionThenId = (
  a: { position: number; id: string },
  b: { position: number; id: string },
) => a.position - b.position || a.id.localeCompare(b.id);

/**
 * Dựng snapshot từ nội dung hiện hành. Chỉ lấy mục và bài tập `active` (data-model §2.10); bài tập gắn
 * với mục `inactive` cũng bị loại vì mục đó đã bị admin gỡ khỏi đơn vị.
 */
export function buildSnapshot(input: {
  title: I18nText;
  unitId: string | null;
  items: readonly ItemSource[];
  exercises: readonly ExerciseSource[];
  language: Language;
}): SessionSnapshot {
  const { language } = input;
  const items = input.items.filter((i) => i.status === 'active').sort(byPositionThenId);
  const activeItemIds = new Set(items.map((i) => i.id));

  return {
    version: SNAPSHOT_VERSION,
    language,
    title: localize(input.title, language),
    unitId: input.unitId,
    items: items.map((i) => ({
      id: i.id,
      kind: i.kind,
      japanese: i.japanese,
      reading: i.reading,
      meaning: localize(i.meaning, language),
      ...(i.explanation ? { explanation: localize(i.explanation, language) } : {}),
      examples: i.examples.map((e) => ({
        ja: e.ja,
        reading: e.reading ?? null,
        translation: localize(e.translation, language),
      })),
    })),
    exercises: input.exercises
      .filter((e) => e.status === 'active' && (e.itemId === null || activeItemIds.has(e.itemId)))
      .sort(byPositionThenId)
      .map((e) => ({
        id: e.id,
        itemId: e.itemId,
        topicId: e.topicId,
        type: e.type,
        prompt: localize(e.prompt, language),
        payload: e.payload,
        feedbackCorrect: localize(e.feedbackCorrect, language),
        feedbackIncorrect: localize(e.feedbackIncorrect, language),
      })),
  };
}

/**
 * Dựng snapshot cho phiên ôn tập (`kind='review'`, T079): mỗi mục trong `itemIds` được hỏi bằng đúng một
 * bài tập `active` của nó (để thời lượng gói ôn khớp `REVIEW_SECONDS_PER_ITEM`). Bài tập được chọn tất
 * định theo `seed` (ví dụ ngày địa phương) nên các ngày ôn khác nhau xoay vòng giữa các bài tập của mục,
 * còn tiếp tục phiên dở dang thì dùng lại snapshot đã lưu. Mục không còn bài tập `active` bị bỏ qua.
 * Thứ tự câu hỏi theo thứ tự ưu tiên của `itemIds`.
 */
export function buildReviewSnapshot(input: {
  title: I18nText;
  itemIds: readonly string[];
  items: readonly ItemSource[];
  exercises: readonly ExerciseSource[];
  language: Language;
  seed: string;
}): SessionSnapshot {
  const byItem = new Map<string, ExerciseSource[]>();
  for (const e of input.exercises) {
    if (e.status !== 'active' || e.itemId === null) continue;
    byItem.set(e.itemId, [...(byItem.get(e.itemId) ?? []), e]);
  }
  const chosen: ExerciseSource[] = [];
  for (const itemId of input.itemIds) {
    const options = (byItem.get(itemId) ?? []).sort(byPositionThenId);
    if (options.length === 0) continue;
    chosen.push(options[seedOf(`${input.seed}:${itemId}`) % options.length]!);
  }

  const snapshot = buildSnapshot({
    title: input.title,
    unitId: null,
    items: input.items.filter((i) => chosen.some((e) => e.itemId === i.id)),
    exercises: chosen,
    language: input.language,
  });
  const order = new Map(input.itemIds.map((id, i) => [id, i]));
  const rank = (itemId: string | null): number => (itemId ? (order.get(itemId) ?? 0) : 0);
  return {
    ...snapshot,
    items: [...snapshot.items].sort((a, b) => rank(a.id) - rank(b.id)),
    exercises: [...snapshot.exercises].sort((a, b) => rank(a.itemId) - rank(b.itemId)),
  };
}

// --- Dạng gửi cho người học (không đáp án) ---

export interface PublicExercise {
  id: string;
  type: ExerciseType;
  prompt: string;
  payload: Record<string, unknown>;
}

/** Hạt giống tất định từ chuỗi (FNV-1a) để xáo trộn ổn định giữa các lần tiếp tục phiên. */
function seedOf(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Xáo trộn tất định (Fisher–Yates) theo `seedText`. Với từ 2 phần tử trở lên, kết quả luôn khác thứ tự
 * gốc để cột vế phải không vô tình trùng đáp án.
 */
export function shuffleStable<T>(values: readonly T[], seedText: string): T[] {
  const out = [...values];
  const rand = mulberry32(seedOf(seedText));
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  const unchanged = out.length > 1 && out.every((v, i) => v === values[i]);
  return unchanged ? [...out.slice(1), out[0]!] : out;
}

/**
 * Bài tập gửi cho người học – KHÔNG chứa đáp án (FR-025, R16).
 * - multiple_choice: `{ choices: string[] }`
 * - matching: `{ left: string[], right: string[] }`, vế phải đã xáo; trả lời là danh sách cặp [trái, phải]
 * - fill_blank: `{ hint? }`
 */
export function publicExercise(exercise: SnapshotExercise, language: Language): PublicExercise {
  const base = { id: exercise.id, type: exercise.type, prompt: exercise.prompt };
  switch (exercise.type) {
    case 'multiple_choice': {
      const choices = (exercise.payload.choices as Localizable[]).map((c) =>
        resolveText(c, language),
      );
      return { ...base, payload: { choices } };
    }
    case 'matching': {
      const pairs = exercise.payload.pairs as [Localizable, Localizable][];
      const left = pairs.map(([l]) => resolveText(l, language));
      const right = shuffleStable(
        pairs.map(([, r]) => resolveText(r, language)),
        exercise.id,
      );
      return { ...base, payload: { left, right } };
    }
    case 'fill_blank': {
      const hint = exercise.payload.hint;
      return { ...base, payload: typeof hint === 'string' ? { hint } : {} };
    }
  }
}

/** Đọc snapshot lưu trong JSONB, từ chối dạng không nhận ra thay vì chấm sai âm thầm. */
export function parseSnapshot(raw: unknown): SessionSnapshot {
  const snap = raw as Partial<SessionSnapshot> | null;
  if (!snap || snap.version !== SNAPSHOT_VERSION || !Array.isArray(snap.exercises)) {
    throw new Error('Snapshot phiên học không hợp lệ hoặc thuộc phiên bản không hỗ trợ');
  }
  return snap as SessionSnapshot;
}
