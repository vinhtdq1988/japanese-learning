import { sql } from 'drizzle-orm';
import type { DbExecutor } from '../db/client.js';
import { getActivePath } from '../db/repositories/paths.js';
import { findPlan, type DailyPlanItemRow } from '../db/repositories/plans.js';
import { getProfile, type ProfileRow } from '../db/repositories/profiles.js';
import {
  getDueDate,
  loadReviewContent,
  lockSchedule,
  recentItemResults,
  toSrsState,
  upsertSchedule,
} from '../db/repositories/review.js';
import {
  listSessionTopicResults,
  lockTopicStats,
  saveTopicStats,
} from '../db/repositories/topic-stats.js';
import {
  countPrimaryResults,
  ensureUnitInProgress,
  findOpenExtraSession,
  findPrimaryRecord,
  findRecordByClientEvent,
  findSessionForPlanItem,
  getPlanItemForUser,
  getSession,
  insertSession,
  insertStudyInterval,
  insertStudyRecord,
  listIncorrectItemIds,
  listPlanItemStatuses,
  listPrimaryRecords,
  listSessionIntervals,
  markPlanCompleted,
  markPlanItemInProgress,
  markSessionCompleted,
  markUnitCompleted,
  setPlanItemStatus,
  type SessionRow,
  type StudyRecordRow,
} from '../db/repositories/sessions.js';
import { gradeExercise } from '../domain/grading.js';
import { unionDurationSeconds } from '../domain/intervals.js';
import {
  buildReviewSnapshot,
  parseSnapshot,
  publicExercise,
  type PublicExercise,
  type SessionSnapshot,
  type SnapshotExercise,
  type SnapshotItem,
} from '../domain/session-snapshot.js';
import type { AnswerSubmission, IntervalInput } from '../domain/session-validation.js';
import { AppError, type I18nText, type LocalDate } from '../domain/types.js';
import { localToday, toLocalDate } from '../engine/clock.js';
import {
  applySessionAccuracy,
  MIN_SESSION_ANSWERS,
  recordAnswer,
  sessionAccuracyByTopic,
} from '../engine/difficulty.js';
import { upcomingUnits } from '../engine/path.js';
import { accuracyOf, dueDateAfter, nextSrsState, RECENT_ACCURACY_WINDOW } from '../engine/srs.js';
import type { ServiceDeps } from './deps.js';
import { notOnboarded, paramsOfPath, rankForUser } from './path.js';

// Dịch vụ phiên học (T061–T064, R10, R12, FR-018, FR-020, FR-025, FR-041).
// - Bắt đầu phiên chụp snapshot nội dung đã bản địa hóa; tiếp tục phiên dở dang trả lại đúng snapshot đó.
// - Ghi câu trả lời idempotent: chấm phía server, `ON CONFLICT DO NOTHING` theo `(user_id, client_event_id)`
//   và theo lượt chính `(session_id, exercise_id)`; trùng thì trả lại kết quả đã có với `duplicate=true`.
// - Hoàn thành phiên chỉ khi mọi câu đã được server xác nhận.

export interface LessonSessionDto {
  id: string;
  status: SessionRow['status'];
  kind: SessionRow['kind'];
  title: string;
  items: SnapshotItem[];
  exercises: PublicExercise[];
  answered: { exerciseId: string; isCorrect: boolean }[];
}

export interface AnswerResultDto {
  isCorrect: boolean;
  feedback: string;
  correctAnswer?: unknown;
  nextReviewDate: string | null;
  duplicate: boolean;
}

export interface SessionSummaryDto {
  correct: number;
  total: number;
  minutesSpent: number;
  dayCompleted: boolean;
  /** Chữ Kanji có câu lượt chính sai trong phiên (US1.4); vắng mặt với phiên không có Kanji. */
  attentionItems?: { itemId: string; japanese: string }[];
}

/** Số phút (làm tròn 0,1) từ số giây. */
export function secondsToMinutes(seconds: number): number {
  return Math.round((seconds / 60) * 10) / 10;
}

async function requireProfile(deps: Pick<ServiceDeps, 'db'>, userId: string): Promise<ProfileRow> {
  const profile = await getProfile(deps.db, userId);
  if (!profile || profile.onboardingState !== 'completed') throw notOnboarded();
  return profile;
}

async function requireSession(
  db: DbExecutor,
  userId: string,
  sessionId: string,
  options: { forUpdate?: boolean } = {},
): Promise<SessionRow> {
  const session = await getSession(db, userId, sessionId, options);
  if (!session) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy phiên học');
  return session;
}

async function toSessionDto(db: DbExecutor, session: SessionRow): Promise<LessonSessionDto> {
  const snapshot = parseSnapshot(session.snapshot);
  // Theo thứ tự bài tập trong phiên (ổn định, không phụ thuộc thời điểm ghi).
  const order = new Map(snapshot.exercises.map((e, i) => [e.id, i]));
  const answered = (await listPrimaryRecords(db, session.id)).sort(
    (a, b) => (order.get(a.exerciseId) ?? 0) - (order.get(b.exerciseId) ?? 0),
  );
  return {
    id: session.id,
    status: session.status,
    kind: session.kind,
    title: snapshot.title,
    items: snapshot.items,
    exercises: snapshot.exercises.map((e) => publicExercise(e, snapshot.language)),
    answered,
  };
}

function unitUnavailable(): AppError {
  return new AppError(404, 'NOT_FOUND', 'Đơn vị học này hiện không còn khả dụng');
}

/** Khóa tư vấn theo giao dịch để hai yêu cầu đồng thời cho cùng một đối tượng được xếp hàng. */
async function lockKey(db: DbExecutor, key: string): Promise<void> {
  await db.execute(sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
}

// --- Bắt đầu / tiếp tục phiên ---

/**
 * `POST /sessions`: bắt đầu hoặc tiếp tục phiên cho một mục kế hoạch.
 * `planItemId` không khớp mục kế hoạch nào của người học được hiểu là id đơn vị "học thêm" do
 * `POST /today/extra` trả về (phiên `kind='extra'`, không gắn mục kế hoạch – data-model §2.13).
 */
export async function startSession(
  deps: ServiceDeps,
  userId: string,
  planItemId: string,
): Promise<LessonSessionDto> {
  const profile = await requireProfile(deps, userId);
  const found = await getPlanItemForUser(deps.db, userId, planItemId);
  if (found) return startPlanItemSession(deps, userId, profile, found.item, found.plan.localDate);
  return startExtraSession(deps, userId, profile, planItemId);
}

async function startPlanItemSession(
  deps: ServiceDeps,
  userId: string,
  profile: ProfileRow,
  item: DailyPlanItemRow,
  planLocalDate: LocalDate,
): Promise<LessonSessionDto> {
  const planItemId = item.id;
  return deps.db.transaction(async (tx) => {
    // Hai cửa sổ cùng mở một mục: xếp hàng để chỉ tạo một phiên.
    await lockKey(tx, `session:${planItemId}`);
    const existing = await findSessionForPlanItem(tx, userId, planItemId);
    if (existing) return toSessionDto(tx, existing);

    if (item.type === 'review_batch') {
      return startReviewSession(tx, deps, userId, profile, item, planLocalDate);
    }
    if (!item.unitId) throw unitUnavailable();

    const snapshot = await deps.contentCache.lessonSnapshot(item.unitId, profile.language);
    if (!snapshot || snapshot.exercises.length === 0) throw unitUnavailable();

    const now = deps.clock.now();
    const session = await insertSession(tx, {
      userId,
      planItemId,
      kind: 'new_unit',
      unitId: item.unitId,
      snapshot: snapshot as unknown as Record<string, unknown>,
      status: 'in_progress',
      startedAt: now,
    });
    await ensureUnitInProgress(tx, userId, item.unitId, now);
    await markPlanItemInProgress(tx, planItemId);
    return toSessionDto(tx, session);
  });
}

const REVIEW_TITLE: I18nText = { vi: 'Ôn tập', en: 'Review' };

/**
 * Phiên ôn tập (`kind='review'`, T079): snapshot bài tập `active` của các mục trong gói ôn
 * (`review_item_ids`), mỗi mục một bài. Mục bị admin gỡ sau khi kế hoạch được sinh bị bỏ qua; không còn
 * mục nào để ôn thì 404 `NOT_FOUND` (lịch của các mục đó vẫn giữ nguyên).
 */
async function startReviewSession(
  tx: DbExecutor,
  deps: ServiceDeps,
  userId: string,
  profile: ProfileRow,
  item: DailyPlanItemRow,
  planLocalDate: LocalDate,
): Promise<LessonSessionDto> {
  const itemIds = item.reviewItemIds ?? [];
  const content = await loadReviewContent(tx, itemIds);
  const snapshot = buildReviewSnapshot({
    title: REVIEW_TITLE,
    itemIds,
    items: content.items,
    exercises: content.exercises,
    language: profile.language,
    seed: planLocalDate,
  });
  if (snapshot.exercises.length === 0) {
    throw new AppError(404, 'NOT_FOUND', 'Các mục ôn này hiện không còn khả dụng');
  }
  const session = await insertSession(tx, {
    userId,
    planItemId: item.id,
    kind: 'review',
    unitId: null,
    snapshot: snapshot as unknown as Record<string, unknown>,
    status: 'in_progress',
    startedAt: deps.clock.now(),
  });
  await markPlanItemInProgress(tx, item.id);
  return toSessionDto(tx, session);
}

async function startExtraSession(
  deps: ServiceDeps,
  userId: string,
  profile: ProfileRow,
  unitId: string,
): Promise<LessonSessionDto> {
  const path = await getActivePath(deps.db, userId);
  if (!path) throw notOnboarded();
  if (profile.paused) throw new AppError(409, 'PATH_PAUSED', 'Lộ trình đang tạm dừng');

  // Chỉ nhận đơn vị thật sự là bài sắp tới của người học (không cho mở đơn vị tùy ý).
  const ranked = await rankForUser(deps, userId, profile, paramsOfPath(path));
  if (!upcomingUnits(ranked).some((u) => u.id === unitId)) {
    throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy mục kế hoạch hoặc đơn vị học này');
  }

  return deps.db.transaction(async (tx) => {
    await lockKey(tx, `extra:${userId}:${unitId}`);
    const existing = await findOpenExtraSession(tx, userId, unitId);
    if (existing) return toSessionDto(tx, existing);

    const snapshot = await deps.contentCache.lessonSnapshot(unitId, profile.language);
    if (!snapshot || snapshot.exercises.length === 0) throw unitUnavailable();

    const now = deps.clock.now();
    const session = await insertSession(tx, {
      userId,
      planItemId: null,
      kind: 'extra',
      unitId,
      snapshot: snapshot as unknown as Record<string, unknown>,
      status: 'in_progress',
      startedAt: now,
    });
    await ensureUnitInProgress(tx, userId, unitId, now);
    return toSessionDto(tx, session);
  });
}

// --- Ghi câu trả lời ---

function resultFromRecord(
  record: Pick<StudyRecordRow, 'isCorrect' | 'submittedAnswer'>,
  exercise: SnapshotExercise,
  snapshot: SessionSnapshot,
  duplicate: boolean,
): AnswerResultDto {
  const base: AnswerResultDto = {
    isCorrect: record.isCorrect,
    feedback: record.isCorrect ? exercise.feedbackCorrect : exercise.feedbackIncorrect,
    nextReviewDate: null,
    duplicate,
  };
  if (record.isCorrect) return base;
  const { correctAnswer } = gradeExercise(
    exercise.type,
    exercise.payload,
    record.submittedAnswer,
    snapshot.language,
  );
  return { ...base, correctAnswer };
}

/** Thời điểm xảy ra của câu trả lời: `answeredAt` của client nếu hợp lý (hàng đợi gửi lại sau), ngược lại giờ server. */
function occurredAtOf(answeredAt: string | undefined, session: SessionRow, now: Date): Date {
  if (!answeredAt) return now;
  const at = new Date(answeredAt);
  return at.getTime() <= now.getTime() && at.getTime() >= session.startedAt.getTime() ? at : now;
}

/**
 * Cập nhật lịch ôn của cặp (mục, khía cạnh) sau một câu trả lời vừa chèn thành công (T077, R6, R10); trả
 * ngày ôn kế tiếp. Khía cạnh lấy từ bản ghi (`item` với từ vựng/ngữ pháp; Kanji dùng meaning/reading/word,
 * mỗi cặp có lịch riêng – research K3). Bỏ qua (chỉ trả ngày đến hạn hiện có) khi: câu hỏi lại cuối phiên
 * (`is_retry`), bài tập không gắn mục, hoặc cặp đã được cập nhật trong ngày địa phương này (hai cửa sổ/hai
 * phiên cùng ôn một cặp). Khóa cặp trước khi đọc nên hai giao dịch đồng thời được xếp hàng và chỉ một
 * giao dịch cập nhật.
 */
async function updateReviewSchedule(
  tx: DbExecutor,
  userId: string,
  record: StudyRecordRow,
): Promise<LocalDate | null> {
  const { itemId, facet } = record;
  if (!itemId) return null;
  if (record.isRetry) return getDueDate(tx, userId, itemId, facet);

  const existing = await lockSchedule(tx, userId, itemId, facet);
  const reviewedOn = existing?.lastReviewedLocalDate;
  if (existing && reviewedOn && reviewedOn >= record.localDate) return existing.dueDate;

  const recent = await recentItemResults(tx, userId, itemId, RECENT_ACCURACY_WINDOW, facet);
  const next = nextSrsState(
    existing ? toSrsState(existing) : null,
    record.isCorrect,
    accuracyOf(recent),
  );
  const dueDate = dueDateAfter(record.localDate, next.intervalDays);
  await upsertSchedule(
    tx,
    userId,
    itemId,
    {
      ...next,
      dueDate,
      lastResult: record.isCorrect,
      lastReviewedAt: record.occurredAt,
      lastReviewedLocalDate: record.localDate,
    },
    facet,
  );
  return dueDate;
}

/**
 * Ghi câu trả lời lượt chính vào thống kê mảng (T084, FR-029): cửa sổ trượt 20 câu, độ chính xác và cờ
 * điểm yếu. Câu hỏi lại cuối phiên (`is_retry`) không được tính. Chỉ gọi sau khi chèn bản ghi thành công
 * nên gửi lại cùng `clientEventId` không đếm hai lần.
 */
async function updateTopicStats(
  tx: DbExecutor,
  userId: string,
  record: StudyRecordRow,
): Promise<void> {
  if (record.isRetry) return;
  const state = await lockTopicStats(tx, userId, record.topicId);
  await saveTopicStats(tx, userId, record.topicId, recordAnswer(state, record.isCorrect));
}

/**
 * Cập nhật độ khó thích ứng khi hoàn thành phiên (T091, FR-013): độ chính xác của phiên theo từng mảng
 * → chuỗi phiên thấp/cao liên tiếp và `difficulty_bias`. Chỉ tính câu lượt chính; gọi đúng một lần vì
 * `completeSession` trả sớm cho phiên đã hoàn thành.
 */
async function updateDifficultyAfterSession(
  tx: DbExecutor,
  userId: string,
  sessionId: string,
): Promise<void> {
  const byTopic = sessionAccuracyByTopic(await listSessionTopicResults(tx, sessionId));
  const topicIds = [...byTopic.keys()].filter(
    (id) => (byTopic.get(id)?.answered ?? 0) >= MIN_SESSION_ANSWERS,
  );
  // Thứ tự khóa cố định giữa các giao dịch.
  for (const topicId of topicIds.sort()) {
    const { accuracy, answered } = byTopic.get(topicId)!;
    const state = await lockTopicStats(tx, userId, topicId);
    const next = applySessionAccuracy(state, accuracy, answered);
    if (next !== state) await saveTopicStats(tx, userId, topicId, next);
  }
}

/**
 * `POST /sessions/{sessionId}/answers`: chấm trên server rồi ghi idempotent (FR-025, FR-041).
 * Trùng `clientEventId`, hoặc trùng lượt chính của bài tập trong phiên (cửa sổ khác gửi với
 * `clientEventId` khác), đều trả lại kết quả đã ghi với `duplicate=true`.
 */
export async function submitAnswer(
  deps: ServiceDeps,
  userId: string,
  sessionId: string,
  input: AnswerSubmission,
): Promise<AnswerResultDto> {
  const session = await requireSession(deps.db, userId, sessionId);
  const snapshot = parseSnapshot(session.snapshot);
  const exercise = snapshot.exercises.find((e) => e.id === input.exerciseId);
  if (!exercise) {
    throw new AppError(422, 'VALIDATION_FAILED', 'Dữ liệu không hợp lệ', {
      exerciseId: 'Bài tập không thuộc phiên học này',
    });
  }

  const replay = async (db: DbExecutor, record: StudyRecordRow): Promise<AnswerResultDto> => {
    if (record.sessionId !== session.id) {
      throw new AppError(422, 'VALIDATION_FAILED', 'Dữ liệu không hợp lệ', {
        clientEventId: 'clientEventId đã được dùng cho phiên khác',
      });
    }
    const target = snapshot.exercises.find((e) => e.id === record.exerciseId) ?? exercise;
    const nextReviewDate = record.itemId
      ? await getDueDate(db, userId, record.itemId, record.facet)
      : null;
    return { ...resultFromRecord(record, target, snapshot, true), nextReviewDate };
  };

  // Gửi lại (thử lại sau mất kết nối): luôn trả kết quả cũ, kể cả khi phiên đã hoàn thành.
  const prior = await findRecordByClientEvent(deps.db, userId, input.clientEventId);
  if (prior) return replay(deps.db, prior);
  if (session.status === 'completed') {
    throw new AppError(409, 'SESSION_COMPLETED', 'Phiên học đã hoàn thành');
  }

  const profile = await requireProfile(deps, userId);
  const graded = gradeExercise(exercise.type, exercise.payload, input.answer, snapshot.language);
  const occurredAt = occurredAtOf(input.answeredAt, session, deps.clock.now());

  return deps.db.transaction(async (tx) => {
    const inserted = await insertStudyRecord(tx, {
      userId,
      clientEventId: input.clientEventId,
      sessionId: session.id,
      exerciseId: exercise.id,
      itemId: exercise.itemId,
      // Khía cạnh vắng mặt (snapshot cũ) hiểu là `item`; `topicId` của bài tập đã là chủ đề của chữ (research K4).
      facet: exercise.facet ?? 'item',
      topicId: exercise.topicId,
      isCorrect: graded.isCorrect,
      submittedAnswer: input.answer,
      context: session.kind === 'review' ? 'review' : 'lesson',
      isRetry: input.isRetry,
      occurredAt,
      localDate: toLocalDate(occurredAt, profile.timezone),
    });
    if (inserted) {
      // Thống kê mảng (T084) và lịch ôn (T077) cập nhật trong cùng giao dịch với bản ghi. Luôn khóa
      // mảng trước rồi mới khóa mục ôn để các giao dịch đồng thời không khóa chéo nhau.
      await updateTopicStats(tx, userId, inserted);
      const nextReviewDate = await updateReviewSchedule(tx, userId, inserted);
      return { ...resultFromRecord(inserted, exercise, snapshot, false), nextReviewDate };
    }
    // Trùng ràng buộc: đọc bản ghi đã có (theo sự kiện, hoặc theo lượt chính của bài tập).
    const existing =
      (await findRecordByClientEvent(tx, userId, input.clientEventId)) ??
      (await findPrimaryRecord(tx, session.id, exercise.id));
    if (!existing) throw new AppError(500, 'INTERNAL_ERROR', 'Lỗi hệ thống');
    return replay(tx, existing);
  });
}

// --- Khoảng thời gian học ---

/** `POST /sessions/{sessionId}/intervals`: ghi khoảng thời gian học, idempotent theo `clientEventId`. */
export async function recordInterval(
  deps: ServiceDeps,
  userId: string,
  sessionId: string,
  input: IntervalInput,
): Promise<void> {
  const session = await requireSession(deps.db, userId, sessionId);
  const profile = await requireProfile(deps, userId);
  const startedAt = new Date(input.startedAt);
  await insertStudyInterval(deps.db, {
    userId,
    clientEventId: input.clientEventId,
    sessionId: session.id,
    startedAt,
    durationSeconds: input.durationSeconds,
    localDate: toLocalDate(startedAt, profile.timezone),
  });
}

// --- Hoàn thành phiên ---

async function dayCompletedFor(
  db: DbExecutor,
  deps: Pick<ServiceDeps, 'clock'>,
  userId: string,
  session: SessionRow,
): Promise<boolean> {
  if (session.planItemId) {
    const found = await getPlanItemForUser(db, userId, session.planItemId);
    return found?.plan.status === 'completed';
  }
  // Phiên "học thêm": ngày hoàn thành khi kế hoạch hôm nay đã xong.
  const profile = await getProfile(db, userId);
  if (!profile) return false;
  const plan = await findPlan(db, userId, localToday(deps.clock, profile.timezone));
  return plan?.status === 'completed';
}

async function summarizeSession(
  db: DbExecutor,
  deps: Pick<ServiceDeps, 'clock'>,
  userId: string,
  session: SessionRow,
): Promise<SessionSummaryDto> {
  const { correct, total } = await countPrimaryResults(db, [session.id]);
  const intervals = await listSessionIntervals(db, [session.id]);
  const kanjiItems = parseSnapshot(session.snapshot).items.filter((i) => i.kind === 'kanji');
  const incorrect =
    kanjiItems.length > 0 ? new Set(await listIncorrectItemIds(db, session.id)) : null;
  return {
    correct,
    total,
    minutesSpent: secondsToMinutes(unionDurationSeconds(intervals)),
    dayCompleted: await dayCompletedFor(db, deps, userId, session),
    // Theo thứ tự xuất hiện của chữ trong bài; chỉ phiên có mục Kanji mới có trường này.
    ...(incorrect
      ? {
          attentionItems: kanjiItems
            .filter((i) => incorrect.has(i.id))
            .map((i) => ({ itemId: i.id, japanese: i.japanese })),
        }
      : {}),
  };
}

/**
 * `POST /sessions/{sessionId}/complete`: chỉ hoàn thành khi mọi bài tập đã có câu trả lời lượt chính
 * được server ghi nhận (409 `SESSION_INCOMPLETE` nếu còn thiếu). Cập nhật mục kế hoạch, kế hoạch ngày
 * và `unit_progress` trong cùng giao dịch; gọi lại trên phiên đã xong chỉ trả lại tóm tắt.
 */
export async function completeSession(
  deps: ServiceDeps,
  userId: string,
  sessionId: string,
): Promise<SessionSummaryDto> {
  return deps.db.transaction(async (tx) => {
    const session = await requireSession(tx, userId, sessionId, { forUpdate: true });
    if (session.status === 'completed') return summarizeSession(tx, deps, userId, session);

    const snapshot = parseSnapshot(session.snapshot);
    const answered = new Set((await listPrimaryRecords(tx, session.id)).map((r) => r.exerciseId));
    if (snapshot.exercises.some((e) => !answered.has(e.id))) {
      throw new AppError(409, 'SESSION_INCOMPLETE', 'Còn câu chưa trả lời');
    }

    const now = deps.clock.now();
    await markSessionCompleted(tx, session.id, now);

    if (session.planItemId) {
      await setPlanItemStatus(tx, session.planItemId, 'completed');
      const found = await getPlanItemForUser(tx, userId, session.planItemId);
      if (found) {
        const statuses = await listPlanItemStatuses(tx, found.plan.id);
        if (statuses.every((s) => s === 'completed'))
          await markPlanCompleted(tx, found.plan.id, now);
      }
    }
    if (session.unitId && session.kind !== 'review') {
      await markUnitCompleted(tx, userId, session.unitId, now);
    }
    await updateDifficultyAfterSession(tx, userId, session.id);

    return summarizeSession(tx, deps, userId, session);
  });
}
