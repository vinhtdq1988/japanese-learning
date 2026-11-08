/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadReportQueries } from '../../src/reports/run.js';
import { seedContent } from '../../src/seed/index.js';
import { ContractClient } from '../contract/client.js';
import { createTestApp, type TestApp } from './helpers.js';
import { answersFor, distinctTopicExercises, seedAnswers } from './class-activity-helpers.js';
import { kanjiUnitId, onboardedLearner, query, type Learner } from './lesson-helpers.js';
import {
  addOrgRole,
  createTestClass,
  createTestOrg,
  createTestUser,
  enrollLearner,
} from './org-helpers.js';
import { addDays } from '../../src/engine/clock.js';

// Truy vấn báo cáo chỉ số sản phẩm (T119, T084, T129, T076): SC-003, SC-009, SC-011, Kanji SC-001, SC-008, lớp học SC-010
// và hiệu ứng thưởng SC-006, SC-007 (spec 005)
// trên dữ liệu dựng sẵn.
// Thời điểm lộ trình/phiên học được "già hóa" bằng UPDATE để nhóm đủ chín mà không cần chờ.

let ctx: TestApp;
let api: ContractClient;
let queries: Map<string, string>;

const run = async (name: string) => {
  const sqlText = queries.get(name);
  if (!sqlText) throw new Error(`Không có truy vấn ${name}`);
  return (await ctx.handle.pool.query(sqlText)).rows;
};

/** Đặt thời điểm tạo lộ trình onboarding cách đây `days` ngày. */
async function ageOnboarding(learner: Learner, days: number): Promise<void> {
  await query(
    ctx,
    `UPDATE learning_paths SET created_at = now() - make_interval(days => $2)
      WHERE user_id = $1 AND reason = 'onboarding'`,
    [learner.userId, days],
  );
}

/** Thêm lộ trình `superseded` với lý do cho trước, `afterDays` ngày sau lộ trình onboarding. */
async function addPath(learner: Learner, reason: string, afterDays: number): Promise<void> {
  await query(
    ctx,
    `INSERT INTO learning_paths (user_id, status, reason, generated_from, created_at)
     SELECT user_id, 'superseded', $2::path_reason, '{}'::jsonb, created_at + make_interval(days => $3)
       FROM learning_paths WHERE user_id = $1 AND reason = 'onboarding'`,
    [learner.userId, reason, afterDays],
  );
}

/** Ghi một phiên học đã hoàn thành `afterDays` ngày sau lộ trình onboarding. */
async function addCompletedSession(learner: Learner, afterDays: number): Promise<void> {
  await query(
    ctx,
    `INSERT INTO lesson_sessions (user_id, kind, snapshot, status, started_at, completed_at)
     SELECT user_id, 'new_unit', '{}'::jsonb, 'completed',
            created_at + make_interval(days => $2), created_at + make_interval(days => $2, mins => 5)
       FROM learning_paths WHERE user_id = $1 AND reason = 'onboarding'`,
    [learner.userId, afterDays],
  );
}

beforeAll(async () => {
  ctx = await createTestApp();
  await seedContent(ctx.handle.db);
  api = new ContractClient(ctx.app);
  queries = new Map((await loadReportQueries()).map((q) => [q.name, q.sql]));
});
afterAll(async () => {
  await ctx.close();
});

describe('bộ truy vấn báo cáo', () => {
  it('có đủ các truy vấn theo T119 và mỗi truy vấn chạy được trên CSDL rỗng', async () => {
    expect([...queries.keys()]).toEqual([
      'sc003_start_point_accepted',
      'sc009_retention',
      'sc011_daily',
      'sc011_summary',
      'trial_placement_levels',
      'kanji_first_plan_has_kanji_ratio',
      'kanji_completed_within_3_days_ratio',
      'sc010_class_week4_active_days',
      'sc006_effects_disabled_ratio',
      'sc007_next_day_return_after_plan_completion',
    ]);
    for (const name of queries.keys()) await expect(run(name)).resolves.toBeDefined();
  });
});

describe('SC-003: điểm xuất phát được chấp nhận, hai nhóm', () => {
  it('đếm riêng nhóm có/không làm placement, chỉ nhóm đã qua 7 ngày, loại lộ trình xây dựng lại trong tuần đầu', async () => {
    const noPlacementAccepted = await onboardedLearner(api, ctx);
    const noPlacementRebuilt = await onboardedLearner(api, ctx);
    const noPlacementLateRebuild = await onboardedLearner(api, ctx);
    const placementAccepted = await onboardedLearner(api, ctx);
    const tooFresh = await onboardedLearner(api, ctx);

    for (const l of [noPlacementAccepted, noPlacementRebuilt, noPlacementLateRebuild]) {
      await ageOnboarding(l, 10);
    }
    await ageOnboarding(placementAccepted, 10);
    await query(
      ctx,
      `UPDATE learning_paths
          SET generated_from = jsonb_set(generated_from, '{placement_result_id}', to_jsonb(gen_random_uuid()::text))
        WHERE user_id = $1 AND reason = 'onboarding'`,
      [placementAccepted.userId],
    );
    await ageOnboarding(tooFresh, 1);

    await addPath(noPlacementRebuilt, 'goal_change', 2); // trong 7 ngày → không chấp nhận
    await addPath(noPlacementLateRebuild, 'rebuild_request', 8); // sau tuần đầu → vẫn chấp nhận

    const rows = await run('sc003_start_point_accepted');
    const byGroup = Object.fromEntries(rows.map((r: any) => [r.nhom, r]));
    expect(byGroup.co_lam_placement).toMatchObject({
      so_nguoi_hoc: 1,
      chap_nhan: 1,
      ty_le_pct: '100.0',
      dat_muc_tieu_80: true,
    });
    expect(byGroup.bo_qua_placement).toMatchObject({
      so_nguoi_hoc: 3,
      chap_nhan: 2,
      ty_le_pct: '66.7',
      dat_muc_tieu_80: false,
    });
  });
});

describe('SC-009: giữ chân ngày 2 và học >= 3 ngày trong 2 tuần', () => {
  it('chỉ tính nhóm đã chín và đếm đúng ngày địa phương', async () => {
    // Xóa người học của các test khác (cascade) để tỷ lệ không bị lẫn; giữ nguyên nội dung đã seed.
    await query(ctx, 'DELETE FROM users');
    const returning = await onboardedLearner(api, ctx);
    const oneDayOnly = await onboardedLearner(api, ctx);
    const fresh = await onboardedLearner(api, ctx);
    await ageOnboarding(returning, 20);
    await ageOnboarding(oneDayOnly, 20);
    await ageOnboarding(fresh, 0);

    for (const day of [0, 1, 5]) await addCompletedSession(returning, day);
    await addCompletedSession(oneDayOnly, 0);
    await addCompletedSession(oneDayOnly, 0); // cùng ngày không tính thêm

    const rows = await run('sc009_retention');
    const byMetric = Object.fromEntries(rows.map((r: any) => [r.chi_so, r]));
    // `fresh` mới onboarding hôm nay nên không thuộc nhóm ngày 2 lẫn nhóm 2 tuần.
    expect(byMetric.giu_chan_ngay_2).toMatchObject({
      so_nguoi_hoc: 2,
      dat: 1,
      ty_le_pct: '50.0',
    });
    expect(byMetric['hoc_>=3_ngay_trong_2_tuan']).toMatchObject({
      so_nguoi_hoc: 2,
      dat: 1,
      ty_le_pct: '50.0',
    });
    expect(byMetric.giu_chan_ngay_2.muc_tieu_pct).toBe(40);
    expect(byMetric['hoc_>=3_ngay_trong_2_tuan'].muc_tieu_pct).toBe(25);
  });
});

describe('SC-011: chuyển đổi từ dùng thử', () => {
  it('so khớp số tài khoản from_trial với bộ đếm hoàn thành bài mẫu và phân bố placement', async () => {
    await query(
      ctx,
      `INSERT INTO aggregate_daily_stats (day, metric, value) VALUES
         ('2026-01-05', 'trial_lesson_completed', 8),
         ('2026-01-06', 'trial_lesson_completed', 2),
         ('2026-01-05', 'trial_placement_level_N5', 3),
         ('2026-01-06', 'trial_placement_level_N5', 1),
         ('2026-01-05', 'trial_placement_level_none', 1)`,
    );
    const a = await onboardedLearner(api, ctx);
    const b = await onboardedLearner(api, ctx);
    await query(ctx, `UPDATE users SET from_trial = true WHERE id = ANY($1::uuid[])`, [
      [a.userId, b.userId],
    ]);

    const [summary] = await run('sc011_summary');
    expect(summary).toMatchObject({
      hoan_thanh_bai_mau: 10,
      dang_ky_tu_dung_thu: 2,
      ty_le_pct: '20.0',
      dat_muc_tieu_20: true,
    });

    const daily = await run('sc011_daily');
    expect(daily.map((r: any) => r.hoan_thanh_bai_mau)).toEqual(expect.arrayContaining([8, 2]));
    expect(daily.reduce((s: number, r: any) => s + Number(r.dang_ky_tu_dung_thu), 0)).toBe(2);

    const levels = await run('trial_placement_levels');
    expect(levels).toEqual([
      { muc_uoc_tinh: 'N5', so_luot: 4, ty_le_pct: '80.0' },
      { muc_uoc_tinh: 'none', so_luot: 1, ty_le_pct: '20.0' },
    ]);
  });
});

/** Đặt `kanji_selected_at` cách đây `days` ngày (người học đã chọn Kanji). */
async function selectKanji(learner: Learner, days: number): Promise<void> {
  await query(
    ctx,
    `UPDATE learning_profiles SET kanji_selected_at = now() - make_interval(days => $2)
      WHERE user_id = $1`,
    [learner.userId, days],
  );
}

/** Ghi một kế hoạch ngày tạo cách đây `daysAgo` ngày; `unitIds` là các mục `new_unit`, rỗng = chỉ có gói ôn. */
async function addPlan(learner: Learner, daysAgo: number, unitIds: string[]): Promise<void> {
  const [plan] = await query<{ id: string }>(
    ctx,
    `INSERT INTO daily_plans (user_id, local_date, budget_minutes, estimated_minutes, created_at)
     VALUES ($1, (now() - make_interval(days => $2))::date, 10, 10, now() - make_interval(days => $2))
     RETURNING id`,
    [learner.userId, daysAgo],
  );
  for (const [position, unitId] of unitIds.entries()) {
    await query(
      ctx,
      `INSERT INTO daily_plan_items (plan_id, type, unit_id, est_minutes, position)
       VALUES ($1, 'new_unit', $2, 5, $3)`,
      [plan!.id, unitId, position],
    );
  }
  if (unitIds.length === 0) {
    await query(
      ctx,
      `INSERT INTO daily_plan_items (plan_id, type, review_item_ids, est_minutes)
       VALUES ($1, 'review_batch', ARRAY[]::uuid[], 5)`,
      [plan!.id],
    );
  }
}

describe('Kanji SC-001: kế hoạch đầu tiên sau khi chọn Kanji có bài Kanji', () => {
  it('chỉ xét kế hoạch đầu tiên từ lúc chọn, chỉ tính kế hoạch có phần bài mới', async () => {
    await query(ctx, 'DELETE FROM users');
    const kanjiUnit = await kanjiUnitId(ctx, 'Number kanji 1 (一 二 三)');
    const [vocab] = await query<{ id: string }>(
      ctx,
      `SELECT id FROM learning_units WHERE kind = 'vocabulary' ORDER BY created_at LIMIT 1`,
    );

    // Kế hoạch đầu tiên SAU khi chọn có Kanji (kế hoạch trước khi chọn bị bỏ qua dù không có Kanji).
    const hit = await onboardedLearner(api, ctx);
    await selectKanji(hit, 5);
    await addPlan(hit, 6, [vocab!.id]);
    await addPlan(hit, 4, [kanjiUnit]);
    // Kế hoạch đầu tiên sau khi chọn chỉ có từ vựng (kế hoạch Kanji đến sau không cứu được).
    const miss = await onboardedLearner(api, ctx);
    await selectKanji(miss, 5);
    await addPlan(miss, 4, [vocab!.id]);
    await addPlan(miss, 3, [kanjiUnit]);
    // Kế hoạch đầu tiên toàn ôn tập: không có phần bài mới nên không vào mẫu số.
    const reviewOnly = await onboardedLearner(api, ctx);
    await selectKanji(reviewOnly, 5);
    await addPlan(reviewOnly, 4, []);
    // Không chọn Kanji: không thuộc báo cáo dù có kế hoạch.
    const noKanji = await onboardedLearner(api, ctx);
    await addPlan(noKanji, 4, [vocab!.id]);

    const [row] = await run('kanji_first_plan_has_kanji_ratio');
    expect(row).toMatchObject({
      so_nguoi_hoc: 2,
      co_bai_kanji: 1,
      ty_le_pct: '50.0',
      ky_vong_pct: 100,
      dat_ky_vong: false,
    });
  });
});

describe('Kanji SC-008: hoàn thành bài Kanji trong 3 ngày sau khi chọn', () => {
  /** Ghi tiến độ `status` của bài Kanji, `updated_at` = `kanji_selected_at` + `afterDays` ngày. */
  async function completeKanji(learner: Learner, afterDays: number, status = 'completed') {
    const unitId = await kanjiUnitId(ctx, 'Number kanji 1 (一 二 三)');
    await query(
      ctx,
      `INSERT INTO unit_progress (user_id, unit_id, status, updated_at)
       SELECT user_id, $2, $3::unit_progress_status, kanji_selected_at + make_interval(days => $4)
         FROM learning_profiles WHERE user_id = $1`,
      [learner.userId, unitId, status, afterDays],
    );
  }

  it('đếm người có bài Kanji completed trong cửa sổ 3 ngày; loại nhóm chưa đủ 3 ngày và hoàn thành ngoài cửa sổ', async () => {
    await query(ctx, 'DELETE FROM users');
    const inWindow = await onboardedLearner(api, ctx);
    const tooLate = await onboardedLearner(api, ctx);
    const beforeSelection = await onboardedLearner(api, ctx);
    const notDone = await onboardedLearner(api, ctx);
    const tooFresh = await onboardedLearner(api, ctx);
    await onboardedLearner(api, ctx); // không chọn Kanji → không thuộc báo cáo
    for (const l of [inWindow, tooLate, beforeSelection, notDone]) await selectKanji(l, 10);
    await selectKanji(tooFresh, 1); // chưa qua 3 ngày → chưa vào nhóm

    await completeKanji(inWindow, 2);
    await completeKanji(tooLate, 5); // quá 3 ngày → không tính
    await completeKanji(beforeSelection, -2); // hoàn thành trước lần chọn hiện tại → không tính
    await completeKanji(notDone, 1, 'in_progress'); // mới học dở → không tính
    await completeKanji(tooFresh, 0);

    const [row] = await run('kanji_completed_within_3_days_ratio');
    expect(row).toMatchObject({
      so_nguoi_hoc: 4,
      hoan_thanh_trong_3_ngay: 1,
      ty_le_pct: '25.0',
      muc_tieu_pct: 80,
      dat_muc_tieu: false,
    });
  });
});

describe('Lớp SC-010: học >= 3 ngày trong tuần thứ 4 kể từ khi vào lớp', () => {
  it('chỉ tính thành viên đã vào lớp >= 28 ngày; đếm ngày địa phương trong cửa sổ ngày 21–27', async () => {
    await query(ctx, 'DELETE FROM users');
    await query(ctx, 'DELETE FROM organizations');
    const org = await createTestOrg(ctx, {
      seats: 10,
      startsOn: '2020-01-01',
      endsOn: '2099-12-31',
    });
    const teacher = await createTestUser(ctx);
    await addOrgRole(ctx, org.orgId, teacher.userId, { teacher: true });
    const { classId } = await createTestClass(ctx, org.orgId, {
      name: 'Lớp thử nghiệm',
      teacherIds: [teacher.userId],
    });
    const [topic] = await distinctTopicExercises(ctx, 1);

    const names = ['dat', 'hai_ngay', 'tuan_3', 'moi_vao'] as const;
    const users = new Map<(typeof names)[number], string>();
    for (const name of names) {
      const user = await createTestUser(ctx, { displayName: name });
      await enrollLearner(ctx, org.orgId, classId, user.userId);
      users.set(name, user.userId);
    }
    // Ba người vào lớp cách đây 30 ngày; `moi_vao` mới 10 ngày ⇒ chưa vào nhóm.
    for (const [name, userId] of users) {
      await query(
        ctx,
        `UPDATE class_memberships SET joined_at = now() - make_interval(days => $2) WHERE user_id = $1`,
        [userId, name === 'moi_vao' ? 10 : 30],
      );
    }
    const day0 = async (userId: string): Promise<string> =>
      (
        await query<{ d: string }>(
          ctx,
          `SELECT (joined_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text AS d
             FROM class_memberships WHERE user_id = $1`,
          [userId],
        )
      )[0]!.d;
    const learnOn = async (name: (typeof names)[number], offsets: number[]) => {
      const userId = users.get(name)!;
      const start = await day0(userId);
      for (const offset of offsets) {
        await seedAnswers(ctx, userId, answersFor(topic!, addDays(start, offset), 2, 1));
      }
    };
    await learnOn('dat', [21, 24, 27]); // đúng 3 ngày trong tuần 4 ⇒ đạt (cả hai biên 21 và 27)
    await learnOn('hai_ngay', [21, 27]); // chỉ 2 ngày ⇒ không đạt
    await learnOn('tuan_3', [14, 18, 20, 28]); // ngoài cửa sổ (tuần 3 và ngày 28) ⇒ không đạt
    await learnOn('moi_vao', [1, 2, 3]); // chưa đủ 28 ngày ⇒ bị loại

    const rows = await run('sc010_class_week4_active_days');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      lop: 'Lớp thử nghiệm',
      so_hoc_vien: 3,
      hoc_3_ngay_tuan_4: 1,
      ty_le_pct: '33.3',
      muc_tieu_pct: 70,
      dat_muc_tieu: false,
    });
    expect(rows[1]).toMatchObject({ lop: 'TONG', so_hoc_vien: 3, hoc_3_ngay_tuan_4: 1 });
  });
});

/** Ngày địa phương (Asia/Ho_Chi_Minh) của đồng hồ CSDL — các truy vấn báo cáo dùng `now()` thật, không dùng đồng hồ giả. */
async function dbToday(): Promise<string> {
  const rows = await query<{ d: string }>(
    ctx,
    `SELECT (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text AS d`,
  );
  return rows[0]!.d;
}

describe('Spec 005 SC-006: tỷ lệ tắt cả hai hiệu ứng', () => {
  it('chỉ tính người học đã hoạt động >= 14 ngày và chỉ coi là tắt khi CẢ HAI tùy chọn đều false', async () => {
    await query(ctx, 'DELETE FROM users');
    const today = await dbToday();
    const [topic] = await distinctTopicExercises(ctx, 1);
    const bothOff = await onboardedLearner(api, ctx);
    const soundOnly = await onboardedLearner(api, ctx);
    const defaults = await onboardedLearner(api, ctx);
    const freshBothOff = await onboardedLearner(api, ctx);
    for (const l of [bothOff, soundOnly, defaults]) {
      await seedAnswers(ctx, l.userId, answersFor(topic!, addDays(today, -20), 1, 1));
    }
    await seedAnswers(ctx, freshBothOff.userId, answersFor(topic!, addDays(today, -5), 1, 1));
    await query(
      ctx,
      `UPDATE learning_profiles SET sound_enabled = false, visual_effects_enabled = false WHERE user_id = ANY($1::uuid[])`,
      [[bothOff.userId, freshBothOff.userId]],
    );
    await query(ctx, `UPDATE learning_profiles SET sound_enabled = false WHERE user_id = $1`, [
      soundOnly.userId,
    ]);

    const [row] = await run('sc006_effects_disabled_ratio');
    // `freshBothOff` mới hoạt động 5 ngày nên chưa thuộc nhóm; còn lại 1/3 tắt cả hai ⇒ 33,3% (không đạt < 20%).
    expect(row).toMatchObject({
      so_nguoi_hoc: 3,
      tat_ca_hai: 1,
      ty_le_pct: '33.3',
      gioi_han_pct: 20,
      dat_muc_tieu: false,
    });
  });

  it('chưa có người học đủ 14 ngày thì tỷ lệ rỗng, không lỗi chia cho 0', async () => {
    await query(ctx, 'DELETE FROM users');
    const [row] = await run('sc006_effects_disabled_ratio');
    expect(row).toMatchObject({ so_nguoi_hoc: 0, tat_ca_hai: 0, ty_le_pct: null, dat_muc_tieu: null });
  });
});

describe('Spec 005 SC-007: quay lại ngày kế tiếp sau ngày hoàn thành kế hoạch', () => {
  it('chưa có dòng thành tựu (chưa ra mắt) thì mọi cột tỷ lệ là NULL', async () => {
    await query(ctx, 'DELETE FROM users');
    const [row] = await run('sc007_next_day_return_after_plan_completion');
    expect(row).toMatchObject({
      ngay_ra_mat: null,
      truoc_ty_le_pct: null,
      sau_ty_le_pct: null,
      chenh_lech_diem: null,
    });
  });

  it('so 28 ngày trước ngày ra mắt với giai đoạn từ ngày ra mắt; bỏ ngày chưa trôi qua, kế hoạch mở và ngoài cửa sổ', async () => {
    await query(ctx, 'DELETE FROM users');
    const today = await dbToday();
    const day = (offset: number) => addDays(today, offset);
    const [topic] = await distinctTopicExercises(ctx, 1);
    const learner = await onboardedLearner(api, ctx);

    // Ngày ra mắt = ngày có dòng thành tựu sớm nhất (10 ngày trước).
    await query(
      ctx,
      `INSERT INTO earned_achievements (user_id, achievement_code, earned_at, source)
       VALUES ($1, 'first_lesson', $2::timestamptz, 'earned')`,
      [learner.userId, `${day(-10)}T05:00:00Z`],
    );
    const plan = (offset: number, status: 'completed' | 'open' = 'completed') =>
      query(
        ctx,
        `INSERT INTO daily_plans (user_id, local_date, budget_minutes, estimated_minutes, status, completed_at)
         VALUES ($1, $2::date, 15, 15, $3::plan_status, $4::timestamptz)`,
        [learner.userId, day(offset), status, status === 'completed' ? new Date() : null],
      );
    // Trước ra mắt (cửa sổ 28 ngày: từ -38 đến -11): -15 không quay lại, -14 quay lại ⇒ 1/2 = 50%.
    await plan(-15);
    await plan(-14);
    await plan(-60); // ngoài cửa sổ trước ⇒ bị bỏ dù ngày sau có học
    await plan(-12, 'open'); // kế hoạch chưa hoàn thành ⇒ bị bỏ
    // Từ ngày ra mắt: -5 (quay lại, có học ngày -4), -3 (quay lại, có học ngày -2), -2 (không học ngày -1) ⇒ 2/3.
    await plan(-5);
    await plan(-3);
    await plan(-2);
    await plan(0); // hôm nay: ngày kế tiếp chưa trôi qua ⇒ bị bỏ
    for (const offset of [-59, -14, -4, -2]) {
      await seedAnswers(ctx, learner.userId, answersFor(topic!, day(offset), 1, 1));
    }
    // -14 vừa là ngày quay lại của kế hoạch -15 vừa là ngày kế hoạch -14 (ngày sau -13 không học ⇒ không quay lại).

    const [row] = await run('sc007_next_day_return_after_plan_completion');
    expect(row).toMatchObject({
      ngay_ra_mat: expect.anything(),
      truoc_so_ngay_hoan_thanh: 2,
      truoc_ty_le_pct: '50.0',
      sau_so_ngay_hoan_thanh: 3,
      sau_ty_le_pct: '66.7',
      chenh_lech_diem: '16.7',
      muc_tieu_diem: 5,
    });
  });
});
