import type { DbExecutor } from '../db/client.js';
import { insertAdminLog } from '../db/repositories/admin-logs.js';
import {
  getTopic,
  getUnit,
  insertExercise,
  insertItem,
  insertUnit,
  listExercises,
  listItems,
  listTopics,
  listUnits,
  lockUnit,
  updateExercise,
  updateItem,
  updateUnit,
  type ExerciseRow,
  type ItemRow,
  type UnitFilters,
  type UnitRow,
} from '../db/repositories/units-admin.js';
import type {
  AdminExerciseWrite,
  AdminItemWrite,
  AdminUnitWriteInput,
} from '../domain/admin-validation.js';
import { formatIssues, validateUnit, type ContentIssue } from '../domain/content-validation.js';
import { AppError, type I18nText } from '../domain/types.js';
import type { ServiceDeps } from './deps.js';

// Dịch vụ nội dung cho quản trị viên (T104, FR-030): tạo/sửa/kích hoạt-vô hiệu hóa đơn vị học cùng mục
// và bài tập lồng trong payload `AdminUnitWrite`. Quy tắc cốt lõi:
// - Phần tử có `id` được cập nhật tại chỗ, không có `id` được tạo mới, phần tử hiện có vắng mặt bị chuyển
//   `inactive` – KHÔNG xóa cứng, để `study_records`/`review_schedules` luôn còn hợp lệ (data-model §2.10).
// - Quy tắc nội dung đầy đủ (T014) chỉ bắt buộc với đơn vị `active`: khi kích hoạt và khi sửa đơn vị đang
//   hoạt động; bản nháp được lưu dở dang.
// - Phiên đang học giữ snapshot (R12) nên không bị đổi; phiên mới thấy thay đổi sau tối đa TTL bộ đệm (SC-008).
// - Mỗi thay đổi ghi `admin_action_logs` trong cùng giao dịch.

export type ContentDeps = Pick<ServiceDeps, 'db' | 'clock' | 'contentCache'>;

export interface AdminItemDto {
  id: string;
  status: ItemRow['status'];
  japanese: string;
  reading: string | null;
  meaning: I18nText;
  explanation: I18nText | null;
  examples: ItemRow['examples'];
}

export interface AdminExerciseDto {
  id: string;
  status: ExerciseRow['status'];
  itemIndex: number | null;
  type: ExerciseRow['type'];
  prompt: I18nText;
  payload: Record<string, unknown>;
  feedbackCorrect: I18nText;
  feedbackIncorrect: I18nText;
}

export interface AdminUnitDto {
  id: string;
  kind: UnitRow['kind'];
  title: I18nText;
  level: UnitRow['level'];
  goalTags: UnitRow['goalTags'];
  topicId: string;
  difficulty: number;
  tier: UnitRow['tier'];
  estMinutes: number;
  sequence: number;
  status: UnitRow['status'];
  isTrial: boolean;
  updatedAt: string;
  items?: AdminItemDto[];
  exercises?: AdminExerciseDto[];
}

function toUnitDto(unit: UnitRow): AdminUnitDto {
  return {
    id: unit.id,
    kind: unit.kind,
    title: unit.title,
    level: unit.level,
    goalTags: unit.goalTags,
    topicId: unit.topicId,
    difficulty: unit.difficulty,
    tier: unit.tier,
    estMinutes: unit.estMinutes,
    sequence: unit.sequence,
    status: unit.status,
    isTrial: unit.isTrial,
    updatedAt: unit.updatedAt.toISOString(),
  };
}

function toItemDto(item: ItemRow): AdminItemDto {
  return {
    id: item.id,
    status: item.status,
    japanese: item.japanese,
    reading: item.reading,
    meaning: item.meaning,
    explanation: item.explanation,
    examples: item.examples,
  };
}

/** Chi tiết đầy đủ; `itemIndex` của bài tập tính theo thứ tự `items` trả về (đối xứng với khi ghi). */
function toDetailDto(unit: UnitRow, items: ItemRow[], exercises: ExerciseRow[]): AdminUnitDto {
  const indexOfItem = new Map(items.map((item, index) => [item.id, index]));
  return {
    ...toUnitDto(unit),
    items: items.map(toItemDto),
    exercises: exercises.map((ex) => ({
      id: ex.id,
      status: ex.status,
      itemIndex: ex.itemId ? (indexOfItem.get(ex.itemId) ?? null) : null,
      type: ex.type,
      prompt: ex.prompt,
      payload: ex.payload,
      feedbackCorrect: ex.feedbackCorrect,
      feedbackIncorrect: ex.feedbackIncorrect,
    })),
  };
}

async function loadDetail(db: DbExecutor, unitId: string): Promise<AdminUnitDto> {
  const unit = await getUnit(db, unitId);
  if (!unit) throw notFound();
  const [items, exercises] = await Promise.all([listItems(db, unitId), listExercises(db, unitId)]);
  return toDetailDto(unit, items, exercises);
}

const notFound = (): AppError => new AppError(404, 'NOT_FOUND', 'Không tìm thấy đơn vị học');

function issuesToFields(issues: ContentIssue[]): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of issues) fields[issue.path || '_'] ??= issue.message;
  return fields;
}

/** Điều kiện để đơn vị được `active` (R13, data-model §2.8–2.10): ném 422 liệt kê từng lỗi theo vị trí. */
async function assertActivatable(db: DbExecutor, unitId: string): Promise<void> {
  const unit = await getUnit(db, unitId);
  if (!unit) throw notFound();
  const [items, exercises] = await Promise.all([listItems(db, unitId), listExercises(db, unitId)]);
  const issues = validateUnit({
    kind: unit.kind,
    level: unit.level,
    tier: unit.tier,
    estMinutes: unit.estMinutes,
    title: unit.title,
    items,
    exercises,
  });
  if (issues.length > 0) {
    throw new AppError(
      422,
      'VALIDATION_FAILED',
      `Đơn vị chưa đạt kiểm tra nội dung:\n${formatIssues(issues)}`,
      issuesToFields(issues),
    );
  }
}

/** Mảng phải tồn tại và khớp kỹ năng + trình độ của đơn vị (cùng quy tắc với seed). */
async function assertTopic(
  db: DbExecutor,
  topicId: string,
  kind: string,
  level: string,
): Promise<void> {
  const topic = await getTopic(db, topicId);
  if (!topic) {
    throw new AppError(422, 'VALIDATION_FAILED', 'Dữ liệu không hợp lệ', {
      topicId: 'Mảng nội dung không tồn tại',
    });
  }
  if (topic.skill !== kind || topic.level !== level) {
    throw new AppError(422, 'VALIDATION_FAILED', 'Dữ liệu không hợp lệ', {
      topicId: `Mảng thuộc ${topic.level} × ${topic.skill}, không khớp đơn vị ${level} × ${kind}`,
    });
  }
}

interface SyncResult {
  /** id theo đúng thứ tự phần tử trong payload. */
  ids: string[];
  created: string[];
  updated: string[];
  deactivated: string[];
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * Đồng bộ mục: có `id` → cập nhật, không có → tạo mới, phần tử hiện có vắng mặt → `inactive`.
 * Phần tử trong payload nhận `position` theo thứ tự mảng; phần tử bị gỡ xếp sau cùng nên thứ tự đọc lại
 * khớp thứ tự ghi (và `itemIndex` của bài tập nhất quán).
 */
async function syncItems(
  db: DbExecutor,
  unit: Pick<UnitRow, 'id' | 'kind'>,
  payload: readonly AdminItemWrite[],
  existing: readonly ItemRow[],
): Promise<SyncResult> {
  const byId = new Map(existing.map((e) => [e.id, e]));
  const errors: Record<string, string> = {};
  payload.forEach((item, i) => {
    if (item.id && !byId.has(item.id)) errors[`items[${i}].id`] = 'Mục không thuộc đơn vị này';
  });
  if (Object.keys(errors).length > 0) {
    throw new AppError(422, 'VALIDATION_FAILED', 'Dữ liệu không hợp lệ', errors);
  }

  const result: SyncResult = { ids: [], created: [], updated: [], deactivated: [] };
  for (const [position, item] of payload.entries()) {
    const values = {
      kind: unit.kind,
      japanese: item.japanese,
      reading: item.reading ?? null,
      meaning: item.meaning,
      explanation: item.explanation ?? null,
      examples: (item.examples ?? []) as ItemRow['examples'],
      position,
      status: item.status ?? 'active',
    } satisfies Partial<ItemRow>;
    const current = item.id ? byId.get(item.id) : undefined;
    if (current) {
      if (!same(pick(current, values), values)) {
        await updateItem(db, current.id, values);
        result.updated.push(current.id);
      }
      result.ids.push(current.id);
    } else {
      const created = await insertItem(db, { unitId: unit.id, ...values });
      result.ids.push(created.id);
      result.created.push(created.id);
    }
  }

  const kept = new Set(result.ids);
  let position = payload.length;
  for (const row of existing.filter((e) => !kept.has(e.id))) {
    await updateItem(db, row.id, { status: 'inactive', position });
    position += 1;
    if (row.status === 'active') result.deactivated.push(row.id);
  }
  return result;
}

async function syncExercises(
  db: DbExecutor,
  unit: Pick<UnitRow, 'id'>,
  payload: readonly AdminExerciseWrite[],
  itemIds: readonly string[],
  existing: readonly ExerciseRow[],
): Promise<SyncResult> {
  const byId = new Map(existing.map((e) => [e.id, e]));
  const errors: Record<string, string> = {};
  payload.forEach((ex, i) => {
    if (ex.id && !byId.has(ex.id)) errors[`exercises[${i}].id`] = 'Bài tập không thuộc đơn vị này';
    if (ex.itemIndex != null && ex.itemIndex >= itemIds.length) {
      errors[`exercises[${i}].itemIndex`] = 'itemIndex nằm ngoài danh sách items';
    }
  });
  if (Object.keys(errors).length > 0) {
    throw new AppError(422, 'VALIDATION_FAILED', 'Dữ liệu không hợp lệ', errors);
  }

  const result: SyncResult = { ids: [], created: [], updated: [], deactivated: [] };
  for (const [position, ex] of payload.entries()) {
    const values = {
      itemId: ex.itemIndex == null ? null : (itemIds[ex.itemIndex] ?? null),
      type: ex.type,
      prompt: ex.prompt,
      payload: ex.payload,
      feedbackCorrect: ex.feedbackCorrect,
      feedbackIncorrect: ex.feedbackIncorrect,
      position,
      status: ex.status ?? 'active',
    } satisfies Partial<ExerciseRow>;
    const current = ex.id ? byId.get(ex.id) : undefined;
    if (current) {
      if (!same(pick(current, values), values)) {
        await updateExercise(db, current.id, values);
        result.updated.push(current.id);
      }
      result.ids.push(current.id);
    } else {
      const created = await insertExercise(db, { unitId: unit.id, ...values });
      result.ids.push(created.id);
      result.created.push(created.id);
    }
  }

  const kept = new Set(result.ids);
  let position = payload.length;
  for (const row of existing.filter((e) => !kept.has(e.id))) {
    await updateExercise(db, row.id, { status: 'inactive', position });
    position += 1;
    if (row.status === 'active') result.deactivated.push(row.id);
  }
  return result;
}

/** Trích đúng các khóa của `template` từ `source` (so sánh trước/sau khi sửa tại chỗ). */
function pick<T extends object>(
  source: T,
  template: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.keys(template).map((k) => [k, (source as Record<string, unknown>)[k]]),
  );
}

/** Các trường vô hướng của đơn vị đã đổi, dạng `{ field: { from, to } }` cho nhật ký. */
function unitFieldChanges(
  before: UnitRow,
  after: UnitRow,
): Record<string, { from: unknown; to: unknown }> {
  const fields = [
    'kind',
    'title',
    'level',
    'goalTags',
    'topicId',
    'difficulty',
    'tier',
    'estMinutes',
    'sequence',
  ] as const;
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const f of fields) {
    if (!same(before[f], after[f])) changes[f] = { from: before[f], to: after[f] };
  }
  return changes;
}

const elementSummary = (sync: SyncResult | undefined) =>
  sync
    ? { created: sync.created, updated: sync.updated, deactivated: sync.deactivated }
    : 'unchanged';

// --- Truy vấn ---

export interface AdminTopicDto {
  id: string;
  skill: UnitRow['kind'];
  level: UnitRow['level'];
  name: I18nText;
}

export async function listAdminTopics(deps: Pick<ContentDeps, 'db'>): Promise<AdminTopicDto[]> {
  return (await listTopics(deps.db)).map((t) => ({
    id: t.id,
    skill: t.skill,
    level: t.level,
    name: t.name,
  }));
}

export async function listAdminUnits(
  deps: Pick<ContentDeps, 'db'>,
  filters: UnitFilters,
): Promise<AdminUnitDto[]> {
  return (await listUnits(deps.db, filters)).map(toUnitDto);
}

export async function getAdminUnit(
  deps: Pick<ContentDeps, 'db'>,
  unitId: string,
): Promise<AdminUnitDto> {
  return loadDetail(deps.db, unitId);
}

// --- Ghi ---

/** Tạo đơn vị ở trạng thái `draft` (kích hoạt riêng qua `setAdminUnitStatus`, khi đã đạt kiểm tra nội dung). */
export async function createAdminUnit(
  deps: ContentDeps,
  actorId: string,
  input: AdminUnitWriteInput,
): Promise<AdminUnitDto> {
  const dto = await deps.db.transaction(async (tx) => {
    await assertTopic(tx, input.topicId, input.kind, input.level);
    const unit = await insertUnit(tx, {
      kind: input.kind,
      title: input.title,
      level: input.level,
      goalTags: input.goalTags ?? [],
      topicId: input.topicId,
      difficulty: input.difficulty,
      tier: input.tier ?? 'core',
      estMinutes: input.estMinutes,
      sequence: input.sequence ?? 0,
      status: 'draft',
      updatedAt: deps.clock.now(),
    });
    const items = await syncItems(tx, unit, input.items ?? [], []);
    const exercises = await syncExercises(tx, unit, input.exercises ?? [], items.ids, []);
    await insertAdminLog(tx, {
      actorId,
      action: 'unit.create',
      targetType: 'unit',
      targetId: unit.id,
      diff: {
        after: {
          kind: unit.kind,
          level: unit.level,
          tier: unit.tier,
          title: unit.title,
          estMinutes: unit.estMinutes,
          items: items.ids.length,
          exercises: exercises.ids.length,
        },
      },
    });
    return loadDetail(tx, unit.id);
  });
  deps.contentCache.invalidate();
  return dto;
}

/**
 * Sửa đơn vị. Trường tùy chọn vắng mặt (`goalTags`, `tier`, `sequence`) giữ giá trị hiện có để một lần
 * lưu từ form thiếu trường không âm thầm đổi thứ tự hay mức độ. Đơn vị đang `active` phải còn đạt kiểm tra
 * nội dung sau khi sửa, nếu không toàn bộ thay đổi bị hoàn tác.
 */
export async function updateAdminUnit(
  deps: ContentDeps,
  actorId: string,
  unitId: string,
  input: AdminUnitWriteInput,
): Promise<AdminUnitDto> {
  const dto = await deps.db.transaction(async (tx) => {
    const before = await lockUnit(tx, unitId);
    if (!before) throw notFound();

    if (input.kind !== before.kind && before.status !== 'draft') {
      throw new AppError(422, 'VALIDATION_FAILED', 'Dữ liệu không hợp lệ', {
        kind: 'Chỉ đổi được kind khi đơn vị còn là bản nháp',
      });
    }
    const tier = input.tier ?? before.tier;
    if (tier === 'foundation' && input.level !== 'N5') {
      throw new AppError(422, 'VALIDATION_FAILED', 'Dữ liệu không hợp lệ', {
        tier: "tier='foundation' chỉ hợp lệ với level N5",
      });
    }
    await assertTopic(tx, input.topicId, input.kind, input.level);

    const [existingItems, existingExercises] = await Promise.all([
      listItems(tx, unitId),
      listExercises(tx, unitId),
    ]);
    // Danh sách vắng mặt trong payload nghĩa là "không đổi" (khác danh sách rỗng = gỡ hết).
    const items = input.items ? await syncItems(tx, before, input.items, existingItems) : undefined;
    const itemIds = items?.ids ?? existingItems.map((i) => i.id);
    const exercises = input.exercises
      ? await syncExercises(tx, before, input.exercises, itemIds, existingExercises)
      : undefined;
    await updateUnit(tx, unitId, {
      kind: input.kind,
      title: input.title,
      level: input.level,
      goalTags: input.goalTags ?? before.goalTags,
      topicId: input.topicId,
      difficulty: input.difficulty,
      tier,
      estMinutes: input.estMinutes,
      sequence: input.sequence ?? before.sequence,
      updatedAt: deps.clock.now(),
    });
    // Đổi kind (chỉ ở bản nháp) kéo theo kind của các mục.
    if (input.kind !== before.kind) {
      for (const row of existingItems) await updateItem(tx, row.id, { kind: input.kind });
    }
    if (before.status === 'active') await assertActivatable(tx, unitId);

    const after = (await getUnit(tx, unitId))!;
    await insertAdminLog(tx, {
      actorId,
      action: 'unit.update',
      targetType: 'unit',
      targetId: unitId,
      diff: {
        fields: unitFieldChanges(before, after),
        items: elementSummary(items),
        exercises: elementSummary(exercises),
      },
    });
    return loadDetail(tx, unitId);
  });
  deps.contentCache.invalidate();
  return dto;
}

/**
 * Đổi trạng thái hiển thị với người học và/hoặc cờ thuộc tập dùng thử (FR-037). Chuyển sang `active` chạy
 * quy tắc kiểm tra nội dung; không đạt thì 422 và đơn vị giữ nguyên trạng thái cũ.
 */
export async function setAdminUnitStatus(
  deps: ContentDeps,
  actorId: string,
  unitId: string,
  input: { status?: UnitRow['status']; isTrial?: boolean },
): Promise<AdminUnitDto> {
  const dto = await deps.db.transaction(async (tx) => {
    const before = await lockUnit(tx, unitId);
    if (!before) throw notFound();

    const status = input.status ?? before.status;
    const isTrial = input.isTrial ?? before.isTrial;
    const statusChanged = status !== before.status;
    const trialChanged = isTrial !== before.isTrial;
    if (!statusChanged && !trialChanged) return loadDetail(tx, unitId);

    await updateUnit(tx, unitId, { status, isTrial, updatedAt: deps.clock.now() });
    if (status === 'active' && statusChanged) await assertActivatable(tx, unitId);

    const diff: Record<string, unknown> = {};
    if (statusChanged) diff.status = { from: before.status, to: status };
    if (trialChanged) diff.isTrial = { from: before.isTrial, to: isTrial };
    await insertAdminLog(tx, {
      actorId,
      action: statusChanged ? 'unit.set_status' : 'unit.set_trial',
      targetType: 'unit',
      targetId: unitId,
      diff,
    });
    return loadDetail(tx, unitId);
  });
  deps.contentCache.invalidate();
  return dto;
}
