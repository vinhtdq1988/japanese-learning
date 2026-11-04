import { describe, expect, it } from 'vitest';
import { languageFromRequest, omitNulls } from '../../src/api/http.js';
import type { FastifyRequest } from 'fastify';
import type { Database } from '../../src/db/client.js';
import {
  onboardingCompleteSchema,
  onboardingDraftSchema,
  passwordSchema,
  profileUpdateSchema,
  registerSchema,
} from '../../src/domain/profile-validation.js';
import { FakeClock } from '../../src/engine/clock.js';
import { createSendEmailJob, passwordResetLink } from '../../src/jobs/send-email.js';
import { ContentCache } from '../../src/services/content-cache.js';
import { InMemoryEmailSender } from '../../src/services/email.js';
import { generateOpaqueToken, sha256Hex } from '../../src/services/tokens.js';

// Kiểm thử đơn vị cho phần hạ tầng US1 không cần CSDL: validation, bộ đệm TTL, token, email, ngôn ngữ.

describe('validation đăng ký và mật khẩu', () => {
  const base = { email: 'a@example.com', password: 'Matkhau-123', displayName: 'An' };

  it('chấp nhận dữ liệu hợp lệ và cắt khoảng trắng ở email/tên', () => {
    const parsed = registerSchema.parse({
      ...base,
      email: '  a@example.com ',
      displayName: ' An ',
    });
    expect(parsed.email).toBe('a@example.com');
    expect(parsed.displayName).toBe('An');
  });

  it('email sai định dạng → thông báo cụ thể theo trường', () => {
    const r = registerSchema.safeParse({ ...base, email: 'khong-phai-email' });
    expect(r.success).toBe(false);
    expect(r.error!.issues[0]!.path).toEqual(['email']);
    expect(r.error!.issues[0]!.message).toBe('Email không đúng định dạng');
  });

  it.each([
    ['ngắn hơn 8 ký tự', 'Ab1!'],
    ['mật khẩu phổ biến', 'Password1'],
    ['lặp lại vài ký tự', 'abababab'],
  ])('từ chối mật khẩu yếu: %s', (_label, password) => {
    expect(passwordSchema.safeParse(password).success).toBe(false);
  });

  it('tên hiển thị 1–60 ký tự', () => {
    expect(registerSchema.safeParse({ ...base, displayName: '' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, displayName: 'a'.repeat(61) }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, displayName: 'a'.repeat(60) }).success).toBe(true);
  });

  it('múi giờ phải là tên IANA hợp lệ', () => {
    expect(registerSchema.safeParse({ ...base, timezone: 'Asia/Tokyo' }).success).toBe(true);
    expect(registerSchema.safeParse({ ...base, timezone: 'Mars/Olympus' }).success).toBe(false);
  });
});

describe('validation onboarding', () => {
  const complete = {
    currentLevel: 'none',
    goalType: 'daily_conversation',
    dailyMinutes: 10,
    skills: ['vocabulary', 'grammar'],
  };

  it('thời gian mỗi ngày chỉ nhận 5, 10, 15, 30', () => {
    for (const ok of [5, 10, 15, 30]) {
      expect(onboardingCompleteSchema.safeParse({ ...complete, dailyMinutes: ok }).success).toBe(
        true,
      );
    }
    for (const bad of [0, 7, 20, 60]) {
      expect(onboardingCompleteSchema.safeParse({ ...complete, dailyMinutes: bad }).success).toBe(
        false,
      );
    }
  });

  it('kỹ năng chỉ nhận từ vựng + ngữ pháp, không rỗng, bỏ trùng lặp', () => {
    expect(onboardingCompleteSchema.safeParse({ ...complete, skills: [] }).success).toBe(false);
    for (const unsupported of ['listening', 'reading', 'kanji']) {
      expect(
        onboardingCompleteSchema.safeParse({ ...complete, skills: ['vocabulary', unsupported] })
          .success,
      ).toBe(false);
    }
    const parsed = onboardingCompleteSchema.parse({
      ...complete,
      skills: ['grammar', 'grammar', 'vocabulary'],
    });
    expect(parsed.skills).toEqual(['grammar', 'vocabulary']);
  });

  it('mục tiêu JLPT bắt buộc targetLevel; N2/N1 được chấp nhận', () => {
    const jlpt = { ...complete, goalType: 'jlpt' };
    const missing = onboardingCompleteSchema.safeParse(jlpt);
    expect(missing.success).toBe(false);
    expect(missing.error!.issues[0]!.path).toEqual(['targetLevel']);
    for (const level of ['N5', 'N4', 'N3', 'N2', 'N1']) {
      expect(onboardingCompleteSchema.safeParse({ ...jlpt, targetLevel: level }).success).toBe(
        true,
      );
    }
  });

  it('bản nháp cho phép thiếu mọi trường nhưng vẫn kiểm tra giá trị đã nhập', () => {
    expect(onboardingDraftSchema.safeParse({}).success).toBe(true);
    expect(onboardingDraftSchema.safeParse({ dailyMinutes: 12 }).success).toBe(false);
    expect(onboardingDraftSchema.safeParse({ targetDate: '31/12/2026' }).success).toBe(false);
    expect(onboardingDraftSchema.safeParse({ targetDate: '2026-12-31' }).success).toBe(true);
  });

  it('PATCH /me: giá trị sai bị từ chối, trường tùy chọn được bỏ qua', () => {
    expect(profileUpdateSchema.safeParse({}).success).toBe(true);
    expect(profileUpdateSchema.safeParse({ language: 'fr' }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ dailyMinutes: 15 }).success).toBe(true);
  });
});

describe('ContentCache – TTL ≤ 60 giây (SC-008)', () => {
  const row = (id: string) => ({
    id,
    kind: 'vocabulary',
    level: 'N5',
    tier: 'core',
    goalTags: [],
    topicId: 't',
    difficulty: 1,
    estMinutes: 5,
    sequence: 0,
    title: { vi: 'a', en: 'a' },
    isTrial: false,
  });

  function fakeDb(rows: () => unknown[]) {
    let reads = 0;
    const db = {
      select: () => ({
        from: () => ({
          where: async () => {
            reads += 1;
            return rows();
          },
        }),
      }),
    } as unknown as Database;
    return { db, reads: () => reads };
  }

  it('không đọc lại CSDL trong TTL, đọc lại khi quá hạn', async () => {
    const clock = new FakeClock('2026-01-01T00:00:00Z');
    let data = [row('u1')];
    const { db, reads } = fakeDb(() => data);
    const cache = new ContentCache(db, clock);

    expect((await cache.activeUnits()).map((u) => u.id)).toEqual(['u1']);
    data = [row('u1'), row('u2')];
    clock.advanceMs(59_000);
    expect(await cache.activeUnits()).toHaveLength(1); // còn trong TTL
    expect(reads()).toBe(1);

    clock.advanceMs(1_000);
    expect(await cache.activeUnits()).toHaveLength(2); // đủ 60 giây → đọc lại
    expect(reads()).toBe(2);
  });

  it('đồng hồ lùi coi như quá hạn; invalidate() buộc đọc lại', async () => {
    const clock = new FakeClock('2026-01-02T00:00:00Z');
    const { db, reads } = fakeDb(() => [row('u1')]);
    const cache = new ContentCache(db, clock);
    await cache.activeUnits();
    clock.advanceDays(-1);
    await cache.activeUnits();
    expect(reads()).toBe(2);
    cache.invalidate();
    await cache.activeUnits();
    expect(reads()).toBe(3);
  });

  it('các yêu cầu đồng thời chỉ gây một lần đọc', async () => {
    const { db, reads } = fakeDb(() => [row('u1')]);
    const cache = new ContentCache(db, new FakeClock());
    await Promise.all([cache.activeUnits(), cache.activeUnits(), cache.activeUnits()]);
    expect(reads()).toBe(1);
  });

  it('đơn vị trong danh mục mang status active để engine không loại nhầm', async () => {
    const { db } = fakeDb(() => [row('u1')]);
    const [unit] = await new ContentCache(db, new FakeClock()).activeUnits();
    expect(unit!.status).toBe('active');
  });
});

describe('token đục và email đặt lại mật khẩu', () => {
  it('token ngẫu nhiên 256-bit, khác nhau mỗi lần; băm SHA-256 hex cố định', () => {
    const a = generateOpaqueToken();
    const b = generateOpaqueToken();
    expect(a).not.toBe(b);
    expect(Buffer.from(a, 'base64url')).toHaveLength(32);
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('liên kết đặt lại trỏ tới route hash của client, token được mã hóa URL', () => {
    expect(passwordResetLink({ APP_BASE_URL: 'https://app.example.com/' }, 'a+b/c')).toBe(
      'https://app.example.com/#/reset-password?token=a%2Bb%2Fc',
    );
  });

  it.each([
    ['vi', 'Đặt lại mật khẩu'],
    ['en', 'Reset your'],
  ] as const)('job gửi email theo ngôn ngữ %s', async (language, subjectPart) => {
    const sender = new InMemoryEmailSender();
    const job = createSendEmailJob({
      config: { APP_BASE_URL: 'http://localhost:8080' },
      emailSender: sender,
    });
    await job.handler({ kind: 'password_reset', to: 'a@example.com', token: 'tok', language });
    const mail = sender.lastTo('a@example.com')!;
    expect(mail.subject).toContain(subjectPart);
    expect(mail.text).toContain('http://localhost:8080/#/reset-password?token=tok');
  });
});

describe('tiện ích HTTP', () => {
  const req = (query: unknown, acceptLanguage?: string) =>
    ({ query, headers: { 'accept-language': acceptLanguage } }) as unknown as FastifyRequest;

  it('omitNulls bỏ null/undefined nhưng giữ false và 0', () => {
    expect(omitNulls({ a: null, b: undefined, c: false, d: 0, e: 'x' })).toEqual({
      c: false,
      d: 0,
      e: 'x',
    });
  });

  it('ngôn ngữ: tham số lang > Accept-Language > mặc định vi', () => {
    expect(languageFromRequest(req({ lang: 'en' }, 'vi'))).toBe('en');
    expect(languageFromRequest(req({}, 'en-US,en;q=0.9'))).toBe('en');
    expect(languageFromRequest(req({}, 'fr-FR,vi;q=0.8'))).toBe('vi');
    expect(languageFromRequest(req({ lang: 'xx' }, undefined))).toBe('vi');
    expect(languageFromRequest(req(undefined, 'ja'))).toBe('vi');
  });
});
