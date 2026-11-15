/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ContractClient } from '../contract/client.js';
import {
  EMPTY_TOPIC_STATS,
  recordAnswer,
  type TopicStatState,
} from '../../src/engine/difficulty.js';
import type { LearnerProfileFixture } from '../fixtures/learner-profiles/index.js';
import { topicByKey, topicCatalog } from '../fixtures/topic-catalog.js';
import type { TestApp } from './helpers.js';
import { onboardedLearner, query, type Learner } from './lesson-helpers.js';

// Tiện ích dùng chung cho kiểm thử màu năng lực (spec 007, US3): dựng người học từ hồ sơ `competency-*`,
// ghi `topic_stats` đúng như đường ghi của phiên học (phát lại qua `recordAnswer`) và tra khóa chủ đề ↔ id.

/** Bảng mức mong đợi của hồ sơ `competency-*` (`expected.competency`), khóa chủ đề theo `topics.json`. */
export interface ExpectedCompetency {
  skills: Record<string, string>;
  topics: Record<string, string>;
  weakTopics: string[];
}

export const expectedCompetency = (fx: LearnerProfileFixture): ExpectedCompetency =>
  fx.expected.competency as unknown as ExpectedCompetency;

/** Phát lại lịch sử hồ sơ theo từng chủ đề (khóa `topics.json`) bằng `recordAnswer`. */
export function replayHistory(fx: LearnerProfileFixture): Map<string, TopicStatState> {
  const states = new Map<string, TopicStatState>();
  for (const session of fx.history) {
    let state = states.get(session.topic) ?? { ...EMPTY_TOPIC_STATS, recentResults: [] };
    for (const r of session.results) state = recordAnswer(state, r === 1);
    states.set(session.topic, state);
  }
  return states;
}

/** Id chủ đề trong CSDL theo khóa `topics.json` (tra theo kỹ năng, trình độ, tên tiếng Anh). */
export async function topicIdOf(ctx: TestApp, key: string): Promise<string> {
  const t = topicByKey(key);
  const rows = await query<{ id: string }>(
    ctx,
    `SELECT id FROM topics WHERE skill = $1 AND level = $2 AND name->>'en' = $3`,
    [t.skill, t.level, t.name.en],
  );
  if (rows.length !== 1) throw new Error(`Không có đúng một chủ đề "${key}" trong CSDL`);
  return rows[0]!.id;
}

/** Ánh xạ ngược id chủ đề trong CSDL → khóa `topics.json`. */
export async function topicKeysById(ctx: TestApp): Promise<Map<string, string>> {
  const rows = await query<{ id: string; skill: string; level: string; en: string }>(
    ctx,
    `SELECT id, skill::text AS skill, level::text AS level, name->>'en' AS en FROM topics`,
  );
  const map = new Map<string, string>();
  for (const r of rows) {
    const t = topicCatalog().find(
      (c) => c.skill === r.skill && c.level === r.level && c.name.en === r.en,
    );
    if (t) map.set(r.id, t.key);
  }
  return map;
}

/** Ghi (hoặc thay) thống kê một chủ đề của người học như phiên học thật sẽ ghi. */
export async function writeTopicStats(
  ctx: TestApp,
  userId: string,
  key: string,
  state: TopicStatState,
): Promise<void> {
  await query(
    ctx,
    `INSERT INTO topic_stats (user_id, topic_id, recent_results, accuracy, is_weak)
     VALUES ($1, $2, $3::smallint[], $4, $5)
     ON CONFLICT (user_id, topic_id) DO UPDATE
       SET recent_results = EXCLUDED.recent_results, accuracy = EXCLUDED.accuracy, is_weak = EXCLUDED.is_weak`,
    [
      userId,
      await topicIdOf(ctx, key),
      state.recentResults,
      state.accuracy === null ? null : state.accuracy.toFixed(3),
      state.isWeak,
    ],
  );
}

/** Đăng ký + onboarding theo hồ sơ rồi ghi `topic_stats` từ lịch sử của hồ sơ. */
export async function competencyLearner(
  api: ContractClient,
  ctx: TestApp,
  fx: LearnerProfileFixture,
): Promise<Learner> {
  const p = fx.profile;
  const learner = await onboardedLearner(api, ctx, {
    currentLevel: p.currentLevel,
    goalType: p.goalType,
    ...(p.targetLevel ? { targetLevel: p.targetLevel } : {}),
    dailyMinutes: p.dailyMinutes,
    skills: p.skills,
  });
  for (const [key, state] of replayHistory(fx)) {
    await writeTopicStats(ctx, learner.userId, key, state);
  }
  return learner;
}

/** Khóa chủ đề của từng đơn vị (`unitId` → khóa `topics.json`), dùng so mức chủ đề ở `GET /path`. */
export async function unitTopicKeys(ctx: TestApp): Promise<Map<string, string>> {
  const keys = await topicKeysById(ctx);
  const rows = await query<{ id: string; topic_id: string }>(
    ctx,
    'SELECT id, topic_id FROM learning_units',
  );
  const map = new Map<string, string>();
  for (const r of rows) {
    const key = keys.get(r.topic_id);
    if (key) map.set(r.id, key);
  }
  return map;
}

/** Quy mảng `competency.topics` của `GET /progress` thành `{ khóa chủ đề: mức }`. */
export function progressTopicLevels(
  body: any,
  keys: Map<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    (body.competency.topics as any[]).map((t) => [keys.get(t.topicId) ?? t.topicId, t.level]),
  );
}
