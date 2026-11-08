import { addDays, diffDays, toLocalDate } from './clock.js';
import { isPausedOn, type PausePeriod } from './daily-plan.js';
import {
  buildPathParams,
  rankUnits,
  type PathParams,
  type RankableUnit,
  type RankedUnit,
  type TopicStatInput,
  type UnitProgressStatus,
} from './path.js';
import type { Level, LocalDate, Skill, TargetLevel } from '../domain/types.js';

// Engine lộ trình LỚP (spec 004, research O7, Nguyên tắc II): lộ trình lớp là THAM SỐ MẪU tính động bằng
// `rankUnits` hiện có, không lưu danh sách đơn vị và không sao chép theo học viên (FR-017). Hàm thuần, không
// chạm CSDL. Chế độ liệt kê/ngày mở/bài giao (US5) bổ sung vào cùng file ở T094.

/** Lộ trình lớp theo mẫu (khớp `class_paths`). */
export interface ClassPathTemplateInput {
  startLevel: Level;
  targetLevel: TargetLevel;
  skills: readonly Skill[];
  startsOn: LocalDate;
  endsOn: LocalDate;
  dailyMinutes: number;
}

/**
 * `PathParams` của lộ trình lớp: tái dùng ngữ nghĩa `buildPathParams` — `none` ⇒ N5 + nền tảng trước,
 * khoảng trình độ `[start, min(target, N3)]`, `scopeNotice = 'content_ceiling_n3'` khi đích (hoặc điểm xuất
 * phát) là N2/N1. Lớp không có mục tiêu cá nhân hay mảng yếu từ placement: `goalType = null`, `weakTopics = []`,
 * `targetDate = ends_on`.
 */
export function classPathParams(template: ClassPathTemplateInput): PathParams {
  const base = buildPathParams(
    {
      currentLevel: template.startLevel,
      goalType: 'jlpt',
      targetLevel: template.targetLevel,
      targetDate: template.endsOn,
      skills: template.skills,
      prioritizedSkill: null,
    },
    null,
  );
  return {
    ...base,
    goalType: null,
    targetLevel: template.targetLevel,
    targetDate: template.endsOn,
    weakTopics: [],
  };
}

/** Một dòng lộ trình chế độ liệt kê (khớp `class_path_units`). */
export interface ExplicitPathUnit {
  unitId: string;
  position: number;
  /** Ngày mở; `null` = mở ngay. Đơn vị `opensOn > today` bị khóa. */
  opensOn: LocalDate | null;
}

/** Một bài giao còn hiệu lực (khớp `class_assignments`, chưa hủy). */
export interface AssignmentInput {
  unitId: string;
  dueOn: LocalDate;
}

export interface RankClassUnitsInput<U extends RankableUnit> {
  template: ClassPathTemplateInput;
  units: readonly U[];
  unitProgress: ReadonlyMap<string, UnitProgressStatus>;
  topicStats: readonly TopicStatInput[];
  /** Chế độ liệt kê: đúng danh sách giáo viên chọn; `null`/rỗng ⇒ chế độ mẫu. */
  explicit?: readonly ExplicitPathUnit[] | null;
  /** Id đơn vị được miễn cho học viên này: loại khỏi `ranked` và `required` (FR-026). */
  exemptions?: ReadonlySet<string>;
  /** Bài giao của lớp: đơn vị chưa xong được đẩy lên đầu (FR-024). */
  assignments?: readonly AssignmentInput[];
  /** Hôm nay theo múi giờ học viên; thiếu ⇒ không khóa theo ngày mở và bài giao chỉ xếp theo hạn. */
  today?: LocalDate;
}

export interface RankClassUnitsResult<U extends RankableUnit> {
  /**
   * Đơn vị kèm trạng thái của học viên: chưa hoàn thành trước (bài giao rồi thứ tự lộ trình), rồi đã hoàn thành,
   * rồi thành thạo. Đơn vị đã `completed/mastered` — kể cả trước khi vào lớp — tính là hoàn thành (US3.5). Đơn
   * vị còn khóa (`opensOn > today`) chưa hoàn thành KHÔNG có trong danh sách này (không vào kế hoạch/học thêm).
   */
  ranked: RankedUnit<U>[];
  /**
   * Tập đơn vị bắt buộc (mẫu số tiến độ): chế độ mẫu – cùng tập cho mọi học viên; chế độ liệt kê – đúng danh
   * sách chọn (kể cả đơn vị còn khóa); luôn trừ phần được miễn. Bài giao ngoài lộ trình KHÔNG vào mẫu số.
   */
  required: U[];
}

const rankGroup = (s: RankedUnit['status']): number =>
  s === 'completed' ? 1 : s === 'mastered' ? 2 : 0;

/** Chế độ mẫu: `rankUnits` hiện có (tập cố định theo mẫu, thứ tự thích ứng theo từng người). */
function templateCandidates<U extends RankableUnit>(
  input: RankClassUnitsInput<U>,
  units: readonly U[],
): { ranked: RankedUnit<U>[]; required: U[] } {
  const ranked = rankUnits(
    classPathParams(input.template),
    { skills: input.template.skills, prioritizedSkill: null, goalType: null },
    units,
    input.unitProgress,
    input.topicStats,
    { includeMastered: true },
  );
  return { ranked, required: ranked.map((r) => r.unit) };
}

/** Chế độ liệt kê: đúng danh sách theo `position`, chỉ đơn vị có trong danh mục (`active`), bỏ qua lọc mẫu. */
function explicitCandidates<U extends RankableUnit>(
  input: RankClassUnitsInput<U>,
  units: readonly U[],
  explicit: readonly ExplicitPathUnit[],
): { ranked: RankedUnit<U>[]; required: U[]; opensOn: Map<string, LocalDate | null> } {
  const byId = new Map(units.map((u) => [u.id, u]));
  const opensOn = new Map<string, LocalDate | null>();
  const ordered: { unit: U; position: number }[] = [];
  for (const e of [...explicit].sort((a, b) => a.position - b.position)) {
    const unit = byId.get(e.unitId);
    if (!unit || opensOn.has(e.unitId)) continue;
    opensOn.set(e.unitId, e.opensOn);
    ordered.push({ unit, position: e.position });
  }
  const ranked: RankedUnit<U>[] = ordered.map(({ unit, position }) => ({
    unit,
    status: input.unitProgress.get(unit.id) ?? 'pending',
    // Điểm giảm dần theo vị trí: thứ tự giáo viên chọn là thứ tự học.
    score: -position,
  }));
  ranked.sort((a, b) => rankGroup(a.status) - rankGroup(b.status));
  return { ranked, required: ordered.map((o) => o.unit), opensOn };
}

/**
 * Xếp hạng đơn vị của một học viên trong lớp.
 *
 * - **Chế độ mẫu** (không có `explicit`): `rankUnits(...)` nên tập đơn vị giống nhau cho mọi học viên còn thứ tự
 *   tinh chỉnh theo mảng yếu/độ khó của TỪNG người (kế hoạch riêng, không đổi lộ trình).
 * - **Chế độ liệt kê**: đúng danh sách giáo viên chọn theo `position`; đơn vị `opensOn > today` chưa hoàn thành bị
 *   khóa khỏi `ranked` nhưng vẫn nằm trong `required`.
 * - **Miễn bài** loại khỏi `ranked` và `required`; **bài giao** chưa xong, đã mở, không bị miễn được đẩy lên đầu
 *   (quá hạn trước – hạn cũ nhất trước – rồi hạn gần nhất). Bài giao ngoài lộ trình vẫn vào `ranked`.
 * Đơn vị không còn `active` không có trong `units` nên tự biến mất (FR-020).
 */
export function rankClassUnits<U extends RankableUnit>(
  input: RankClassUnitsInput<U>,
): RankClassUnitsResult<U> {
  const exempt = input.exemptions ?? new Set<string>();
  const units = exempt.size === 0 ? input.units : input.units.filter((u) => !exempt.has(u.id));
  const explicit = input.explicit && input.explicit.length > 0 ? input.explicit : null;

  const base = explicit
    ? explicitCandidates(input, units, explicit)
    : { ...templateCandidates(input, units), opensOn: new Map<string, LocalDate | null>() };

  const isLocked = (unitId: string): boolean => {
    const opens = base.opensOn.get(unitId);
    return input.today !== undefined && !!opens && opens > input.today;
  };
  let ranked = base.ranked.filter(
    (r) => r.status === 'completed' || r.status === 'mastered' || !isLocked(r.unit.id),
  );

  // Bài giao: tập đơn vị cần đẩy lên đầu (mỗi đơn vị một lần, hạn sớm nhất nếu trùng).
  const dueByUnit = new Map<string, LocalDate>();
  for (const a of input.assignments ?? []) {
    if (exempt.has(a.unitId)) continue;
    const known = dueByUnit.get(a.unitId);
    if (known === undefined || a.dueOn < known) dueByUnit.set(a.unitId, a.dueOn);
  }
  if (dueByUnit.size > 0) {
    const byId = new Map(units.map((u) => [u.id, u]));
    const inRanked = new Set(ranked.map((r) => r.unit.id));
    // Bài giao ngoài tập lộ trình vẫn phải học được: thêm vào `ranked` (không vào `required`).
    for (const unitId of dueByUnit.keys()) {
      const unit = byId.get(unitId);
      if (!unit || inRanked.has(unitId) || isLocked(unitId)) continue;
      ranked.push({ unit, status: input.unitProgress.get(unitId) ?? 'pending', score: 0 });
    }
    const assigned = (r: RankedUnit<U>): boolean =>
      dueByUnit.has(r.unit.id) && (r.status === 'pending' || r.status === 'in_progress');
    const head = ranked
      .filter(assigned)
      .sort(
        (a, b) =>
          dueByUnit.get(a.unit.id)!.localeCompare(dueByUnit.get(b.unit.id)!) ||
          a.unit.id.localeCompare(b.unit.id),
      );
    const rest = ranked.filter((r) => !assigned(r));
    // Đã hoàn thành/thành thạo luôn ở cuối; phần chưa xong không phải bài giao giữ thứ tự cũ.
    ranked = [...head, ...rest].sort((a, b) => rankGroup(a.status) - rankGroup(b.status));
  }
  return { ranked, required: [...base.required] };
}

// --- Cảnh báo khả thi (FR-025) ---

export interface FeasibilityInput {
  /** Tổng `estMinutes` các đơn vị bắt buộc còn phải học. */
  remainingMinutes: number;
  today: LocalDate;
  startsOn: LocalDate;
  endsOn: LocalDate;
  dailyMinutes: number;
  /** Khoảng tạm dừng của lớp: ngày tạm dừng không tính vào sức chứa. */
  pauses?: readonly PausePeriod[];
}

export interface Feasibility {
  requiredMinutes: number;
  capacityMinutes: number;
  /** `max(0, requiredMinutes − capacityMinutes)`. */
  overBy: number;
}

/** Số ngày tối đa duyệt khi đếm ngày còn lại (chặn mốc kết thúc quá xa). */
const MAX_CAPACITY_DAYS = 3660;

/**
 * `capacityMinutes = số ngày còn lại không tạm dừng × dailyMinutes`, ngày còn lại tính từ
 * `max(today, startsOn)` đến `endsOn` (cả hai đầu). Công thức đúng spec FR-025; thực tế một phần quỹ dành cho
 * ôn tập nên cảnh báo có thể lạc quan — client hiển thị kèm `capacityMinutes` để nêu rõ. Cảnh báo không chặn lưu.
 */
export function computeFeasibility(input: FeasibilityInput): Feasibility {
  const from = input.today > input.startsOn ? input.today : input.startsOn;
  const span = Math.min(diffDays(from, input.endsOn) + 1, MAX_CAPACITY_DAYS);
  const pauses = input.pauses ?? [];
  let days = 0;
  for (let i = 0; i < span; i++) {
    if (!isPausedOn(addDays(from, i), pauses)) days += 1;
  }
  const requiredMinutes = Math.max(0, Math.round(input.remainingMinutes));
  const capacityMinutes = days * input.dailyMinutes;
  return {
    requiredMinutes,
    capacityMinutes,
    overBy: Math.max(0, requiredMinutes - capacityMinutes),
  };
}

// --- Trạng thái bài giao theo học viên (research O12) ---

export type AssignmentState = 'pending' | 'on_time' | 'late' | 'overdue';

export interface AssignmentStateInput {
  dueOn: LocalDate;
  /** Thời điểm bài được giao (`class_assignments.created_at`). */
  assignedAt: Date;
  /** Thời điểm học viên hoàn thành đơn vị; `null` nếu chưa xong. */
  completedAt: Date | null;
  /** Hôm nay theo múi giờ học viên. */
  today: LocalDate;
  timezone: string;
}

/**
 * Trạng thái DẪN XUẤT từ dữ liệu học thật (không có bảng trạng thái riêng): đã xong ⇒ `on_time` nếu hoàn thành
 * trước khi được giao (ghi nhận, không làm lại) hoặc trong ngày `dueOn` theo múi giờ học viên, ngược lại `late`;
 * chưa xong ⇒ `overdue` khi đã quá hạn, `pending` khi chưa tới hạn.
 */
export function assignmentState(input: AssignmentStateInput): AssignmentState {
  if (input.completedAt) {
    if (input.completedAt < input.assignedAt) return 'on_time';
    return toLocalDate(input.completedAt, input.timezone) <= input.dueOn ? 'on_time' : 'late';
  }
  return input.today > input.dueOn ? 'overdue' : 'pending';
}

// --- Cảnh báo khả thi của bài giao (FR-025) ---

export interface AssignmentWarning {
  code: 'over_capacity';
  requiredMinutes: number;
  capacityMinutes: number;
  assignmentId: string;
}

export interface AssignmentWarningsInput {
  assignments: readonly { id: string; unitId: string; dueOn: LocalDate }[];
  units: readonly { id: string; estMinutes: number }[];
  today: LocalDate;
  dailyMinutes: number;
  /** Khoảng tạm dừng của cả lớp: ngày nghỉ không tính vào sức chứa. */
  pauses: readonly PausePeriod[];
}

/**
 * Với mỗi bài giao còn hạn (theo thứ tự hạn): khối lượng TÍCH LŨY của các bài giao đến hạn đó so với sức chứa
 * từ hôm nay đến hạn (`computeFeasibility`). Vượt quỹ ⇒ cảnh báo `over_capacity` gắn `assignmentId`; không chặn
 * lưu. Bài giao đã quá hạn không còn khả thi để tính nên bị bỏ qua.
 */
export function assignmentWarnings(input: AssignmentWarningsInput): AssignmentWarning[] {
  const minutes = new Map(input.units.map((u) => [u.id, u.estMinutes]));
  const sorted = [...input.assignments].sort(
    (a, b) => a.dueOn.localeCompare(b.dueOn) || a.id.localeCompare(b.id),
  );
  const warnings: AssignmentWarning[] = [];
  let cumulative = 0;
  for (const a of sorted) {
    cumulative += minutes.get(a.unitId) ?? 0;
    if (a.dueOn < input.today) continue;
    const f = computeFeasibility({
      remainingMinutes: cumulative,
      today: input.today,
      startsOn: input.today,
      endsOn: a.dueOn,
      dailyMinutes: input.dailyMinutes,
      pauses: input.pauses,
    });
    if (f.overBy > 0) {
      warnings.push({
        code: 'over_capacity',
        requiredMinutes: f.requiredMinutes,
        capacityMinutes: f.capacityMinutes,
        assignmentId: a.id,
      });
    }
  }
  return warnings;
}
