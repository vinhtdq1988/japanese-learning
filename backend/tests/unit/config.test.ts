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
