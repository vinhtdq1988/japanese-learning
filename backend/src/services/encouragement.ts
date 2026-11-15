import { listActiveDays, listPausePeriods } from '../db/repositories/progress.js';
import type { Language } from '../domain/types.js';
import { GAP_NOTICE } from '../engine/daily-plan.js';
import {
  pickEncouragementState,
  pickVariant,
  type EncouragementSignals,
} from '../engine/encouragement.js';
import { localToday } from '../engine/clock.js';
import { upcomingUnits } from '../engine/path.js';
import { currentStreakDays, isOnTrack } from '../engine/progress.js';
import type { EncouragementState } from '../domain/encouragement.js';
import type { DailyPlanDto } from './daily-plan.js';
import type { ServiceDeps } from './deps.js';
import { rankForContext, type LearningContext } from './learning-context.js';

// Lời khích lệ của `GET /today` (spec 007, FR-026…FR-031): thu tín hiệu từ dữ liệu đã ghi rồi để engine thuần
// chọn trạng thái và câu. Tín hiệu đắt (chuỗi ngày, tiến độ mục tiêu) chỉ được tính khi trạng thái rẻ hơn chưa
// quyết định được kết quả, để không làm chậm `GET /today` (plan.md §Rủi ro).

export interface EncouragementDto {
  state: EncouragementState;
  message: string;
}

type PlanView = Pick<DailyPlanDto, 'localDate' | 'status' | 'notice' | 'items'>;

export async function buildEncouragement(
  deps: ServiceDeps,
  userId: string,
  ctx: LearningContext,
  plan: PlanView,
): Promise<EncouragementDto> {
  const profile = ctx.profile;
  const signals: EncouragementSignals = {
    planStatus: plan.status,
    planItemsTotal: plan.items.length,
    planItemsDone: plan.items.filter((i) => i.status === 'completed').length,
    streakDays: 0,
    // Kế hoạch lưu `replanned_after_gap` lúc được lập (cùng nguồn với `GET /today.notice`), nên ổn định trong ngày.
    afterGap: plan.notice === GAP_NOTICE,
    onTrack: null,
  };

  let state = pickEncouragementState(signals);
  if (state === 'not_started') {
    const [activeDays, pauses] = await Promise.all([
      listActiveDays(deps.db, userId),
      // Trong lớp chỉ khoảng tạm dừng của lớp áp dụng (research O9).
      ctx.source === 'class' ? Promise.resolve(ctx.pauses) : listPausePeriods(deps.db, userId),
    ]);
    signals.streakDays = currentStreakDays(activeDays, localToday(deps.clock, profile.timezone), pauses);
    state = pickEncouragementState(signals);
  }
  if (state === 'not_started' && profile.targetDate) {
    const remaining = upcomingUnits(await rankForContext(deps, userId, ctx));
    signals.onTrack = isOnTrack({
      remainingMinutes: remaining.reduce((sum, u) => sum + u.estMinutes, 0),
      dailyMinutes: profile.dailyMinutes ?? 0,
      today: plan.localDate,
      targetDate: profile.targetDate,
    });
    state = pickEncouragementState(signals);
  }

  return {
    state,
    message: pickVariant({
      userId,
      state,
      language: profile.language as Language,
      localDate: plan.localDate,
      streakDays: signals.streakDays,
    }),
  };
}
