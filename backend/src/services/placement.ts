import {
  clearCurrentPlacement,
  getCurrentPlacement,
  getPlacementById,
  getTopicNames,
  insertPlacementResult,
  listActiveQuestions,
  type PlacementQuestionRow,
  type PlacementResultRow,
} from '../db/repositories/placement.js';
import type { DbExecutor } from '../db/client.js';
import { getProfile } from '../db/repositories/profiles.js';
import type { PlacementAnswersInput } from '../domain/profile-validation.js';
import { localize } from '../domain/i18n.js';
import { AppError, DEFAULT_LANGUAGE, type Language } from '../domain/types.js';
import {
  GUESS_RATIO,
  gradePlacement,
  type EstimatedLevel,
  type PlacementAnswer,
  type PlacementOutcome,
} from '../engine/placement.js';
import type { ServiceDeps } from './deps.js';

// Dịch vụ kiểm tra trình độ (T048, R8): chấm trên server từ các câu trả lời, lưu kết quả hiện hành và
// giữ kết quả cũ làm lịch sử (FR-009). Phần chấm không lưu (`gradeAnswers`) cũng phục vụ khách dùng thử.

/** Thời gian tối đa của bài kiểm tra (đồng hồ ở client). */
export const PLACEMENT_TIME_LIMIT_SECONDS = 600;
/** Sai lệch cho phép giữa đồng hồ client và server khi kiểm tra `durationSeconds`. */
const DURATION_GRACE_SECONDS = 60;

export interface PlacementQuestionDto {
  id: string;
  skill: string;
  prompt: string;
  choices: string[];
}

export interface PlacementQuestionSetDto {
  timeLimitSeconds: number;
  questions: PlacementQuestionDto[];
}

export interface PlacementResultDto {
  id: string | null;
  estimatedLevel: EstimatedLevel;
  score: number;
  total: number;
  strongTopics: string[];
  weakTopics: string[];
  guessSuspected: boolean;
}

/** Bộ câu hỏi đang kích hoạt, KHÔNG kèm đáp án đúng (công khai). */
export async function getQuestionSet(
  deps: Pick<ServiceDeps, 'db'>,
  language: Language,
): Promise<PlacementQuestionSetDto> {
  const rows = await listActiveQuestions(deps.db);
  return {
    timeLimitSeconds: PLACEMENT_TIME_LIMIT_SECONDS,
    questions: rows.map((q) => ({
      id: q.id,
      skill: q.skill,
      // Gợi ý (nếu có) nối sau câu hỏi, theo ngôn ngữ giao diện.
      prompt: q.prompt.hint ? `${q.prompt.ja}\n${localize(q.prompt.hint, language)}` : q.prompt.ja,
      choices: q.choices,
    })),
  };
}

interface GradedAnswers {
  questions: PlacementQuestionRow[];
  /** Câu trả lời chuẩn hóa: đủ mọi câu của bộ hiện hành (câu thiếu = bỏ trống). */
  answers: PlacementAnswer[];
  outcome: PlacementOutcome;
}

function invalid(field: string, message: string): AppError {
  return new AppError(422, 'VALIDATION_FAILED', 'Dữ liệu không hợp lệ', { [field]: message });
}

/** Kiểm tra câu trả lời với bộ câu hỏi hiện hành rồi chấm; KHÔNG lưu gì. */
export async function gradeAnswers(
  db: DbExecutor,
  input: PlacementAnswersInput,
): Promise<GradedAnswers> {
  if (input.durationSeconds !== undefined) {
    if (input.durationSeconds > PLACEMENT_TIME_LIMIT_SECONDS + DURATION_GRACE_SECONDS) {
      throw invalid('durationSeconds', 'Quá thời gian làm bài cho phép');
    }
  }
  const questions = await listActiveQuestions(db);
  if (questions.length === 0) {
    throw new AppError(404, 'NOT_FOUND', 'Chưa có bộ câu hỏi kiểm tra trình độ');
  }

  const byId = new Map(questions.map((q) => [q.id, q]));
  const chosen = new Map<string, number | null>();
  for (const a of input.answers) {
    const q = byId.get(a.questionId);
    if (!q) throw invalid('answers', 'Có câu hỏi không thuộc bộ kiểm tra hiện hành');
    if (chosen.has(a.questionId)) throw invalid('answers', 'Mỗi câu hỏi chỉ được trả lời một lần');
    if (a.choice !== null && a.choice >= q.choices.length) {
      throw invalid('answers', 'Lựa chọn nằm ngoài các đáp án của câu hỏi');
    }
    chosen.set(a.questionId, a.choice);
  }

  const answers: PlacementAnswer[] = questions.map((q) => ({
    questionId: q.id,
    choice: chosen.get(q.id) ?? null,
  }));
  const outcome = gradePlacement(
    questions.map((q) => ({
      id: q.id,
      level: q.level,
      topicId: q.topicId,
      correctChoice: q.correctChoice,
    })),
    answers,
  );
  return { questions, answers, outcome };
}

async function toDto(
  db: DbExecutor,
  value: {
    id: string | null;
    estimatedLevel: EstimatedLevel;
    score: number;
    total: number;
    strongTopics: readonly string[];
    weakTopics: readonly string[];
  },
  language: Language,
): Promise<PlacementResultDto> {
  const names = await getTopicNames(db, [...value.strongTopics, ...value.weakTopics]);
  const label = (id: string): string => localize(names.get(id), language) || id;
  return {
    id: value.id,
    estimatedLevel: value.estimatedLevel,
    score: value.score,
    total: value.total,
    strongTopics: value.strongTopics.map(label),
    weakTopics: value.weakTopics.map(label),
    guessSuspected: value.total > 0 && value.score / value.total <= GUESS_RATIO,
  };
}

/** Kết quả chấm không lưu (khách dùng thử, FR-038): `id` là null. */
export async function gradeWithoutStoring(
  db: DbExecutor,
  input: PlacementAnswersInput,
  language: Language,
): Promise<PlacementResultDto> {
  const { outcome } = await gradeAnswers(db, input);
  return toDto(db, { id: null, ...outcome }, language);
}

/** Dạng DTO của một kết quả đã lưu (dùng cho `carriedPlacement`). */
export async function placementRowToDto(
  db: DbExecutor,
  row: PlacementResultRow,
  language: Language,
): Promise<PlacementResultDto> {
  return toDto(
    db,
    {
      id: row.id,
      estimatedLevel: row.estimatedLevel,
      score: row.score,
      total: row.answers.length,
      strongTopics: row.strongTopics,
      weakTopics: row.weakTopics,
    },
    language,
  );
}

/**
 * Nộp bài (cũng dùng để mang câu trả lời dùng thử sang – FR-039 – và làm lại – FR-009): chấm lại trên
 * server, đặt kết quả mới là hiện hành, kết quả cũ giữ làm lịch sử. KHÔNG đổi lộ trình hay tiến độ học;
 * việc xây dựng lại lộ trình do người học chọn qua `POST /path/rebuild` (T051).
 */
export async function submitPlacement(
  deps: ServiceDeps,
  userId: string,
  input: PlacementAnswersInput,
): Promise<PlacementResultDto> {
  const profile = await getProfile(deps.db, userId);
  const language = profile?.language ?? DEFAULT_LANGUAGE;
  const { answers, outcome } = await gradeAnswers(deps.db, input);

  const row = await deps.db.transaction(async (tx) => {
    await clearCurrentPlacement(tx, userId);
    return insertPlacementResult(tx, {
      userId,
      answers,
      estimatedLevel: outcome.estimatedLevel,
      strongTopics: outcome.strongTopics,
      weakTopics: outcome.weakTopics,
      score: outcome.score,
      durationSeconds: input.durationSeconds ?? null,
      takenAt: deps.clock.now(),
      isCurrent: true,
    });
  });
  return placementRowToDto(deps.db, row, language);
}

/** Kết quả hiện hành của người học (null nếu chưa làm). */
export async function getCurrentPlacementDto(
  deps: Pick<ServiceDeps, 'db'>,
  userId: string,
  language: Language,
): Promise<PlacementResultDto | null> {
  const row = await getCurrentPlacement(deps.db, userId);
  return row ? placementRowToDto(deps.db, row, language) : null;
}

/** Kết quả thuộc về người học, theo id (null nếu không phải của họ). */
export async function findOwnPlacement(
  db: DbExecutor,
  userId: string,
  id: string,
): Promise<PlacementResultRow | undefined> {
  return getPlacementById(db, userId, id);
}
