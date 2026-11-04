import type { DbExecutor } from '../db/client.js';
import {
  incrementMetric,
  placementLevelMetric,
  type TrialMetric,
} from '../db/repositories/aggregate-stats.js';
import { resolveText, type Localizable } from '../domain/i18n.js';
import type { PlacementAnswersInput } from '../domain/profile-validation.js';
import {
  publicExercise,
  type PublicExercise,
  type SessionSnapshot,
  type SnapshotExercise,
  type SnapshotItem,
} from '../domain/session-snapshot.js';
import type { Language, Skill } from '../domain/types.js';
import type { CatalogUnit } from './content-cache.js';
import type { ServiceDeps } from './deps.js';
import { gradeWithoutStoring, type PlacementResultDto } from './placement.js';

// Dịch vụ dùng thử không đăng ký (T097, T098, T098a; FR-036 → FR-040). Không có phiên phía server và không
// ghi bản ghi định danh nào: nội dung công khai chỉ đọc, placement chấm xong không lưu, và chỉ tăng các bộ
// đếm tổng hợp ẩn danh theo ngày (`aggregate_daily_stats`).

/** Tổng thời lượng tối đa của tập dùng thử (R9). */
export const TRIAL_MAX_MINUTES = 10;

/** Đáp án gửi cho client để chấm cục bộ (chỉ dùng cho nội dung dùng thử công khai). */
export type TrialAnswerKey =
  { correctIndex: number } | { pairs: [string, string][] } | { acceptedAnswers: string[] };

export interface TrialExerciseDto extends PublicExercise {
  answerKey: TrialAnswerKey;
  feedbackCorrect: string;
  feedbackIncorrect: string;
}

export interface TrialUnitDto {
  id: string;
  kind: Skill;
  title: string;
  estMinutes: number;
  items: SnapshotItem[];
  exercises: TrialExerciseDto[];
}

export interface TrialContentDto {
  units: TrialUnitDto[];
}

/** Sự kiện dùng thử ẩn danh được phép ghi nhận → metric tương ứng. */
export const TRIAL_EVENT_METRICS = {
  lesson_completed: 'trial_lesson_completed',
} as const satisfies Record<string, TrialMetric>;

export type TrialEvent = keyof typeof TRIAL_EVENT_METRICS;

/** Ngày UTC (YYYY-MM-DD) của đồng hồ tiêm vào; bộ đếm ẩn danh không gắn với múi giờ người dùng nào. */
function metricDay(deps: Pick<ServiceDeps, 'clock'>): string {
  return deps.clock.now().toISOString().slice(0, 10);
}

/**
 * Chọn tập dùng thử mặc định: mỗi kỹ năng (từ vựng, ngữ pháp) một đơn vị `is_trial`, ưu tiên đơn vị ngắn
 * rồi theo `sequence`, và bỏ bớt nếu tổng vượt `TRIAL_MAX_MINUTES`. Hàm thuần để kiểm thử.
 */
export function pickTrialUnits(units: readonly CatalogUnit[]): CatalogUnit[] {
  const trial = units.filter((u) => u.isTrial);
  const picked: CatalogUnit[] = [];
  let minutes = 0;
  for (const kind of ['vocabulary', 'grammar'] as const) {
    const best = trial
      .filter((u) => u.kind === kind)
      .sort((a, b) => a.estMinutes - b.estMinutes || a.sequence - b.sequence)[0];
    if (best && minutes + best.estMinutes <= TRIAL_MAX_MINUTES) {
      picked.push(best);
      minutes += best.estMinutes;
    }
  }
  return picked;
}

function answerKeyOf(exercise: SnapshotExercise, language: Language): TrialAnswerKey {
  const payload = exercise.payload;
  switch (exercise.type) {
    case 'multiple_choice':
      return { correctIndex: payload.correct_index as number };
    case 'matching': {
      const pairs = payload.pairs as [Localizable, Localizable][];
      return {
        pairs: pairs.map(([l, r]) => [resolveText(l, language), resolveText(r, language)]),
      };
    }
    case 'fill_blank':
      return { acceptedAnswers: payload.accepted_answers as string[] };
  }
}

/** Dựng đơn vị dùng thử từ snapshot đã bản địa hóa: bài tập có kèm đáp án để client chấm. */
export function toTrialUnit(unit: CatalogUnit, snapshot: SessionSnapshot): TrialUnitDto {
  return {
    id: unit.id,
    kind: unit.kind,
    title: snapshot.title,
    estMinutes: unit.estMinutes,
    items: snapshot.items,
    exercises: snapshot.exercises.map((e) => ({
      ...publicExercise(e, snapshot.language),
      answerKey: answerKeyOf(e, snapshot.language),
      feedbackCorrect: e.feedbackCorrect,
      feedbackIncorrect: e.feedbackIncorrect,
    })),
  };
}

/** Nội dung dùng thử cố định (công khai); tăng bộ đếm ẩn danh `trial_content_loaded`. */
export async function getTrialContent(
  deps: Pick<ServiceDeps, 'db' | 'clock' | 'contentCache'>,
  language: Language,
): Promise<TrialContentDto> {
  const catalog = await deps.contentCache.activeUnits();
  const units: TrialUnitDto[] = [];
  for (const unit of pickTrialUnits(catalog)) {
    const snapshot = await deps.contentCache.lessonSnapshot(unit.id, language);
    if (snapshot) units.push(toTrialUnit(unit, snapshot));
  }
  await incrementMetric(deps.db, metricDay(deps), 'trial_content_loaded');
  return { units };
}

/**
 * Chấm placement cho khách: KHÔNG lưu kết quả (`id` là null) và không ghi nhật ký định danh. Chỉ tăng bộ
 * đếm `trial_placement_completed` và `trial_placement_level_<mức>`. Chấm thất bại (422) thì không đếm.
 */
export async function gradeTrialPlacement(
  deps: Pick<ServiceDeps, 'db' | 'clock'>,
  input: PlacementAnswersInput,
  language: Language,
): Promise<PlacementResultDto> {
  const result = await gradeWithoutStoring(deps.db, input, language);
  const day = metricDay(deps);
  await countPlacement(deps.db, day, result.estimatedLevel);
  return result;
}

async function countPlacement(
  db: DbExecutor,
  day: string,
  level: PlacementResultDto['estimatedLevel'],
): Promise<void> {
  await incrementMetric(db, day, 'trial_placement_completed');
  await incrementMetric(db, day, placementLevelMetric(level));
}

/** Ghi nhận một sự kiện dùng thử ẩn danh: chỉ tăng bộ đếm tổng hợp theo ngày, không lưu gì khác. */
export async function recordTrialEvent(
  deps: Pick<ServiceDeps, 'db' | 'clock'>,
  event: TrialEvent,
): Promise<void> {
  await incrementMetric(deps.db, metricDay(deps), TRIAL_EVENT_METRICS[event]);
}
