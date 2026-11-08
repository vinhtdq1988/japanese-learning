import { and, desc, eq, gte, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import type { DbExecutor } from '../client.js';
import {
  classMemberships,
  learningProfiles,
  lessonSessions,
  placementResults,
  studyIntervals,
  studyRecords,
  unitProgress,
  users,
} from '../schema.js';
import type { LocalDate } from '../../domain/types.js';

// Số liệu học tập của lớp (spec 004, T084, research O11, FR-030). Mọi truy vấn gộp theo lô (`GROUP BY user_id` /
// `IN (...)`) nên số truy vấn KHÔNG tăng theo số học viên, và MỌI truy vấn lọc `occurred_at >= joined_at` của
// chính thành viên đang hoạt động — giáo viên không bao giờ thấy hoạt động trước khi học viên vào lớp.

/** Thành viên đang hoạt động của lớp kèm thông tin hiển thị; tài khoản không `active` bị loại. */
export interface DashboardMember {
  membershipId: string;
  userId: string;
  joinedAt: Date;
  displayName: string;
  email: string;
  timezone: string;
}

/** Học viên của lớp; `userId` chỉ định một người (chi tiết học viên) — không phải thành viên ⇒ mảng rỗng. */
export async function listDashboardMembers(
  db: DbExecutor,
  organizationId: string,
  classId: string,
  userId?: string,
): Promise<DashboardMember[]> {
  const rows = await db
    .select({
      membershipId: classMemberships.id,
      userId: classMemberships.userId,
      joinedAt: classMemberships.joinedAt,
      displayName: learningProfiles.displayName,
      email: users.email,
      timezone: learningProfiles.timezone,
    })
    .from(classMemberships)
    .innerJoin(users, eq(users.id, classMemberships.userId))
    .leftJoin(learningProfiles, eq(learningProfiles.userId, classMemberships.userId))
    .where(
      and(
        eq(classMemberships.organizationId, organizationId),
        eq(classMemberships.classId, classId),
        isNull(classMemberships.leftAt),
        eq(users.status, 'active'),
        userId ? eq(classMemberships.userId, userId) : undefined,
      ),
    )
    .orderBy(classMemberships.joinedAt, classMemberships.id);
  return rows.map((r) => ({
    ...r,
    displayName: r.displayName ?? r.email,
    timezone: r.timezone ?? 'Asia/Ho_Chi_Minh',
  }));
}

/** Một khoảng thời gian học kèm ngày địa phương lúc xảy ra. */
export interface ActivityInterval {
  startedAt: Date;
  durationSeconds: number;
  localDate: LocalDate;
}

/** Hoạt động của một học viên kể từ khi vào lớp. */
export interface ClassActivity {
  /** Số bản ghi trả lời kể từ `joined_at` (0 ⇒ "chưa bắt đầu"). */
  recordCount: number;
  /** Đúng/tổng câu lượt chính trong ngữ cảnh ôn tập. */
  reviewCorrect: number;
  reviewTotal: number;
  /** Các ngày địa phương có hoạt động. */
  activeDays: Set<LocalDate>;
  intervals: ActivityInterval[];
}

const EMPTY_ACTIVITY = (): ClassActivity => ({
  recordCount: 0,
  reviewCorrect: 0,
  reviewTotal: 0,
  activeDays: new Set(),
  intervals: [],
});

/**
 * Hoạt động của các học viên kể từ `joined_at` của thành viên lớp hiện tại: BA truy vấn gộp (bản ghi, ngày hoạt
 * động, khoảng thời gian) cho cả lô. Dùng chung bởi bảng điều khiển và "Lớp của tôi" (cùng nguồn, cùng cửa sổ).
 */
export async function getClassProgressFor(
  db: DbExecutor,
  userIds: readonly string[],
): Promise<Map<string, ClassActivity>> {
  const result = new Map<string, ClassActivity>(userIds.map((id) => [id, EMPTY_ACTIVITY()]));
  if (userIds.length === 0) return result;
  const ids = [...userIds];

  const sinceJoined = (userCol: typeof studyRecords.userId, at: typeof studyRecords.occurredAt) =>
    and(
      eq(classMemberships.userId, userCol),
      isNull(classMemberships.leftAt),
      gte(at, classMemberships.joinedAt),
    );

  const [counts, days, intervals] = await Promise.all([
    db
      .select({
        userId: studyRecords.userId,
        recordCount: sql<number>`count(*)`.mapWith(Number),
        reviewTotal:
          sql<number>`count(*) filter (where ${studyRecords.context} = 'review' and not ${studyRecords.isRetry})`.mapWith(
            Number,
          ),
        reviewCorrect:
          sql<number>`count(*) filter (where ${studyRecords.context} = 'review' and not ${studyRecords.isRetry} and ${studyRecords.isCorrect})`.mapWith(
            Number,
          ),
      })
      .from(studyRecords)
      .innerJoin(classMemberships, sinceJoined(studyRecords.userId, studyRecords.occurredAt))
      .where(inArray(studyRecords.userId, ids))
      .groupBy(studyRecords.userId),
    db
      .selectDistinct({ userId: studyRecords.userId, day: studyRecords.localDate })
      .from(studyRecords)
      .innerJoin(classMemberships, sinceJoined(studyRecords.userId, studyRecords.occurredAt))
      .where(inArray(studyRecords.userId, ids)),
    db
      .select({
        userId: studyIntervals.userId,
        startedAt: studyIntervals.startedAt,
        durationSeconds: studyIntervals.durationSeconds,
        localDate: studyIntervals.localDate,
      })
      .from(studyIntervals)
      .innerJoin(
        classMemberships,
        and(
          eq(classMemberships.userId, studyIntervals.userId),
          isNull(classMemberships.leftAt),
          gte(studyIntervals.startedAt, classMemberships.joinedAt),
        ),
      )
      .where(inArray(studyIntervals.userId, ids)),
  ]);

  for (const c of counts) {
    const a = result.get(c.userId);
    if (!a) continue;
    a.recordCount = c.recordCount;
    a.reviewTotal = c.reviewTotal;
    a.reviewCorrect = c.reviewCorrect;
  }
  for (const d of days) result.get(d.userId)?.activeDays.add(d.day);
  for (const i of intervals) {
    result.get(i.userId)?.intervals.push({
      startedAt: i.startedAt,
      durationSeconds: i.durationSeconds,
      localDate: i.localDate,
    });
  }
  return result;
}

/** Đơn vị đã hoàn thành/thành thạo của các học viên (kể cả trước khi vào lớp – US3.5), một truy vấn. */
export async function loadCompletedUnits(
  db: DbExecutor,
  userIds: readonly string[],
): Promise<Map<string, Set<string>>> {
  const byUser = new Map<string, Set<string>>(userIds.map((id) => [id, new Set()]));
  if (userIds.length === 0) return byUser;
  const rows = await db
    .select({ userId: unitProgress.userId, unitId: unitProgress.unitId })
    .from(unitProgress)
    .where(
      and(
        inArray(unitProgress.userId, [...userIds]),
        inArray(unitProgress.status, ['completed', 'mastered']),
      ),
    );
  for (const r of rows) byUser.get(r.userId)?.add(r.unitId);
  return byUser;
}

/** Trạng thái đầy đủ từng đơn vị của MỘT học viên (`in_progress` cần cho chi tiết). */
export async function loadUnitStatuses(
  db: DbExecutor,
  userId: string,
): Promise<Map<string, 'in_progress' | 'completed' | 'mastered'>> {
  const rows = await db
    .select({ unitId: unitProgress.unitId, status: unitProgress.status })
    .from(unitProgress)
    .where(eq(unitProgress.userId, userId));
  return new Map(rows.map((r) => [r.unitId, r.status]));
}

/**
 * Thời điểm học viên hoàn thành từng đơn vị (research O12): sớm nhất của phiên `new_unit` hoàn thành, hoặc
 * `unit_progress.updated_at` nếu đã hoàn thành/thành thạo mà không có phiên (hoàn thành từ trước). Chỉ trả đơn
 * vị đã hoàn thành.
 */
export async function loadCompletionTimes(
  db: DbExecutor,
  userId: string,
  unitIds: readonly string[],
): Promise<Map<string, Date>> {
  if (unitIds.length === 0) return new Map();
  const ids = [...unitIds];
  const [sessions, progress] = await Promise.all([
    db
      .select({
        unitId: lessonSessions.unitId,
        at: sql<Date>`min(${lessonSessions.completedAt})`.mapWith((v) => new Date(v as string)),
      })
      .from(lessonSessions)
      .where(
        and(
          eq(lessonSessions.userId, userId),
          eq(lessonSessions.status, 'completed'),
          eq(lessonSessions.kind, 'new_unit'),
          inArray(lessonSessions.unitId, ids),
        ),
      )
      .groupBy(lessonSessions.unitId),
    db
      .select({ unitId: unitProgress.unitId, at: unitProgress.updatedAt })
      .from(unitProgress)
      .where(
        and(
          eq(unitProgress.userId, userId),
          inArray(unitProgress.status, ['completed', 'mastered']),
          inArray(unitProgress.unitId, ids),
        ),
      ),
  ]);
  const times = new Map<string, Date>();
  for (const p of progress) times.set(p.unitId, p.at);
  for (const s of sessions) {
    if (s.unitId && (!times.has(s.unitId) || s.at < times.get(s.unitId)!))
      times.set(s.unitId, s.at);
  }
  return times;
}

/** Số kết quả lượt chính gần nhất giữ lại cho mỗi (học viên, chủ đề) khi xác định mảng yếu (= `TOPIC_WINDOW`). */
export interface TopicWindowRow {
  userId: string;
  topicId: string;
  /** 1 = đúng, 0 = sai. */
  results: (0 | 1)[];
}

/**
 * Với mỗi (học viên, chủ đề): tối đa `window` kết quả lượt chính MỚI NHẤT kể từ `joined_at`, trả cũ → mới để
 * engine độ khó phát lại (`nextWeakFlag`). Không dùng `topic_stats.is_weak` vì nó có thể gồm kết quả trước khi
 * vào lớp (research O11).
 */
export async function listTopicWindows(
  db: DbExecutor,
  userIds: readonly string[],
  window: number,
): Promise<TopicWindowRow[]> {
  if (userIds.length === 0) return [];
  const ids = [...userIds];
  const result = await db.execute<{
    user_id: string;
    topic_id: string;
    results: number[];
  }>(sql`
    SELECT user_id, topic_id, array_agg(ok ORDER BY rn DESC) AS results
      FROM (
        SELECT s.user_id, s.topic_id, (CASE WHEN s.is_correct THEN 1 ELSE 0 END) AS ok,
               row_number() OVER (PARTITION BY s.user_id, s.topic_id
                                  ORDER BY s.occurred_at DESC, s.id DESC) AS rn
          FROM study_records s
          JOIN class_memberships m ON m.user_id = s.user_id AND m.left_at IS NULL
                                  AND s.occurred_at >= m.joined_at
         WHERE s.user_id IN (${sql.join(
           ids.map((id) => sql`${id}::uuid`),
           sql`, `,
         )}) AND NOT s.is_retry
      ) t
     WHERE rn <= ${window}
     GROUP BY user_id, topic_id`);
  return result.rows.map((r) => ({
    userId: r.user_id,
    topicId: r.topic_id,
    results: r.results.map((x) => (x === 1 ? 1 : 0)),
  }));
}

/** Tổng lượt chính theo chủ đề của cả lớp (bài học + ôn tập) kể từ `joined_at` của từng thành viên. */
export interface ClassTopicAggregate {
  topicId: string;
  answers: number;
  correct: number;
}

/**
 * Gộp lượt chính (`is_retry = false`, mọi ngữ cảnh) theo `topic_id` cho các thành viên hiện tại: MỘT truy vấn
 * cho cả lô, chỉ tính bản ghi từ `joined_at` (research O11, FR-032).
 */
export async function listClassTopicAggregates(
  db: DbExecutor,
  userIds: readonly string[],
): Promise<ClassTopicAggregate[]> {
  if (userIds.length === 0) return [];
  const ids = [...userIds];
  const result = await db.execute<{ topic_id: string; answers: string; correct: string }>(sql`
    SELECT s.topic_id, count(*) AS answers, count(*) FILTER (WHERE s.is_correct) AS correct
      FROM study_records s
      JOIN class_memberships m ON m.user_id = s.user_id AND m.left_at IS NULL
                              AND s.occurred_at >= m.joined_at
     WHERE s.user_id IN (${sql.join(
       ids.map((id) => sql`${id}::uuid`),
       sql`, `,
     )}) AND NOT s.is_retry
     GROUP BY s.topic_id`);
  return result.rows.map((r) => ({
    topicId: r.topic_id,
    answers: Number(r.answers),
    correct: Number(r.correct),
  }));
}

export interface ClassPlacementSummary {
  estimatedLevel: string;
  score: number;
  total: number;
  takenAt: Date;
}

/** Kết quả kiểm tra trình độ do LỚP yêu cầu (US8) mới nhất của học viên; `null` nếu chưa có. */
export async function getLatestClassPlacement(
  db: DbExecutor,
  userId: string,
): Promise<ClassPlacementSummary | null> {
  const [row] = await db
    .select({
      estimatedLevel: placementResults.estimatedLevel,
      score: placementResults.score,
      answers: placementResults.answers,
      takenAt: placementResults.takenAt,
    })
    .from(placementResults)
    .where(
      and(eq(placementResults.userId, userId), isNotNull(placementResults.classPlacementRequestId)),
    )
    .orderBy(desc(placementResults.takenAt))
    .limit(1);
  if (!row) return null;
  return {
    estimatedLevel: row.estimatedLevel,
    score: row.score,
    total: row.answers.length,
    takenAt: row.takenAt,
  };
}
