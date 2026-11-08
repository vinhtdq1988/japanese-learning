import { describe, expect, it } from 'vitest';
import {
  assignmentState,
  assignmentWarnings,
  classPathParams,
  rankClassUnits,
} from '../../src/engine/class-path.js';
import type { UnitProgressStatus } from '../../src/engine/path.js';
import { loadSimCatalog } from '../fixtures/golden/simulate-plans.js';
import { loadClassProfile } from '../fixtures/learner-profiles/class-index.js';

// Engine lộ trình lớp (spec 004, T060, research O7): tham số mẫu → PathParams, xếp hạng chế độ mẫu trên hồ sơ
// `class-*`. Thuần hàm, không CSDL.

const catalog = loadSimCatalog(true);
const template = (over: Partial<Parameters<typeof classPathParams>[0]> = {}) => ({
  startLevel: 'N5' as const,
  targetLevel: 'N4' as const,
  skills: ['vocabulary', 'grammar'] as const,
  startsOn: '2026-01-05',
  endsOn: '2026-03-31',
  dailyMinutes: 10,
  ...over,
});

describe('classPathParams', () => {
  it('"none" ⇒ bắt đầu N5 và xếp bài nền tảng trước', () => {
    const p = classPathParams(template({ startLevel: 'none' }));
    expect(p.startLevel).toBe('N5');
    expect(p.foundationFirst).toBe(true);
    expect(p.levelRange).toEqual(['N5', 'N4']);
  });

  it('khoảng trình độ [start, min(target, N3)] và không có mục tiêu/mảng yếu cá nhân', () => {
    const p = classPathParams(template({ startLevel: 'N5', targetLevel: 'N3' }));
    expect(p.levelRange).toEqual(['N5', 'N3']);
    expect(p.foundationFirst).toBe(false);
    expect(p).toMatchObject({
      goalType: null,
      weakTopics: [],
      targetDate: '2026-03-31',
      placementResultId: null,
      scopeNotice: null,
    });
  });

  it('đích không thấp hơn điểm xuất phát (xuất phát N4, đích N5 ⇒ chỉ N4)', () => {
    expect(classPathParams(template({ startLevel: 'N4', targetLevel: 'N5' })).levelRange).toEqual([
      'N4',
      'N4',
    ]);
  });

  it.each(['N2', 'N1'] as const)(
    'đích %s bị cắt ở N3 kèm scopeNotice content_ceiling_n3',
    (target) => {
      const p = classPathParams(template({ targetLevel: target }));
      expect(p.levelRange[1]).toBe('N3');
      expect(p.scopeNotice).toBe('content_ceiling_n3');
    },
  );
});

describe('rankClassUnits (chế độ mẫu) trên hồ sơ lớp', () => {
  const fixture = loadClassProfile('class-newcomer-10min');
  const tpl = template({
    startLevel: fixture.class.startLevel,
    targetLevel: fixture.class.targetLevel,
    skills: fixture.class.skills,
    startsOn: fixture.class.startsOn,
    endsOn: fixture.class.endsOn,
    dailyMinutes: fixture.class.dailyMinutes,
  });
  const none = new Map<string, UnitProgressStatus>();

  it('cùng tập đơn vị bắt buộc cho mọi học viên, đúng khoảng trình độ và kỹ năng của lớp', () => {
    const a = rankClassUnits({ template: tpl, units: catalog, unitProgress: none, topicStats: [] });
    const b = rankClassUnits({
      template: tpl,
      units: catalog,
      unitProgress: new Map([['n5-vocabulary-greetings', 'completed']]),
      topicStats: [{ topicId: 'x', isWeak: true, difficultyBias: 2 }],
    });
    expect(a.required.map((u) => u.id).sort()).toEqual(b.required.map((u) => u.id).sort());
    expect(a.required.length).toBeGreaterThan(0);
    for (const u of a.required) {
      expect(['vocabulary', 'grammar']).toContain(u.kind);
      expect(['N5', 'N4']).toContain(u.level);
    }
    expect(a.required.some((u) => u.kind === 'kanji')).toBe(false);
  });

  it('bài nền tảng đứng trước cho người mới (startLevel none)', () => {
    const { ranked } = rankClassUnits({
      template: template({ startLevel: 'none' }),
      units: catalog,
      unitProgress: none,
      topicStats: [],
    });
    const firstTier = ranked[0]!.unit.tier;
    expect(firstTier).toBe('foundation');
  });

  it('thứ tự thích ứng theo mảng yếu của từng người nhưng tập đơn vị không đổi', () => {
    const base = rankClassUnits({
      template: tpl,
      units: catalog,
      unitProgress: none,
      topicStats: [],
    });
    const lastPending = [...base.ranked].reverse().find((r) => r.status === 'pending')!;
    const adapted = rankClassUnits({
      template: tpl,
      units: catalog,
      unitProgress: none,
      topicStats: [{ topicId: lastPending.unit.topicId, isWeak: true, difficultyBias: 0 }],
    });
    const position = (r: typeof base, id: string) => r.ranked.findIndex((x) => x.unit.id === id);
    expect(position(adapted, lastPending.unit.id)).toBeLessThan(
      position(base, lastPending.unit.id),
    );
    expect(adapted.required.map((u) => u.id).sort()).toEqual(base.required.map((u) => u.id).sort());
  });

  it('đơn vị đã completed/mastered trước khi vào lớp tính là hoàn thành (US3.5)', () => {
    const mid = loadClassProfile('class-midway-personal-progress');
    const progress = new Map<string, UnitProgressStatus>(
      (mid.completedUnitSlugs ?? []).map((s) => [s, 'completed' as const]),
    );
    progress.set('n5-vocabulary-food-drink', 'mastered');
    const { ranked, required } = rankClassUnits({
      template: template({ skills: mid.class.skills, dailyMinutes: mid.class.dailyMinutes }),
      units: catalog,
      unitProgress: progress,
      topicStats: [],
    });
    const done = ranked.filter((r) => r.status === 'completed' || r.status === 'mastered');
    expect(done.map((r) => r.unit.id).sort()).toEqual(
      [...(mid.completedUnitSlugs ?? []), 'n5-vocabulary-food-drink'].sort(),
    );
    // Vẫn nằm trong mẫu số tiến độ; nhóm đã hoàn thành xếp sau nhóm chưa học.
    for (const r of done) expect(required.map((u) => u.id)).toContain(r.unit.id);
    const firstDone = ranked.findIndex((r) => r.status === 'completed' || r.status === 'mastered');
    expect(
      ranked.slice(0, firstDone).every((r) => r.status === 'pending' || r.status === 'in_progress'),
    ).toBe(true);
  });

  it('đơn vị không còn active (không có trong danh mục) biến mất khỏi kế hoạch và mẫu số', () => {
    const full = rankClassUnits({
      template: tpl,
      units: catalog,
      unitProgress: none,
      topicStats: [],
    });
    const removed = full.required[0]!;
    const without = rankClassUnits({
      template: tpl,
      units: catalog.filter((u) => u.id !== removed.id),
      unitProgress: none,
      topicStats: [],
    });
    expect(without.required.map((u) => u.id)).not.toContain(removed.id);
    expect(without.required).toHaveLength(full.required.length - 1);
  });

  it('đơn vị được miễn bị loại khỏi ranked và required', () => {
    const exempt = loadClassProfile('class-exempt-unit');
    const { ranked, required } = rankClassUnits({
      template: tpl,
      units: catalog,
      unitProgress: none,
      topicStats: [],
      exemptions: new Set(exempt.class.exemptions),
    });
    for (const id of exempt.class.exemptions) {
      expect(ranked.map((r) => r.unit.id)).not.toContain(id);
      expect(required.map((u) => u.id)).not.toContain(id);
    }
  });
});

// --- US5 (T090): chế độ liệt kê, ngày mở, miễn bài, bài giao ---

describe('rankClassUnits (chế độ liệt kê)', () => {
  const tpl = template();
  const none = new Map<string, UnitProgressStatus>();
  const pick = (kind: 'vocabulary' | 'grammar', n: number) =>
    catalog.filter((u) => u.kind === kind && u.level === 'N5').slice(0, n);
  const [v1, v2, v3] = pick('vocabulary', 3) as [
    (typeof catalog)[number],
    (typeof catalog)[number],
    (typeof catalog)[number],
  ];
  const [g1] = pick('grammar', 1) as [(typeof catalog)[number]];
  const explicit = (ids: [string, string | null][]) =>
    ids.map(([unitId, opensOn], i) => ({ unitId, position: i + 1, opensOn }));

  it('đúng danh sách giáo viên chọn theo thứ tự position, bỏ qua lọc trình độ/kỹ năng', () => {
    const n3 = catalog.find((u) => u.level === 'N3')!;
    const { ranked, required } = rankClassUnits({
      template: tpl,
      units: catalog,
      unitProgress: none,
      topicStats: [],
      explicit: explicit([
        [g1.id, null],
        [n3.id, null],
        [v1.id, null],
      ]),
      today: '2026-01-10',
    });
    expect(ranked.map((r) => r.unit.id)).toEqual([g1.id, n3.id, v1.id]);
    expect(required.map((u) => u.id)).toEqual([g1.id, n3.id, v1.id]);
  });

  it('chỉ đơn vị active: đơn vị không còn trong danh mục biến khỏi ranked và required', () => {
    const { ranked, required } = rankClassUnits({
      template: tpl,
      units: catalog.filter((u) => u.id !== v2.id),
      unitProgress: none,
      topicStats: [],
      explicit: explicit([
        [v1.id, null],
        [v2.id, null],
        [v3.id, null],
      ]),
      today: '2026-01-10',
    });
    expect(ranked.map((r) => r.unit.id)).toEqual([v1.id, v3.id]);
    expect(required.map((u) => u.id)).toEqual([v1.id, v3.id]);
  });

  it('đơn vị opens_on > today bị khóa khỏi ranked nhưng vẫn nằm trong required', () => {
    const input = {
      template: tpl,
      units: catalog,
      unitProgress: none,
      topicStats: [],
      explicit: explicit([
        [v1.id, null],
        [v2.id, '2026-01-20'],
        [v3.id, '2026-01-10'],
      ]),
    };
    const before = rankClassUnits({ ...input, today: '2026-01-10' });
    expect(before.ranked.map((r) => r.unit.id)).toEqual([v1.id, v3.id]); // ngày mở đúng hôm nay là đã mở
    expect(before.required.map((u) => u.id)).toEqual([v1.id, v2.id, v3.id]);
    const after = rankClassUnits({ ...input, today: '2026-01-20' });
    expect(after.ranked.map((r) => r.unit.id)).toEqual([v1.id, v2.id, v3.id]);
  });

  it('đơn vị khóa nhưng đã hoàn thành từ trước vẫn tính hoàn thành (còn trong ranked)', () => {
    const { ranked } = rankClassUnits({
      template: tpl,
      units: catalog,
      unitProgress: new Map<string, UnitProgressStatus>([[v2.id, 'completed']]),
      topicStats: [],
      explicit: explicit([
        [v1.id, null],
        [v2.id, '2026-02-01'],
      ]),
      today: '2026-01-10',
    });
    expect(ranked.map((r) => [r.unit.id, r.status])).toEqual([
      [v1.id, 'pending'],
      [v2.id, 'completed'],
    ]);
  });

  it('miễn bài loại khỏi ranked và required (không tính mẫu số)', () => {
    const { ranked, required } = rankClassUnits({
      template: tpl,
      units: catalog,
      unitProgress: none,
      topicStats: [],
      explicit: explicit([
        [v1.id, null],
        [v2.id, null],
      ]),
      exemptions: new Set([v1.id]),
      today: '2026-01-10',
    });
    expect(ranked.map((r) => r.unit.id)).toEqual([v2.id]);
    expect(required.map((u) => u.id)).toEqual([v2.id]);
  });
});

describe('rankClassUnits (bài giao)', () => {
  const tpl = template();
  const none = new Map<string, UnitProgressStatus>();
  const base = rankClassUnits({
    template: tpl,
    units: catalog,
    unitProgress: none,
    topicStats: [],
  });
  // Các đơn vị cuối danh sách mẫu: nếu không có bài giao chúng không đứng đầu.
  const last = base.ranked.slice(-3).map((r) => r.unit.id) as [string, string, string];

  it('bài giao chưa xong đẩy lên đầu: quá hạn (hạn cũ nhất trước), rồi hạn gần nhất', () => {
    const { ranked } = rankClassUnits({
      template: tpl,
      units: catalog,
      unitProgress: none,
      topicStats: [],
      assignments: [
        { unitId: last[0], dueOn: '2026-01-30' },
        { unitId: last[1], dueOn: '2026-01-08' }, // quá hạn
        { unitId: last[2], dueOn: '2026-01-12' },
      ],
      today: '2026-01-10',
    });
    expect(ranked.slice(0, 3).map((r) => r.unit.id)).toEqual([last[1], last[2], last[0]]);
  });

  it('bài giao quá hạn chưa xong vẫn xuất hiện; đã hoàn thành thì không còn được đẩy lên', () => {
    const done = new Map<string, UnitProgressStatus>([[last[0], 'completed']]);
    const { ranked } = rankClassUnits({
      template: tpl,
      units: catalog,
      unitProgress: done,
      topicStats: [],
      assignments: [
        { unitId: last[0], dueOn: '2026-01-01' },
        { unitId: last[1], dueOn: '2026-01-01' },
      ],
      today: '2026-01-10',
    });
    expect(ranked[0]!.unit.id).toBe(last[1]);
    expect(ranked.findIndex((r) => r.unit.id === last[0])).toBeGreaterThan(2);
  });

  it('bài giao cho đơn vị bị miễn của học viên đó bị bỏ qua', () => {
    const { ranked, required } = rankClassUnits({
      template: tpl,
      units: catalog,
      unitProgress: none,
      topicStats: [],
      exemptions: new Set([last[1]]),
      assignments: [{ unitId: last[1], dueOn: '2026-01-05' }],
      today: '2026-01-10',
    });
    expect(ranked.some((r) => r.unit.id === last[1])).toBe(false);
    expect(required.some((u) => u.id === last[1])).toBe(false);
  });

  it('bài giao ngoài tập mẫu vẫn vào kế hoạch (ranked) nhưng không vào mẫu số (required)', () => {
    const outside = catalog.find((u) => u.level === 'N3')!;
    const { ranked, required } = rankClassUnits({
      template: tpl,
      units: catalog,
      unitProgress: none,
      topicStats: [],
      assignments: [{ unitId: outside.id, dueOn: '2026-01-20' }],
      today: '2026-01-10',
    });
    expect(ranked[0]!.unit.id).toBe(outside.id);
    expect(required.some((u) => u.id === outside.id)).toBe(false);
  });

  it('bài giao cho đơn vị đang khóa (opens_on tương lai) chưa được đẩy lên', () => {
    const explicit = [
      { unitId: last[0], position: 1, opensOn: null },
      { unitId: last[1], position: 2, opensOn: '2026-02-01' },
    ];
    const { ranked } = rankClassUnits({
      template: tpl,
      units: catalog,
      unitProgress: none,
      topicStats: [],
      explicit,
      assignments: [{ unitId: last[1], dueOn: '2026-01-20' }],
      today: '2026-01-10',
    });
    expect(ranked.map((r) => r.unit.id)).toEqual([last[0]]);
  });
});

describe('assignmentState (dẫn xuất từ dữ liệu học)', () => {
  const base = {
    dueOn: '2026-01-15',
    assignedAt: new Date('2026-01-05T03:00:00Z'),
    today: '2026-01-10',
    timezone: 'Asia/Ho_Chi_Minh',
  };

  it('chưa xong: pending trước hạn, overdue sau hạn', () => {
    expect(assignmentState({ ...base, completedAt: null })).toBe('pending');
    expect(assignmentState({ ...base, completedAt: null, today: '2026-01-15' })).toBe('pending');
    expect(assignmentState({ ...base, completedAt: null, today: '2026-01-16' })).toBe('overdue');
  });

  it('hoàn thành trong ngày hạn theo múi giờ học viên ⇒ on_time, sau đó ⇒ late', () => {
    // 16:59 UTC ngày 15 = 23:59 giờ Việt Nam ngày 15; 17:01 UTC = 00:01 ngày 16.
    expect(assignmentState({ ...base, completedAt: new Date('2026-01-15T16:59:00Z') })).toBe(
      'on_time',
    );
    expect(assignmentState({ ...base, completedAt: new Date('2026-01-15T17:01:00Z') })).toBe(
      'late',
    );
  });

  it('hoàn thành trước khi được giao ⇒ on_time (ghi nhận, không làm lại)', () => {
    expect(
      assignmentState({
        ...base,
        dueOn: '2026-01-06',
        completedAt: new Date('2026-01-02T03:00:00Z'),
      }),
    ).toBe('on_time');
  });
});

describe('assignmentWarnings (FR-025)', () => {
  const unit = (id: string, estMinutes: number) => ({ id, estMinutes });

  it('khối lượng tích lũy vượt quỹ đến hạn ⇒ cảnh báo over_capacity theo assignmentId', () => {
    const warnings = assignmentWarnings({
      assignments: [
        { id: 'a1', unitId: 'u1', dueOn: '2026-01-11' },
        { id: 'a2', unitId: 'u2', dueOn: '2026-01-11' },
      ],
      units: [unit('u1', 15), unit('u2', 15)],
      today: '2026-01-10',
      dailyMinutes: 10,
      pauses: [],
    });
    // 10–11/01 ⇒ quỹ 2 ngày × 10 = 20 phút; a1 cần 15 (đủ), a2 cần tích lũy 30 (vượt).
    expect(warnings).toEqual([
      { code: 'over_capacity', requiredMinutes: 30, capacityMinutes: 20, assignmentId: 'a2' },
    ]);
  });

  it('ngày tạm dừng không tính vào sức chứa; đủ quỹ thì không cảnh báo; hạn đã qua bị bỏ qua', () => {
    expect(
      assignmentWarnings({
        assignments: [{ id: 'a1', unitId: 'u1', dueOn: '2026-01-11' }],
        units: [unit('u1', 15)],
        today: '2026-01-10',
        dailyMinutes: 10,
        pauses: [{ startedOn: '2026-01-11', endedOn: null }],
      }),
    ).toEqual([
      { code: 'over_capacity', requiredMinutes: 15, capacityMinutes: 10, assignmentId: 'a1' },
    ]);
    expect(
      assignmentWarnings({
        assignments: [{ id: 'a1', unitId: 'u1', dueOn: '2026-01-20' }],
        units: [unit('u1', 15)],
        today: '2026-01-10',
        dailyMinutes: 10,
        pauses: [],
      }),
    ).toEqual([]);
    expect(
      assignmentWarnings({
        assignments: [{ id: 'a1', unitId: 'u1', dueOn: '2026-01-05' }],
        units: [unit('u1', 15)],
        today: '2026-01-10',
        dailyMinutes: 10,
        pauses: [],
      }),
    ).toEqual([]);
  });
});
