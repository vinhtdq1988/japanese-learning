import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  NOT_FOUND_MESSAGE,
  ORG_ERROR_STATUS,
  notFoundGeneric,
  orgError,
  toErrorResponse,
} from '../../src/api/errors.js';
import {
  CLASS_LOCKED_PROFILE_FIELDS,
  CSV_OUTCOMES,
  SHARED_DATA_CODES,
  SHARED_DATA_V1,
  sharedDataDisclosure,
} from '../../src/domain/org-types.js';
import {
  confirmSchema,
  dailyMinutesSchema,
  localDateSchema,
  orgEmailSchema,
  orgNameSchema,
  orgUuidSchema,
} from '../../src/domain/org-validation.js';
import { ERROR_CODES, LANGUAGES } from '../../src/domain/types.js';
import {
  CLASS_PROFILE_IDS,
  loadClassProfile,
  loadClassProfiles,
} from '../fixtures/learner-profiles/class-index.js';
import { loadLearnerProfiles } from '../fixtures/learner-profiles/index.js';
import { SIMULATION_DAYS } from '../fixtures/golden/simulate-plans.js';
import { normalizeIds } from '../fixtures/golden/api-snapshot.js';

// Kiểm thử nền tảng tổ chức/lớp học không cần CSDL (spec 004, Phase 2): mã lỗi, hằng miền, kiểm tra dữ
// liệu vào, hồ sơ đại diện lớp và độ phủ của golden `plans-pre-org.json`.

describe('mã lỗi tổ chức (T012)', () => {
  it('mọi mã mới nằm trong ERROR_CODES và có mã HTTP đúng hợp đồng', () => {
    for (const code of Object.keys(ORG_ERROR_STATUS)) {
      expect(ERROR_CODES as readonly string[]).toContain(code);
    }
    expect(ORG_ERROR_STATUS).toMatchObject({
      CLASS_MANAGED: 409,
      SEAT_UNAVAILABLE: 409,
      SEAT_REASSIGN_LIMIT: 422,
      SEAT_BELOW_USAGE: 422,
      CLASS_NOT_READY: 409,
      CLASS_FULL: 409,
      CLASS_ARCHIVED: 409,
      LAST_TEACHER: 409,
      ALREADY_IN_CLASS: 409,
      INVITEE_UNAVAILABLE: 409,
    });
  });

  it('CLASS_MANAGED kèm fields liệt kê trường bị khóa', () => {
    const err = orgError('CLASS_MANAGED', 'Do lớp quyết định', { dailyMinutes: 'locked' });
    expect(toErrorResponse(err)).toEqual({
      status: 409,
      body: {
        code: 'CLASS_MANAGED',
        message: 'Do lớp quyết định',
        fields: { dailyMinutes: 'locked' },
      },
    });
  });

  it('notFoundGeneric: thân phản hồi cố định, không phụ thuộc đối tượng', () => {
    const a = toErrorResponse(notFoundGeneric());
    const b = toErrorResponse(notFoundGeneric());
    expect(a).toEqual({ status: 404, body: { code: 'NOT_FOUND', message: NOT_FOUND_MESSAGE } });
    expect(JSON.stringify(a.body)).toBe(JSON.stringify(b.body));
  });
});

describe('hằng miền tổ chức (T014)', () => {
  it('SHARED_DATA_V1 đủ chín mã dữ liệu, nhãn song ngữ và bất biến', () => {
    expect(SHARED_DATA_V1.visible.map((i) => i.code).sort()).toEqual([...SHARED_DATA_CODES].sort());
    for (const item of [
      ...SHARED_DATA_V1.visible,
      ...SHARED_DATA_V1.notVisible,
      ...SHARED_DATA_V1.lockedControls,
    ]) {
      for (const lang of LANGUAGES) expect(item.label[lang].length).toBeGreaterThan(0);
    }
    expect(SHARED_DATA_V1.canLeaveAnytime).toBe(true);
    expect(SHARED_DATA_V1.mayBeMovedWithinOrganization).toBe(false);
  });

  it('thông báo "không thấy" nêu từng câu trả lời và hoạt động trước ngày vào lớp', () => {
    const vi = sharedDataDisclosure('vi').notVisible.join(' ');
    expect(vi).toMatch(/Từng câu trả lời/);
    expect(vi).toMatch(/trước ngày vào lớp/);
    expect(sharedDataDisclosure('en').notVisible.join(' ')).toMatch(/individual answer/);
  });

  it('khóa của lockedControls trùng danh sách trường hồ sơ bị khóa', () => {
    expect(SHARED_DATA_V1.lockedControls.map((c) => c.code)).toEqual([
      ...CLASS_LOCKED_PROFILE_FIELDS,
    ]);
    expect(CLASS_LOCKED_PROFILE_FIELDS).toEqual([
      'dailyMinutes',
      'skills',
      'prioritizedSkill',
      'currentLevel',
      'goalType',
      'targetLevel',
      'targetDate',
    ]);
  });

  it('CSV_OUTCOMES đúng tám kết quả theo csv-formats.md', () => {
    expect([...CSV_OUTCOMES]).toEqual([
      'invited',
      'invalid_email',
      'duplicate_in_file',
      'already_in_class',
      'already_in_other_class',
      'already_invited',
      'no_seat',
      'unavailable',
    ]);
  });

  it('sharedDataDisclosure khớp hình dạng SharedDataDisclosure của hợp đồng', () => {
    const d = sharedDataDisclosure('vi');
    expect(Object.keys(d).sort()).toEqual(
      [
        'canLeaveAnytime',
        'lockedControls',
        'mayBeMovedWithinOrganization',
        'notVisible',
        'version',
        'visible',
      ].sort(),
    );
    expect(d.visible[0]).toEqual({ code: 'display_name', label: 'Tên hiển thị' });
  });
});

describe('kiểm tra dữ liệu vào tổ chức (T016)', () => {
  it('email: cắt khoảng trắng, chuẩn hóa chữ thường, từ chối sai định dạng/quá dài', () => {
    expect(orgEmailSchema.parse('  An@Example.COM ')).toBe('an@example.com');
    expect(orgEmailSchema.safeParse('khong-hop-le').success).toBe(false);
    expect(orgEmailSchema.safeParse(`${'a'.repeat(250)}@example.com`).success).toBe(false);
    expect(orgEmailSchema.safeParse(undefined).success).toBe(false);
  });

  it('uuid và ngày hợp lệ trong lịch', () => {
    expect(orgUuidSchema.safeParse('3f0d5c1e-1111-4222-8333-444455556666').success).toBe(true);
    expect(orgUuidSchema.safeParse('abc').success).toBe(false);
    expect(localDateSchema.safeParse('2026-02-28').success).toBe(true);
    expect(localDateSchema.safeParse('2026-02-30').success).toBe(false);
    expect(localDateSchema.safeParse('2026-2-3').success).toBe(false);
  });

  it('confirm phải đúng true; thiếu hoặc khác ⇒ lỗi', () => {
    expect(confirmSchema.safeParse({ confirm: true }).success).toBe(true);
    expect(confirmSchema.safeParse({}).success).toBe(false);
    expect(confirmSchema.safeParse({ confirm: false }).success).toBe(false);
    expect(confirmSchema.safeParse({ confirm: 'true' }).success).toBe(false);
  });

  it('quỹ thời gian chỉ 5/10/15/30 phút (Nguyên tắc I)', () => {
    for (const ok of [5, 10, 15, 30]) expect(dailyMinutesSchema.safeParse(ok).success).toBe(true);
    for (const bad of [0, 7, 20, 45, '10', null]) {
      expect(dailyMinutesSchema.safeParse(bad).success, String(bad)).toBe(false);
    }
  });

  it('tên: 1–120 ký tự sau khi cắt khoảng trắng', () => {
    expect(orgNameSchema.parse('  Lớp N5  ')).toBe('Lớp N5');
    expect(orgNameSchema.safeParse('   ').success).toBe(false);
    expect(orgNameSchema.safeParse('a'.repeat(121)).success).toBe(false);
    expect(orgNameSchema.safeParse('a'.repeat(120)).success).toBe(true);
  });
});

describe('hồ sơ đại diện lớp (T020, FR-043)', () => {
  it('có đủ bảy hồ sơ bắt buộc, mỗi hồ sơ có phần class hợp lệ', () => {
    const profiles = loadClassProfiles();
    expect(profiles.map((p) => p.id)).toEqual([...CLASS_PROFILE_IDS].sort());
    for (const p of profiles) {
      expect([5, 10, 15, 30]).toContain(p.class.dailyMinutes);
      expect(p.class.endsOn > p.class.startsOn).toBe(true);
      expect(p.class.skills.length).toBeGreaterThan(0);
      expect(p.profile.dailyMinutes).toBeGreaterThan(0);
    }
    expect(loadClassProfile('class-exempt-unit').class.exemptions).toEqual([
      'n5-grammar-particles',
    ]);
  });

  it('hồ sơ lớp KHÔNG lẫn vào loadLearnerProfiles() (giữ golden pre-org đúng tập cũ)', () => {
    const ids = loadLearnerProfiles().map((p) => p.id);
    expect(ids.some((id) => id.startsWith('class-') || id.startsWith('kanji-'))).toBe(false);
    expect(ids).toHaveLength(10);
  });

  it('các đơn vị được hồ sơ nhắc tới tồn tại trong thư viện nội dung', async () => {
    const { readdirSync } = await import('node:fs');
    const dir = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../../content/units',
    );
    const slugs = new Set(readdirSync(dir).map((f) => f.replace(/\.json$/, '')));
    for (const p of loadClassProfiles()) {
      const referenced = [
        ...(p.completedUnitSlugs ?? []),
        ...p.class.exemptions,
        ...p.class.assignments.map((a) => a.unit),
        ...p.class.explicitUnits.map((u) => u.unit),
      ];
      for (const slug of referenced) expect(slugs.has(slug), `${p.id}: ${slug}`).toBe(true);
    }
  });
});

describe('golden plans-pre-org.json (T001, SC-012)', () => {
  const golden = JSON.parse(
    readFileSync(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        '../fixtures/golden/plans-pre-org.json',
      ),
      'utf8',
    ),
  ) as { days: number; profiles: Record<string, unknown[]> };

  it('phủ đúng tập hồ sơ cũ và số ngày mô phỏng', () => {
    expect(golden.days).toBe(SIMULATION_DAYS);
    expect(Object.keys(golden.profiles).sort()).toEqual(
      loadLearnerProfiles()
        .map((p) => p.id)
        .sort(),
    );
    for (const days of Object.values(golden.profiles)) expect(days).toHaveLength(SIMULATION_DAYS);
  });
});

describe('chuẩn hóa id của golden mức dịch vụ (T002)', () => {
  it('thay UUID bằng nhãn theo thứ tự xuất hiện, cùng id ⇒ cùng nhãn, giữ nguyên chuỗi khác', () => {
    const a = '3f0d5c1e-1111-4222-8333-444455556666';
    const b = '4f0d5c1e-1111-4222-8333-444455556666';
    expect(normalizeIds({ x: a, items: [{ id: b, ref: a }], title: 'あいさつ', n: 3 })).toEqual({
      x: '<id:1>',
      items: [{ id: '<id:2>', ref: '<id:1>' }],
      title: 'あいさつ',
      n: 3,
    });
  });
});
