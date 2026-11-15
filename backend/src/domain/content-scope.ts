import type { ContentIssue } from './content-validation.js';
import {
  SCOPE_KINDS,
  type ContentLevel,
  type CoverageReport,
  type CoverageViolation,
  type ScopeFile,
  type ScopeKind,
  type ScopeRow,
  type ScopeRowStatus,
  type Skill,
  type UnitStatus,
} from './types.js';

// Danh mục phạm vi JLPT và độ phủ (spec 008, contracts/scope-catalog.md). Hàm thuần: nhận danh mục
// và đơn vị ĐÃ DUYỆT, trả báo cáo — trạng thái phủ được SUY RA, không bao giờ lưu.

/** Mục của đơn vị dùng để khớp danh mục (tương thích cấu trúc `UnitFileItem`). */
export interface ScopeUnitItem {
  japanese: string;
  reading?: string;
  scopeRef?: string;
  /** Ví dụ chỉ để minh họa: KHÔNG bao giờ được tính là phủ (FR-007). */
  examples?: { ja: string }[];
}

/** Đơn vị đã duyệt dùng tính độ phủ (tương thích cấu trúc `UnitFile`). */
export interface ScopeUnit {
  file: string;
  kind: Skill;
  level: ContentLevel;
  items: ScopeUnitItem[];
  /** Vắng mặt = `active` (nội dung nạp từ `content/units/`); đơn vị khác `active` không tính. */
  status?: UnitStatus;
  /** Đơn vị baseline (chỉ để ghi chú; được tính như đơn vị mới khi có `scopeRef` hồi tố). */
  baseline?: boolean;
}

/** Ngưỡng nghiệm thu `--final` (FR-003): tỷ lệ phủ tối thiểu mỗi trình độ; `null` = không có ngưỡng. */
export const FINAL_THRESHOLDS: Record<ScopeKind, number | null> = {
  grammar: 0.95,
  kanji: 0.95,
  vocabulary: 0.9,
  reading: null,
};

const LEVEL_ORDER: readonly ContentLevel[] = ['N4', 'N3'];

/**
 * Khóa tự nhiên của mục chính: Kanji = ký tự; từ vựng = `japanese|reading`; ngữ pháp/đọc = `scopeRef`
 * (chuỗi rỗng khi thiếu — không khớp dòng nào).
 */
export function itemKey(kind: Skill, item: ScopeUnitItem): string {
  switch (kind) {
    case 'kanji':
      return item.japanese;
    case 'vocabulary':
      return `${item.japanese}|${item.reading ?? ''}`;
    case 'grammar':
    case 'reading':
      return item.scopeRef ?? '';
    default:
      return '';
  }
}

/** Trạng thái phủ của một dòng: `exclude` > đủ `minUnits` đơn vị khớp > chưa phủ. */
export function statusOfRow(row: ScopeRow, matchedUnits: number): ScopeRowStatus {
  if (row.exclude) return 'excluded';
  return matchedUnits >= (row.minUnits ?? 1) ? 'covered' : 'uncovered';
}

/** Khóa dòng danh mục dùng khớp: Kanji/từ vựng theo `key`, ngữ pháp/đọc theo `id` (đối với `scopeRef`). */
const rowMatchKey = (kind: ScopeKind, row: ScopeRow): string =>
  kind === 'grammar' || kind === 'reading' ? row.id : row.key;

const isContentLevel = (level: string): level is ContentLevel =>
  (LEVEL_ORDER as readonly string[]).includes(level) || level === 'N5';

/**
 * Tính báo cáo mức phủ. File `reference: true` bị bỏ qua (chỉ dùng kiểm chữ Hán). Bốn bất biến luôn
 * được kiểm: `scopeRef` tồn tại, mục chính duy nhất (trừ dòng `reading` có `minUnits > 1`), khóa dòng duy
 * nhất theo loại, `exclude.reason` không rỗng; cộng khớp sai trình độ.
 */
export function buildCoverageReport(
  scopeFiles: readonly ScopeFile[],
  units: readonly ScopeUnit[],
): CoverageReport {
  const scopes = scopeFiles.filter((s) => !s.reference);
  const active = units.filter((u) => u.status === undefined || u.status === 'active');
  const violations: CoverageViolation[] = [];

  // Chỉ mục: loại → khóa dòng → dòng (để khớp nhanh và bắt khóa trùng).
  const rowsByKind = new Map<ScopeKind, Map<string, { row: ScopeRow; level: ContentLevel }[]>>();
  for (const scope of scopes) {
    if (!isContentLevel(scope.level)) continue;
    const level = scope.level as ContentLevel;
    const index = rowsByKind.get(scope.kind) ?? new Map();
    rowsByKind.set(scope.kind, index);
    for (const row of scope.rows) {
      const key = rowMatchKey(scope.kind, row);
      const bucket = index.get(key) ?? [];
      bucket.push({ row, level });
      index.set(key, bucket);
      if (row.exclude && row.exclude.reason.trim() === '') {
        violations.push({
          type: 'missing_reason',
          id: row.id,
          file: scope.file,
          message: `dòng ${row.id} bị loại trừ nhưng thiếu lý do (exclude.reason)`,
        });
      }
    }
  }
  // Khóa trùng: hai dòng cùng loại có cùng khóa (cả hai trình độ) — chỉ xét khóa tự nhiên (Kanji/từ vựng).
  for (const kind of ['kanji', 'vocabulary'] as const) {
    for (const [key, bucket] of rowsByKind.get(kind) ?? []) {
      if (bucket.length > 1) {
        violations.push({
          type: 'duplicate_key',
          id: bucket[1]!.row.id,
          message: `khóa 「${key}」 xuất hiện ở nhiều dòng danh mục ${kind}: ${bucket
            .map((b) => b.row.id)
            .join(', ')}`,
        });
      }
    }
  }

  // Khớp: dòng.id → tập tên file đơn vị chứa mục khớp.
  const matches = new Map<string, Set<string>>();
  const knownIds = new Map<ScopeKind, Set<string>>();
  for (const [kind, index] of rowsByKind) {
    const ids = new Set<string>();
    for (const bucket of index.values()) for (const b of bucket) ids.add(b.row.id);
    knownIds.set(kind, ids);
  }
  for (const unit of active) {
    const kind = unit.kind as ScopeKind;
    if (!(SCOPE_KINDS as readonly string[]).includes(kind)) continue;
    const index = rowsByKind.get(kind);
    for (const item of unit.items) {
      if ((kind === 'grammar' || kind === 'reading') && item.scopeRef !== undefined) {
        if (!knownIds.get(kind)?.has(item.scopeRef)) {
          violations.push({
            type: 'unknown_scope_ref',
            file: unit.file,
            message: `${unit.file}: scopeRef 「${item.scopeRef}」 không có trong danh mục ${kind}`,
          });
          continue;
        }
      }
      const key = itemKey(unit.kind, item);
      if (key === '') continue;
      for (const hit of index?.get(key) ?? []) {
        const set = matches.get(hit.row.id) ?? new Set<string>();
        set.add(unit.file);
        matches.set(hit.row.id, set);
        if (hit.level !== unit.level) {
          violations.push({
            type: 'level_mismatch',
            id: hit.row.id,
            file: unit.file,
            message: `${unit.file}: mục khớp dòng ${hit.row.id} (${hit.level}) nhưng đơn vị ở ${unit.level}`,
          });
        }
      }
    }
  }

  const uncovered: CoverageReport['uncovered'] = [];
  const excluded: CoverageReport['excluded'] = [];
  const cells = new Map<string, CoverageReport['byKindLevel'][number]>();
  for (const scope of scopes) {
    if (!isContentLevel(scope.level)) continue;
    const level = scope.level as ContentLevel;
    const id = `${scope.kind}|${level}`;
    const cell = cells.get(id) ?? {
      kind: scope.kind,
      level,
      total: 0,
      covered: 0,
      excluded: 0,
      uncovered: 0,
      percent: 1,
    };
    cells.set(id, cell);
    for (const row of scope.rows) {
      const files = matches.get(row.id)?.size ?? 0;
      const status = statusOfRow(row, files);
      cell.total += 1;
      if (status === 'excluded') {
        cell.excluded += 1;
        excluded.push({ id: row.id, key: row.key, reason: row.exclude!.reason });
      } else if (status === 'covered') {
        cell.covered += 1;
        // Mục chính duy nhất: dòng đã phủ nằm ở ≥ 2 đơn vị là vi phạm (trừ `reading` có minUnits > 1).
        if (files > 1 && !(scope.kind === 'reading' && (row.minUnits ?? 1) > 1)) {
          violations.push({
            type: 'duplicate_primary',
            id: row.id,
            message: `dòng ${row.id} (${row.key}) là mục chính của ${files} đơn vị: ${[
              ...matches.get(row.id)!,
            ].join(', ')}`,
          });
        }
      } else {
        cell.uncovered += 1;
        uncovered.push({ id: row.id, key: row.key, level, kind: scope.kind });
      }
    }
  }
  // `duplicate_primary` của dòng chưa đủ minUnits không xảy ra (chưa phủ), nên không cần xét thêm.

  const byKindLevel = [...cells.values()].sort(
    (a, b) =>
      SCOPE_KINDS.indexOf(a.kind) - SCOPE_KINDS.indexOf(b.kind) ||
      LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level),
  );
  for (const cell of byKindLevel) {
    const denominator = cell.total - cell.excluded;
    cell.percent = denominator > 0 ? cell.covered / denominator : 1;
  }
  return { byKindLevel, uncovered, excluded, violations };
}

/**
 * Ngưỡng nghiệm thu `--final` (FR-003, SC-001): mỗi (loại × trình độ) đạt ngưỡng tỷ lệ phủ, không còn dòng
 * chưa phủ, danh mục không rỗng ở ô có ngưỡng, và không có vi phạm bất biến. Trả danh sách lý do thất bại
 * (rỗng = đạt).
 */
export function checkFinalThresholds(report: CoverageReport): string[] {
  const failures: string[] = [];
  if (report.violations.length > 0) {
    failures.push(`còn ${report.violations.length} vi phạm bất biến danh mục`);
  }
  for (const cell of report.byKindLevel) {
    const where = `${cell.kind} ${cell.level}`;
    const threshold = FINAL_THRESHOLDS[cell.kind];
    const denominator = cell.total - cell.excluded;
    if (threshold !== null && denominator === 0) {
      failures.push(`${where}: danh mục rỗng, không thể nghiệm thu`);
      continue;
    }
    if (threshold !== null && cell.covered / denominator < threshold - 1e-9) {
      failures.push(
        `${where}: phủ ${cell.covered}/${denominator} (${(cell.percent * 100).toFixed(1)}%) < ngưỡng ${threshold * 100}%`,
      );
    }
    if (cell.uncovered > 0) {
      failures.push(`${where}: còn ${cell.uncovered} dòng chưa phủ (SC-001 yêu cầu 0)`);
    }
  }
  return failures;
}

// --- Kiểm tra cấu trúc danh mục (ngoài JSON Schema) ---

const KIND_PREFIX: Record<ScopeKind, string> = {
  kanji: 'k',
  vocabulary: 'v',
  grammar: 'g',
  reading: 'r',
};

/**
 * Kiểm tra danh mục phạm vi ngoài JSON Schema: mã nguồn của dòng có trong `sources`; tiền tố `id` khớp loại
 * và trình độ (`k-n4-…`, `r-n3-…`); `id` duy nhất toàn bộ danh mục; `key` đúng dạng (Kanji = 1 ký tự CJK,
 * từ vựng = `japanese|reading`); `minUnits` chỉ ở dòng `reading`. Hàm thuần.
 */
export function validateScopes(scopes: readonly ScopeFile[]): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const seen = new Map<string, string>();
  for (const scope of scopes) {
    const label = `scope/${scope.file ?? `${scope.level}-${scope.kind}`}`;
    scope.rows.forEach((row, i) => {
      const at = `${label}.rows[${i}]`;
      const prefix = `${KIND_PREFIX[scope.kind]}-${scope.level.toLowerCase()}-`;
      if (!row.id.startsWith(prefix)) {
        issues.push({
          path: `${at}.id`,
          message: `id 「${row.id}」 phải bắt đầu bằng 「${prefix}」 (loại ${scope.kind}, trình độ ${scope.level})`,
        });
      }
      const other = seen.get(row.id);
      if (other !== undefined) {
        issues.push({ path: `${at}.id`, message: `id 「${row.id}」 trùng với dòng ở ${other}` });
      }
      seen.set(row.id, label);
      for (const code of row.sources) {
        if (!(code in scope.sources)) {
          issues.push({
            path: `${at}.sources`,
            message: `mã nguồn 「${code}」 không có trong sources của file`,
          });
        }
      }
      if (scope.kind === 'kanji' && [...row.key].length !== 1) {
        issues.push({ path: `${at}.key`, message: 'khóa Kanji phải là đúng một ký tự' });
      }
      if (scope.kind === 'vocabulary') {
        const [japanese, reading] = row.key.split('|');
        if (!japanese || !reading || row.key.split('|').length !== 2) {
          issues.push({ path: `${at}.key`, message: 'khóa từ vựng phải có dạng japanese|reading' });
        }
      }
      if (row.minUnits !== undefined && scope.kind !== 'reading') {
        issues.push({ path: `${at}.minUnits`, message: 'minUnits chỉ dùng cho dòng reading' });
      }
    });
  }
  return issues;
}
