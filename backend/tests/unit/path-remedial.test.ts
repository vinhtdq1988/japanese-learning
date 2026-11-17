import { describe, expect, it } from 'vitest';
import {
  REMEDIAL_MAX_UNITS,
  buildPathParams,
  rankUnits,
  type PathParams,
  type PathProfileInput,
  type RankableUnit,
  type UnitProgressStatus,
} from '../../src/engine/path.js';
import type { ContentLevel, Skill } from '../../src/domain/types.js';
import { loadLearnerProfile } from '../fixtures/learner-profiles/index.js';
import { simPathParams } from '../fixtures/golden/simulate-plans.js';

// Ôn lùi có chặn cho người xếp thẳng N3 (spec 008, T207; research D11, bất biến I8): người xếp N3 có mảng
// yếu thuộc N4 thấy TỐI ĐA `REMEDIAL_MAX_UNITS` đơn vị N4 thuộc mảng đó, điểm trình độ bằng 0 và nằm ngoài
// biên giới của loại; không có mảng yếu, xếp N4/N5 hoặc `foundationFirst` thì không có đơn vị ôn lùi.

interface LibUnit extends RankableUnit {
  name: string;
}

const KINDS: Skill[] = ['vocabulary', 'grammar', 'kanji'];
const WEAK = ['transport-places', 'health-body'];

/**
 * Thư viện tổng hợp: N4 mỗi loại 12 đơn vị (3 mảng: 2 yếu + 1 khác, luân phiên), N3 mỗi loại 12 đơn vị ở các
 * mảng KHÁC hẳn mảng yếu của N4 (để thứ tự N3 không bị mảng yếu tác động).
 */
function library(): LibUnit[] {
  const units: LibUnit[] = [];
  let n = 0;
  for (const kind of KINDS) {
    for (const level of ['N4', 'N3'] as ContentLevel[]) {
      for (let i = 0; i < 12; i += 1) {
        n += 1;
        const topicId = level === 'N4' ? [...WEAK, 'te-form'][i % 3]! : `n3-topic-${i % 4}`;
        units.push({
          id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
          name: `${kind}-${level}-${i + 1}`,
          kind,
          level,
          tier: 'core',
          goalTags: ['jlpt'],
          topicId,
          difficulty: 3,
          estMinutes: 5,
          sequence: (Math.floor(i / 4) + 4) * 100 + ((i % 4) + 1) * 10 + KINDS.indexOf(kind),
        });
      }
    }
  }
  return units;
}

const profile: PathProfileInput = {
  currentLevel: 'N3',
  goalType: 'jlpt',
  targetLevel: 'N3',
  targetDate: null,
  skills: KINDS,
  prioritizedSkill: null,
};

const paramsOf = (over: Partial<PathParams> = {}): PathParams => ({
  ...buildPathParams(profile),
  weakTopics: WEAK,
  ...over,
});

const rank = (
  units: LibUnit[],
  params: PathParams,
  progress: Record<string, UnitProgressStatus> = {},
  options: { includeMastered?: boolean } = {},
) => rankUnits(params, profile, units, new Map(Object.entries(progress)), [], options);

const remedialOf = (ranked: ReturnType<typeof rank>) => ranked.filter((r) => r.unit.level === 'N4');

/** `REMEDIAL_MAX_UNITS` đơn vị N4 đầu theo `sequence` thuộc mảng yếu (kỳ vọng độc lập với engine). */
const expectedRemedial = (units: LibUnit[]): LibUnit[] =>
  units
    .filter((u) => u.level === 'N4' && WEAK.includes(u.topicId))
    .sort((a, b) => a.sequence - b.sequence || a.id.localeCompare(b.id))
    .slice(0, REMEDIAL_MAX_UNITS);

describe('ôn lùi có chặn (D11)', () => {
  const units = library();

  it('REMEDIAL_MAX_UNITS = 3', () => {
    expect(REMEDIAL_MAX_UNITS).toBe(3);
  });

  it('xếp N3 + mảng yếu thuộc N4: đúng 3 đơn vị N4 đầu theo sequence trong mảng yếu', () => {
    const remedial = remedialOf(rank(units, paramsOf()));
    expect(remedial).toHaveLength(REMEDIAL_MAX_UNITS);
    expect(new Set(remedial.map((r) => r.unit.id))).toEqual(
      new Set(expectedRemedial(units).map((u) => u.id)),
    );
    for (const r of remedial) expect(WEAK).toContain(r.unit.topicId);
  });

  it('học xong cả 3 bài vẫn không xuất hiện đơn vị ôn lùi thứ 4', () => {
    const picked = expectedRemedial(units);
    const progress = Object.fromEntries(picked.map((u) => [u.id, 'completed' as const]));
    const remedial = remedialOf(rank(units, paramsOf(), progress));
    expect(remedial).toHaveLength(REMEDIAL_MAX_UNITS);
    expect(remedial.every((r) => r.status === 'completed')).toBe(true);
    expect(new Set(remedial.map((r) => r.unit.id))).toEqual(new Set(picked.map((u) => u.id)));
  });

  it('thành thạo cả 3 bài: biến mất khỏi danh sách (mặc định) và vẫn không có bài thứ 4', () => {
    const picked = expectedRemedial(units);
    const progress = Object.fromEntries(picked.map((u) => [u.id, 'mastered' as const]));
    expect(remedialOf(rank(units, paramsOf(), progress))).toHaveLength(0);
    expect(remedialOf(rank(units, paramsOf(), progress, { includeMastered: true }))).toHaveLength(
      3,
    );
  });

  it('chỉ kỹ năng người học đã chọn mới có bài ôn lùi', () => {
    const grammarOnly = { ...profile, skills: ['grammar' as Skill] };
    const ranked = rankUnits({ ...paramsOf(), skills: ['grammar'] }, grammarOnly, units, new Map());
    const remedial = remedialOf(ranked);
    expect(remedial.length).toBeLessThanOrEqual(REMEDIAL_MAX_UNITS);
    expect(remedial.every((r) => r.unit.kind === 'grammar')).toBe(true);
  });

  it('không có mảng yếu thì không có bài ôn lùi', () => {
    expect(remedialOf(rank(units, paramsOf({ weakTopics: [] })))).toEqual([]);
  });

  it('xếp N4 (hoặc N5) hoặc foundationFirst thì không có bài ôn lùi', () => {
    const n4 = paramsOf({ startLevel: 'N4', levelRange: ['N4', 'N3'] });
    // Ở N4 các đơn vị N4 là nội dung chính thức; chỉ kiểm không có đơn vị N5 nào được kéo vào.
    expect(rank(units, n4).some((r) => r.unit.level === 'N5')).toBe(false);
    const n5 = paramsOf({ startLevel: 'N5', levelRange: ['N5', 'N3'] });
    expect(rank(units, n5).filter((r) => r.unit.level === 'N5')).toEqual([]);
    expect(remedialOf(rank(units, paramsOf({ foundationFirst: true })))).toEqual([]);
  });

  it('điểm trình độ của bài ôn lùi bằng 0 (không cộng bậc lùi) và nằm ngoài biên giới', () => {
    const ranked = rank(units, paramsOf());
    // Công thức của bài trong biên giới ở trình độ xuất phát: thẻ mục tiêu jlpt +20, mảng yếu +40, độ khó 3 ⇒ 0,
    // trừ sequence × 0,01. Bậc lùi KHÔNG được cộng thêm +100 của công thức cũ cho `idx < startIdx`.
    for (const r of remedialOf(ranked)) {
      expect(r.score).toBeCloseTo(20 + 40 - r.unit.sequence * 0.01, 6);
    }
    // Không chiếm chỗ biên giới của N3: bài N3 thứ 1–3 mỗi loại vẫn trong biên giới, bài thứ 4 ngoài biên giới.
    for (const kind of KINDS) {
      const n3 = ranked
        .filter((r) => r.unit.kind === kind && r.unit.level === 'N3')
        .sort((a, b) => a.unit.sequence - b.unit.sequence);
      expect(n3.slice(0, 3).every((r) => r.score > -1000)).toBe(true);
      expect(n3[3]!.score).toBeLessThan(-9000);
    }
  });

  it('thứ tự các đơn vị N3 không đổi khi thêm bài ôn lùi (mảng yếu chỉ thuộc N4)', () => {
    const n3Order = (params: PathParams) =>
      rank(units, params)
        .filter((r) => r.unit.level === 'N3')
        .map((r) => r.unit.id);
    expect(n3Order(paramsOf())).toEqual(n3Order(paramsOf({ weakTopics: [] })));
  });

  it('hồ sơ n3-skip-n4-weak: placement N3 + mảng yếu N4 ⇒ thấy N3 và ≤ 3 đơn vị N4 ôn lùi', () => {
    const fixture = loadLearnerProfile('n3-skip-n4-weak');
    const params = simPathParams(fixture);
    expect(params.startLevel).toBe('N3');
    expect(params.levelRange).toEqual(['N3', 'N3']);
    expect([...params.weakTopics].sort()).toEqual([...WEAK].sort());

    const ranked = rankUnits(params, fixture.profile, units, new Map());
    expect(ranked.some((r) => r.unit.level === 'N3')).toBe(true);
    expect(remedialOf(ranked).length).toBeGreaterThan(0);
    expect(remedialOf(ranked).length).toBeLessThanOrEqual(REMEDIAL_MAX_UNITS);
  });

  it('không đổi levelRange của lộ trình (chỉ thêm bài khi xếp hạng)', () => {
    const params = paramsOf();
    rank(units, params);
    expect(params.levelRange).toEqual(['N3', 'N3']);
  });
});
