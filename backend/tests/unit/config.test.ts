import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config.js';

const validEnv = {
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  JWT_SECRET: 'x'.repeat(32),
  SMTP_URL: 'smtp://localhost:1025',
  APP_BASE_URL: 'http://localhost:8080',
};

describe('loadConfig', () => {
  it('áp dụng giá trị mặc định cho ngưỡng và cổng', () => {
    const c = loadConfig(validEnv);
    expect(c.PORT).toBe(3000);
    expect(c.RATE_LIMIT_TRIAL_PER_MIN).toBe(60);
    expect(c.RATE_LIMIT_TRIAL_GRADE_PER_MIN).toBe(10);
    expect(c.RATE_LIMIT_AUTH_PER_MIN).toBe(10);
    expect(c.DIFFICULTY_LOW_THRESHOLD_PCT).toBe(60);
    expect(c.DIFFICULTY_HIGH_THRESHOLD_PCT).toBe(90);
    expect(c.REVIEW_SECONDS_PER_ITEM).toBe(30);
    expect(c.ACCESS_TOKEN_TTL_SECONDS).toBe(900);
    expect(c.REFRESH_TOKEN_TTL_SECONDS).toBe(30 * 86400);
    expect(c.PASSWORD_RESET_TTL_SECONDS).toBe(3600);
  });

  it('áp dụng cấu hình mặc định của tổ chức và lớp học (research O16)', () => {
    const c = loadConfig(validEnv);
    expect(c.INVITATION_TTL_DAYS).toBe(14);
    expect(c.SEAT_GRACE_DAYS).toBe(7);
    expect(c.SEAT_MAX_REASSIGNMENTS).toBe(2);
    expect(c.SEAT_EXPIRY_WARNING_DAYS).toBe(14);
    expect(c.CLASS_MAX_MEMBERS).toBe(100);
    expect(c.CSV_IMPORT_MAX_ROWS).toBe(200);
    expect(c.CSV_IMPORT_MAX_BYTES).toBe(262144);
    expect(c.JOIN_CODE_MAX_FAILURES).toBe(5);
    expect(c.JOIN_CODE_LOCK_MINUTES).toBe(15);
    expect(c.CLASS_ABSENCE_DEFAULT_DAYS).toBe(3);
    expect(c.CLASS_PROGRESS_MARGIN_PCT).toBe(10);
    expect(c.CLASS_WEAK_ACCURACY_PCT).toBe(60);
    expect(c.CLASS_WEAK_MIN_ANSWERS).toBe(30);
    expect(c.ORG_TIMEZONE).toBe('Asia/Ho_Chi_Minh');
  });

  it('chuyển biến cấu hình tổ chức từ chuỗi và từ chối giá trị ngoài khoảng', () => {
    const c = loadConfig({ ...validEnv, CLASS_MAX_MEMBERS: '50', SEAT_GRACE_DAYS: '0' });
    expect(c.CLASS_MAX_MEMBERS).toBe(50);
    expect(c.SEAT_GRACE_DAYS).toBe(0);
    expect(() => loadConfig({ ...validEnv, SEAT_GRACE_DAYS: '61' })).toThrowError(
      /SEAT_GRACE_DAYS/,
    );
    expect(() => loadConfig({ ...validEnv, CLASS_ABSENCE_DEFAULT_DAYS: '15' })).toThrowError(
      /CLASS_ABSENCE_DEFAULT_DAYS/,
    );
  });

  it('chuyển biến số từ chuỗi', () => {
    const c = loadConfig({ ...validEnv, PORT: '8081', REVIEW_SECONDS_PER_ITEM: '45' });
    expect(c.PORT).toBe(8081);
    expect(c.REVIEW_SECONDS_PER_ITEM).toBe(45);
  });

  it('liệt kê mọi biến thiếu/sai trong một thông báo', () => {
    expect(() => loadConfig({})).toThrowError(
      /DATABASE_URL[\s\S]*JWT_SECRET[\s\S]*SMTP_URL[\s\S]*APP_BASE_URL/,
    );
  });

  it('từ chối JWT_SECRET ngắn hơn 32 ký tự', () => {
    expect(() => loadConfig({ ...validEnv, JWT_SECRET: 'ngan' })).toThrowError(/JWT_SECRET/);
  });

  it('từ chối ngưỡng độ khó không hợp lý (thấp ≥ cao)', () => {
    expect(() =>
      loadConfig({
        ...validEnv,
        DIFFICULTY_LOW_THRESHOLD_PCT: '90',
        DIFFICULTY_HIGH_THRESHOLD_PCT: '60',
      }),
    ).toThrowError(/DIFFICULTY_LOW_THRESHOLD_PCT/);
  });

  it('file .env.example không đặt giá trị sai', async () => {
    const { readFileSync } = await import('node:fs');
    const path = await import('node:path');
    const example = readFileSync(path.resolve(__dirname, '../../.env.example'), 'utf8');
    const env = Object.fromEntries(
      example
        .split(/\r?\n/)
        .filter((l) => l.trim() && !l.startsWith('#'))
        .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
    );
    expect(() => loadConfig(env)).not.toThrow();
  });
});
