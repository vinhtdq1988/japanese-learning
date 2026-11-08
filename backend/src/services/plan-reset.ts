import type { DbExecutor } from '../db/client.js';
import { deletePlanIfAllPending } from '../db/repositories/plans.js';
import { getProfile } from '../db/repositories/profiles.js';
import { localToday, type Clock } from '../engine/clock.js';

// Dọn kế hoạch hôm nay khi NGUỒN HỌC đổi giữa ngày (vào lớp, rời lớp, bị gỡ, hết hạn…) — spec 004, research
// O6, US3.2, SC-013. Tách khỏi `learning-context.ts` để các dịch vụ vòng đời tổ chức dùng được mà không tạo
// vòng phụ thuộc (learning-context → org-access → org-lifecycle).

/**
 * Xóa kế hoạch hôm nay (theo múi giờ của học viên) nếu mọi mục còn `pending`; đã có mục `in_progress` hoặc
 * `completed` thì giữ nguyên và nguồn mới có hiệu lực từ ngày sau. Không chạm lịch sử học, lịch ôn, tiến độ.
 */
export async function clearPendingTodayPlan(
  db: DbExecutor,
  deps: { clock: Clock },
  userId: string,
): Promise<boolean> {
  const profile = await getProfile(db, userId);
  if (!profile) return false;
  return deletePlanIfAllPending(db, userId, localToday(deps.clock, profile.timezone));
}
