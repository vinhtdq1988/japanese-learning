import type { DbExecutor } from '../db/client.js';
import { insertAdminLog } from '../db/repositories/admin-logs.js';
import {
  activateQuestion,
  activePositionTaken,
  deactivateAllQuestions,
  insertQuestion,
  listActiveQuestionIds,
  listQuestions,
  lockActiveSetChange,
  lockQuestion,
  questionsByIds,
  updateQuestion,
  type PlacementQuestionRow,
} from '../db/repositories/placement-admin.js';
import { getTopic } from '../db/repositories/units-admin.js';
import type { AdminPlacementQuestionInput } from '../domain/admin-validation.js';
import { CONTENT_LEVELS, AppError, type ContentLevel, type I18nText } from '../domain/types.js';
import type { ServiceDeps } from './deps.js';

// Dịch vụ quản trị bộ câu hỏi kiểm tra trình độ (T106, FR-007, FR-030, FR-032). Bộ hiện hành luôn gồm
// đúng 20 câu (8 N5, 6 N4, 6 N3) và chỉ đổi bằng thao tác kích hoạt nguyên tử cả bộ; `placement_results`
// cũ giữ nguyên `answers` và `score` đã chấm nên sửa/đổi bộ không làm sai lịch sử.

export type PlacementAdminDeps = Pick<ServiceDeps, 'db' | 'clock'>;

/** Số câu theo trình độ của bộ hiện hành (spec FR-007). */
export const PLACEMENT_SET_QUOTA: Record<ContentLevel, number> = { N5: 8, N4: 6, N3: 6 };
export const PLACEMENT_SET_SIZE = 20;

export interface AdminPlacementQuestionDto {
  id: string;
  level: PlacementQuestionRow['level'];
  skill: PlacementQuestionRow['skill'];
  topicId: string;
  prompt: string;
  hint: I18nText | null;
  choices: string[];
  correctChoice: number;
  position: number;
  isActive: boolean;
}

function toDto(row: PlacementQuestionRow): AdminPlacementQuestionDto {
  return {
    id: row.id,
    level: row.level,
    skill: row.skill,
    topicId: row.topicId,
    prompt: row.prompt.ja,
    hint: row.prompt.hint ?? null,
    choices: row.choices,
    correctChoice: row.correctChoice,
    position: row.position,
    isActive: row.isActive,
  };
}

function toValues(input: AdminPlacementQuestionInput) {
  return {
    level: input.level,
    skill: input.skill,
    topicId: input.topicId,
    prompt: input.hint ? { ja: input.prompt, hint: input.hint } : { ja: input.prompt },
    choices: input.choices,
    correctChoice: input.correctChoice,
  };
}

async function assertTopicSkill(db: DbExecutor, topicId: string, skill: string): Promise<void> {
  const topic = await getTopic(db, topicId);
  if (!topic) {
    throw new AppError(422, 'VALIDATION_FAILED', 'Dữ liệu không hợp lệ', {
      topicId: 'Mảng nội dung không tồn tại',
    });
  }
  if (topic.skill !== skill) {
    throw new AppError(422, 'VALIDATION_FAILED', 'Dữ liệu không hợp lệ', {
      topicId: `Mảng thuộc kỹ năng ${topic.skill}, không khớp câu hỏi ${skill}`,
    });
  }
}

const notFound = (): AppError => new AppError(404, 'NOT_FOUND', 'Không tìm thấy câu hỏi');
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

export async function listAdminPlacementQuestions(
  deps: Pick<PlacementAdminDeps, 'db'>,
): Promise<AdminPlacementQuestionDto[]> {
  return (await listQuestions(deps.db)).map(toDto);
}

/** Tạo câu hỏi ở trạng thái chưa kích hoạt; đưa vào bộ hiện hành bằng `setActivePlacementSet`. */
export async function createAdminPlacementQuestion(
  deps: PlacementAdminDeps,
  actorId: string,
  input: AdminPlacementQuestionInput,
): Promise<AdminPlacementQuestionDto> {
  return deps.db.transaction(async (tx) => {
    await assertTopicSkill(tx, input.topicId, input.skill);
    const row = await insertQuestion(tx, {
      ...toValues(input),
      position: input.position ?? 0,
      isActive: false,
      updatedAt: deps.clock.now(),
    });
    await insertAdminLog(tx, {
      actorId,
      action: 'placement_question.create',
      targetType: 'placement_question',
      targetId: row.id,
      diff: { after: toDto(row) },
    });
    return toDto(row);
  });
}

/**
 * Sửa câu hỏi (kể cả câu đang thuộc bộ hiện hành – có hiệu lực cho lần làm bài sau). Để bộ hiện hành luôn
 * đúng 8/6/6, câu đang kích hoạt không được đổi `level` và không được trùng `position` với câu khác của bộ.
 */
export async function updateAdminPlacementQuestion(
  deps: PlacementAdminDeps,
  actorId: string,
  questionId: string,
  input: AdminPlacementQuestionInput,
): Promise<AdminPlacementQuestionDto> {
  return deps.db.transaction(async (tx) => {
    const before = await lockQuestion(tx, questionId);
    if (!before) throw notFound();
    await assertTopicSkill(tx, input.topicId, input.skill);

    const position = input.position ?? before.position;
    if (before.isActive) {
      if (input.level !== before.level) {
        throw new AppError(
          422,
          'PLACEMENT_SET_INVALID',
          'Không đổi trình độ của câu đang thuộc bộ hiện hành; hãy kích hoạt một bộ mới',
          { level: 'Câu đang thuộc bộ hiện hành' },
        );
      }
      if (await activePositionTaken(tx, position, questionId)) {
        throw new AppError(422, 'VALIDATION_FAILED', 'Dữ liệu không hợp lệ', {
          position: 'Vị trí đã được câu khác của bộ hiện hành dùng',
        });
      }
    }

    const row = await updateQuestion(tx, questionId, {
      ...toValues(input),
      position,
      updatedAt: deps.clock.now(),
    });
    const [oldDto, newDto] = [toDto(before), toDto(row)];
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const key of Object.keys(newDto) as (keyof AdminPlacementQuestionDto)[]) {
      if (!same(oldDto[key], newDto[key])) changes[key] = { from: oldDto[key], to: newDto[key] };
    }
    await insertAdminLog(tx, {
      actorId,
      action: 'placement_question.update',
      targetType: 'placement_question',
      targetId: questionId,
      diff: { fields: changes },
    });
    return newDto;
  });
}

function invalidSet(message: string, fields?: Record<string, string>): AppError {
  return new AppError(422, 'PLACEMENT_SET_INVALID', message, fields);
}

/**
 * Kích hoạt nguyên tử một bộ câu hỏi thay cho bộ hiện hành: đúng 20 câu phân biệt, tồn tại, 8 N5 / 6 N4 /
 * 6 N3; thứ tự mảng = `position` (từ 1). Không hợp lệ thì 422 `PLACEMENT_SET_INVALID` và bộ hiện hành không
 * đổi. Khóa tư vấn tuần tự hóa hai lần kích hoạt đồng thời để không bao giờ có hơn một bộ hoạt động.
 */
export async function setActivePlacementSet(
  deps: PlacementAdminDeps,
  actorId: string,
  questionIds: readonly string[],
): Promise<void> {
  await deps.db.transaction(async (tx) => {
    await lockActiveSetChange(tx);

    if (new Set(questionIds).size !== questionIds.length) {
      throw invalidSet('Bộ câu hỏi có câu bị lặp lại', { questionIds: 'Có câu bị lặp lại' });
    }
    if (questionIds.length !== PLACEMENT_SET_SIZE) {
      throw invalidSet(`Bộ câu hỏi phải có đúng ${PLACEMENT_SET_SIZE} câu`, {
        questionIds: `Cần ${PLACEMENT_SET_SIZE} câu, nhận ${questionIds.length}`,
      });
    }
    const rows = await questionsByIds(tx, questionIds);
    if (rows.length !== questionIds.length) {
      throw invalidSet('Có câu hỏi không tồn tại', { questionIds: 'Có câu hỏi không tồn tại' });
    }
    const counts: Record<ContentLevel, number> = { N5: 0, N4: 0, N3: 0 };
    for (const row of rows) counts[row.level] += 1;
    const fields: Record<string, string> = {};
    for (const level of CONTENT_LEVELS) {
      if (counts[level] !== PLACEMENT_SET_QUOTA[level]) {
        fields[level] =
          `Cần đúng ${PLACEMENT_SET_QUOTA[level]} câu ${level}, nhận ${counts[level]}`;
      }
    }
    if (Object.keys(fields).length > 0) {
      throw invalidSet('Số câu theo trình độ không đúng (cần 8 N5, 6 N4, 6 N3)', fields);
    }

    const previous = await listActiveQuestionIds(tx);
    const now = deps.clock.now();
    await deactivateAllQuestions(tx, now);
    for (const [index, id] of questionIds.entries()) {
      await activateQuestion(tx, id, index + 1, now);
    }
    await insertAdminLog(tx, {
      actorId,
      action: 'placement_set.activate',
      targetType: 'placement_set',
      targetId: null,
      diff: { from: previous, to: [...questionIds] },
    });
  });
}
