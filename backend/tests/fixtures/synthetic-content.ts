import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DEFAULT_CONTENT_DIR } from '../../src/seed/content.js';

// Nội dung TỔNG HỢP cho kiểm thử hạ tầng nội dung (spec 008): dựng thư mục `content/` tạm từ nội dung
// thật rồi thêm đợt/đơn vị giả. Người duyệt/ngày duyệt ở đây là DỮ LIỆU KIỂM THỬ, không phải hồ sơ thật.

/** Từ kana không trùng nhau (khóa `japanese|reading` duy nhất giữa các đơn vị tổng hợp). */
const WORDS = [
  'あさ',
  'ひる',
  'よる',
  'ゆうがた',
  'きのう',
  'きょう',
  'あした',
  'まいにち',
  'まいあさ',
  'まいばん',
  'せんしゅう',
  'らいしゅう',
  'こんしゅう',
  'まいしゅう',
  'せんげつ',
  'らいげつ',
  'こんげつ',
  'まいつき',
  'ことし',
  'らいねん',
];

export interface SyntheticUnit {
  kind: string;
  level: string;
  tier: string;
  topic: string;
  title: { vi: string; en: string };
  goalTags: string[];
  difficulty: number;
  estMinutes: number;
  isTrial: boolean;
  sequence: number;
  requires?: string[];
  items: Record<string, unknown>[];
  exercises: Record<string, unknown>[];
}

const choiceExercise = (
  item: string,
  format: 'context_fill' | 'synonym',
  tag: string,
): Record<string, unknown> => ({
  item,
  type: 'multiple_choice',
  format,
  prompt: {
    vi: `Chọn đáp án đúng cho 「${item}」 (${tag})`,
    en: `Choose the right answer for 「${item}」 (${tag})`,
  },
  payload: { choices: [item, 'ひなた', 'あらし'], correct_index: 0 },
  feedbackCorrect: {
    vi: `Đúng, 「${item}」 là đáp án hợp ngữ cảnh.`,
    en: `Correct, 「${item}」 fits the context.`,
  },
  feedbackIncorrect: {
    vi: `Chưa đúng, hãy xem lại nghĩa của 「${item}」 ở phần học.`,
    en: `Not quite, review the meaning of 「${item}」 in the lesson.`,
  },
});

/**
 * Đơn vị từ vựng N4 hợp lệ theo mọi quy tắc biên soạn (AU1…AU18): 2 từ kana, mỗi từ 2 bài gắn mục với hai
 * `format` khác nhau, `sequence` = `400 + 10·n`. `n` chọn cặp từ không trùng (n = 0…9).
 */
export function syntheticVocabUnit(n: number, over: Partial<SyntheticUnit> = {}): SyntheticUnit {
  const words = [WORDS[2 * n]!, WORDS[2 * n + 1]!];
  return {
    kind: 'vocabulary',
    level: 'N4',
    tier: 'core',
    topic: 'transport-places',
    title: { vi: `Từ vựng tổng hợp ${n}`, en: `Synthetic vocabulary ${n}` },
    goalTags: ['jlpt'],
    difficulty: 2,
    estMinutes: 5,
    isTrial: false,
    sequence: 400 + 10 * (n + 1),
    items: words.map((w) => ({
      japanese: w,
      reading: w,
      meaning: { vi: `Nghĩa của ${w}`, en: `Meaning of ${w}` },
      examples: [
        {
          ja: `${w}にあいます。`,
          reading: `${w}にあいます。`,
          translation: { vi: `Gặp vào ${w}.`, en: `I meet at ${w}.` },
        },
      ],
    })),
    exercises: words.flatMap((w) => [
      choiceExercise(w, 'context_fill', 'a'),
      choiceExercise(w, 'synonym', 'b'),
    ]),
    ...over,
  };
}

/** Tên file đơn vị tổng hợp theo CS1: `n4-vocabulary-synthetic-NN.json`. */
export const syntheticFileName = (n: number): string =>
  `n4-vocabulary-synthetic-${String(n + 1).padStart(2, '0')}.json`;

export interface SyntheticRelease {
  id: string;
  date: string;
  title: { vi: string; en: string };
  baseline?: boolean;
  sources?: { name: string; note: string }[];
  units: {
    file: string;
    reviewer?: string;
    reviewedOn?: string;
    checklist?: boolean;
  }[];
  amendments?: unknown[];
  notes?: string;
}

/** Manifest hợp lệ cho các đơn vị tổng hợp `0…count-1`, hồ sơ duyệt giả của kiểm thử. */
export function syntheticRelease(
  id = '001-synthetic',
  count = 1,
  over: Partial<SyntheticRelease> = {},
  firstUnit = 0,
): SyntheticRelease {
  return {
    id,
    date: '2026-12-05',
    title: { vi: 'Đợt tổng hợp', en: 'Synthetic release' },
    sources: [{ name: 'Nguồn thử', note: 'Chỉ dùng trong kiểm thử' }],
    units: Array.from({ length: count }, (_, i) => ({
      file: syntheticFileName(firstUnit + i),
      reviewer: 'Người duyệt thử nghiệm',
      reviewedOn: '2026-12-04',
      checklist: true,
    })),
    ...over,
  };
}

/** Sao chép `content/` thật vào thư mục tạm (không có đợt tổng hợp nào). Người gọi tự dọn dẹp. */
export async function copyContentDir(registry?: string[]): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'content-synthetic-'));
  registry?.push(dir);
  // Chỉ giữ đợt cơ sở: bỏ `drafts/` và mọi đợt phát hành thật (cùng đơn vị của chúng) để các kiểm thử
  // dùng thư mục tạm không bị lệch khi thư viện thật thêm đợt mới (số đơn vị, `sequence`, chủ đề).
  const baseline = JSON.parse(
    await readFile(path.join(DEFAULT_CONTENT_DIR, 'releases', '000-baseline.json'), 'utf8'),
  ) as { units: { file: string }[] };
  const baselineFiles = new Set(baseline.units.map((u) => u.file));
  await cp(DEFAULT_CONTENT_DIR, dir, {
    recursive: true,
    filter: (src) => {
      const rel = path.relative(DEFAULT_CONTENT_DIR, src).split(path.sep);
      if (rel[0] === 'drafts') return false;
      if (rel[0] === 'releases' && rel.length > 1) return rel[1] === '000-baseline.json';
      if (rel[0] === 'units' && rel.length > 1) return baselineFiles.has(rel[1]);
      return true;
    },
  });
  return dir;
}

/** Ghi manifest vào `releases/<id>.json` và các đơn vị vào `units/` của thư mục nội dung. */
export async function writeSyntheticRelease(
  dir: string,
  release: SyntheticRelease,
  units: Record<string, unknown> = {},
): Promise<void> {
  await mkdir(path.join(dir, 'releases'), { recursive: true });
  await writeFile(path.join(dir, 'releases', `${release.id}.json`), JSON.stringify(release));
  for (const [file, doc] of Object.entries(units)) {
    await writeFile(path.join(dir, 'units', file), JSON.stringify(doc));
  }
}

/** Dựng nhanh: thư mục tạm + một đợt tổng hợp `count` đơn vị từ vựng hợp lệ. */
export async function contentDirWithSyntheticRelease(
  count = 1,
  registry?: string[],
  id = '001-synthetic',
): Promise<string> {
  const dir = await copyContentDir(registry);
  const units: Record<string, unknown> = {};
  for (let n = 0; n < count; n += 1) units[syntheticFileName(n)] = syntheticVocabUnit(n);
  await writeSyntheticRelease(dir, syntheticRelease(id, count), units);
  return dir;
}
