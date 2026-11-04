// Schema Drizzle – khớp migration `migrations/0001_init.sql` (nguồn sự thật của lược đồ là file SQL).
// Drizzle chỉ dùng để truy vấn có kiểu; KHÔNG sinh migration từ file này.
import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
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
import type { I18nText } from '../domain/types.js';

const citext = customType<{ data: string }>({
  dataType: () => 'citext',
});

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

// --- Kiểu liệt kê (tên khớp CREATE TYPE trong migration) ---
export const userRole = pgEnum('user_role', ['learner', 'admin']);
export const accountStatus = pgEnum('account_status', ['active', 'disabled', 'pending_deletion']);
export const skill = pgEnum('skill', ['vocabulary', 'grammar']);
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
  },
  (t) => [
    uniqueIndex('placement_results_current_idx')
      .on(t.userId)
      .where(sql`${t.isCurrent}`),
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
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.itemId] }),
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
  },
  (t) => [index('admin_action_logs_time_idx').on(t.occurredAt.desc())],
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
