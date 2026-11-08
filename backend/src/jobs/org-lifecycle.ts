import { expireOverdueInvitations } from '../db/repositories/invitations.js';
import { localToday } from '../engine/clock.js';
import type { ServiceDeps } from '../services/deps.js';
import { findOrgsNeedingLapse, processOrgLapse } from '../services/org-lifecycle.js';
import { QUEUES, type JobDefinition } from './boss.js';

// Job định kỳ xử lý hết hạn giấy phép / vô hiệu hóa tổ chức (spec 004, T036, research O3). Xử lý LƯỜI trong
// `loadOrgContext` đảm bảo hiệu lực tức thì cho người đang dùng; job này đảm bảo dữ liệu nhất quán cả khi
// không ai truy cập (nếu không, tổ chức không ai dùng sẽ giữ seat và lời mời quá hạn vô thời hạn).

/** Mỗi giờ, lệch phút 07 để không trùng các job đầu giờ khác. */
const HOURLY_CRON = '7 * * * *';

type LifecycleJobDeps = Pick<ServiceDeps, 'config' | 'db' | 'clock'>;

/**
 * Quét và xử lý mọi tổ chức quá hạn/bị vô hiệu hóa còn dữ liệu chưa dọn; chuyển `expired` các lời mời đã quá
 * hạn. Mỗi tổ chức một giao dịch riêng nên một tổ chức lỗi không chặn các tổ chức khác. Trả số tổ chức đã
 * thực sự có thay đổi.
 */
export async function sweepOrgLapses(deps: LifecycleJobDeps): Promise<number> {
  const today = localToday(deps.clock, deps.config.ORG_TIMEZONE);
  await expireOverdueInvitations(deps.db, deps.clock.now());
  let processed = 0;
  for (const organizationId of await findOrgsNeedingLapse(deps.db, today)) {
    const changed = await deps.db.transaction((tx) =>
      processOrgLapse(tx, deps, organizationId, 'seat_expired'),
    );
    if (changed) processed += 1;
  }
  return processed;
}

export function createOrgLifecycleJob(deps: LifecycleJobDeps): JobDefinition<object> {
  return {
    name: QUEUES.orgLifecycle,
    cron: HOURLY_CRON,
    handler: async () => {
      await sweepOrgLapses(deps);
    },
  };
}
