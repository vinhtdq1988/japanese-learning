import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ContentIssue } from '../domain/content-validation.js';
import {
  DEFAULT_CONTENT_DIR,
  lintContent,
  listJson,
  loadContent,
  type UnitFile,
} from './content.js';

// Lệnh `pnpm content:lint` (spec 008, contracts/release-manifest.md §1 bước 2): kiểm tra nội dung theo JSON
// Schema, quy tắc T014, quy tắc đợt M1…M6 và quy tắc biên soạn AU1…AU18. Cờ `--drafts` kiểm thêm bản nháp
// ở `content/drafts/<mã-đợt>/` (KHÔNG bao giờ nạp vào seed) và so trùng với `content/units/`; cờ `--final`
// bật các quy tắc chỉ ở nghiệm thu (AU12 thành lỗi, AU18).

export interface LintRun {
  errors: ContentIssue[];
  warnings: ContentIssue[];
  /** Tên file bản nháp đã kiểm (rỗng khi không có `--drafts`). */
  draftFiles: string[];
}

/** Đọc mọi `content/drafts/<đợt>/*.json`; trả đơn vị (tên file không đuôi thư mục) và thư mục nguồn. */
async function loadDrafts(
  dir: string,
  readDir: (d: string) => Promise<string[]>,
): Promise<{ units: UnitFile[]; origins: Map<string, string>; problems: ContentIssue[] }> {
  const draftsDir = path.join(dir, 'drafts');
  const units: UnitFile[] = [];
  const origins = new Map<string, string>();
  const problems: ContentIssue[] = [];
  for (const release of await readDir(draftsDir)) {
    for (const file of await listJson(path.join(draftsDir, release))) {
      const where = `drafts/${release}/${file}`;
      try {
        const doc = JSON.parse(
          await readFile(path.join(draftsDir, release, file), 'utf8'),
        ) as UnitFile;
        if (origins.has(file)) {
          problems.push({
            path: where,
            message: `trùng tên file với bản nháp ở ${origins.get(file)}`,
          });
          continue;
        }
        origins.set(file, where);
        units.push({ ...doc, file });
      } catch (err) {
        problems.push({ path: where, message: `không đọc được: ${(err as Error).message}` });
      }
    }
  }
  return { units, origins, problems };
}

async function listSubdirs(dir: string): Promise<string[]> {
  const { readdir } = await import('node:fs/promises');
  try {
    return (await readdir(dir, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

/** Kiểm tra thư viện (mọi đợt) và, nếu `drafts`, cả bản nháp như thể chúng đã là đơn vị mới của thư viện. */
export async function lintLibrary(
  dir: string = DEFAULT_CONTENT_DIR,
  options: { drafts?: boolean; final?: boolean } = {},
): Promise<LintRun> {
  const content = await loadContent(dir, { releases: 'all' });
  if (!options.drafts) {
    const check = await lintContent(content, dir, { final: options.final });
    return { ...check, draftFiles: [] };
  }

  const drafts = await loadDrafts(dir, listSubdirs);
  const known = new Set(content.units.map((u) => u.file));
  const problems = [...drafts.problems];
  for (const draft of drafts.units) {
    if (known.has(draft.file)) {
      problems.push({
        path: drafts.origins.get(draft.file)!,
        message: `trùng tên file với đơn vị đã duyệt content/units/${draft.file}`,
      });
    }
  }
  const merged = {
    ...content,
    units: [...content.units, ...drafts.units.filter((u) => !known.has(u.file))].sort((a, b) =>
      a.file.localeCompare(b.file),
    ),
  };
  const check = await lintContent(merged, dir, { final: options.final });
  const draftNames = drafts.units.map((u) => u.file);
  // Chỉ báo vấn đề của bản nháp và quy tắc xuyên danh mục; vấn đề thuần của đơn vị đã duyệt thuộc lần lint thường.
  const relevant = (issue: ContentIssue): boolean =>
    issue.path === '' ||
    draftNames.some((name) => issue.path.startsWith(name) || issue.message.includes(name));
  return {
    errors: [...problems, ...check.errors.filter(relevant)],
    warnings: check.warnings.filter(relevant),
    draftFiles: draftNames,
  };
}

const format = (label: string, issue: ContentIssue): string =>
  `${label}  ${issue.path ? `${issue.path}: ` : ''}${issue.message}`;

/** Chạy lệnh; mã thoát `0` khi sạch lỗi, `1` khi có lỗi (cảnh báo không làm thất bại). */
export async function runLintCli(
  argv: readonly string[],
  write: (line: string) => void = console.log,
): Promise<number> {
  const known = new Set(['--drafts', '--final']);
  const unknown = argv.filter((a) => !known.has(a));
  if (unknown.length > 0) throw new Error(`Tham số không hợp lệ: ${unknown.join(' ')}`);
  const dir = process.env.CONTENT_DIR ?? DEFAULT_CONTENT_DIR;
  const run = await lintLibrary(dir, {
    drafts: argv.includes('--drafts'),
    final: argv.includes('--final'),
  });
  for (const issue of run.errors) write(format('LỖI     ', issue));
  for (const issue of run.warnings) write(format('CẢNH BÁO', issue));
  if (argv.includes('--drafts')) write(`Bản nháp đã kiểm: ${run.draftFiles.length} file.`);
  write(`Tổng: ${run.errors.length} lỗi, ${run.warnings.length} cảnh báo.`);
  return run.errors.length > 0 ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runLintCli(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((err: unknown) => {
      console.error(err instanceof Error ? err.message : err);
      process.exitCode = 1;
    });
}
