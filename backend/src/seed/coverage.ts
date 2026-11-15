import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  FINAL_THRESHOLDS,
  buildCoverageReport,
  checkFinalThresholds,
  validateScopes,
  type ScopeUnit,
} from '../domain/content-scope.js';
import type { ContentIssue } from '../domain/content-validation.js';
import { formatIssues } from '../domain/content-validation.js';
import {
  CONTENT_LEVELS,
  SCOPE_KINDS,
  SKILLS,
  type ContentLevel,
  type CoverageReport,
  type ScopeKind,
  type Skill,
} from '../domain/types.js';
import {
  DEFAULT_CONTENT_DIR,
  compileSchema,
  loadContent,
  schemaIssues,
  type LoadedContent,
  type ReleaseSelection,
} from './content.js';

// Lệnh `pnpm content:coverage` và `pnpm content:stats` (spec 008, contracts/scope-catalog.md §4):
// báo cáo mức phủ danh mục phạm vi và thống kê khối lượng thư viện. Không phụ thuộc CSDL.

/** Mục tiêu khối lượng từ research D17 (FR-003; chỉ để so sánh khi in `--stats`). */
export const VOLUME_TARGETS: Record<Skill, { units: number; minutes: number } | null> = {
  grammar: { units: 56, minutes: 476 },
  vocabulary: { units: 260, minutes: 2210 },
  kanji: { units: 129, minutes: 1096 },
  reading: { units: 60, minutes: 450 },
  writing: { units: 40, minutes: 300 },
};

export interface CoverageRun {
  report: CoverageReport;
  content: LoadedContent;
  /** Lỗi cấu trúc danh mục (schema + định dạng id/khóa/nguồn). */
  scopeIssues: ContentIssue[];
}

/** Đơn vị đã duyệt dạng tối thiểu để tính độ phủ. */
export function toScopeUnits(content: LoadedContent): ScopeUnit[] {
  return content.units.map((u) => ({
    file: u.file,
    kind: u.kind,
    level: u.level,
    items: u.items.map((i) => ({
      japanese: i.japanese,
      reading: i.reading,
      scopeRef: i.scopeRef,
      examples: i.examples?.map((e) => ({ ja: e.ja })),
    })),
  }));
}

/** Nạp nội dung của các đợt được chọn và tính báo cáo độ phủ. Mặc định mọi đợt (khác vitest). */
export async function computeCoverage(
  dir: string = DEFAULT_CONTENT_DIR,
  options: { releases?: ReleaseSelection } = {},
): Promise<CoverageRun> {
  const content = await loadContent(dir, { releases: options.releases ?? 'all' });
  const scopeSchema = await compileSchema(dir, 'scope.schema.json');
  const scopeIssues: ContentIssue[] = [];
  for (const scope of content.scopes) {
    const { file, ...doc } = scope;
    scopeIssues.push(...schemaIssues(`scope/${file}`, scopeSchema, doc));
  }
  if (scopeIssues.length === 0) scopeIssues.push(...validateScopes(content.scopes));
  const report = buildCoverageReport(content.scopes, toScopeUnits(content));
  return { report, content, scopeIssues };
}

const pad = (value: string | number, width: number, right = false): string =>
  right ? String(value).padStart(width) : String(value).padEnd(width);

/** Phần trăm kiểu Việt Nam: một chữ số thập phân, dấu phẩy. */
const percent = (ratio: number): string => `${(ratio * 100).toFixed(1).replace('.', ',')}%`;

/** Bảng loại × trình độ đúng mẫu ở scope-catalog.md §4 (sau khi lọc theo `kind`/`level` nếu có). */
export function formatCoverageTable(
  report: CoverageReport,
  filter: { kind?: ScopeKind; level?: ContentLevel } = {},
): string {
  const lines = [
    `${pad('LOẠI', 12)} ${pad('TRÌNH ĐỘ', 9)} ${pad('TỔNG', 5, true)} ${pad('PHỦ', 5, true)} ${pad('LOẠI TRỪ', 8, true)} ${pad('CHƯA PHỦ', 8, true)} ${pad('%PHỦ', 7, true)}  NGƯỠNG`,
  ];
  for (const cell of report.byKindLevel) {
    if (filter.kind && cell.kind !== filter.kind) continue;
    if (filter.level && cell.level !== filter.level) continue;
    const threshold = FINAL_THRESHOLDS[cell.kind];
    const denominator = cell.total - cell.excluded;
    const verdict =
      threshold === null
        ? '—'
        : denominator === 0
          ? '— (danh mục rỗng)'
          : `≥ ${threshold * 100}% ${cell.percent >= threshold - 1e-9 ? '✔' : '✘'}`;
    lines.push(
      `${pad(cell.kind, 12)} ${pad(cell.level, 9)} ${pad(cell.total, 5, true)} ${pad(cell.covered, 5, true)} ${pad(cell.excluded, 8, true)} ${pad(cell.uncovered, 8, true)} ${pad(denominator === 0 ? '—' : percent(cell.percent), 7, true)}  ${verdict}`,
    );
  }
  return lines.join('\n');
}

export interface StatsCell {
  kind: Skill;
  level: ContentLevel;
  units: number;
  minutes: number;
  items: number;
  topics: number;
  byDuration: Record<number, number>;
}

/** Thống kê khối lượng: số đơn vị/phút/mục/chủ đề theo loại × trình độ × thời lượng (research D17). */
export function computeStats(content: LoadedContent): StatsCell[] {
  const cells: StatsCell[] = [];
  for (const kind of SKILLS) {
    for (const level of CONTENT_LEVELS) {
      const units = content.units.filter((u) => u.kind === kind && u.level === level);
      if (units.length === 0) continue;
      const byDuration: Record<number, number> = {};
      for (const u of units) byDuration[u.estMinutes] = (byDuration[u.estMinutes] ?? 0) + 1;
      cells.push({
        kind,
        level,
        units: units.length,
        minutes: units.reduce((sum, u) => sum + u.estMinutes, 0),
        items: units.reduce((sum, u) => sum + u.items.length, 0),
        topics: new Set(units.map((u) => u.topic)).size,
        byDuration,
      });
    }
  }
  return cells;
}

/** Bảng thống kê + so với mục tiêu D17 (chỉ tính các đơn vị N4/N3 vì mục tiêu là phần bổ sung). */
export function formatStatsTable(cells: StatsCell[]): string {
  const lines = [
    `${pad('LOẠI', 12)} ${pad('TRÌNH ĐỘ', 9)} ${pad('ĐƠN VỊ', 7, true)} ${pad('5 PHÚT', 7, true)} ${pad('10 PHÚT', 8, true)} ${pad('15 PHÚT', 8, true)} ${pad('PHÚT', 6, true)} ${pad('MỤC', 6, true)} ${pad('CHỦ ĐỀ', 7, true)}`,
  ];
  for (const c of cells) {
    lines.push(
      `${pad(c.kind, 12)} ${pad(c.level, 9)} ${pad(c.units, 7, true)} ${pad(c.byDuration[5] ?? 0, 7, true)} ${pad(c.byDuration[10] ?? 0, 8, true)} ${pad(c.byDuration[15] ?? 0, 8, true)} ${pad(c.minutes, 6, true)} ${pad(c.items, 6, true)} ${pad(c.topics, 7, true)}`,
    );
  }
  lines.push('', 'SO VỚI MỤC TIÊU D17 (đơn vị N4 + N3):');
  lines.push(
    `${pad('LOẠI', 12)} ${pad('ĐƠN VỊ', 7, true)} ${pad('MỤC TIÊU', 9, true)} ${pad('PHÚT', 6, true)} ${pad('MỤC TIÊU', 9, true)}`,
  );
  for (const kind of SKILLS) {
    const target = VOLUME_TARGETS[kind];
    if (!target) continue;
    const own = cells.filter((c) => c.kind === kind && c.level !== 'N5');
    lines.push(
      `${pad(kind, 12)} ${pad(
        own.reduce((s, c) => s + c.units, 0),
        7,
        true,
      )} ${pad(`≈ ${target.units}`, 9, true)} ${pad(
        own.reduce((s, c) => s + c.minutes, 0),
        6,
        true,
      )} ${pad(`≈ ${target.minutes}`, 9, true)}`,
    );
  }
  return lines.join('\n');
}

interface CliArgs {
  final: boolean;
  stats: boolean;
  listUncovered: boolean;
  kind?: ScopeKind;
  level?: ContentLevel;
  dir: string;
}

export function parseArgs(argv: readonly string[], env: NodeJS.ProcessEnv = process.env): CliArgs {
  const args: CliArgs = {
    final: false,
    stats: false,
    listUncovered: false,
    dir: env.CONTENT_DIR ?? DEFAULT_CONTENT_DIR,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    const value = (): string => {
      const next = argv[(i += 1)];
      if (next === undefined) throw new Error(`Thiếu giá trị cho ${arg}`);
      return next;
    };
    if (arg === '--final') args.final = true;
    else if (arg === '--stats') args.stats = true;
    else if (arg === '--list-uncovered') args.listUncovered = true;
    else if (arg === '--kind') {
      const kind = value();
      if (!(SCOPE_KINDS as readonly string[]).includes(kind)) {
        throw new Error(`--kind phải thuộc ${SCOPE_KINDS.join(', ')}`);
      }
      args.kind = kind as ScopeKind;
    } else if (arg === '--level') {
      const level = value().toUpperCase();
      if (level !== 'N4' && level !== 'N3') throw new Error('--level phải là N4 hoặc N3');
      args.level = level;
    } else if (arg === '--dir') args.dir = path.resolve(value());
    else throw new Error(`Tham số không hợp lệ: ${arg}`);
  }
  return args;
}

/** Chạy lệnh; trả mã thoát (0 đạt, 1 có vi phạm hoặc chưa đạt ngưỡng ở `--final`). */
export async function runCoverageCli(
  argv: readonly string[],
  write: (line: string) => void = console.log,
): Promise<number> {
  const args = parseArgs(argv);
  const { report, content, scopeIssues } = await computeCoverage(args.dir);

  if (args.stats) {
    write(formatStatsTable(computeStats(content)));
    return scopeIssues.length > 0 ? 1 : 0;
  }

  write(formatCoverageTable(report, args));
  let failed = false;
  if (scopeIssues.length > 0) {
    failed = true;
    write(`\nLỗi danh mục (${scopeIssues.length}):\n${formatIssues(scopeIssues)}`);
  }
  if (report.violations.length > 0) {
    failed = true;
    write(`\nVi phạm bất biến (${report.violations.length}):`);
    for (const v of report.violations) write(`  - [${v.type}] ${v.message}`);
  }
  if (args.listUncovered) {
    const rows = report.uncovered.filter(
      (u) => (!args.kind || u.kind === args.kind) && (!args.level || u.level === args.level),
    );
    write(`\nChưa phủ (${rows.length}):`);
    for (const u of rows) write(`  ${u.id}\t${u.key}`);
  }
  if (args.final) {
    const failures = checkFinalThresholds(report);
    if (failures.length > 0) {
      failed = true;
      write('\nChưa đạt nghiệm thu (--final):');
      for (const f of failures) write(`  - ${f}`);
    } else {
      write('\nĐạt nghiệm thu --final (FR-003, SC-001).');
    }
  }
  return failed ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runCoverageCli(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((err: unknown) => {
      console.error(err instanceof Error ? err.message : err);
      process.exitCode = 1;
    });
}
