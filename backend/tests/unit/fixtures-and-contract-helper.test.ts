import { describe, expect, it } from 'vitest';
import {
  assertRequestMatches,
  assertResponseMatches,
  allOperationIds,
  contractVersion,
  declaredStatuses,
  matchOperation,
} from '../contract/helper.js';
import {
  REQUIRED_PROFILE_IDS,
  loadLearnerProfile,
  loadLearnerProfiles,
} from '../fixtures/learner-profiles/index.js';

describe('hồ sơ người học đại diện (T024, FR-035)', () => {
  const profiles = loadLearnerProfiles();

  it('đủ mọi hồ sơ bắt buộc và không có hồ sơ lạ', () => {
    expect(profiles.map((p) => p.id).sort()).toEqual([...REQUIRED_PROFILE_IDS].sort());
  });

  it('mỗi hồ sơ có đủ phần hồ sơ học tập, lịch sử và kết quả mong đợi hợp lệ', () => {
    for (const p of profiles) {
      expect([5, 10, 15, 30], p.id).toContain(p.profile.dailyMinutes);
      expect(p.profile.skills.length, p.id).toBeGreaterThan(0);
      expect(Object.keys(p.expected).length, p.id).toBeGreaterThan(0);
      expect(p.description.length, p.id).toBeGreaterThan(10);
      if (p.profile.goalType === 'jlpt') expect(p.profile.targetLevel, p.id).not.toBeNull();
      for (const h of p.history) {
        expect(
          h.results.every((r) => r === 0 || r === 1),
          p.id,
        ).toBe(true);
        expect(h.date <= p.asOf, `${p.id}: lịch sử không được ở tương lai`).toBe(true);
      }
    }
  });

  it('placement dùng đủ 20 vị trí', () => {
    for (const p of profiles.filter((x) => x.placement)) {
      expect(p.placement!.correctByPosition, p.id).toHaveLength(20);
    }
  });

  it('hồ sơ đoán mò có tỷ lệ đúng ≤ 25% (R8)', () => {
    const p = loadLearnerProfile('placement-guesser');
    const correct = p.placement!.correctByPosition.filter(Boolean).length;
    expect(correct).toBe(5);
    expect(correct / 20).toBeLessThanOrEqual(0.25);
    expect(p.expected.placement?.score).toBe(correct);
  });

  it('số liệu độ chính xác mong đợi khớp lịch sử làm bài', () => {
    const accuracy = (xs: (0 | 1)[]) => xs.reduce<number>((a, b) => a + b, 0) / xs.length;
    const low = loadLearnerProfile('low-accuracy-topic');
    expect(low.history.map((h) => accuracy(h.results))).toEqual(
      low.expected.difficulty?.sessionAccuracies,
    );
    const recovered = loadLearnerProfile('recovered-weak-topic');
    const all: (0 | 1)[] = [];
    const checkpoints = recovered.expected.difficulty?.checkpoints as { recentAccuracy: number }[];
    recovered.history.forEach((h, i) => {
      all.push(...h.results);
      expect(accuracy(all.slice(-20))).toBeCloseTo(checkpoints[i]!.recentAccuracy, 5);
    });
  });

  it('tồn đọng ôn tập của hồ sơ 5 phút đủ lớn để buộc chia gói', () => {
    const p = loadLearnerProfile('five-minute-backlog');
    expect(p.reviewBacklog.reduce((s, g) => s + g.count, 0)).toBeGreaterThan(30);
  });
});

describe('hạ tầng kiểm thử hợp đồng OpenAPI (T023)', () => {
  it('đọc được hợp đồng và mọi operation có operationId duy nhất', () => {
    expect(contractVersion()).toMatch(/^\d+\.\d+\.\d+$/);
    const ids = allOperationIds();
    expect(ids.length).toBeGreaterThan(40);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('khớp URL thực (tiền tố /api/v1, tham số đường dẫn, query) với operation', () => {
    const m = matchOperation(
      'POST',
      '/api/v1/sessions/6f1c2d9e-0000-4000-8000-000000000001/answers?x=1',
    );
    expect(m.operationId).toBe('submitAnswer');
    expect(m.pathParams.sessionId).toBe('6f1c2d9e-0000-4000-8000-000000000001');
    expect(matchOperation('GET', '/me').operationId).toBe('getMe');
    expect(() => matchOperation('GET', '/khong-co')).toThrow(/không có operation/);
    expect(declaredStatuses('POST', '/auth/register')).toEqual(
      expect.arrayContaining(['201', '409', '422', '429']),
    );
  });

  it('chấp nhận phản hồi đúng schema và từ chối phản hồi lệch', () => {
    const tokens = { accessToken: 'a', refreshToken: 'r', expiresIn: 900 };
    expect(() => assertResponseMatches('POST', '/auth/register', 201, tokens)).not.toThrow();
    expect(() =>
      assertResponseMatches('POST', '/auth/register', 201, { accessToken: 'a' }),
    ).toThrow(/lệch hợp đồng/);
    // Mã không khai báo trong hợp đồng.
    expect(() => assertResponseMatches('POST', '/auth/register', 418, {})).toThrow(
      /không khai báo mã 418/,
    );
  });

  it('phản hồi lỗi tham chiếu components.responses được kiểm tra theo schema Error', () => {
    expect(() =>
      assertResponseMatches('GET', '/admin/units', 403, {
        code: 'FORBIDDEN',
        message: 'Không có quyền',
      }),
    ).not.toThrow();
    expect(() =>
      assertResponseMatches('GET', '/admin/units', 403, { message: 'thiếu code' }),
    ).toThrow(/lệch hợp đồng/);
  });

  it('xử lý nullable + enum (scopeNotice null) và định dạng uuid/date-time', () => {
    const path = {
      id: '6f1c2d9e-0000-4000-8000-000000000001',
      totalUnits: 3,
      completedUnits: 0,
      startLevel: 'N5',
      reason: 'onboarding',
      scopeNotice: null,
      message: null,
    };
    expect(() => assertResponseMatches('POST', '/path/rebuild', 200, path)).not.toThrow();
    expect(() =>
      assertResponseMatches('POST', '/path/rebuild', 200, { ...path, id: 'khong-phai-uuid' }),
    ).toThrow();
    expect(() =>
      assertResponseMatches('POST', '/path/rebuild', 200, { ...path, reason: 'khac' }),
    ).toThrow();
  });

  it('kiểm tra request body', () => {
    const ok = { email: 'a@b.co', password: '12345678', displayName: 'An' };
    expect(() => assertRequestMatches('POST', '/auth/register', ok)).not.toThrow();
    expect(() =>
      assertRequestMatches('POST', '/auth/register', { ...ok, password: 'ngan' }),
    ).toThrow(/request lệch/);
    expect(() => assertRequestMatches('POST', '/auth/register', { email: 'a@b.co' })).toThrow(
      /request lệch/,
    );
    expect(() =>
      assertRequestMatches('POST', '/trial/events', { event: 'lesson_completed', extra: 1 }),
    ).toThrow(/request lệch/);
  });
});
