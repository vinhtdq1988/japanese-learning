import { describe, expect, it } from 'vitest';
import {
  FINAL_THRESHOLDS,
  buildCoverageReport,
  checkFinalThresholds,
  itemKey,
  statusOfRow,
  type ScopeUnit,
} from '../../src/domain/content-scope.js';
import type { ScopeFile, ScopeKind, ScopeRow } from '../../src/domain/types.js';

// Kiểm thử hàm thuần của danh mục phạm vi và độ phủ (spec 008, T010; contracts/scope-catalog.md §2–§3).

const row = (id: string, key: string, extra: Partial<ScopeRow> = {}): ScopeRow => ({
  id,
  key,
  sources: ['s1'],
  ...extra,
});

function scope(
  kind: ScopeKind,
  level: 'N4' | 'N3',
  rows: ScopeRow[],
  extra: Partial<ScopeFile> = {},
): ScopeFile {
  return {
    kind,
    level,
    reference: false,
    sources: { s1: { name: 'Nguồn thử', note: 'phạm vi' } },
    rows,
    ...extra,
  };
}

function unit(
  file: string,
  kind: ScopeUnit['kind'],
  level: ScopeUnit['level'],
  items: ScopeUnit['items'],
  extra: Partial<ScopeUnit> = {},
): ScopeUnit {
  return { file, kind, level, items, ...extra };
}

const find = (r: ReturnType<typeof buildCoverageReport>, kind: ScopeKind, level: 'N4' | 'N3') =>
  r.byKindLevel.find((x) => x.kind === kind && x.level === level)!;

describe('itemKey (khóa tự nhiên của mục chính)', () => {
  it('Kanji = ký tự; từ vựng = japanese|reading; ngữ pháp/đọc = scopeRef', () => {
    expect(itemKey('kanji', { japanese: '生' })).toBe('生');
    expect(itemKey('vocabulary', { japanese: '方', reading: 'かた' })).toBe('方|かた');
    expect(itemKey('vocabulary', { japanese: '方', reading: 'ほう' })).toBe('方|ほう');
    expect(itemKey('grammar', { japanese: '〜ために', scopeRef: 'g-n4-023' })).toBe('g-n4-023');
    expect(itemKey('reading', { japanese: '…', scopeRef: 'r-n3-form-notice' })).toBe(
      'r-n3-form-notice',
    );
  });

  it('ngữ pháp/đọc thiếu scopeRef ⇒ chuỗi rỗng (không khớp dòng nào)', () => {
    expect(itemKey('grammar', { japanese: '〜ために' })).toBe('');
  });
});

describe('statusOfRow (excluded > covered > uncovered)', () => {
  it('loại trừ thắng mọi thứ, kể cả khi đã có đơn vị khớp', () => {
    expect(statusOfRow(row('k-n4-001', '生', { exclude: { reason: 'quá hiếm' } }), 3)).toBe(
      'excluded',
    );
  });

  it('phủ khi số đơn vị khớp ≥ minUnits (mặc định 1)', () => {
    expect(statusOfRow(row('k-n4-001', '生'), 1)).toBe('covered');
    expect(statusOfRow(row('k-n4-001', '生'), 0)).toBe('uncovered');
    expect(statusOfRow(row('r-n4-x', 'x', { minUnits: 3 }), 2)).toBe('uncovered');
    expect(statusOfRow(row('r-n4-x', 'x', { minUnits: 3 }), 3)).toBe('covered');
  });
});

describe('buildCoverageReport', () => {
  it('đếm phủ/loại trừ/chưa phủ và % = phủ / (tổng − loại trừ)', () => {
    const scopes = [
      scope('kanji', 'N4', [
        row('k-n4-001', '生'),
        row('k-n4-002', '学'),
        row('k-n4-003', '校'),
        row('k-n4-004', '龍', { exclude: { reason: 'quá hiếm' } }),
      ]),
    ];
    const units = [
      unit('n4-kanji-a.json', 'kanji', 'N4', [{ japanese: '生' }, { japanese: '学' }]),
    ];
    const report = buildCoverageReport(scopes, units);
    const cell = find(report, 'kanji', 'N4');
    expect(cell).toMatchObject({ total: 4, covered: 2, excluded: 1, uncovered: 1 });
    expect(cell.percent).toBeCloseTo(2 / 3, 5);
    expect(report.uncovered).toEqual([{ id: 'k-n4-003', key: '校', level: 'N4', kind: 'kanji' }]);
    expect(report.excluded).toEqual([{ id: 'k-n4-004', key: '龍', reason: 'quá hiếm' }]);
    expect(report.violations).toEqual([]);
  });

  it('từ vựng khớp theo japanese|reading: cùng chữ khác cách đọc là hai dòng khác nhau', () => {
    const scopes = [
      scope('vocabulary', 'N3', [row('v-n3-0001', '方|かた'), row('v-n3-0002', '方|ほう')]),
    ];
    const units = [
      unit('n3-vocabulary-a.json', 'vocabulary', 'N3', [{ japanese: '方', reading: 'かた' }]),
    ];
    const report = buildCoverageReport(scopes, units);
    expect(find(report, 'vocabulary', 'N3')).toMatchObject({ covered: 1, uncovered: 1 });
    expect(report.uncovered.map((u) => u.id)).toEqual(['v-n3-0002']);
  });

  it('ngữ pháp khớp theo scopeRef = id của dòng; thiếu scopeRef thì không phủ', () => {
    const scopes = [scope('grammar', 'N4', [row('g-n4-001', '〜ために', { label: lbl() })])];
    const withRef = [
      unit('n4-grammar-a.json', 'grammar', 'N4', [{ japanese: '〜ために', scopeRef: 'g-n4-001' }]),
    ];
    const noRef = [unit('n4-grammar-a.json', 'grammar', 'N4', [{ japanese: '〜ために' }])];
    expect(find(buildCoverageReport(scopes, withRef), 'grammar', 'N4').covered).toBe(1);
    expect(find(buildCoverageReport(scopes, noRef), 'grammar', 'N4').covered).toBe(0);
  });

  it('dòng reading cần ≥ minUnits đơn vị (mặc định 1), tính theo số đơn vị khác nhau', () => {
    const scopes = [
      scope('reading', 'N3', [
        row('r-n3-form-notice', 'thông báo', { label: lbl(), minUnits: 2 }),
        row('r-n3-info-schedule', 'lịch', { label: lbl() }),
      ]),
    ];
    const one = [
      unit('n3-reading-a.json', 'reading', 'N3', [{ japanese: '…', scopeRef: 'r-n3-form-notice' }]),
      unit('n3-reading-b.json', 'reading', 'N3', [
        { japanese: '…', scopeRef: 'r-n3-info-schedule' },
      ]),
    ];
    let report = buildCoverageReport(scopes, one);
    expect(find(report, 'reading', 'N3')).toMatchObject({ covered: 1, uncovered: 1 });
    expect(report.violations).toEqual([]);

    const two = [
      ...one,
      unit('n3-reading-c.json', 'reading', 'N3', [{ japanese: '…', scopeRef: 'r-n3-form-notice' }]),
    ];
    report = buildCoverageReport(scopes, two);
    expect(find(report, 'reading', 'N3')).toMatchObject({ covered: 2, uncovered: 0 });
    // minUnits > 1 ⇒ nhiều đơn vị cùng dòng KHÔNG phải vi phạm mục chính trùng.
    expect(report.violations).toEqual([]);
  });

  it('mục chỉ làm ví dụ ở đơn vị khác KHÔNG tính là phủ', () => {
    const scopes = [scope('vocabulary', 'N4', [row('v-n4-0001', '病院|びょういん')])];
    const units = [
      unit('n4-vocabulary-a.json', 'vocabulary', 'N4', [
        { japanese: '薬', reading: 'くすり', examples: [{ ja: '病院に行きます。' }] },
      ]),
    ];
    expect(find(buildCoverageReport(scopes, units), 'vocabulary', 'N4').covered).toBe(0);
  });

  it('đơn vị chưa active (nháp/inactive) không tính vào độ phủ', () => {
    const scopes = [scope('kanji', 'N4', [row('k-n4-001', '生')])];
    const draft = [
      unit('n4-kanji-a.json', 'kanji', 'N4', [{ japanese: '生' }], { status: 'draft' }),
    ];
    const inactive = [
      unit('n4-kanji-a.json', 'kanji', 'N4', [{ japanese: '生' }], { status: 'inactive' }),
    ];
    const active = [
      unit('n4-kanji-a.json', 'kanji', 'N4', [{ japanese: '生' }], { status: 'active' }),
    ];
    expect(find(buildCoverageReport(scopes, draft), 'kanji', 'N4').covered).toBe(0);
    expect(find(buildCoverageReport(scopes, inactive), 'kanji', 'N4').covered).toBe(0);
    expect(find(buildCoverageReport(scopes, active), 'kanji', 'N4').covered).toBe(1);
  });

  it('đơn vị baseline có scopeRef hồi tố được tính là phủ như đơn vị mới', () => {
    const scopes = [scope('grammar', 'N4', [row('g-n4-002', '〜て', { label: lbl() })])];
    const units = [
      unit(
        'n4-grammar-te-form.json',
        'grammar',
        'N4',
        [{ japanese: '〜て', scopeRef: 'g-n4-002' }],
        {
          baseline: true,
        },
      ),
    ];
    expect(find(buildCoverageReport(scopes, units), 'grammar', 'N4').covered).toBe(1);
  });

  it('file tham chiếu (reference: true) không vào báo cáo độ phủ', () => {
    const scopes = [
      scope('kanji', 'N4', [row('k-n4-001', '生')]),
      {
        ...scope('kanji', 'N4', [row('k-n5-001', '一')]),
        level: 'N5',
        reference: true,
      } as ScopeFile,
    ];
    const report = buildCoverageReport(scopes, []);
    expect(report.byKindLevel.filter((c) => c.kind === 'kanji')).toHaveLength(1);
    expect(report.uncovered.map((u) => u.id)).toEqual(['k-n4-001']);
  });

  it('ô không có dòng nào có % = 1 (không chia cho 0)', () => {
    const cell = find(buildCoverageReport([scope('grammar', 'N4', [])], []), 'grammar', 'N4');
    expect(cell).toMatchObject({ total: 0, covered: 0, excluded: 0, uncovered: 0, percent: 1 });
  });

  describe('năm vi phạm (scope-catalog.md §3)', () => {
    it('(1) scopeRef không tồn tại', () => {
      const scopes = [scope('grammar', 'N4', [row('g-n4-001', '〜ために', { label: lbl() })])];
      const units = [
        unit('n4-grammar-a.json', 'grammar', 'N4', [{ japanese: 'x', scopeRef: 'g-n4-999' }]),
      ];
      const { violations } = buildCoverageReport(scopes, units);
      expect(violations).toHaveLength(1);
      expect(violations[0]).toMatchObject({ type: 'unknown_scope_ref', file: 'n4-grammar-a.json' });
    });

    it('(2) cùng một dòng bị hai đơn vị làm mục chính', () => {
      const scopes = [scope('kanji', 'N4', [row('k-n4-001', '生')])];
      const units = [
        unit('n4-kanji-a.json', 'kanji', 'N4', [{ japanese: '生' }]),
        unit('n4-kanji-b.json', 'kanji', 'N4', [{ japanese: '生' }]),
      ];
      const { violations } = buildCoverageReport(scopes, units);
      expect(violations.map((v) => v.type)).toEqual(['duplicate_primary']);
      expect(violations[0]!.id).toBe('k-n4-001');
    });

    it('(3) hai dòng cùng khóa trong cùng loại (kể cả khác trình độ)', () => {
      const scopes = [
        scope('kanji', 'N4', [row('k-n4-001', '生')]),
        scope('kanji', 'N3', [row('k-n3-001', '生')]),
      ];
      const { violations } = buildCoverageReport(scopes, []);
      expect(violations.map((v) => v.type)).toEqual(['duplicate_key']);
    });

    it('(4) exclude thiếu reason (rỗng hoặc chỉ khoảng trắng)', () => {
      const scopes = [
        scope('kanji', 'N4', [
          row('k-n4-001', '生', { exclude: { reason: '' } }),
          row('k-n4-002', '学', { exclude: { reason: '   ' } }),
        ]),
      ];
      const { violations } = buildCoverageReport(scopes, []);
      expect(violations.map((v) => v.type)).toEqual(['missing_reason', 'missing_reason']);
    });

    it('(5) mục khớp dòng danh mục nhưng đơn vị khác trình độ với dòng', () => {
      const scopes = [scope('vocabulary', 'N4', [row('v-n4-0001', '薬|くすり')])];
      const units = [
        unit('n3-vocabulary-a.json', 'vocabulary', 'N3', [{ japanese: '薬', reading: 'くすり' }]),
      ];
      const { violations } = buildCoverageReport(scopes, units);
      expect(violations.map((v) => v.type)).toEqual(['level_mismatch']);
    });

    it('nội dung đúng ⇒ không vi phạm', () => {
      const scopes = [scope('vocabulary', 'N4', [row('v-n4-0001', '薬|くすり')])];
      const units = [
        unit('n4-vocabulary-a.json', 'vocabulary', 'N4', [{ japanese: '薬', reading: 'くすり' }]),
      ];
      expect(buildCoverageReport(scopes, units).violations).toEqual([]);
    });
  });
});

describe('checkFinalThresholds (--final: FR-003, SC-001)', () => {
  /** Dựng báo cáo có `total` dòng và `covered` dòng được phủ cho một (loại × trình độ). */
  function reportWith(kind: ScopeKind, level: 'N4' | 'N3', total: number, covered: number) {
    const rows = Array.from({ length: total }, (_, i) =>
      row(`${kindPrefix(kind)}-${level.toLowerCase()}-${String(i + 1).padStart(4, '0')}`, `k${i}`, {
        label: lbl(),
      }),
    );
    const items = rows.slice(0, covered).map((r) => ({
      japanese: r.key,
      reading: 'あ',
      scopeRef: r.id,
    }));
    const scopes = [
      scope(
        kind,
        level,
        rows.map((r) => (kind === 'vocabulary' ? { ...r, key: `${r.key}|あ` } : r)),
      ),
    ];
    return buildCoverageReport(scopes, [unit('u.json', kind, level, items)]);
  }

  it('ngưỡng cố định: ngữ pháp ≥ 95%, Kanji ≥ 95%, từ vựng ≥ 90%, đọc không có ngưỡng', () => {
    expect(FINAL_THRESHOLDS).toEqual({
      grammar: 0.95,
      kanji: 0.95,
      vocabulary: 0.9,
      reading: null,
    });
  });

  it('đạt khi mọi ô đạt ngưỡng và không còn dòng chưa phủ', () => {
    expect(checkFinalThresholds(reportWith('grammar', 'N4', 100, 100))).toEqual([]);
  });

  it('báo ô dưới ngưỡng và số dòng chưa phủ', () => {
    const failures = checkFinalThresholds(reportWith('grammar', 'N4', 100, 94));
    expect(failures.join('\n')).toMatch(/grammar.*N4.*94/s);
    expect(failures.join('\n')).toMatch(/chưa phủ/);
  });

  it('từ vựng đủ 90% vẫn thất bại ở --final nếu còn dòng chưa phủ (SC-001: 0 chưa phủ)', () => {
    const failures = checkFinalThresholds(reportWith('vocabulary', 'N3', 100, 92));
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatch(/chưa phủ/);
  });

  it('ô có dòng bị loại trừ không bị tính vào mẫu số', () => {
    const rows = [
      row('g-n4-001', 'a', { label: lbl() }),
      row('g-n4-002', 'b', { label: lbl(), exclude: { reason: 'thuộc N2' } }),
    ];
    const report = buildCoverageReport(
      [scope('grammar', 'N4', rows)],
      [unit('u.json', 'grammar', 'N4', [{ japanese: 'a', scopeRef: 'g-n4-001' }])],
    );
    expect(checkFinalThresholds(report)).toEqual([]);
  });

  it('danh mục rỗng ở ô có ngưỡng thất bại (nghiệm thu không được đạt khống)', () => {
    const failures = checkFinalThresholds(buildCoverageReport([scope('grammar', 'N4', [])], []));
    expect(failures.join('\n')).toMatch(/rỗng/);
  });

  it('vi phạm bất biến luôn làm thất bại', () => {
    const report = buildCoverageReport(
      [scope('kanji', 'N4', [row('k-n4-001', '生', { exclude: { reason: '' } })])],
      [],
    );
    expect(checkFinalThresholds(report).join('\n')).toMatch(/vi phạm/);
  });
});

function lbl() {
  return { vi: 'nhãn', en: 'label' };
}

function kindPrefix(kind: ScopeKind): string {
  return kind === 'kanji' ? 'k' : kind === 'vocabulary' ? 'v' : kind === 'grammar' ? 'g' : 'r';
}
