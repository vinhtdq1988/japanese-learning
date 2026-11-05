import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { encodeReviewKey } from '../../../src/domain/review-key.js';
import { gradePlacement } from '../../../src/engine/placement.js';
import { addDays } from '../../../src/engine/clock.js';
import {
  packReviewBatches,
  planDailyPlan,
  rankDueItems,
  type DailyPlanResult,
  type DueReviewItem,
  type NewUnitCandidate,
  type PlanDayKind,
} from '../../../src/engine/daily-plan.js';
import {
  buildPathParams,
  rankUnits,
  upcomingUnits,
  type RankableUnit,
  type UnitProgressStatus,
} from '../../../src/engine/path.js';
import { DEFAULT_CONTENT_DIR, type PlacementFile } from '../../../src/seed/content.js';
import type { LearnerProfileFixture } from '../learner-profiles/index.js';

// Mô phỏng kế hoạch nhiều ngày cho một hồ sơ đại diện (T001, T040, SC-006).
// Dùng chung cho script sinh ảnh chụp golden (chạy trên engine CHƯA sửa) và kiểm thử hồi quy golden:
// hai bên PHẢI dùng đúng một cách mô phỏng thì so sánh mới có nghĩa.

/** Số ngày mô phỏng cho mỗi hồ sơ. */
export const SIMULATION_DAYS = 14;
/** Số giây ước tính mỗi câu ôn (khớp mặc định `REVIEW_SECONDS_PER_ITEM`). */
export const SIMULATION_SECONDS_PER_ITEM = 30;

/** Đơn vị trong danh mục mô phỏng: `id` là tên file nguồn (không đuôi) nên tất định. */
export interface SimUnit extends RankableUnit {
  slug: string;
}

/** Một mục kế hoạch đã rút gọn thành dạng so sánh được (không chứa id ngẫu nhiên). */
export type SimPlanItem =
  | { type: 'new_unit'; unitId: string; estMinutes: number }
  | { type: 'review_batch'; itemIds: string[]; estMinutes: number };

export interface SimDay {
  date: string;
  kind: PlanDayKind;
  estimatedMinutes: number;
  items: SimPlanItem[];
}

/** Kết quả mô phỏng của một hồ sơ: `null` ở ngày tạm dừng (không có kế hoạch). */
export type SimHistory = (SimDay | null)[];

/** Biến đổi danh sách ứng viên đã xếp hạng trước `planDailyPlan` (kiểm thử golden truyền `applyKanjiSlot`). */
export type CandidateTransform = (
  candidates: NewUnitCandidate[],
  context: {
    skills: LearnerProfileFixture['profile']['skills'];
    prioritizedSkill: LearnerProfileFixture['profile']['prioritizedSkill'];
    units: ReadonlyMap<string, SimUnit>;
    previousNewUnitDayKinds: readonly string[][];
  },
) => NewUnitCandidate[];

const placementFile = JSON.parse(
  readFileSync(path.join(DEFAULT_CONTENT_DIR, 'placement/placement-v1.json'), 'utf8'),
) as PlacementFile;

/** Nạp danh mục đơn vị từ `content/units/*.json` (loại đơn vị Kanji nếu `includeKanji = false`). */
export function loadSimCatalog(includeKanji: boolean): SimUnit[] {
  const dir = path.join(DEFAULT_CONTENT_DIR, 'units');
  const units: SimUnit[] = [];
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()) {
    const raw = JSON.parse(readFileSync(path.join(dir, file), 'utf8')) as {
      kind: string;
      level: SimUnit['level'];
      tier?: SimUnit['tier'];
      topic: string;
      goalTags?: string[];
      difficulty: number;
      estMinutes: number;
      sequence?: number;
    };
    if (raw.kind === 'kanji' && !includeKanji) continue;
    const slug = file.replace(/\.json$/, '');
    units.push({
      id: slug,
      slug,
      kind: raw.kind as SimUnit['kind'],
      level: raw.level,
      tier: raw.tier ?? 'core',
      goalTags: raw.goalTags ?? [],
      topicId: raw.topic,
      difficulty: raw.difficulty,
      estMinutes: raw.estMinutes,
      sequence: raw.sequence ?? 0,
    });
  }
  return units;
}

function placementOf(f: LearnerProfileFixture) {
  if (!f.placement) return null;
  const correct = f.placement.correctByPosition;
  const keys = placementFile.questions.map((q) => ({
    id: `q${q.position}`,
    level: q.level,
    topicId: q.topic,
    correctChoice: q.correctChoice,
  }));
  const outcome = gradePlacement(
    keys,
    placementFile.questions.map((q) => ({
      questionId: `q${q.position}`,
      choice: correct[q.position - 1] ? q.correctChoice : (q.correctChoice + 1) % 4,
    })),
  );
  return {
    id: 'placement-1',
    estimatedLevel: outcome.estimatedLevel,
    weakTopics: outcome.weakTopics,
  };
}

export interface SimulateOptions {
  catalog: readonly SimUnit[];
  transform?: CandidateTransform;
  days?: number;
}

/**
 * Mô phỏng `days` ngày: mỗi ngày xếp hạng đơn vị bằng `rankUnits`, chọn gói ôn từ tồn đọng bằng
 * `rankDueItems` + `packReviewBatches`, lập kế hoạch bằng `planDailyPlan`; sang ngày sau coi đơn vị mới
 * đã hoàn thành, các mục ôn trong gói đã được ôn xong và loại kế hoạch ngày trước được đưa vào `previousKind`.
 */
export function simulatePlans(f: LearnerProfileFixture, options: SimulateOptions): SimHistory {
  const { catalog, transform, days = SIMULATION_DAYS } = options;
  const params = buildPathParams(
    {
      currentLevel: f.profile.currentLevel,
      goalType: f.profile.goalType,
      targetLevel: f.profile.targetLevel,
      targetDate: f.profile.targetDate,
      skills: f.profile.skills,
      prioritizedSkill: f.profile.prioritizedSkill,
    },
    placementOf(f),
  );
  const unitsById = new Map(catalog.map((u) => [u.id, u]));
  const progress = new Map<string, UnitProgressStatus>(
    (f.completedUnitSlugs ?? []).map((slug) => [slug, 'completed' as const]),
  );

  // Tồn đọng ôn: mỗi nhóm `count` mục, quá hạn `daysOverdue` ngày so với `asOf`.
  let backlog: DueReviewItem[] = f.reviewBacklog.flatMap((g, gi) =>
    Array.from({ length: g.count }, (_, i) => ({
      // Khóa ghép itemId[:facet]: facet `item` (hồ sơ cũ) giữ nguyên khóa nên golden không đổi.
      itemId: encodeReviewKey(`b${gi}-${String(i).padStart(3, '0')}`, g.facet ?? 'item'),
      dueDate: addDays(f.asOf, -g.daysOverdue),
      isHard: g.isHard,
    })),
  );

  const history: SimHistory = [];
  let previousKind: PlanDayKind | null = null;
  const previousNewUnitDayKinds: string[][] = [];

  for (let d = 0; d < days; d++) {
    const today = addDays(f.asOf, d);
    if (f.profile.paused) {
      history.push(null);
      continue;
    }
    const ranked = rankUnits(
      params,
      {
        skills: f.profile.skills,
        prioritizedSkill: f.profile.prioritizedSkill,
        goalType: f.profile.goalType,
      },
      catalog,
      progress,
    );
    let candidates: NewUnitCandidate[] = upcomingUnits(ranked).map((u) => ({
      unitId: u.id,
      estMinutes: u.estMinutes,
    }));
    if (transform) {
      candidates = transform(candidates, {
        skills: f.profile.skills,
        prioritizedSkill: f.profile.prioritizedSkill,
        units: unitsById,
        previousNewUnitDayKinds,
      });
    }
    const rankedIds = rankDueItems(backlog, today).map((i) => i.itemId);
    const result: DailyPlanResult | null = planDailyPlan({
      budgetMinutes: f.profile.dailyMinutes,
      paused: false,
      newUnits: candidates,
      packReview: (minutes) => packReviewBatches(rankedIds, minutes, SIMULATION_SECONDS_PER_ITEM),
      previousKind,
    });
    if (!result) {
      history.push(null);
      continue;
    }
    history.push({
      date: today,
      kind: result.kind,
      estimatedMinutes: result.estimatedMinutes,
      items: result.items.map((i) =>
        i.type === 'new_unit'
          ? { type: 'new_unit', unitId: i.unitId, estMinutes: i.estMinutes }
          : { type: 'review_batch', itemIds: [...i.itemIds], estMinutes: i.estMinutes },
      ),
    });

    // Kết quả ngày: đơn vị mới hoàn thành, gói ôn đã ôn xong, nhớ loại bài mới cho ngày sau.
    const reviewed = new Set<string>();
    const newKinds: string[] = [];
    for (const item of result.items) {
      if (item.type === 'new_unit') {
        progress.set(item.unitId, 'completed');
        newKinds.push(unitsById.get(item.unitId)?.kind ?? '');
      } else {
        for (const id of item.itemIds) reviewed.add(id);
      }
    }
    backlog = backlog.filter((b) => !reviewed.has(b.itemId));
    if (newKinds.length > 0) previousNewUnitDayKinds.push(newKinds);
    previousKind = result.kind;
  }
  return history;
}
