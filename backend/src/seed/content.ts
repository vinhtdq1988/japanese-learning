import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ajv, type ValidateFunction } from 'ajv';
import { mergeAmendment } from '../domain/amendments.js';
import {
  checkAuthoringUnit,
  checkCatalog,
  formatIssues,
  validateUnit,
  type AuthoringUnit,
  type ContentIssue,
  type UnitCheck,
  type UnitDraft,
} from '../domain/content-validation.js';
import { validateScopes } from '../domain/content-scope.js';
import {
  CONTENT_LEVELS,
  type ContentLevel,
  type ExerciseFormat,
  type GoalType,
  type I18nText,
  type KanjiDetails,
  type ReleaseManifest,
  type ReviewFacet,
  type ScopeFile,
  type Skill,
  type UnitTier,
} from '../domain/types.js';

// Nạp và kiểm tra nội dung gốc trong `content/` (R13): JSON Schema + quy tắc nội dung (T014) +
// ràng buộc xuyên file (khóa mảng, bộ placement 8/6/6, tập dùng thử). Không phụ thuộc CSDL.
//
// Spec 008: đơn vị được nạp theo ĐỢT PHÁT HÀNH (`content/releases/*.json`). Bộ nạp ĐÓNG KÍN: file trong
// `units/` không thuộc manifest nào là lỗi; `drafts/` KHÔNG BAO GIỜ được đọc. Đợt `000-baseline` (33 đơn
// vị có từ spec 001/003/007) được miễn các quy tắc biên soạn mới và hồ sơ duyệt.

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
  /** Siêu dữ liệu biên soạn (KHÔNG vào CSDL): `id` dòng danh mục phạm vi mà mục phủ. */
  scopeRef?: string;
}

export interface UnitFileExercise {
  /** `japanese` của mục mà bài tập kiểm tra. */
  item?: string;
  /** Khía cạnh kiểm tra; vắng mặt = `item`. */
  facet?: ReviewFacet;
  /** Siêu dữ liệu biên soạn (KHÔNG vào CSDL): dạng câu hỏi đề thi. */
  format?: ExerciseFormat;
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
  /** Siêu dữ liệu biên soạn (KHÔNG vào CSDL): tên file đơn vị nền (không đuôi). */
  requires?: string[];
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

/** Manifest đợt phát hành kèm tên file đã đọc. */
export interface ReleaseFile extends ReleaseManifest {
  file: string;
}

export interface LoadedContent {
  topics: TopicFile[];
  /** Chỉ đơn vị của các đợt được chọn (`selectedReleases`), sắp theo tên file. */
  units: UnitFile[];
  placement: PlacementFile;
  /** Mọi manifest trong `content/releases/` (không phụ thuộc lựa chọn) — để kiểm M1…M5. */
  releases: ReleaseFile[];
  /** Mã các đợt đã nạp đơn vị. */
  selectedReleases: string[];
  /** Mọi file `*.json` trong `content/units/` — để bắt file mồ côi (M1). */
  unitFiles: string[];
  /** Danh mục phạm vi `content/scope/*.json` (gồm file tham chiếu). */
  scopes: ScopeFile[];
}

/** `'all'` = mọi đợt; mảng = chỉ các đợt có mã trong mảng. */
export type ReleaseSelection = 'all' | readonly string[];

export interface LoadContentOptions {
  /** Đợt cần nạp; vắng mặt thì lấy từ biến `CONTENT_RELEASES` (`all` hoặc `id1,id2`), không có = `all`. */
  releases?: ReleaseSelection;
}

/** Số file đơn vị của đợt cơ sở (M5): N5 13 + N4 10 + N3 10. */
export const BASELINE_UNIT_COUNT = 33;

/**
 * Chọn đợt cần nạp. Tham số tường minh THẮNG biến môi trường `CONTENT_RELEASES` (D7: vitest đặt
 * `000-baseline`, kiểm thử nội dung thật truyền `'all'`).
 */
export function resolveReleaseSelection(
  option?: ReleaseSelection,
  env: Record<string, string | undefined> = process.env,
): ReleaseSelection {
  if (option !== undefined) return option;
  const raw = env.CONTENT_RELEASES?.trim();
  if (!raw || raw === 'all') return 'all';
  return raw
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id !== '');
}

async function readJson(file: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (err) {
    throw new Error(`Không đọc được ${file}: ${(err as Error).message}`, { cause: err });
  }
}

/** Liệt kê `*.json` trong thư mục (đã sắp); thư mục không tồn tại ⇒ rỗng. */
export async function listJson(dir: string): Promise<string[]> {
  try {
    return (await readdir(dir)).filter((f) => f.endsWith('.json')).sort();
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

/** Đọc danh mục phạm vi `content/scope/*.json` (chưa kiểm tra – xem `lintContent`). */
export async function loadScopeFiles(dir: string = DEFAULT_CONTENT_DIR): Promise<ScopeFile[]> {
  const scopeDir = path.join(dir, 'scope');
  const scopes: ScopeFile[] = [];
  for (const f of await listJson(scopeDir)) {
    scopes.push({ ...((await readJson(path.join(scopeDir, f))) as ScopeFile), file: f });
  }
  return scopes;
}

/**
 * Đọc nội dung từ thư mục `content/` (chưa kiểm tra – gọi `validateContent` sau đó). Chỉ nạp đơn vị
 * thuộc các đợt được chọn; `drafts/` không bao giờ được đọc.
 */
export async function loadContent(
  dir: string = DEFAULT_CONTENT_DIR,
  options: LoadContentOptions = {},
): Promise<LoadedContent> {
  const topicsDoc = (await readJson(path.join(dir, 'topics.json'))) as { topics: TopicFile[] };
  const placement = (await readJson(
    path.join(dir, 'placement', 'placement-v1.json'),
  )) as PlacementFile;

  const releaseDir = path.join(dir, 'releases');
  const releases: ReleaseFile[] = [];
  for (const f of await listJson(releaseDir)) {
    releases.push({ ...((await readJson(path.join(releaseDir, f))) as ReleaseManifest), file: f });
  }
  const selection = resolveReleaseSelection(options.releases);
  if (selection !== 'all') {
    const unknown = selection.filter((id) => !releases.some((r) => r.id === id));
    if (unknown.length > 0) {
      throw new Error(
        `Không có đợt phát hành ${unknown.map((id) => `"${id}"`).join(', ')} trong ${releaseDir}`,
      );
    }
  }
  const selected =
    selection === 'all' ? releases : releases.filter((r) => selection.includes(r.id));

  const unitDir = path.join(dir, 'units');
  const unitFiles = await listJson(unitDir);
  const wanted = new Set(
    selected.flatMap((r) => (Array.isArray(r.units) ? r.units.map((u) => u.file) : [])),
  );
  const units: UnitFile[] = [];
  for (const f of unitFiles) {
    if (!wanted.has(f)) continue;
    const doc = (await readJson(path.join(unitDir, f))) as UnitFile;
    units.push({ ...doc, file: f });
  }
  return {
    topics: topicsDoc.topics,
    units,
    placement,
    releases,
    selectedReleases: selected.map((r) => r.id),
    unitFiles,
    scopes: await loadScopeFiles(dir),
  };
}

export async function compileSchema(dir: string, name: string): Promise<ValidateFunction> {
  const schema = (await readJson(path.join(dir, 'schema', name))) as object;
  return new Ajv({ allErrors: true, strict: false }).compile(schema);
}

export function schemaIssues(
  label: string,
  validate: ValidateFunction,
  data: unknown,
): ContentIssue[] {
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

const isRealDate = (date: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(date) && new Date(`${date}T00:00:00Z`).toISOString().startsWith(date);

/**
 * Quy tắc đợt phát hành M1…M5 (release-manifest.md §3): file đơn vị thuộc đúng một manifest (M1) và tồn
 * tại (M2); hồ sơ duyệt đủ ở đợt không phải baseline (M3); `id` duy nhất, khớp tên file, đủ `sources` (M4);
 * baseline là đợt `000-baseline` với đúng 33 file (M5). M6 (amendments) ở `lintContent`; M7 (không nạp
 * `drafts/`) do bộ nạp bảo đảm. Hàm thuần.
 */
export function validateReleases(
  releases: readonly ReleaseFile[],
  unitFiles: readonly string[],
): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const present = new Set(unitFiles);
  const owners = new Map<string, string[]>();
  const ids = new Map<string, string>();

  for (const release of releases) {
    const at = (p: string): string => `releases/${release.file}${p ? `.${p}` : ''}`;
    const units = Array.isArray(release.units) ? release.units : [];

    if (ids.has(release.id)) {
      issues.push({
        path: at('id'),
        message: `M4: id "${release.id}" trùng với ${ids.get(release.id)}`,
      });
    }
    ids.set(release.id, release.file);
    if (release.file !== `${release.id}.json`) {
      issues.push({
        path: at('id'),
        message: `M4: id "${release.id}" phải khớp tên file ${release.file}`,
      });
    }
    if (typeof release.date !== 'string' || !isRealDate(release.date)) {
      issues.push({ path: at('date'), message: 'M4: date phải là ngày YYYY-MM-DD hợp lệ' });
    }
    const baseline = release.baseline === true;
    if (baseline !== (release.id === '000-baseline')) {
      issues.push({
        path: at('baseline'),
        message: baseline
          ? 'M5: chỉ đợt 000-baseline được đặt baseline: true'
          : 'M5: đợt 000-baseline phải đặt baseline: true',
      });
    }
    if (baseline && units.length !== BASELINE_UNIT_COUNT) {
      issues.push({
        path: at('units'),
        message: `M5: đợt cơ sở phải liệt kê đúng ${BASELINE_UNIT_COUNT} file (hiện có ${units.length})`,
      });
    }
    if (!baseline && (!Array.isArray(release.sources) || release.sources.length === 0)) {
      issues.push({
        path: at('sources'),
        message: 'M4: đợt phát hành phải ghi nguồn tham khảo (sources)',
      });
    }

    units.forEach((ref, i) => {
      const where = at(`units[${i}]`);
      if (!present.has(ref.file)) {
        issues.push({
          path: `${where}.file`,
          message: `M2: không có file content/units/${ref.file}`,
        });
      }
      owners.set(ref.file, [...(owners.get(ref.file) ?? []), release.id]);
      if (baseline) return;
      if (typeof ref.reviewer !== 'string' || ref.reviewer.trim() === '') {
        issues.push({ path: `${where}.reviewer`, message: 'M3: thiếu reviewer (hồ sơ duyệt)' });
      }
      if (typeof ref.reviewedOn !== 'string' || !isRealDate(ref.reviewedOn)) {
        issues.push({
          path: `${where}.reviewedOn`,
          message: 'M3: thiếu hoặc sai reviewedOn (YYYY-MM-DD)',
        });
      } else if (typeof release.date === 'string' && ref.reviewedOn > release.date) {
        issues.push({
          path: `${where}.reviewedOn`,
          message: `M3: reviewedOn (${ref.reviewedOn}) không được sau ngày đợt (${release.date})`,
        });
      }
      if (ref.checklist !== true) {
        issues.push({
          path: `${where}.checklist`,
          message: 'M3: checklist phải là true (người duyệt đã đi hết checklist)',
        });
      }
    });
  }

  if (!releases.some((r) => r.id === '000-baseline')) {
    issues.push({ path: 'releases', message: 'M5: thiếu đợt 000-baseline' });
  }
  for (const file of unitFiles) {
    const list = owners.get(file) ?? [];
    if (list.length === 0) {
      issues.push({
        path: `units/${file}`,
        message:
          'M1: file không thuộc manifest nào trong content/releases/ (mồ côi) — chưa được duyệt?',
      });
    } else if (list.length > 1) {
      issues.push({
        path: `units/${file}`,
        message: `M1: file thuộc nhiều manifest (${list.join(', ')}); chỉ được thuộc đúng một`,
      });
    }
  }
  return issues;
}

/** Chữ Hán được phép trong đoạn đọc/mục luyện viết của bài trình độ `level` (AU15). */
function allowedKanjiFor(content: LoadedContent, level: ContentLevel): Set<string> {
  const upTo = CONTENT_LEVELS.indexOf(level);
  const allowed = new Set<string>();
  for (const scope of content.scopes) {
    if (scope.kind !== 'kanji') continue;
    if (scope.reference || CONTENT_LEVELS.indexOf(scope.level as ContentLevel) <= upTo) {
      for (const row of scope.rows) allowed.add(row.key);
    }
  }
  for (const unit of content.units) {
    if (unit.kind === 'kanji' && CONTENT_LEVELS.indexOf(unit.level) <= upTo) {
      for (const item of unit.items) allowed.add(item.japanese);
    }
  }
  return allowed;
}

export interface LintOptions {
  /** Nghiệm thu: AU12 (kích thước chủ đề) thành lỗi và bật AU18. */
  final?: boolean;
}

/**
 * Kiểm tra toàn bộ nội dung đã nạp và tách cảnh báo khỏi lỗi: JSON Schema (đơn vị, chủ đề, placement,
 * đợt, danh mục), quy tắc T014 cho từng đơn vị, M1…M6, quy tắc biên soạn AU1…AU18 cho đơn vị NGOÀI
 * baseline, quy tắc danh mục, tham chiếu mảng/mục, bộ placement và tập dùng thử.
 */
export async function lintContent(
  content: LoadedContent,
  dir: string = DEFAULT_CONTENT_DIR,
  options: LintOptions = {},
): Promise<UnitCheck> {
  const issues: ContentIssue[] = [];
  const warnings: ContentIssue[] = [];
  const [topicsSchema, unitSchema, placementSchema, releaseSchema, scopeSchema] = await Promise.all(
    [
      compileSchema(dir, 'topics.schema.json'),
      compileSchema(dir, 'unit.schema.json'),
      compileSchema(dir, 'placement.schema.json'),
      compileSchema(dir, 'release.schema.json'),
      compileSchema(dir, 'scope.schema.json'),
    ],
  );

  issues.push(...schemaIssues('topics.json', topicsSchema, { topics: content.topics }));
  for (const u of content.units) {
    const { file, ...doc } = u;
    issues.push(...schemaIssues(file, unitSchema, doc));
  }
  issues.push(...schemaIssues('placement-v1.json', placementSchema, content.placement));
  for (const r of content.releases) {
    const { file, ...doc } = r;
    issues.push(...schemaIssues(`releases/${file}`, releaseSchema, doc));
  }
  for (const s of content.scopes) {
    const { file, ...doc } = s;
    issues.push(...schemaIssues(`scope/${file}`, scopeSchema, doc));
  }
  // Sai cấu trúc thì các kiểm tra sau không còn tin cậy được.
  if (issues.length > 0) return { errors: issues, warnings };

  issues.push(...validateReleases(content.releases, content.unitFiles));
  issues.push(...validateScopes(content.scopes));
  const baselineFiles = new Set(
    content.releases.filter((r) => r.baseline).flatMap((r) => r.units.map((u) => u.file)),
  );

  const topics = new Map<string, TopicFile>();
  for (const t of content.topics) {
    if (topics.has(t.key))
      issues.push({ path: 'topics.json', message: `khóa mảng "${t.key}" bị trùng` });
    topics.set(t.key, t);
  }

  const titles = new Set<string>();
  const allowedKanji: Partial<Record<ContentLevel, Set<string>>> = {};
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
    // Quy tắc biên soạn mới (AU) chỉ áp cho đơn vị ngoài baseline.
    if (!baselineFiles.has(u.file)) {
      allowedKanji[u.level] ??= allowedKanjiFor(content, u.level);
      const authoring = checkAuthoringUnit(u as AuthoringUnit, {
        allowedKanji: allowedKanji[u.level],
      });
      for (const issue of authoring.errors) {
        issues.push({ path: where(issue.path), message: issue.message });
      }
      for (const issue of authoring.warnings) {
        warnings.push({ path: where(issue.path), message: issue.message });
      }
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

  const catalog = checkCatalog(
    content.units.map((u) => ({
      ...u,
      name: u.file,
      baseline: baselineFiles.has(u.file),
      // Đơn vị không thuộc manifest nào (mồ côi) bị M1 chặn riêng; ở đây coi như đơn vị mới.
      exerciseCount: u.exercises.length,
    })),
    requiredLevels(content.units),
    { final: options.final, scopes: content.scopes, topics: content.topics },
  );
  issues.push(...catalog.errors);
  warnings.push(...catalog.warnings);
  issues.push(...validateAmendments(content, topics));

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
  return { errors: issues, warnings };
}

/**
 * Kiểm tra toàn bộ nội dung đã nạp (chỉ lỗi): xem `lintContent`. Trả danh sách lỗi (rỗng = hợp lệ).
 */
export async function validateContent(
  content: LoadedContent,
  dir: string = DEFAULT_CONTENT_DIR,
): Promise<ContentIssue[]> {
  return (await lintContent(content, dir)).errors;
}

/**
 * M6: `amendments` của các đợt được chọn trỏ tới đơn vị Kanji đã duyệt và chữ có thật; áp lần lượt (kể cả
 * nhiều bổ sung vào cùng đơn vị) rồi đơn vị sau gộp PHẢI đạt quy tắc Kanji (đủ ba khía cạnh, quỹ thời lượng).
 */
function validateAmendments(
  content: LoadedContent,
  topics: ReadonlyMap<string, TopicFile>,
): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const working = new Map<string, UnitFile>();
  const touched = new Map<string, string>();
  for (const release of content.releases) {
    if (!content.selectedReleases.includes(release.id)) continue;
    (release.amendments ?? []).forEach((amendment, i) => {
      const at = `releases/${release.file}.amendments[${i}]`;
      const target = content.units.find(
        (u) =>
          u.kind === 'kanji' &&
          u.level === amendment.unit.level &&
          u.title.en === amendment.unit.titleEn,
      );
      if (!target) {
        issues.push({
          path: `${at}.unit`,
          message: `M6: không có đơn vị Kanji ${amendment.unit.level} 「${amendment.unit.titleEn}」 đã duyệt`,
        });
        return;
      }
      const current = working.get(target.file) ?? target;
      if (!current.items.some((item) => item.japanese === amendment.item)) {
        issues.push({
          path: `${at}.item`,
          message: `M6: không có chữ 「${amendment.item}」 trong ${target.file}`,
        });
        return;
      }
      working.set(target.file, mergeAmendment(current, amendment).unit);
      touched.set(target.file, release.file);
    });
  }
  for (const [file, merged] of working) {
    for (const issue of validateUnit(merged as UnitDraft, {
      topicSkillOf: (key) => topics.get(key)?.skill,
    })) {
      issues.push({
        path: `releases/${touched.get(file)}.amendments`,
        message: `M6: ${file} sau khi gộp không đạt quy tắc Kanji — ${issue.path ? `${issue.path}: ` : ''}${issue.message} (nêu phương án ở notes: đổi estMinutes qua Admin API)`,
      });
    }
  }
  return issues;
}

/** Nạp + kiểm tra; ném lỗi liệt kê đủ mọi vấn đề nếu nội dung không hợp lệ. */
export async function loadValidatedContent(
  dir: string = DEFAULT_CONTENT_DIR,
  options: LoadContentOptions = {},
): Promise<LoadedContent> {
  const content = await loadContent(dir, options);
  const issues = await validateContent(content, dir);
  if (issues.length > 0) {
    throw new Error(`Nội dung trong ${dir} không hợp lệ:\n${formatIssues(issues)}`);
  }
  return content;
}
