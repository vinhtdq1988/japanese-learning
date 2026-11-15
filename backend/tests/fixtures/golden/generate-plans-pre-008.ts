import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyKanjiSlot,
  applyPracticeSlot,
  type NewUnitCandidate,
} from '../../../src/engine/daily-plan.js';
import { goalRatio } from '../../../src/engine/progress.js';
import { rankUnits, upcomingUnits, type UnitProgressStatus } from '../../../src/engine/path.js';
import {
  loadCompetencyProfiles,
  loadEncouragementProfiles,
  loadKanjiProfiles,
  loadLearnerProfiles,
  loadPracticeProfiles,
  loadRewardProfiles,
  type LearnerProfileFixture,
} from '../learner-profiles/index.js';
import {
  loadSimCatalog,
  simPathParams,
  simulatePlans,
  SIMULATION_DAYS,
  type CandidateTransform,
} from './simulate-plans.js';

// Sinh ảnh chụp golden TRƯỚC khi sửa engine cho spec 008 (bước 0, T001): kế hoạch 14 ngày, thứ tự lộ trình và
// tiến độ của mọi hồ sơ đại diện CŨ trên thư viện 33 đơn vị hiện có. Là chuẩn so sánh cho bất biến I1, I7, I9.
// Ảnh chụp gồm HAI phần tách bạch trong mỗi hồ sơ:
//   (a) `plans` + `path`: kế hoạch ngày và thứ tự lộ trình — PHẢI giống hệt sau mọi thay đổi engine ở D10/D11;
//   (b) `progress`: `completionRatio` — DỰ KIẾN đổi ở T214 vì tính theo phút (baseline có cả đơn vị 5 và 10 phút).
// PHẢI chạy trên mã engine CHƯA thêm biên giới thứ tự học/ôn lùi/`goalRatio` theo phút. KHÔNG chạy lại sau khi
// engine đã đổi, trừ khi chủ ý cập nhật chuẩn (khi đó mọi khác biệt cần được duyệt).
// Phủ MỌI hồ sơ người học cá nhân (nhóm cũ, `kanji-*`, `practice-*`, `competency-*`, `encouragement-*`,
// `reward-*`). Nhóm `class-*` không có: lớp học dùng đường xếp hạng riêng của lớp (spec 004), không đi qua
// `rankUnits` cá nhân.
//
// Chạy: cd backend && CONTENT_RELEASES=000-baseline pnpm exec tsx tests/fixtures/golden/generate-plans-pre-008.ts

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, 'plans-pre-008.json');

/** Cách dịch vụ áp suất luyện rồi suất Kanji lên ứng viên đã xếp hạng (cùng cách dùng ở `services/daily-plan.ts`). */
const practiceThenKanji =
  (budgetMinutes: number): CandidateTransform =>
  (candidates, ctx) => {
    const withKind: NewUnitCandidate[] = candidates.map((c) => ({
      ...c,
      kind: ctx.units.get(c.unitId)?.kind,
    }));
    const last = ctx.previousNewUnitDayKinds.at(-1) ?? null;
    const practiced = applyPracticeSlot(withKind, {
      skills: ctx.skills,
      prioritizedSkill: ctx.prioritizedSkill,
      lastNewUnitPlanKinds: last,
      budgetMinutes,
    });
    return applyKanjiSlot(practiced, {
      skills: ctx.skills,
      prioritizedSkill: ctx.prioritizedSkill,
      lastNewUnitPlanHadKanji: last === null ? null : last.includes('kanji'),
    }).map(({ unitId, estMinutes }) => ({ unitId, estMinutes }));
  };

// Danh mục ĐẦY ĐỦ (gồm Kanji và bài luyện) của thư viện hiện có: đúng hành vi hiện tại của người học cá nhân.
const catalog = loadSimCatalog(true);
const profiles: Record<string, unknown> = {};
const fixtures: LearnerProfileFixture[] = [
  ...loadLearnerProfiles(),
  ...loadKanjiProfiles(),
  ...loadPracticeProfiles(),
  ...loadCompetencyProfiles(),
  ...loadEncouragementProfiles(),
  ...loadRewardProfiles(),
].sort((a, b) => a.id.localeCompare(b.id));
for (const f of fixtures) {
  const plans = simulatePlans(f, { catalog, transform: practiceThenKanji(f.profile.dailyMinutes) });

  // Lộ trình và tiến độ ở ngày xuất phát (`asOf`): tiến độ ban đầu = các đơn vị `completedUnitSlugs`.
  const progress = new Map<string, UnitProgressStatus>(
    (f.completedUnitSlugs ?? []).map((slug) => [slug, 'completed' as const]),
  );
  const ranked = rankUnits(
    simPathParams(f),
    {
      skills: f.profile.skills,
      prioritizedSkill: f.profile.prioritizedSkill,
      goalType: f.profile.goalType,
    },
    catalog,
    progress,
    [],
    { includeMastered: true },
  );
  const remaining = upcomingUnits(ranked);

  profiles[f.id] = {
    plans,
    path: ranked.map((r) => ({ unitId: r.unit.id, status: r.status })),
    progress: {
      ...goalRatio(ranked),
      remainingUnits: remaining.length,
      remainingMinutes: remaining.reduce((sum, u) => sum + u.estMinutes, 0),
    },
  };
}

const snapshot = { days: SIMULATION_DAYS, unitCount: catalog.length, profiles };
writeFileSync(OUT, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
console.log(
  `Đã ghi ${Object.keys(profiles).length} hồ sơ × ${SIMULATION_DAYS} ngày (${catalog.length} đơn vị) vào ${OUT}`,
);
