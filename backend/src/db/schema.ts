// Schema Drizzle – khớp migration `migrations/0001_init.sql`, `0002_kanji_skill.sql`, `0003_kanji.sql`, `0004_org_classes.sql` (nguồn sự thật của lược đồ là file SQL).
// Drizzle chỉ dùng để truy vấn có kiểu; KHÔNG sinh migration từ file này.
import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import type { I18nText, KanjiDetails } from '../domain/types.js';

const citext = customType<{ data: string }>({
  dataType: () => 'citext',
});

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

// --- Kiểu liệt kê (tên khớp CREATE TYPE trong migration) ---
export const userRole = pgEnum('user_role', ['learner', 'admin']);
export const accountStatus = pgEnum('account_status', ['active', 'disabled', 'pending_deletion']);
export const skill = pgEnum('skill', ['vocabulary', 'grammar', 'kanji']);
export const reviewFacet = pgEnum('review_facet', ['item', 'meaning', 'reading', 'word']);
export const language = pgEnum('language', ['vi', 'en']);
export const selfLevel = pgEnum('self_level', ['none', 'N5', 'N4', 'N3', 'N2', 'N1']);
export const targetLevel = pgEnum('target_level', ['N5', 'N4', 'N3', 'N2', 'N1']);
export const contentLevel = pgEnum('content_level', ['N5', 'N4', 'N3']);
export const placementLevel = pgEnum('placement_level', ['none', 'N5', 'N4', 'N3']);
export const goalType = pgEnum('goal_type', ['jlpt', 'daily_conversation', 'work']);
export const onboardingState = pgEnum('onboarding_state', [
  'not_started',
  'in_progress',
  'completed',
]);
export const unitTier = pgEnum('unit_tier', ['foundation', 'core']);
export const unitStatus = pgEnum('unit_status', ['draft', 'active', 'inactive']);
export const elementStatus = pgEnum('element_status', ['active', 'inactive']);
export const exerciseType = pgEnum('exercise_type', ['multiple_choice', 'matching', 'fill_blank']);
export const pathStatus = pgEnum('path_status', ['active', 'superseded']);
export const pathReason = pgEnum('path_reason', [
  'onboarding',
  'rebuild_request',
  'goal_change',
  'level_change',
  'placement_retake',
]);
export const unitProgressStatus = pgEnum('unit_progress_status', [
  'in_progress',
  'completed',
  'mastered',
]);
export const planStatus = pgEnum('plan_status', ['open', 'completed']);
export const planItemType = pgEnum('plan_item_type', ['new_unit', 'review_batch']);
export const planItemStatus = pgEnum('plan_item_status', ['pending', 'in_progress', 'completed']);
export const sessionKind = pgEnum('session_kind', ['new_unit', 'review', 'extra']);
export const sessionStatus = pgEnum('session_status', ['in_progress', 'completed']);
export const recordContext = pgEnum('record_context', ['lesson', 'review']);

// --- Tài khoản ---
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: citext('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: userRole('role').notNull().default('learner'),
  status: accountStatus('status').notNull().default('active'),
  deletionRequestedAt: timestamptz('deletion_requested_at'),
  fromTrial: boolean('from_trial').notNull().default(false),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
});

export const authSessions = pgTable(
  'auth_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    refreshTokenHash: text('refresh_token_hash').notNull().unique(),
    expiresAt: timestamptz('expires_at').notNull(),
    revokedAt: timestamptz('revoked_at'),
    userAgent: text('user_agent'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [index('auth_sessions_user_idx').on(t.userId)],
);

export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamptz('expires_at').notNull(),
    usedAt: timestamptz('used_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [index('password_reset_tokens_user_idx').on(t.userId)],
);

export const learningProfiles = pgTable('learning_profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  displayName: text('display_name').notNull(),
  currentLevel: selfLevel('current_level').notNull().default('none'),
  goalType: goalType('goal_type'),
  targetLevel: targetLevel('target_level'),
  dailyMinutes: smallint('daily_minutes'),
  targetDate: date('target_date', { mode: 'string' }),
  skills: skill('skills')
    .array()
    .notNull()
    .default(sql`ARRAY['vocabulary', 'grammar']::skill[]`),
  prioritizedSkill: skill('prioritized_skill'),
  language: language('language').notNull().default('vi'),
  timezone: text('timezone').notNull().default('Asia/Ho_Chi_Minh'),
  onboardingState: onboardingState('onboarding_state').notNull().default('not_started'),
  onboardingDraft: jsonb('onboarding_draft').$type<Record<string, unknown>>(),
  paused: boolean('paused').notNull().default(false),
  // Thời điểm người học chọn Kanji (đo SC-001/SC-008); giữ khi bỏ chọn, đặt lại khi chọn lại.
  kanjiSelectedAt: timestamptz('kanji_selected_at'),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
});

export const pausePeriods = pgTable(
  'pause_periods',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    startedOn: date('started_on', { mode: 'string' }).notNull(),
    endedOn: date('ended_on', { mode: 'string' }),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('pause_periods_one_open_idx')
      .on(t.userId)
      .where(sql`${t.endedOn} IS NULL`),
  ],
);

// --- Nội dung học ---
export const topics = pgTable('topics', {
  id: uuid('id').primaryKey().defaultRandom(),
  skill: skill('skill').notNull(),
  name: jsonb('name').$type<I18nText>().notNull(),
  level: contentLevel('level').notNull(),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
});

export const learningUnits = pgTable(
  'learning_units',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kind: skill('kind').notNull(),
    title: jsonb('title').$type<I18nText>().notNull(),
    level: contentLevel('level').notNull(),
    goalTags: text('goal_tags')
      .array()
      .notNull()
      .default(sql`'{}'`),
    topicId: uuid('topic_id')
      .notNull()
      .references(() => topics.id),
    difficulty: smallint('difficulty').notNull(),
    tier: unitTier('tier').notNull().default('core'),
    estMinutes: smallint('est_minutes').notNull(),
    sequence: integer('sequence').notNull().default(0),
    isTrial: boolean('is_trial').notNull().default(false),
    status: unitStatus('status').notNull().default('draft'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => [index('learning_units_status_idx').on(t.status, t.level, t.kind)],
);

export interface ExampleSentence {
  ja: string;
  reading?: string | null;
  /** Kanji: cách đọc của chính chữ trong từ ví dụ này. */
  kanjiReading?: string | null;
  translation: I18nText;
}

export const contentItems = pgTable(
  'content_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    unitId: uuid('unit_id')
      .notNull()
      .references(() => learningUnits.id),
    kind: skill('kind').notNull(),
    japanese: text('japanese').notNull(),
    reading: text('reading'),
    meaning: jsonb('meaning').$type<I18nText>().notNull(),
    explanation: jsonb('explanation').$type<I18nText>(),
    examples: jsonb('examples')
      .$type<ExampleSentence[]>()
      .notNull()
      .default(sql`'[]'`),
    // Chủ đề và chi tiết riêng của chữ Kanji (NULL với mục khác; có thể NULL ở bản nháp Kanji).
    topicId: uuid('topic_id').references(() => topics.id),
    kanjiDetails: jsonb('kanji_details').$type<KanjiDetails>(),
    position: smallint('position').notNull().default(0),
    status: elementStatus('status').notNull().default('active'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [index('content_items_unit_idx').on(t.unitId)],
);

export const exercises = pgTable(
  'exercises',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    unitId: uuid('unit_id')
      .notNull()
      .references(() => learningUnits.id),
    itemId: uuid('item_id').references(() => contentItems.id),
    type: exerciseType('type').notNull(),
    prompt: jsonb('prompt').$type<I18nText>().notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    feedbackCorrect: jsonb('feedback_correct').$type<I18nText>().notNull(),
    feedbackIncorrect: jsonb('feedback_incorrect').$type<I18nText>().notNull(),
    facet: reviewFacet('facet').notNull().default('item'),
    position: smallint('position').notNull().default(0),
    status: elementStatus('status').notNull().default('active'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [index('exercises_unit_idx').on(t.unitId)],
);

// --- Placement ---
export interface PlacementPrompt {
  ja: string;
  hint?: I18nText;
}

export const placementQuestions = pgTable(
  'placement_questions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    level: contentLevel('level').notNull(),
    skill: skill('skill').notNull(),
    topicId: uuid('topic_id')
      .notNull()
      .references(() => topics.id),
    prompt: jsonb('prompt').$type<PlacementPrompt>().notNull(),
    choices: jsonb('choices').$type<string[]>().notNull(),
    correctChoice: smallint('correct_choice').notNull(),
    position: smallint('position').notNull().default(0),
    isActive: boolean('is_active').notNull().default(false),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => [index('placement_questions_active_idx').on(t.isActive, t.position)],
);

export const placementResults = pgTable(
  'placement_results',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    answers: jsonb('answers').$type<{ questionId: string; choice: number | null }[]>().notNull(),
    estimatedLevel: placementLevel('estimated_level').notNull(),
    strongTopics: uuid('strong_topics')
      .array()
      .notNull()
      .default(sql`'{}'`),
    weakTopics: uuid('weak_topics')
      .array()
      .notNull()
      .default(sql`'{}'`),
    score: smallint('score').notNull(),
    durationSeconds: integer('duration_seconds'),
    takenAt: timestamptz('taken_at').notNull().defaultNow(),
    isCurrent: boolean('is_current').notNull().default(true),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    // Spec 004: kết quả do lớp yêu cầu có `is_current = false`; dòng cũ NULL.
    classPlacementRequestId: uuid('class_placement_request_id').references(
      () => classPlacementRequests.id,
      { onDelete: 'set null' },
    ),
  },
  (t) => [
    uniqueIndex('placement_results_current_idx')
      .on(t.userId)
      .where(sql`${t.isCurrent}`),
    uniqueIndex('placement_results_class_request_idx')
      .on(t.userId, t.classPlacementRequestId)
      .where(sql`${t.classPlacementRequestId} IS NOT NULL`),
    check(
      'placement_results_class_request_not_current_check',
      sql`${t.classPlacementRequestId} IS NULL OR NOT ${t.isCurrent}`,
    ),
  ],
);

// --- Lộ trình ---
export const learningPaths = pgTable(
  'learning_paths',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: pathStatus('status').notNull().default('active'),
    reason: pathReason('reason').notNull(),
    generatedFrom: jsonb('generated_from').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('learning_paths_one_active_idx')
      .on(t.userId)
      .where(sql`${t.status} = 'active'`),
  ],
);

export const unitProgress = pgTable(
  'unit_progress',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    unitId: uuid('unit_id')
      .notNull()
      .references(() => learningUnits.id),
    status: unitProgressStatus('status').notNull(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.unitId] })],
);

// --- Kế hoạch ngày và phiên học ---
export const dailyPlans = pgTable(
  'daily_plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    localDate: date('local_date', { mode: 'string' }).notNull(),
    budgetMinutes: smallint('budget_minutes').notNull(),
    estimatedMinutes: smallint('estimated_minutes').notNull(),
    status: planStatus('status').notNull().default('open'),
    notice: text('notice'),
    completedAt: timestamptz('completed_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [unique('daily_plans_user_id_local_date_key').on(t.userId, t.localDate)],
);

export const dailyPlanItems = pgTable(
  'daily_plan_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    planId: uuid('plan_id')
      .notNull()
      .references(() => dailyPlans.id, { onDelete: 'cascade' }),
    type: planItemType('type').notNull(),
    unitId: uuid('unit_id').references(() => learningUnits.id),
    reviewItemIds: uuid('review_item_ids').array(),
    // Song song với reviewItemIds; NULL = mọi phần tử là `item`.
    reviewFacets: reviewFacet('review_facets').array(),
    estMinutes: smallint('est_minutes').notNull(),
    position: smallint('position').notNull().default(0),
    status: planItemStatus('status').notNull().default('pending'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [index('daily_plan_items_plan_idx').on(t.planId)],
);

export const lessonSessions = pgTable(
  'lesson_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    planItemId: uuid('plan_item_id').references(() => dailyPlanItems.id, {
      onDelete: 'set null',
    }),
    kind: sessionKind('kind').notNull(),
    unitId: uuid('unit_id').references(() => learningUnits.id),
    snapshot: jsonb('snapshot').$type<Record<string, unknown>>().notNull(),
    status: sessionStatus('status').notNull().default('in_progress'),
    startedAt: timestamptz('started_at').notNull().defaultNow(),
    completedAt: timestamptz('completed_at'),
  },
  (t) => [index('lesson_sessions_user_idx').on(t.userId, t.status)],
);

// --- Bản ghi học tập ---
export const studyRecords = pgTable(
  'study_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    clientEventId: uuid('client_event_id').notNull(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => lessonSessions.id, { onDelete: 'cascade' }),
    exerciseId: uuid('exercise_id')
      .notNull()
      .references(() => exercises.id),
    itemId: uuid('item_id').references(() => contentItems.id),
    facet: reviewFacet('facet').notNull().default('item'),
    topicId: uuid('topic_id')
      .notNull()
      .references(() => topics.id),
    isCorrect: boolean('is_correct').notNull(),
    submittedAnswer: jsonb('submitted_answer').$type<unknown>().notNull(),
    context: recordContext('context').notNull(),
    isRetry: boolean('is_retry').notNull().default(false),
    occurredAt: timestamptz('occurred_at').notNull().defaultNow(),
    localDate: date('local_date', { mode: 'string' }).notNull(),
  },
  (t) => [
    unique('study_records_user_id_client_event_id_key').on(t.userId, t.clientEventId),
    uniqueIndex('study_records_primary_answer_idx')
      .on(t.sessionId, t.exerciseId)
      .where(sql`${t.isRetry} = false`),
    index('study_records_user_date_idx').on(t.userId, t.localDate),
    index('study_records_item_facet_idx')
      .on(t.userId, t.itemId, t.facet, sql`${t.occurredAt} DESC`)
      .where(sql`${t.isRetry} = false`),
  ],
);

export const studyIntervals = pgTable(
  'study_intervals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    clientEventId: uuid('client_event_id').notNull(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => lessonSessions.id, { onDelete: 'cascade' }),
    startedAt: timestamptz('started_at').notNull(),
    durationSeconds: integer('duration_seconds').notNull(),
    localDate: date('local_date', { mode: 'string' }).notNull(),
  },
  (t) => [
    unique('study_intervals_user_id_client_event_id_key').on(t.userId, t.clientEventId),
    index('study_intervals_user_idx').on(t.userId, t.startedAt),
  ],
);

export const reviewSchedules = pgTable(
  'review_schedules',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    itemId: uuid('item_id')
      .notNull()
      .references(() => contentItems.id),
    facet: reviewFacet('facet').notNull().default('item'),
    intervalDays: integer('interval_days').notNull(),
    // numeric(3,2) → Drizzle trả chuỗi; engine SRS chuyển sang số khi dùng.
    ease: numeric('ease', { precision: 3, scale: 2 }).notNull(),
    repetitions: integer('repetitions').notNull().default(0),
    lapses: integer('lapses').notNull().default(0),
    dueDate: date('due_date', { mode: 'string' }).notNull(),
    lastResult: boolean('last_result'),
    lastReviewedAt: timestamptz('last_reviewed_at'),
    lastReviewedLocalDate: date('last_reviewed_local_date', { mode: 'string' }),
    isHard: boolean('is_hard').notNull().default(false),
    // Chữ Kanji đã đánh dấu thành thạo (áp mọi khía cạnh): không vào gói ôn; NULL = đang ôn.
    masteredAt: timestamptz('mastered_at'),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.itemId, t.facet] }),
    index('review_schedules_due_idx').on(t.userId, t.dueDate),
  ],
);

export const topicStats = pgTable(
  'topic_stats',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    topicId: uuid('topic_id')
      .notNull()
      .references(() => topics.id),
    recentResults: smallint('recent_results')
      .array()
      .notNull()
      .default(sql`'{}'`),
    accuracy: numeric('accuracy', { precision: 4, scale: 3 }),
    difficultyBias: smallint('difficulty_bias').notNull().default(0),
    consecutiveLow: smallint('consecutive_low').notNull().default(0),
    consecutiveHigh: smallint('consecutive_high').notNull().default(0),
    isWeak: boolean('is_weak').notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.userId, t.topicId] })],
);

// --- Quản trị và thống kê ---
export const adminActionLogs = pgTable(
  'admin_action_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: uuid('target_id'),
    diff: jsonb('diff').$type<Record<string, unknown>>(),
    occurredAt: timestamptz('occurred_at').notNull().defaultNow(),
    // Spec 004: hành động của chủ tổ chức/giáo viên mang tổ chức để lọc theo tổ chức (FR-008).
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'set null',
    }),
  },
  (t) => [
    index('admin_action_logs_time_idx').on(t.occurredAt.desc()),
    index('admin_action_logs_org_idx')
      .on(t.organizationId, t.occurredAt.desc())
      .where(sql`${t.organizationId} IS NOT NULL`),
  ],
);

export const aggregateDailyStats = pgTable(
  'aggregate_daily_stats',
  {
    day: date('day', { mode: 'string' }).notNull(),
    metric: text('metric').notNull(),
    value: bigint('value', { mode: 'number' }).notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.day, t.metric] })],
);

// --- Tổ chức, lớp học và lộ trình lớp (spec 004, migration 0004_org_classes.sql) ---
export const orgStatus = pgEnum('org_status', ['active', 'disabled']);
export const invitationKind = pgEnum('invitation_kind', ['owner', 'teacher', 'student']);
export const invitationStatus = pgEnum('invitation_status', [
  'pending',
  'accepted',
  'declined',
  'revoked',
  'expired',
]);
export const classStatus = pgEnum('class_status', ['active', 'archived']);
export const membershipEndReason = pgEnum('membership_end_reason', [
  'switched_personal',
  'removed',
  'moved',
  'seat_revoked',
  'seat_expired',
  'org_disabled',
  'class_archived',
  'account_deleted',
]);

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  status: orgStatus('status').notNull().default('active'),
  disabledAt: timestamptz('disabled_at'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
});

// Khóa chính `user_id`: một tài khoản tối đa một tổ chức (FR-002).
export const organizationMembers = pgTable(
  'organization_members',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    isOwner: boolean('is_owner').notNull().default(false),
    isTeacher: boolean('is_teacher').notNull().default(false),
    joinedAt: timestamptz('joined_at').notNull(),
  },
  (t) => [index('organization_members_org_idx').on(t.organizationId)],
);

// Ràng buộc loại trừ chồng ngày (`seat_licenses_no_overlap`) chỉ có trong file SQL.
export const seatLicenses = pgTable(
  'seat_licenses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    startsOn: date('starts_on', { mode: 'string' }).notNull(),
    endsOn: date('ends_on', { mode: 'string' }).notNull(),
    graceDays: smallint('grace_days').notNull().default(7),
    maxReassignments: smallint('max_reassignments').notNull().default(2),
    lapseProcessedAt: timestamptz('lapse_processed_at'),
    revokedAt: timestamptz('revoked_at'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [index('seat_licenses_org_idx').on(t.organizationId, t.endsOn.desc())],
);

export const seats = pgTable(
  'seats',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    licenseId: uuid('license_id')
      .notNull()
      .references(() => seatLicenses.id, { onDelete: 'cascade' }),
    holderUserId: uuid('holder_user_id').references(() => users.id, { onDelete: 'set null' }),
    lastHolderUserId: uuid('last_holder_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    reassignmentCount: smallint('reassignment_count').notNull().default(0),
    assignedAt: timestamptz('assigned_at'),
  },
  (t) => [
    uniqueIndex('seats_holder_idx')
      .on(t.holderUserId)
      .where(sql`${t.holderUserId} IS NOT NULL`),
    index('seats_free_idx')
      .on(t.licenseId)
      .where(sql`${t.holderUserId} IS NULL`),
  ],
);

export const classes = pgTable(
  'classes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    name: text('name').notNull(),
    description: text('description'),
    status: classStatus('status').notNull().default('active'),
    archivedAt: timestamptz('archived_at'),
    joinCode: text('join_code').unique(),
    joinCodeEnabled: boolean('join_code_enabled').notNull().default(false),
    joinCodeExpiresAt: timestamptz('join_code_expires_at'),
    absenceThresholdDays: smallint('absence_threshold_days').notNull().default(3),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => [index('classes_org_status_idx').on(t.organizationId, t.status)],
);

export const invitations = pgTable(
  'invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    classId: uuid('class_id').references(() => classes.id),
    kind: invitationKind('kind').notNull(),
    email: citext('email').notNull(),
    displayNameHint: text('display_name_hint'),
    tokenHash: text('token_hash').notNull().unique(),
    status: invitationStatus('status').notNull().default('pending'),
    expiresAt: timestamptz('expires_at').notNull(),
    invitedBy: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),
    respondedAt: timestamptz('responded_at'),
    acceptedBy: uuid('accepted_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('invitations_one_pending_idx')
      .on(t.organizationId, t.email)
      .where(sql`${t.status} = 'pending'`),
    index('invitations_class_status_idx').on(t.classId, t.status),
    index('invitations_org_status_idx').on(t.organizationId, t.status, t.expiresAt),
  ],
);

export const classTeachers = pgTable(
  'class_teachers',
  {
    classId: uuid('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    addedAt: timestamptz('added_at').notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.classId, t.userId] }),
    index('class_teachers_user_idx').on(t.userId),
  ],
);

export const classPaths = pgTable('class_paths', {
  classId: uuid('class_id')
    .primaryKey()
    .references(() => classes.id, { onDelete: 'cascade' }),
  startLevel: selfLevel('start_level').notNull(),
  targetLevel: targetLevel('target_level').notNull(),
  skills: skill('skills').array().notNull(),
  startsOn: date('starts_on', { mode: 'string' }).notNull(),
  endsOn: date('ends_on', { mode: 'string' }).notNull(),
  dailyMinutes: smallint('daily_minutes').notNull(),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
});

export const classPathUnits = pgTable(
  'class_path_units',
  {
    classId: uuid('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    unitId: uuid('unit_id')
      .notNull()
      .references(() => learningUnits.id),
    position: integer('position').notNull(),
    opensOn: date('opens_on', { mode: 'string' }),
  },
  // Ràng buộc UNIQUE (class_id, position) DEFERRABLE chỉ có trong file SQL.
  (t) => [primaryKey({ columns: [t.classId, t.unitId] })],
);

export const classAssignments = pgTable(
  'class_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    classId: uuid('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    batchId: uuid('batch_id').notNull(),
    unitId: uuid('unit_id')
      .notNull()
      .references(() => learningUnits.id),
    dueOn: date('due_on', { mode: 'string' }).notNull(),
    assignedBy: uuid('assigned_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    cancelledAt: timestamptz('cancelled_at'),
  },
  (t) => [
    uniqueIndex('class_assignments_active_idx')
      .on(t.classId, t.unitId)
      .where(sql`${t.cancelledAt} IS NULL`),
  ],
);

export const classMemberships = pgTable(
  'class_memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    classId: uuid('class_id')
      .notNull()
      .references(() => classes.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    joinedAt: timestamptz('joined_at').notNull(),
    consentAt: timestamptz('consent_at').notNull(),
    consentVersion: smallint('consent_version').notNull().default(1),
    seatId: uuid('seat_id').references(() => seats.id, { onDelete: 'set null' }),
    leftAt: timestamptz('left_at'),
    endReason: membershipEndReason('end_reason'),
    exitDisplayName: text('exit_display_name'),
  },
  (t) => [
    uniqueIndex('class_memberships_one_active_idx')
      .on(t.userId)
      .where(sql`${t.leftAt} IS NULL`),
    index('class_memberships_class_active_idx')
      .on(t.classId)
      .where(sql`${t.leftAt} IS NULL`),
    index('class_memberships_class_left_idx').on(t.classId, t.leftAt),
    index('class_memberships_user_idx').on(t.userId, t.joinedAt.desc()),
    check('class_memberships_end_check', sql`(${t.leftAt} IS NULL) = (${t.endReason} IS NULL)`),
  ],
);

export const classLearnerOverrides = pgTable('class_learner_overrides', {
  membershipId: uuid('membership_id')
    .primaryKey()
    .references(() => classMemberships.id, { onDelete: 'cascade' }),
  dailyMinutes: smallint('daily_minutes'),
  shiftDays: smallint('shift_days').notNull().default(0),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
});

export const classLearnerExemptions = pgTable(
  'class_learner_exemptions',
  {
    membershipId: uuid('membership_id')
      .notNull()
      .references(() => classMemberships.id, { onDelete: 'cascade' }),
    unitId: uuid('unit_id')
      .notNull()
      .references(() => learningUnits.id),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.membershipId, t.unitId] })],
);

export const classPausePeriods = pgTable(
  'class_pause_periods',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    classId: uuid('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    // NULL = cả lớp.
    membershipId: uuid('membership_id').references(() => classMemberships.id, {
      onDelete: 'cascade',
    }),
    startedOn: date('started_on', { mode: 'string' }).notNull(),
    endedOn: date('ended_on', { mode: 'string' }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('class_pause_periods_class_open_idx')
      .on(t.classId)
      .where(sql`${t.membershipId} IS NULL AND ${t.endedOn} IS NULL`),
    uniqueIndex('class_pause_periods_member_open_idx')
      .on(t.membershipId)
      .where(sql`${t.membershipId} IS NOT NULL AND ${t.endedOn} IS NULL`),
  ],
);

export const classPlacementRequests = pgTable(
  'class_placement_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    classId: uuid('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    requestedBy: uuid('requested_by').references(() => users.id, { onDelete: 'set null' }),
    requestedAt: timestamptz('requested_at').notNull().defaultNow(),
    closedAt: timestamptz('closed_at'),
  },
  (t) => [
    uniqueIndex('class_placement_requests_open_idx')
      .on(t.classId)
      .where(sql`${t.closedAt} IS NULL`),
  ],
);

export const joinCodeAttempts = pgTable('join_code_attempts', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  failures: smallint('failures').notNull().default(0),
  windowStartedAt: timestamptz('window_started_at').notNull(),
  lockedUntil: timestamptz('locked_until'),
});
