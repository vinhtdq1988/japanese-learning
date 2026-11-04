import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { gradePlacement } from '../../src/engine/placement.js';
import {
  buildPathParams,
  fromGeneratedFrom,
  rankUnits,
  requiredUnitsPerDay,
  toGeneratedFrom,
  upcomingUnits,
  type PathParams,
  type PathProfileInput,
  type RankableUnit,
  type UnitProgressStatus,
} from '../../src/engine/path.js';
import {
  loadLearnerProfile,
  type LearnerProfileFixture,
} from '../fixtures/learner-profiles/index.js';
import { DEFAULT_CONTENT_DIR, type PlacementFile } from '../../src/seed/content.js';
import type { ContentLevel, Skill } from '../../src/domain/types.js';

// Kiểm thử engine lộ trình (T035, research R7) trên hồ sơ đại diện (FR-035).

const placementFile = JSON.parse(
  readFileSync(`${DEFAULT_CONTENT_DIR}/placement/placement-v1.json`, 'utf8'),
) as PlacementFile;

function profileInput(f: LearnerProfileFixture): PathProfileInput {
  return {
    currentLevel: f.profile.currentLevel,
    goalType: f.profile.goalType,
    targetLevel: f.profile.targetLevel,
    targetDate: f.profile.targetDate,
    skills: f.profile.skills,
    prioritizedSkill: f.profile.prioritizedSkill,
  };
}

/** Chấm placement của hồ sơ (nếu có) thành đầu vào cho `buildPathParams`. */
function placementOf(f: LearnerProfileFixture) {
  if (!f.placement) return null;
  const correct = f.placement.correctByPosition;
  const keys = placementFile.questions.map((q) => ({
    id: `q${q.position}`,
    level: q.level,
    topicId: q.topic,
    correctChoice: q.correctChoice,
  }));
  const outcome = gradePlacement(
    keys,
    placementFile.questions.map((q) => ({
      questionId: `q${q.position}`,
      choice: correct[q.position - 1] ? q.correctChoice : (q.correctChoice + 1) % 4,
    })),
  );
  return {
    id: 'placement-1',
    estimatedLevel: outcome.estimatedLevel,
    weakTopics: outcome.weakTopics,
  };
}

function paramsFor(id: string): { params: PathParams; fixture: LearnerProfileFixture } {
  const fixture = loadLearnerProfile(id);
  return { params: buildPathParams(profileInput(fixture), placementOf(fixture)), fixture };
}

let counter = 0;
function unit(over: Partial<RankableUnit> & Pick<RankableUnit, 'kind' | 'level'>): RankableUnit {
  counter += 1;
  return {
    id: `u${String(counter).padStart(3, '0')}`,
    tier: 'core',
    goalTags: ['daily_conversation', 'work', 'jlpt'],
    topicId: `t-${over.kind}-${over.level}`,
    difficulty: 2,
    estMinutes: 5,
    sequence: counter * 10,
    ...over,
  };
}

/** Danh mục giả lập đủ N5–N3, có đơn vị nền tảng N5 cho cả hai kỹ năng. */
function catalog(): RankableUnit[] {
  const levels: ContentLevel[] = ['N5', 'N4', 'N3'];
  const kinds: Skill[] = ['vocabulary', 'grammar'];
  const units: RankableUnit[] = [];
  for (const level of levels) {
    for (const kind of kinds) {
      units.push(unit({ kind, level, tier: level === 'N5' ? 'foundation' : 'core', sequence: 10 }));
      units.push(unit({ kind, level, sequence: 20 }));
    }
  }
  return units;
}

const noProgress = new Map<string, UnitProgressStatus>();

describe('buildPathParams – điểm xuất phát và khoảng trình độ', () => {
  it.each(['newcomer-10min', 'n3-30min', 'placement-guesser', 'self-declared-n2', 'jlpt-n1-goal'])(
    'hồ sơ %s khớp kết quả mong đợi',
    (id) => {
      const { params, fixture } = paramsFor(id);
      const expected = fixture.expected.path!;
      expect(params.startLevel).toBe(expected.startLevel);
      if (expected.levelRange) expect(params.levelRange).toEqual(expected.levelRange);
      expect(params.scopeNotice).toBe(expected.scopeNotice);
      expect(params.foundationFirst).toBe(expected.firstUnitsTier === 'foundation');
    },
  );

  it('người mới (chưa biết gì) bắt đầu ở N5 và ưu tiên nền tảng', () => {
    const { params } = paramsFor('newcomer-10min');
    expect(params).toMatchObject({ startLevel: 'N5', foundationFirst: true, scopeNotice: null });
  });

  it('placement đoán mò → mức an toàn cho người mới dù tự khai báo N4', () => {
    const { params } = paramsFor('placement-guesser');
    expect(params).toMatchObject({ startLevel: 'N5', foundationFirst: true });
    expect(params.levelRange).toEqual(['N5', 'N4']); // trần theo mục tiêu JLPT N4
    expect(params.placementResultId).toBe('placement-1');
  });

  it('kết quả placement ưu tiên hơn trình độ tự khai báo', () => {
    const base: PathProfileInput = {
      currentLevel: 'N3',
      goalType: 'work',
      targetLevel: null,
      targetDate: null,
      skills: ['vocabulary', 'grammar'],
    };
    const params = buildPathParams(base, { id: 'p', estimatedLevel: 'N5', weakTopics: ['x'] });
    expect(params).toMatchObject({ startLevel: 'N5', foundationFirst: false, weakTopics: ['x'] });
  });

  it('N2 tự khai báo → bắt đầu N3 kèm scopeNotice', () => {
    const { params } = paramsFor('self-declared-n2');
    expect(params).toMatchObject({
      startLevel: 'N3',
      levelRange: ['N3', 'N3'],
      scopeNotice: 'content_ceiling_n3',
    });
  });

  it('mục tiêu JLPT N1 → khoảng trình độ cắt ở N3', () => {
    const { params } = paramsFor('jlpt-n1-goal');
    expect(params.levelRange).toEqual(['N4', 'N3']);
    expect(params.scopeNotice).toBe('content_ceiling_n3');
  });

  it('mục tiêu JLPT thấp hơn điểm xuất phát không kéo trần xuống dưới điểm xuất phát', () => {
    const params = buildPathParams({
      currentLevel: 'N3',
      goalType: 'jlpt',
      targetLevel: 'N5',
      targetDate: null,
      skills: ['vocabulary'],
    });
    expect(params.levelRange).toEqual(['N3', 'N3']);
  });

  it('mục tiêu không phải JLPT mở khoảng đến hết nội dung (N3)', () => {
    const params = buildPathParams({
      currentLevel: 'N5',
      goalType: 'work',
      targetLevel: null,
      targetDate: null,
      skills: ['grammar'],
    });
    expect(params.levelRange).toEqual(['N5', 'N3']);
  });

  it('serialize generated_from rồi đọc lại cho đúng tham số', () => {
    const { params } = paramsFor('jlpt-n1-goal');
    expect(fromGeneratedFrom(toGeneratedFrom(params))).toEqual(params);
  });
});

describe('rankUnits – thứ tự đơn vị tính động', () => {
  it('người mới: các đơn vị đầu đều là tier foundation', () => {
    const { params, fixture } = paramsFor('newcomer-10min');
    const ranked = rankUnits(params, profileInput(fixture), catalog(), noProgress);
    // Danh mục thử có đúng 2 đơn vị nền tảng (từ vựng + ngữ pháp N5); chúng đứng trước mọi đơn vị core.
    expect(ranked.slice(0, 2).map((r) => r.unit.tier)).toEqual(['foundation', 'foundation']);
    expect(ranked.slice(2).every((r) => r.unit.tier === 'core')).toBe(true);
    expect(ranked[0]!.unit.level).toBe('N5');
  });

  it('N3/30 phút: chỉ đơn vị N3', () => {
    const { params, fixture } = paramsFor('n3-30min');
    const ranked = rankUnits(params, profileInput(fixture), catalog(), noProgress);
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked.every((r) => r.unit.level === 'N3')).toBe(true);
  });

  it('N2 tự khai báo: bắt đầu với đơn vị N3', () => {
    const { params, fixture } = paramsFor('self-declared-n2');
    const ranked = rankUnits(params, profileInput(fixture), catalog(), noProgress);
    expect(ranked.every((r) => r.unit.level === 'N3')).toBe(true);
  });

  it('mục tiêu JLPT N1: chỉ N4 rồi N3 (cắt ở N3), N4 trước N3, ưu tiên ngữ pháp', () => {
    const { params, fixture } = paramsFor('jlpt-n1-goal');
    const ranked = rankUnits(params, profileInput(fixture), catalog(), noProgress);
    const levels = ranked.map((r) => r.unit.level);
    expect(new Set(levels)).toEqual(new Set(['N4', 'N3']));
    expect(levels.indexOf('N3')).toBeGreaterThan(levels.lastIndexOf('N4'));
    expect(ranked[0]!.unit.kind).toBe('grammar'); // prioritizedSkill = grammar
  });

  it('placement đoán mò → mức an toàn: bắt đầu bằng nền tảng N5, không có N3', () => {
    const { params, fixture } = paramsFor('placement-guesser');
    const ranked = rankUnits(params, profileInput(fixture), catalog(), noProgress);
    expect(ranked[0]!.unit.tier).toBe('foundation');
    expect(ranked.some((r) => r.unit.level === 'N3')).toBe(false);
  });

  it('KHÔNG tạo lộ trình cố định chung: các hồ sơ khác nhau cho thứ tự khác nhau', () => {
    const units = catalog();
    const orders = ['newcomer-10min', 'n3-30min', 'jlpt-n1-goal'].map((id) => {
      const { params, fixture } = paramsFor(id);
      return rankUnits(params, profileInput(fixture), units, noProgress)
        .map((r) => r.unit.id)
        .join(',');
    });
    expect(new Set(orders).size).toBe(orders.length);
  });

  it('chỉ giữ đơn vị thuộc kỹ năng đã chọn', () => {
    const { params, fixture } = paramsFor('newcomer-10min');
    const profile = { ...profileInput(fixture), skills: ['vocabulary'] as Skill[] };
    const ranked = rankUnits({ ...params, skills: ['vocabulary'] }, profile, catalog(), noProgress);
    expect(ranked.every((r) => r.unit.kind === 'vocabulary')).toBe(true);
  });

  it('đơn vị active mới xuất hiện ở lần tính kế tiếp, đơn vị inactive bị loại (SC-008)', () => {
    const { params, fixture } = paramsFor('newcomer-10min');
    const base = catalog();
    const before = rankUnits(params, profileInput(fixture), base, noProgress);

    const fresh = unit({ kind: 'vocabulary', level: 'N5', tier: 'foundation', sequence: 1 });
    const withFresh = rankUnits(params, profileInput(fixture), [...base, fresh], noProgress);
    expect(withFresh.map((r) => r.unit.id)).toContain(fresh.id);
    expect(withFresh).toHaveLength(before.length + 1);

    const inactive = { ...base[0]!, status: 'inactive' as const };
    const withoutOne = rankUnits(
      params,
      profileInput(fixture),
      [inactive, ...base.slice(1)],
      noProgress,
    );
    expect(withoutOne.map((r) => r.unit.id)).not.toContain(inactive.id);
  });

  it('đơn vị mastered bị loại khỏi bài sắp tới (có thể giữ lại khi includeMastered)', () => {
    const { params, fixture } = paramsFor('newcomer-10min');
    const units = catalog();
    const mastered = units[0]!;
    const progress = new Map<string, UnitProgressStatus>([[mastered.id, 'mastered']]);
    const ranked = rankUnits(params, profileInput(fixture), units, progress);
    expect(ranked.map((r) => r.unit.id)).not.toContain(mastered.id);

    const all = rankUnits(params, profileInput(fixture), units, progress, [], {
      includeMastered: true,
    });
    expect(all.at(-1)!.unit.id).toBe(mastered.id);
    expect(all.at(-1)!.status).toBe('mastered');
  });

  it('đơn vị đang học dở lên đầu; đơn vị đã hoàn thành xuống cuối và không thuộc bài sắp tới', () => {
    const { params, fixture } = paramsFor('newcomer-10min');
    const units = catalog();
    const first = rankUnits(params, profileInput(fixture), units, noProgress)[0]!.unit;
    const later = units.find((u) => u.id !== first.id && u.level === 'N5' && u.tier === 'core')!;
    const progress = new Map<string, UnitProgressStatus>([
      [later.id, 'in_progress'],
      [first.id, 'completed'],
    ]);
    const ranked = rankUnits(params, profileInput(fixture), units, progress);
    expect(ranked[0]!.unit.id).toBe(later.id);
    expect(ranked.at(-1)!.unit.id).toBe(first.id);
    expect(upcomingUnits(ranked).map((u) => u.id)).not.toContain(first.id);
  });

  it('mảng yếu và difficulty_bias ảnh hưởng thứ tự', () => {
    const { params, fixture } = paramsFor('n3-30min');
    const easy = unit({
      kind: 'vocabulary',
      level: 'N3',
      difficulty: 1,
      sequence: 10,
      topicId: 'ta',
    });
    const hard = unit({
      kind: 'vocabulary',
      level: 'N3',
      difficulty: 5,
      sequence: 10,
      topicId: 'tb',
    });
    const profile = profileInput(fixture);

    const neutral = rankUnits(params, profile, [hard, easy], noProgress).map((r) => r.unit.id);
    const lowBias = rankUnits(params, profile, [hard, easy], noProgress, [
      { topicId: 'tb', isWeak: false, difficultyBias: -2 },
    ]).map((r) => r.unit.id);
    expect(lowBias[0]).toBe(easy.id);
    // Bias dương cho mảng của đơn vị khó đẩy nó lên cao hơn.
    const highBias = rankUnits(params, profile, [hard, easy], noProgress, [
      { topicId: 'tb', isWeak: false, difficultyBias: 2 },
    ]).map((r) => r.unit.id);
    expect(highBias[0]).toBe(hard.id);
    expect(neutral).toHaveLength(2);

    // Mảng yếu được củng cố trước.
    const weak = rankUnits(params, profile, [easy, hard], noProgress, [
      { topicId: 'tb', isWeak: true, difficultyBias: 0 },
    ]).map((r) => r.unit.id);
    expect(weak[0]).toBe(hard.id);
  });

  it('tất định: cùng đầu vào cho cùng thứ tự', () => {
    const { params, fixture } = paramsFor('newcomer-10min');
    const units = catalog();
    const a = rankUnits(params, profileInput(fixture), units, noProgress).map((r) => r.unit.id);
    const b = rankUnits(params, profileInput(fixture), [...units].reverse(), noProgress).map(
      (r) => r.unit.id,
    );
    expect(a).toEqual(b);
  });
});

describe('requiredUnitsPerDay', () => {
  it('chia đơn vị còn lại cho số ngày đến mốc', () => {
    expect(requiredUnitsPerDay(30, '2026-01-01', '2026-01-31')).toBe(1);
  });
  it('không có mốc → null; quá hạn → cần học hết ngay', () => {
    expect(requiredUnitsPerDay(10, '2026-01-01', null)).toBeNull();
    expect(requiredUnitsPerDay(10, '2026-02-01', '2026-01-31')).toBe(10);
  });
});
