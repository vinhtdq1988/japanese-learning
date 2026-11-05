import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ajv, type ValidateFunction } from 'ajv';
import {
  formatIssues,
  validateCatalog,
  validateUnit,
  type ContentIssue,
  type UnitDraft,
} from '../domain/content-validation.js';
import {
  CONTENT_LEVELS,
  type ContentLevel,
  type GoalType,
  type I18nText,
  type KanjiDetails,
  type ReviewFacet,
  type Skill,
  type UnitTier,
} from '../domain/types.js';

// Nạp và kiểm tra nội dung gốc trong `content/` (R13): JSON Schema + quy tắc nội dung (T014) +
// ràng buộc xuyên file (khóa mảng, bộ placement 8/6/6, tập dùng thử). Không phụ thuộc CSDL.

export const DEFAULT_CONTENT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../content',
);

export interface TopicFile {
  key: string;
  skill: Skill;
  level: ContentLevel;
  name: I18nText;
}

export interface UnitFileItem {
  japanese: string;
  reading?: string;
  meaning: I18nText;
  explanation?: I18nText;
  examples?: { ja: string; reading?: string; kanjiReading?: string; translation: I18nText }[];
  /** Kanji: khóa chủ đề của chữ trong topics.json. */
  topic?: string;
  /** Kanji: âm On/Kun, số nét, thành phần. */
  kanjiDetails?: KanjiDetails;
}

export interface UnitFileExercise {
  /** `japanese` của mục mà bài tập kiểm tra. */
  item?: string;
  /** Khía cạnh kiểm tra; vắng mặt = `item`. */
  facet?: ReviewFacet;
  type: 'multiple_choice' | 'matching' | 'fill_blank';
  prompt: I18nText;
  payload: Record<string, unknown>;
  feedbackCorrect: I18nText;
  feedbackIncorrect: I18nText;
}

export interface UnitFile {
  /** Tên file nguồn, dùng trong thông báo lỗi. */
  file: string;
  kind: Skill;
  level: ContentLevel;
  tier?: UnitTier;
  topic: string;
  title: I18nText;
  goalTags?: GoalType[];
  difficulty: number;
  estMinutes: 5 | 10 | 15;
  sequence?: number;
  isTrial?: boolean;
  items: UnitFileItem[];
  exercises: UnitFileExercise[];
}

export interface PlacementQuestionFile {
  position: number;
  level: ContentLevel;
  skill: Skill;
  topic: string;
  prompt: string;
  hint?: I18nText;
  choices: string[];
  correctChoice: number;
}

export interface PlacementFile {
  version: string;
  timeLimitSeconds: number;
  questions: PlacementQuestionFile[];
}

export interface LoadedContent {
  topics: TopicFile[];
  units: UnitFile[];
  placement: PlacementFile;
}

async function readJson(file: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (err) {
    throw new Error(`Không đọc được ${file}: ${(err as Error).message}`, { cause: err });
  }
}

/** Đọc toàn bộ nội dung từ thư mục `content/` (chưa kiểm tra – gọi `validateContent` sau đó). */
export async function loadContent(dir: string = DEFAULT_CONTENT_DIR): Promise<LoadedContent> {
  const topicsDoc = (await readJson(path.join(dir, 'topics.json'))) as { topics: TopicFile[] };
  const placement = (await readJson(
    path.join(dir, 'placement', 'placement-v1.json'),
  )) as PlacementFile;
  const unitDir = path.join(dir, 'units');
  const unitFiles = (await readdir(unitDir)).filter((f) => f.endsWith('.json')).sort();
  const units: UnitFile[] = [];
  for (const f of unitFiles) {
    const doc = (await readJson(path.join(unitDir, f))) as UnitFile;
    units.push({ ...doc, file: f });
  }
  return { topics: topicsDoc.topics, units, placement };
}

async function compileSchema(dir: string, name: string): Promise<ValidateFunction> {
  const schema = (await readJson(path.join(dir, 'schema', name))) as object;
  return new Ajv({ allErrors: true, strict: false }).compile(schema);
}

function schemaIssues(label: string, validate: ValidateFunction, data: unknown): ContentIssue[] {
  if (validate(data)) return [];
  return (validate.errors ?? []).map((e) => ({
    path: `${label}${e.instancePath.replace(/\//g, '.')}`,
    message: e.message ?? 'không hợp lệ',
  }));
}

/** Trình độ bắt buộc đủ đơn vị 5 phút: N5 luôn bắt buộc, cộng mọi trình độ đã có nội dung. */
function requiredLevels(units: UnitFile[]): ContentLevel[] {
  const present = new Set<ContentLevel>(['N5', ...units.map((u) => u.level)]);
  return CONTENT_LEVELS.filter((l) => present.has(l));
}

const PLACEMENT_QUOTA: Record<ContentLevel, number> = { N5: 8, N4: 6, N3: 6 };
const TRIAL_MAX_MINUTES = 10;

/** Kiểm tra bộ placement ngoài JSON Schema: số câu theo trình độ, vị trí 1..20, mảng tồn tại. */
function validatePlacement(
  placement: PlacementFile,
  topics: Map<string, TopicFile>,
): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const counts: Record<ContentLevel, number> = { N5: 0, N4: 0, N3: 0 };
  const positions = new Set<number>();
  placement.questions.forEach((q, i) => {
    const at = `placement.questions[${i}]`;
    counts[q.level] += 1;
    if (positions.has(q.position)) {
      issues.push({ path: `${at}.position`, message: `vị trí ${q.position} bị trùng` });
    }
    positions.add(q.position);
    const topic = topics.get(q.topic);
    if (!topic) {
      issues.push({ path: `${at}.topic`, message: `không có mảng "${q.topic}" trong topics.json` });
    } else if (topic.skill !== q.skill) {
      issues.push({
        path: `${at}.topic`,
        message: `mảng "${q.topic}" thuộc kỹ năng ${topic.skill}`,
      });
    }
    if (new Set(q.choices).size !== q.choices.length) {
      issues.push({ path: `${at}.choices`, message: 'các lựa chọn không được trùng nhau' });
    }
  });
  for (const level of CONTENT_LEVELS) {
    if (counts[level] !== PLACEMENT_QUOTA[level]) {
      issues.push({
        path: 'placement.questions',
        message: `cần đúng ${PLACEMENT_QUOTA[level]} câu ${level}, hiện có ${counts[level]}`,
      });
    }
  }
  return issues;
}

/**
 * Kiểm tra toàn bộ nội dung đã nạp: JSON Schema, quy tắc T014 cho từng đơn vị, quy tắc danh mục,
 * tham chiếu mảng/mục, bộ placement và tập dùng thử. Trả danh sách lỗi (rỗng = hợp lệ).
 */
export async function validateContent(
  content: LoadedContent,
  dir: string = DEFAULT_CONTENT_DIR,
): Promise<ContentIssue[]> {
  const issues: ContentIssue[] = [];
  const [topicsSchema, unitSchema, placementSchema] = await Promise.all([
    compileSchema(dir, 'topics.schema.json'),
    compileSchema(dir, 'unit.schema.json'),
    compileSchema(dir, 'placement.schema.json'),
  ]);

  issues.push(...schemaIssues('topics.json', topicsSchema, { topics: content.topics }));
  for (const u of content.units) {
    const { file, ...doc } = u;
    issues.push(...schemaIssues(file, unitSchema, doc));
  }
  issues.push(...schemaIssues('placement-v1.json', placementSchema, content.placement));
  // Sai cấu trúc thì các kiểm tra sau không còn tin cậy được.
  if (issues.length > 0) return issues;

  const topics = new Map<string, TopicFile>();
  for (const t of content.topics) {
    if (topics.has(t.key))
      issues.push({ path: 'topics.json', message: `khóa mảng "${t.key}" bị trùng` });
    topics.set(t.key, t);
  }

  const titles = new Set<string>();
  for (const u of content.units) {
    const where = (p: string): string => (p ? `${u.file}.${p}` : u.file);
    for (const issue of validateUnit(u as UnitDraft, {
      topicSkillOf: (key) => topics.get(key)?.skill,
    })) {
      issues.push({ path: where(issue.path), message: issue.message });
    }
    const topic = topics.get(u.topic);
    if (!topic) {
      issues.push({
        path: where('topic'),
        message: `không có mảng "${u.topic}" trong topics.json`,
      });
    } else if (topic.skill !== u.kind || topic.level !== u.level) {
      issues.push({
        path: where('topic'),
        message: `mảng "${u.topic}" thuộc ${topic.level} × ${topic.skill}, không khớp đơn vị ${u.level} × ${u.kind}`,
      });
    }
    const natural = `${u.kind}|${u.level}|${u.title.en}`;
    if (titles.has(natural)) {
      issues.push({
        path: where('title'),
        message: 'trùng tiêu đề với đơn vị khác cùng loại và trình độ',
      });
    }
    titles.add(natural);
    const japanese = new Set(u.items.map((i) => i.japanese));
    if (japanese.size !== u.items.length) {
      issues.push({
        path: where('items'),
        message: 'trường japanese của các mục không được trùng nhau',
      });
    }
    u.exercises.forEach((ex, i) => {
      if (ex.item !== undefined && !japanese.has(ex.item)) {
        issues.push({
          path: where(`exercises[${i}].item`),
          message: `không có mục "${ex.item}" trong đơn vị`,
        });
      }
    });
  }

  issues.push(
    ...validateCatalog(
      content.units.map((u) => ({ ...u, name: u.file })),
      requiredLevels(content.units),
    ),
  );

  // Tập dùng thử mặc định (R9): 1 từ vựng + 1 ngữ pháp, tổng ≤ 10 phút.
  const trial = content.units.filter((u) => u.isTrial);
  for (const u of trial.filter((t) => t.kind === 'kanji')) {
    issues.push({
      path: u.file,
      message: 'đơn vị Kanji không được thuộc tập dùng thử (ngoài phạm vi)',
    });
  }
  const trialKinds = new Set(trial.map((u) => u.kind));
  const trialMinutes = trial.reduce((sum, u) => sum + u.estMinutes, 0);
  if (!trialKinds.has('vocabulary') || !trialKinds.has('grammar')) {
    issues.push({
      path: '',
      message: 'tập dùng thử cần ít nhất 1 đơn vị từ vựng và 1 đơn vị ngữ pháp',
    });
  }
  if (trialMinutes > TRIAL_MAX_MINUTES) {
    issues.push({
      path: '',
      message: `tập dùng thử dài ${trialMinutes} phút, tối đa ${TRIAL_MAX_MINUTES} phút`,
    });
  }

  issues.push(...validatePlacement(content.placement, topics));
  return issues;
}

/** Nạp + kiểm tra; ném lỗi liệt kê đủ mọi vấn đề nếu nội dung không hợp lệ. */
export async function loadValidatedContent(
  dir: string = DEFAULT_CONTENT_DIR,
): Promise<LoadedContent> {
  const content = await loadContent(dir);
  const issues = await validateContent(content, dir);
  if (issues.length > 0) {
    throw new Error(`Nội dung trong ${dir} không hợp lệ:\n${formatIssues(issues)}`);
  }
  return content;
}
