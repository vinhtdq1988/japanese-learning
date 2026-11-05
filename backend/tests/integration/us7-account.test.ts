/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { QUEUES } from '../../src/jobs/boss.js';
import {
  createPurgeDeletedAccountsJob,
  purgeDeletedAccounts,
} from '../../src/jobs/purge-deleted-accounts.js';
import { seedContent } from '../../src/seed/index.js';
import { ContractClient, newcomerOnboarding, registerUser } from '../contract/client.js';
import { createTestApp, type TestApp } from './helpers.js';

// Kiểm thử tích hợp US7 (T110) trên PostgreSQL thật: hồ sơ, ngôn ngữ, đổi email/mật khẩu, xóa và khôi
// phục tài khoản, job xóa cứng sau 30 ngày (FR-002, FR-003, quickstart K8).

let ctx: TestApp;
let api: ContractClient;

beforeAll(async () => {
  ctx = await createTestApp();
  await seedContent(ctx.handle.db);
  api = new ContractClient(ctx.app);
});
afterAll(async () => {
  await ctx.close();
});

const query = async <T = Record<string, unknown>>(sqlText: string, params: unknown[] = []) =>
  (await ctx.handle.pool.query(sqlText, params)).rows as T[];

async function userIdOf(email: string): Promise<string | undefined> {
  return (await query<{ id: string }>('SELECT id FROM users WHERE email = $1', [email]))[0]?.id;
}

async function login(user: { email: string; password: string }) {
  return api.post('/auth/login', { body: { email: user.email, password: user.password } });
}

/** Đăng ký rồi hoàn tất onboarding để người học có lộ trình, kế hoạch và dữ liệu học. */
async function onboardedUser() {
  const user = await registerUser(api);
  const res = await api.post('/onboarding/complete', {
    token: user.accessToken,
    body: newcomerOnboarding({ timezone: 'Asia/Ho_Chi_Minh' }),
  });
  expect(res.status).toBe(200);
  return user;
}

async function deleteAccount(user: { accessToken: string; password: string }) {
  const res = await api.post('/account/delete', {
    token: user.accessToken,
    body: { password: user.password },
  });
  expect(res.status).toBe(200);
}

describe('đổi ngôn ngữ và hồ sơ', () => {
  it('đổi vi → en đổi nội dung bản địa hóa của kế hoạch hôm nay; lưu tên và múi giờ', async () => {
    const user = await onboardedUser();
    const vi = await api.get('/today', { token: user.accessToken });
    expect(vi.status).toBe(200);
    const viTitles = vi.body.items.map((i: any) => i.title);

    const patched = await api.patch('/me', {
      token: user.accessToken,
      body: { language: 'en', displayName: 'Tên mới', timezone: 'Asia/Tokyo' },
    });
    expect(patched.status).toBe(200);
    expect(patched.body.profile).toMatchObject({
      language: 'en',
      displayName: 'Tên mới',
      timezone: 'Asia/Tokyo',
    });

    const en = await api.get('/today', { token: user.accessToken });
    const enTitles = en.body.items.map((i: any) => i.title);
    expect(enTitles).toHaveLength(viTitles.length);
    expect(enTitles).not.toEqual(viTitles);

    // Đổi ngôn ngữ/tên không sinh lộ trình mới.
    const paths = await query('SELECT 1 FROM learning_paths WHERE user_id = $1', [
      await userIdOf(user.email),
    ]);
    expect(paths).toHaveLength(1);
  });
});

describe('đổi email', () => {
  it('thiếu/sai currentPassword → 401 và email không đổi', async () => {
    const user = await registerUser(api);
    const email = `moi-${Date.now()}@example.com`;
    for (const body of [{ email }, { email, currentPassword: 'Sai-Mat-Khau-1' }]) {
      const res = await api.patch('/me', { token: user.accessToken, body });
      expect(res.status).toBe(401);
    }
    expect(await userIdOf(email)).toBeUndefined();
    expect(await userIdOf(user.email)).toBeDefined();
  });

  it('trùng tài khoản khác → EMAIL_TAKEN; trùng tài khoản chờ xóa → EMAIL_PENDING_DELETION', async () => {
    const owner = await registerUser(api);
    const mover = await registerUser(api);
    const body = { email: owner.email, currentPassword: mover.password };

    const taken = await api.patch('/me', { token: mover.accessToken, body });
    expect(taken.status).toBe(409);
    expect(taken.body.code).toBe('EMAIL_TAKEN');

    await deleteAccount(owner);
    const pending = await api.patch('/me', { token: mover.accessToken, body });
    expect(pending.status).toBe(409);
    expect(pending.body.code).toBe('EMAIL_PENDING_DELETION');
    expect(await userIdOf(mover.email)).toBeDefined();
  });

  it('đổi thành công: email chuẩn hóa chữ thường, đổi cùng sửa hồ sơ trong một yêu cầu', async () => {
    const user = await registerUser(api);
    const email = `Moi-${Date.now()}@Example.com`;
    const res = await api.patch('/me', {
      token: user.accessToken,
      body: { email, currentPassword: user.password, displayName: 'Đổi cả hai' },
    });
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(email.toLowerCase());
    expect(res.body.profile.displayName).toBe('Đổi cả hai');

    expect((await login({ email, password: user.password })).status).toBe(200);
    expect((await login(user)).status).toBe(401);
  });

  it('gửi lại đúng email hiện tại (khác hoa thường) không lỗi và không đổi gì', async () => {
    const user = await registerUser(api);
    const res = await api.patch('/me', {
      token: user.accessToken,
      body: { email: user.email.toUpperCase(), currentPassword: user.password },
    });
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(user.email);
  });
});

describe('đổi mật khẩu', () => {
  it('thu hồi mọi phiên khác, giữ phiên hiện tại; mật khẩu cũ không còn dùng được', async () => {
    const user = await registerUser(api);
    const other = await login(user);
    expect(other.status).toBe(200);

    const res = await api.put('/me/password', {
      token: user.accessToken,
      body: { currentPassword: user.password, newPassword: 'Matkhau-Moi-456' },
    });
    expect(res.status).toBe(204);

    // Phiên khác không làm mới được nữa; phiên hiện tại vẫn làm mới được.
    const otherRefresh = await api.post('/auth/refresh', {
      body: { refreshToken: other.body.refreshToken },
      validateResponse: false,
    });
    expect(otherRefresh.status).toBe(401);
    const currentRefresh = await api.post('/auth/refresh', {
      body: { refreshToken: user.refreshToken },
    });
    expect(currentRefresh.status).toBe(200);

    expect((await login(user)).status).toBe(401);
    expect((await login({ email: user.email, password: 'Matkhau-Moi-456' })).status).toBe(200);
  });

  it('sai currentPassword → 401, mật khẩu và phiên giữ nguyên', async () => {
    const user = await registerUser(api);
    const res = await api.put('/me/password', {
      token: user.accessToken,
      body: { currentPassword: 'Sai-Mat-Khau-1', newPassword: 'Matkhau-Moi-456' },
    });
    expect(res.status).toBe(401);
    expect((await login(user)).status).toBe(200);
  });
});

describe('xóa và khôi phục tài khoản', () => {
  it('xóa → mọi phiên bị thu hồi; cửa sổ khác dùng access token cũ đến khi hết hạn (+15 phút → 401)', async () => {
    const user = await registerUser(api);
    const windowB = await login(user);
    expect(windowB.status).toBe(200);

    await deleteAccount(user);
    const row = (
      await query<{ status: string; deletion_requested_at: Date }>(
        'SELECT status, deletion_requested_at FROM users WHERE email = $1',
        [user.email],
      )
    )[0]!;
    expect(row.status).toBe('pending_deletion');
    expect(row.deletion_requested_at.toISOString()).toBe(ctx.clock.now().toISOString());

    // Refresh token của cả hai cửa sổ đều bị thu hồi.
    for (const refreshToken of [user.refreshToken, windowB.body.refreshToken]) {
      const res = await api.post('/auth/refresh', {
        body: { refreshToken },
        validateResponse: false,
      });
      expect(res.status).toBe(401);
    }

    // Access token cấp trước khi xóa vẫn truy cập được cho tới khi hết hạn (FR-003 đã làm rõ).
    const stillOk = await api.get('/me', { token: windowB.body.accessToken });
    expect(stillOk.status).toBe(200);
    ctx.clock.advanceMinutes(15);
    const expired = await api.get('/me', {
      token: windowB.body.accessToken,
      validateResponse: false,
    });
    expect(expired.status).toBe(401);
  });

  it('token cấp sau khi xóa chỉ gọi được /account/restore và /auth/logout', async () => {
    const user = await onboardedUser();
    await deleteAccount(user);

    const relogin = await login(user);
    expect(relogin.status).toBe(200);
    expect(relogin.body.accountStatus).toBe('pending_deletion');
    const token = relogin.body.accessToken;

    for (const url of ['/me', '/today', '/progress', '/path']) {
      const res = await api.get(url, { token, validateResponse: false });
      expect(res.status, url).toBe(403);
      expect(res.body.code, url).toBe('ACCOUNT_PENDING_DELETION');
    }
    const deleteAgain = await api.post('/account/delete', {
      token,
      body: { password: user.password },
      validateResponse: false,
    });
    expect(deleteAgain.status).toBe(403);

    const logout = await api.post('/auth/logout', { token, validateResponse: false });
    expect(logout.status).toBe(204);
  });

  it('khôi phục trong 30 ngày giữ nguyên dữ liệu học; cần làm mới token để dùng lại', async () => {
    const user = await onboardedUser();
    const userId = (await userIdOf(user.email))!;
    const before = await query('SELECT id FROM learning_paths WHERE user_id = $1', [userId]);

    await deleteAccount(user);
    ctx.clock.advanceDays(29);
    const relogin = await login(user);
    expect(relogin.status).toBe(200);

    const restored = await api.post('/account/restore', { token: relogin.body.accessToken });
    expect(restored.status).toBe(200);
    expect(restored.body.status).toBe('active');
    expect(restored.body.profile.onboardingState).toBe('completed');

    const row = (
      await query<{ status: string; deletion_requested_at: unknown }>(
        'SELECT status, deletion_requested_at FROM users WHERE id = $1',
        [userId],
      )
    )[0]!;
    expect(row).toMatchObject({ status: 'active', deletion_requested_at: null });
    expect(await query('SELECT id FROM learning_paths WHERE user_id = $1', [userId])).toEqual(
      before,
    );

    // Access token cũ còn mang trạng thái pending_deletion; làm mới token → dùng lại bình thường.
    const stale = await api.get('/me', {
      token: relogin.body.accessToken,
      validateResponse: false,
    });
    expect(stale.status).toBe(403);
    const refreshed = await api.post('/auth/refresh', {
      body: { refreshToken: relogin.body.refreshToken },
    });
    expect(refreshed.status).toBe(200);
    const today = await api.get('/today', { token: refreshed.body.accessToken });
    expect(today.status).toBe(200);

    // Gọi khôi phục lần nữa khi đã active là vô hại.
    const again = await api.post('/account/restore', { token: relogin.body.accessToken });
    expect(again.status).toBe(200);
  });

  it('quá 30 ngày: đăng nhập và làm mới bị từ chối; token còn hạn gọi restore nhận 410', async () => {
    const user = await registerUser(api);
    await deleteAccount(user);
    ctx.clock.advanceMinutes(30 * 24 * 60 - 5);
    const relogin = await login(user);
    expect(relogin.status).toBe(200);

    ctx.clock.advanceMinutes(6);
    const restore = await api.post('/account/restore', { token: relogin.body.accessToken });
    expect(restore.status).toBe(410);
    expect(restore.body.code).toBe('ACCOUNT_DELETED');

    expect((await login(user)).status).toBe(401);
    const refresh = await api.post('/auth/refresh', {
      body: { refreshToken: relogin.body.refreshToken },
      validateResponse: false,
    });
    expect(refresh.status).toBe(401);
  });

  it('đăng ký lại email đang chờ xóa bị từ chối EMAIL_PENDING_DELETION', async () => {
    const user = await registerUser(api);
    await deleteAccount(user);
    const res = await api.post('/auth/register', {
      body: { email: user.email, password: 'Matkhau-Tot-123', displayName: 'Người khác' },
    });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EMAIL_PENDING_DELETION');
  });
});

describe('job xóa cứng sau 30 ngày', () => {
  it('xóa cascade toàn bộ dữ liệu cá nhân, chỉ giữ aggregate_daily_stats; không đụng tài khoản khác', async () => {
    const doomed = await onboardedUser();
    const waiting = await onboardedUser();
    const active = await onboardedUser();
    const doomedId = (await userIdOf(doomed.email))!;

    await deleteAccount(doomed);
    ctx.clock.advanceDays(10);
    // Access token cấp lúc đăng ký đã hết hạn sau 10 ngày giả lập: đăng nhập lại để lấy token mới.
    const waitingSession = await login(waiting);
    await deleteAccount({
      accessToken: waitingSession.body.accessToken,
      password: waiting.password,
    });
    ctx.clock.advanceDays(20); // doomed: 30 ngày, waiting: 20 ngày

    // Các test trước trong file cũng để lại tài khoản chờ xóa đã quá hạn: job xóa cả chúng.
    const purged = await purgeDeletedAccounts({ db: ctx.handle.db, clock: ctx.clock });
    expect(purged).toBeGreaterThanOrEqual(1);

    expect(await userIdOf(doomed.email)).toBeUndefined();
    expect(await userIdOf(waiting.email)).toBeDefined();
    expect(await userIdOf(active.email)).toBeDefined();

    // Không bảng nào còn dòng của người dùng đã xóa (mọi bảng có cột user_id).
    const tables = await query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name = 'user_id'`,
    );
    expect(tables.length).toBeGreaterThan(5);
    for (const { table_name } of tables) {
      const left = await query(`SELECT 1 FROM "${table_name}" WHERE user_id = $1`, [doomedId]);
      expect(left, table_name).toHaveLength(0);
    }

    const stats = await query<{ metric: string; value: number }>(
      `SELECT metric, value FROM aggregate_daily_stats WHERE metric = 'accounts_purged'`,
    );
    expect(stats).toEqual([{ metric: 'accounts_purged', value: purged }]);

    // Chạy lại không xóa thêm gì.
    expect(await purgeDeletedAccounts({ db: ctx.handle.db, clock: ctx.clock })).toBe(0);

    // Email được nhả lại sau khi xóa cứng.
    const again = await api.post('/auth/register', {
      body: { email: doomed.email, password: 'Matkhau-Tot-123', displayName: 'Đăng ký lại' },
    });
    expect(again.status).toBe(201);
  });
});

describe('định nghĩa job', () => {
  it('đăng ký hàng đợi purge-deleted-accounts chạy hằng ngày; handler xóa tài khoản quá hạn', async () => {
    const job = createPurgeDeletedAccountsJob({ db: ctx.handle.db, clock: ctx.clock });
    expect(job.name).toBe(QUEUES.purgeDeletedAccounts);
    expect(job.cron).toMatch(/^\S+ \S+ \* \* \*$/);

    const user = await registerUser(api);
    await deleteAccount(user);
    ctx.clock.advanceDays(31);
    await job.handler({});
    expect(await userIdOf(user.email)).toBeUndefined();
  });
});
