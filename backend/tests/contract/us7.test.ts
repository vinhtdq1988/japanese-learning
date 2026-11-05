import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from '../integration/helpers.js';
import { ContractClient, registerUser } from './client.js';

// Kiểm thử hợp đồng US7 (T109): `PUT /me/password`, `POST /account/delete`, `POST /account/restore`
// (và `PATCH /me` đổi email). Request/response được ContractClient đối chiếu `contracts/openapi.yaml`.

let ctx: TestApp;
let api: ContractClient;

beforeAll(async () => {
  ctx = await createTestApp();
  api = new ContractClient(ctx.app);
});
afterAll(async () => {
  await ctx.close();
});

describe('PUT /me/password', () => {
  it('204 khi đổi đúng; đăng nhập bằng mật khẩu mới', async () => {
    const user = await registerUser(api);
    const res = await api.put('/me/password', {
      token: user.accessToken,
      body: { currentPassword: user.password, newPassword: 'Matkhau-Moi-456' },
    });
    expect(res.status).toBe(204);

    const login = await api.post('/auth/login', {
      body: { email: user.email, password: 'Matkhau-Moi-456' },
    });
    expect(login.status).toBe(200);
  });

  it('401 khi currentPassword sai', async () => {
    const user = await registerUser(api);
    const res = await api.put('/me/password', {
      token: user.accessToken,
      body: { currentPassword: 'Sai-Mat-Khau-1', newPassword: 'Matkhau-Moi-456' },
    });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('401 khi thiếu token', async () => {
    const res = await api.put('/me/password', {
      body: { currentPassword: 'x', newPassword: 'Matkhau-Moi-456' },
      validateResponse: false,
    });
    expect(res.status).toBe(401);
  });

  it('422 khi mật khẩu mới yếu hoặc trùng email, kèm thông báo theo trường', async () => {
    const user = await registerUser(api);
    const weak = await api.put('/me/password', {
      token: user.accessToken,
      body: { currentPassword: user.password, newPassword: 'password' },
      validateRequest: false,
    });
    expect(weak.status).toBe(422);
    expect(weak.body.code).toBe('VALIDATION_FAILED');
    expect(weak.body.fields.newPassword).toBeTruthy();

    const sameAsEmail = await api.put('/me/password', {
      token: user.accessToken,
      body: { currentPassword: user.password, newPassword: user.email },
    });
    expect(sameAsEmail.status).toBe(422);
    expect(sameAsEmail.body.fields.newPassword).toBeTruthy();
  });
});

describe('POST /account/delete', () => {
  it('200 trả permanentDeletionAt = hôm nay + 30 ngày', async () => {
    const user = await registerUser(api);
    const res = await api.post('/account/delete', {
      token: user.accessToken,
      body: { password: user.password },
    });
    expect(res.status).toBe(200);
    const expected = new Date(ctx.clock.now().getTime() + 30 * 86_400_000).toISOString();
    expect(res.body.permanentDeletionAt).toBe(expected);
  });

  it('401 khi mật khẩu sai; tài khoản vẫn dùng được', async () => {
    const user = await registerUser(api);
    const res = await api.post('/account/delete', {
      token: user.accessToken,
      body: { password: 'Sai-Mat-Khau-1' },
    });
    expect(res.status).toBe(401);
    const me = await api.get('/me', { token: user.accessToken });
    expect(me.status).toBe(200);
    expect(me.body.status).toBe('active');
  });

  it('422 khi thiếu mật khẩu; 401 khi thiếu token', async () => {
    const user = await registerUser(api);
    const missing = await api.post('/account/delete', {
      token: user.accessToken,
      body: {},
      validateRequest: false,
    });
    expect(missing.status).toBe(422);
    const anonymous = await api.post('/account/delete', {
      body: { password: user.password },
      validateResponse: false,
    });
    expect(anonymous.status).toBe(401);
  });
});

describe('POST /account/restore', () => {
  it('200 trả Me với status active khi đăng nhập lại trong thời gian chờ xóa', async () => {
    const user = await registerUser(api);
    await api.post('/account/delete', {
      token: user.accessToken,
      body: { password: user.password },
    });

    const login = await api.post('/auth/login', {
      body: { email: user.email, password: user.password },
    });
    expect(login.status).toBe(200);
    expect(login.body.accountStatus).toBe('pending_deletion');

    const res = await api.post('/account/restore', { token: login.body.accessToken });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('active');
    expect(res.body.email).toBe(user.email);
  });

  it('401 khi thiếu token', async () => {
    const res = await api.post('/account/restore', { validateResponse: false });
    expect(res.status).toBe(401);
  });

  it('410 ACCOUNT_DELETED khi token còn hạn nhưng đã quá 30 ngày chờ xóa', async () => {
    const user = await registerUser(api);
    await api.post('/account/delete', {
      token: user.accessToken,
      body: { password: user.password },
    });

    // Đăng nhập 5 phút trước hạn 30 ngày; token sống 15 phút nên vẫn dùng được sau mốc 30 ngày.
    ctx.clock.advanceMinutes(30 * 24 * 60 - 5);
    const login = await api.post('/auth/login', {
      body: { email: user.email, password: user.password },
    });
    expect(login.status).toBe(200);
    ctx.clock.advanceMinutes(6);

    const res = await api.post('/account/restore', { token: login.body.accessToken });
    expect(res.status).toBe(410);
    expect(res.body.code).toBe('ACCOUNT_DELETED');
  });
});

describe('PATCH /me – đổi email', () => {
  it('200 khi kèm currentPassword đúng; đăng nhập bằng email mới', async () => {
    const user = await registerUser(api);
    const email = `moi-${Date.now()}@example.com`;
    const res = await api.patch('/me', {
      token: user.accessToken,
      body: { email, currentPassword: user.password },
    });
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(email);

    const login = await api.post('/auth/login', { body: { email, password: user.password } });
    expect(login.status).toBe(200);
  });

  it('401 khi thiếu hoặc sai currentPassword', async () => {
    const user = await registerUser(api);
    const email = `khac-${Date.now()}@example.com`;
    const missing = await api.patch('/me', { token: user.accessToken, body: { email } });
    expect(missing.status).toBe(401);
    const wrong = await api.patch('/me', {
      token: user.accessToken,
      body: { email, currentPassword: 'Sai-Mat-Khau-1' },
    });
    expect(wrong.status).toBe(401);
  });

  it('409 EMAIL_TAKEN khi trùng tài khoản khác, EMAIL_PENDING_DELETION khi trùng tài khoản chờ xóa', async () => {
    const owner = await registerUser(api);
    const mover = await registerUser(api);
    const taken = await api.patch('/me', {
      token: mover.accessToken,
      body: { email: owner.email.toUpperCase(), currentPassword: mover.password },
    });
    expect(taken.status).toBe(409);
    expect(taken.body.code).toBe('EMAIL_TAKEN');

    await api.post('/account/delete', {
      token: owner.accessToken,
      body: { password: owner.password },
    });
    const pending = await api.patch('/me', {
      token: mover.accessToken,
      body: { email: owner.email, currentPassword: mover.password },
    });
    expect(pending.status).toBe(409);
    expect(pending.body.code).toBe('EMAIL_PENDING_DELETION');
  });
});
