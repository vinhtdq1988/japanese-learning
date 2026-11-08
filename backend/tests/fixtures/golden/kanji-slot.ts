import { applyKanjiSlot, type NewUnitCandidate } from '../../../src/engine/daily-plan.js';
import type { CandidateTransform } from './simulate-plans.js';

// Cách dịch vụ áp suất Kanji lên ứng viên đã xếp hạng (cùng cách dùng ở `services/daily-plan.ts`).
// Dùng chung cho script sinh golden pre-org (T001) và kiểm thử hồi quy golden để hai bên mô phỏng
// đúng một cách thì so sánh mới có nghĩa.
export const kanjiSlot: CandidateTransform = (candidates, ctx) => {
  const withKind: NewUnitCandidate[] = candidates.map((c) => ({
    ...c,
    kind: ctx.units.get(c.unitId)?.kind,
  }));
  const last = ctx.previousNewUnitDayKinds.at(-1);
  const slotted = applyKanjiSlot(withKind, {
    skills: ctx.skills,
    prioritizedSkill: ctx.prioritizedSkill,
    lastNewUnitPlanHadKanji: last === undefined ? null : last.includes('kanji'),
  });
  return slotted.map(({ unitId, estMinutes }) => ({ unitId, estMinutes }));
};
