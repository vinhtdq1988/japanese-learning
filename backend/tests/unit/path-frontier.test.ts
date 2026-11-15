import { describe, expect, it } from 'vitest';
import {
  FRONTIER_SIZE,
  GOAL_EXTRA,
  GOAL_LOOKAHEAD,
  buildPathParams,
  levelIndex,
  rankUnits,
  type PathParams,
  type PathProfileInput,
  type RankableUnit,
  type RankedUnit,
  type UnitProgressStatus,
} from '../../src/engine/path.js';
import type { ContentLevel, GoalType, Skill } from '../../src/domain/types.js';

// Biên giới thứ tự học ở quy mô lớn (spec 008, T013; research D10, data-model §7.1) trên thư viện tổng hợp
// ≥ 100 đơn vị/loại. Bất biến: (a) mỗi loại đi đúng (trình độ, sequence) ngoài biên giới; (b) ≤ 3 đơn vị
// chưa học ⇒ bằng công thức cũ; (c) tất định, không phụ thuộc UUID; (d) mở rộng theo mục tiêu work.

interface LibUnit extends RankableUnit {
  /** Tên dễ đọc: `<kind>-<level>-<i>`; không đi vào engine. */
  name: string;
  /** Vị trí 1-based trong (loại) theo (trình độ, sequence). */
  position: number;
}

const KINDS: Skill[] = ['vocabulary', 'grammar', 'kanji'];
const PER_LEVEL = 60;

/** Số giả ngẫu nhiên tất định để id KHÔNG tăng dần theo thứ tự giáo trình. */
function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state;
  };
}

interface Options {
  seed?: number;
  /** i (1-based, trong loại) → thẻ mục tiêu thêm cho đơn vị. */
  extraTags?: (kind: Skill, position: number) => GoalType[];
}

/** Thư viện 3 loại × 2 trình độ × 60 đơn vị = 360 đơn vị, `sequence` = chặng×100 + vị trí. */
function library({ seed = 1, extraTags }: Options = {}): LibUnit[] {
  const next = lcg(seed);
  const units: LibUnit[] = [];
  for (const kind of KINDS) {
    let position = 0;
    for (const level of ['N4', 'N3'] as ContentLevel[]) {
      for (let i = 0; i < PER_LEVEL; i += 1) {
        position += 1;
        const stage = Math.floor(i / 9) + 4;
        units.push({
          id: `u-${next().toString(16).padStart(8, '0')}-${next().toString(16).padStart(8, '0')}`,
          name: `${kind}-${level}-${i + 1}`,
          position,
          kind,
          level,
          tier: 'core',
          goalTags: ['jlpt', ...(extraTags?.(kind, position) ?? [])],
          topicId: `topic-${kind}-${level}-${Math.floor(i / 6)}`,
          difficulty: 3,
          estMinutes: 5,
          sequence: stage * 100 + ((i % 9) + 1) * 10,
        });
      }
    }
  }
  return units;
}

const jlptProfile = (
  over: Partial<PathProfileInput> = {},
): PathProfileInput & { goalType: GoalType | null } => ({
  currentLevel: 'N4',
  goalType: 'jlpt',
  targetLevel: 'N3',
  targetDate: null,
  skills: KINDS,
  prioritizedSkill: null,
  ...over,
});

const paramsOf = (profile: PathProfileInput, weak: string[] = []): PathParams => ({
  ...buildPathParams(profile),
  weakTopics: weak,
});

const names = (ranked: RankedUnit<LibUnit>[], kind?: Skill): string[] =>
  ranked.filter((r) => !kind || r.unit.kind === kind).map((r) => r.unit.name);

/** Thứ tự giáo trình của một loại: (trình độ, sequence) tăng dần. */
const curriculum = (units: LibUnit[], kind: Skill): LibUnit[] =>
  units
    .filter((u) => u.kind === kind)
    .sort((a, b) => levelIndex(a.level) - levelIndex(b.level) || a.sequence - b.sequence);

const rank = (
  units: LibUnit[],
  profile: PathProfileInput,
  progress: Record<string, UnitProgressStatus> = {},
  stats: { topicId: string; isWeak: boolean; difficultyBias: number }[] = [],
  weak: string[] = [],
) => rankUnits(paramsOf(profile, weak), profile, units, new Map(Object.entries(progress)), stats);

describe('hằng số biên giới', () => {
  it('FRONTIER_SIZE = 3, GOAL_LOOKAHEAD = 12, GOAL_EXTRA = 3', () => {
    expect([FRONTIER_SIZE, GOAL_LOOKAHEAD, GOAL_EXTRA]).toEqual([3, 12, 3]);
  });
});

describe('(a) mỗi loại luôn đề xuất đúng (trình độ, sequence) ngoài biên giới', () => {
  const units = library();
  const byName = new Map(units.map((u) => [u.name, u]));
  // Mảng của đơn vị #50 (N4) yếu và độ lệch độ khó dương ở mọi mảng của loại ngữ pháp.
  const weakTopic = byName.get('vocabulary-N4-50')!.topicId;
  const stats = [
    { topicId: weakTopic, isWeak: true, difficultyBias: 2 },
    { topicId: byName.get('grammar-N3-10')!.topicId, isWeak: true, difficultyBias: 2 },
    { topicId: byName.get('kanji-N4-30')!.topicId, isWeak: false, difficultyBias: -2 },
  ];

  for (const [label, tune] of [
    ['không thích ứng', false],
    ['mảng yếu + độ lệch độ khó + kỹ năng ưu tiên', true],
  ] as const) {
    it(`${label}: phần ngoài biên giới đi đúng giáo trình, biên giới là 3 đơn vị đầu`, () => {
      const profile = jlptProfile(tune ? { prioritizedSkill: 'grammar' } : {});
      const ranked = rank(units, profile, {}, tune ? stats : [], tune ? [weakTopic] : []);
      for (const kind of KINDS) {
        const order = curriculum(units, kind).map((u) => u.name);
        const got = names(ranked, kind);
        expect(got).toHaveLength(order.length);
        expect(new Set(got.slice(0, FRONTIER_SIZE))).toEqual(
          new Set(order.slice(0, FRONTIER_SIZE)),
        );
        expect(got.slice(FRONTIER_SIZE)).toEqual(order.slice(FRONTIER_SIZE));
      }
    });
  }

  it('mảng yếu của đơn vị ở vị trí 50 KHÔNG đẩy nó lên trước đơn vị trong biên giới', () => {
    const ranked = rank(units, jlptProfile(), {}, stats, [weakTopic]);
    const order = names(ranked, 'vocabulary');
    expect(order.indexOf('vocabulary-N4-50')).toBeGreaterThanOrEqual(FRONTIER_SIZE);
    expect(order.indexOf('vocabulary-N4-50')).toBeGreaterThan(order.indexOf('vocabulary-N4-3'));
  });

  it('thích ứng vẫn hoán đổi được TRONG biên giới (mảng yếu ở đơn vị thứ 3 lên đầu)', () => {
    const fresh = library();
    const third = curriculum(fresh, 'vocabulary')[2]!;
    third.topicId = 'topic-rieng-cua-don-vi-thu-3';
    const ranked = rank(fresh, jlptProfile(), {}, [
      { topicId: third.topicId, isWeak: true, difficultyBias: 0 },
    ]);
    const order = names(ranked, 'vocabulary');
    expect(order[0]).toBe(third.name);
    expect(new Set(order.slice(0, 3))).toEqual(
      new Set(
        curriculum(fresh, 'vocabulary')
          .slice(0, 3)
          .map((u) => u.name),
      ),
    );
  });

  it('đơn vị N3 không bao giờ lên trước đơn vị N4 chưa học cùng loại (người xuất phát N4)', () => {
    const ranked = rank(units, jlptProfile(), {}, stats, [weakTopic]);
    for (const kind of KINDS) {
      const levels = ranked.filter((r) => r.unit.kind === kind).map((r) => r.unit.level);
      expect(levels.indexOf('N3')).toBe(PER_LEVEL);
    }
  });

  it('đơn vị in_progress luôn thuộc biên giới và đứng đầu', () => {
    const far = byName.get('grammar-N4-40')!;
    const ranked = rank(units, jlptProfile(), { [far.id]: 'in_progress' });
    expect(names(ranked)[0]).toBe('grammar-N4-40');
    expect(ranked[0]!.status).toBe('in_progress');
    // Các loại khác và phần còn lại của ngữ pháp vẫn đúng giáo trình.
    const grammar = names(ranked, 'grammar').filter((n) => n !== 'grammar-N4-40');
    expect(grammar.slice(FRONTIER_SIZE)).toEqual(
      curriculum(units, 'grammar')
        .map((u) => u.name)
        .filter((n) => n !== 'grammar-N4-40')
        .slice(FRONTIER_SIZE),
    );
  });

  it('đơn vị đã học xong rời khỏi biên giới: đơn vị thứ 4 vào thay chỗ', () => {
    const order = curriculum(units, 'vocabulary');
    const done = Object.fromEntries(order.slice(0, 2).map((u) => [u.id, 'completed' as const]));
    const ranked = rank(units, jlptProfile(), done);
    const pending = ranked.filter((r) => r.unit.kind === 'vocabulary' && r.status === 'pending');
    expect(pending.slice(0, 3).map((r) => r.unit.name)).toEqual(
      expect.arrayContaining([order[2]!.name, order[3]!.name, order[4]!.name]),
    );
    expect(pending.slice(3).map((r) => r.unit.name)).toEqual(order.slice(5).map((u) => u.name));
  });
});

describe('điểm xuất phát (FR-021, D13)', () => {
  const units = library();

  it('xuất phát N4: đơn vị đầu tiên đề xuất của mỗi loại là đơn vị đầu của N4', () => {
    const ranked = rank(units, jlptProfile());
    for (const kind of KINDS) {
      expect(names(ranked, kind)[0]).toBe(curriculum(units, kind)[0]!.name);
      expect(names(ranked, kind)[0]).toMatch(/-N4-/);
    }
  });

  it('xuất phát N3: chỉ N3, đơn vị đầu là đơn vị đầu của N3 (không rơi xuống N4)', () => {
    const profile = jlptProfile({ currentLevel: 'N3', targetLevel: 'N3' });
    const ranked = rank(units, profile);
    for (const kind of KINDS) {
      const order = names(ranked, kind);
      expect(order.every((n) => n.includes('-N3-'))).toBe(true);
      expect(order[0]).toBe(`${kind}-N3-1`);
      expect(order.slice(FRONTIER_SIZE)).toEqual(
        curriculum(units, kind)
          .filter((u) => u.level === 'N3')
          .map((u) => u.name)
          .slice(FRONTIER_SIZE),
      );
    }
  });
});

describe('requires thật: ngữ pháp bị động đứng sau thể ない (Câu chuyện 1 kịch bản 4)', () => {
  it('mảng bị động yếu không kéo bài bị động (xa biên giới) lên trước bài thể ない', () => {
    const units = library();
    const grammar = curriculum(units, 'grammar');
    const nai = grammar[1]!; // vị trí 2: trong biên giới
    const passive = grammar[20]!; // vị trí 21: ngoài biên giới, "requires" nai
    const ranked = rank(
      units,
      jlptProfile(),
      {},
      [{ topicId: passive.topicId, isWeak: true, difficultyBias: 2 }],
      [passive.topicId],
    );
    const order = names(ranked, 'grammar');
    expect(order.indexOf(nai.name)).toBeLessThan(order.indexOf(passive.name));
    expect(order.indexOf(passive.name)).toBeGreaterThanOrEqual(FRONTIER_SIZE);
  });
});

describe('(b) khi mỗi loại ≤ 3 đơn vị chưa học, kết quả BẰNG công thức cũ', () => {
  /** Công thức cũ (trước spec 008), chép nguyên văn từ `rankUnits` để làm chuẩn so sánh. */
  function legacyRank(
    params: PathParams,
    profile: PathProfileInput,
    units: LibUnit[],
    progress: Map<string, UnitProgressStatus>,
    stats: { topicId: string; isWeak: boolean; difficultyBias: number }[],
  ) {
    const skills = new Set<Skill>(profile.skills);
    const [low, high] = params.levelRange.map(levelIndex) as [number, number];
    const start = levelIndex(params.startLevel);
    const byTopic = new Map(stats.map((s) => [s.topicId, s]));
    const weak = new Set<string>(params.weakTopics);
    for (const s of stats) if (s.isWeak) weak.add(s.topicId);
    const out: { name: string; id: string; kind: Skill; status: string; score: number }[] = [];
    for (const unit of units) {
      if (!skills.has(unit.kind)) continue;
      const idx = levelIndex(unit.level);
      if (idx < low || idx > high) continue;
      const p = progress.get(unit.id);
      if (p === 'mastered') continue;
      const status = p ?? 'pending';
      let score = 0;
      if (status === 'in_progress') score += 2000;
      score -= 100 * (idx - start);
      if (profile.goalType && unit.goalTags.includes(profile.goalType)) score += 20;
      if (profile.prioritizedSkill && unit.kind === profile.prioritizedSkill) score += 30;
      if (weak.has(unit.topicId)) score += 40;
      score += 4 * (byTopic.get(unit.topicId)?.difficultyBias ?? 0) * (unit.difficulty - 3);
      score -= unit.sequence * 0.01;
      out.push({ name: unit.name, id: unit.id, kind: unit.kind, status, score });
    }
    const group = (s: string): number => (s === 'completed' ? 1 : 0);
    return out
      .sort(
        (a, b) =>
          group(a.status) - group(b.status) ||
          b.score - a.score ||
          // Cùng điểm: từ vựng trước, rồi theo id — đúng như `rankUnits` trước spec 008.
          (a.kind === b.kind ? 0 : a.kind === 'vocabulary' ? -1 : 1) ||
          a.id.localeCompare(b.id),
      )
      .map((r) => r.id);
  }

  it('chỉ còn 3 đơn vị chưa học mỗi loại (phần còn lại đã hoàn thành) ⇒ cùng thứ tự với công thức cũ', () => {
    const units = library({ seed: 7 });
    const pendingKeep = new Set<string>();
    const progress = new Map<string, UnitProgressStatus>();
    for (const kind of KINDS) {
      curriculum(units, kind).forEach((u, i) => {
        // Giữ 3 đơn vị chưa học nằm rải rác (không nhất thiết đầu danh sách).
        if ([5, 17, 70].includes(i)) pendingKeep.add(u.id);
        else progress.set(u.id, 'completed');
      });
    }
    const stats = [
      {
        topicId: units.find((u) => u.name === 'vocabulary-N4-6')!.topicId,
        isWeak: true,
        difficultyBias: 2,
      },
    ];
    for (const goalType of ['jlpt', 'work', null] as (GoalType | null)[]) {
      const profile = jlptProfile({ goalType, prioritizedSkill: 'kanji' });
      const params = paramsOf(profile);
      const got = rankUnits(params, profile, units, progress, stats).map((r) => r.unit.id);
      const want = legacyRank(params, profile, units, progress, stats);
      expect(got).toEqual(want);
    }
  });

  it('còn đúng 3 đơn vị chưa học mỗi loại ⇒ 100% đơn vị chưa học đều thuộc biên giới (không ai bị đẩy xuống)', () => {
    const units = library();
    const progress = new Map<string, UnitProgressStatus>();
    for (const kind of KINDS) {
      curriculum(units, kind).forEach((u, i) => {
        if (i >= 3) progress.set(u.id, 'completed');
      });
    }
    const profile = jlptProfile();
    const ranked = rankUnits(paramsOf(profile), profile, units, progress);
    const pending = ranked.filter((r) => r.status === 'pending');
    expect(pending).toHaveLength(9);
    expect(pending.every((r) => r.score > -1_000)).toBe(true);
  });
});

describe('(c) tất định, không phụ thuộc UUID', () => {
  it('đổi toàn bộ id và đảo thứ tự đầu vào ⇒ cùng thứ tự theo tên', () => {
    const profile = jlptProfile({ prioritizedSkill: 'vocabulary' });
    const a = library({ seed: 1 });
    const b = library({ seed: 999 }).sort(() => 0.5 - Math.sin(1)); // id khác, thứ tự mảng khác
    const shuffled = [...b].reverse();
    const stats = (units: LibUnit[]) => [
      {
        topicId: units.find((u) => u.name === 'vocabulary-N4-2')!.topicId,
        isWeak: true,
        difficultyBias: 1,
      },
    ];
    const first = names(rank(a, profile, {}, stats(a)));
    const second = names(rank(shuffled, profile, {}, stats(shuffled)));
    expect(second).toEqual(first);
    expect(names(rank(a, profile, {}, stats(a)))).toEqual(first);
  });

  it('hai đơn vị cùng sequence (nội dung cũ) được phá hòa bằng id, không thay đổi giữa các lần gọi', () => {
    const units = library();
    const [x, y] = curriculum(units, 'vocabulary');
    y!.sequence = x!.sequence;
    const profile = jlptProfile();
    const once = names(rank(units, profile), 'vocabulary');
    const twice = names(rank([...units].reverse(), profile), 'vocabulary');
    expect(twice).toEqual(once);
  });
});

describe('(d) mở rộng theo mục tiêu work/daily_conversation (D10)', () => {
  /** Đơn vị vị trí 5, 6, 7, 8 và 13 (trong loại, theo giáo trình) mang thẻ `work`. */
  const tagged = new Set([5, 6, 7, 8, 13]);
  const units = library({
    extraTags: (_kind, position) => (tagged.has(position) ? ['work'] : []),
  });
  const nameAt = (kind: Skill, position: number): string =>
    curriculum(units, kind)[position - 1]!.name;

  it('goalType = work: 3 đơn vị work đầu tiên trong 12 đơn vị đầu được đề bạt lên biên giới', () => {
    const ranked = rank(units, jlptProfile({ goalType: 'work' }));
    for (const kind of KINDS) {
      const order = names(ranked, kind);
      const promoted = [5, 6, 7].map((p) => nameAt(kind, p));
      // Có thẻ mục tiêu (+20) nên đứng trước ba đơn vị đầu không mang thẻ.
      expect(order.slice(0, 3)).toEqual(promoted);
      expect(new Set(order.slice(3, 6))).toEqual(new Set([1, 2, 3].map((p) => nameAt(kind, p))));
    }
  });

  it('đơn vị work thứ 4 (vị trí 8) và vị trí 13 KHÔNG được đề bạt; phần còn lại đúng giáo trình', () => {
    const ranked = rank(units, jlptProfile({ goalType: 'work' }));
    for (const kind of KINDS) {
      const order = names(ranked, kind);
      const rest = order.slice(6);
      const expected = curriculum(units, kind)
        .map((u) => u.name)
        .filter((n) => ![1, 2, 3, 5, 6, 7].map((p) => nameAt(kind, p)).includes(n));
      expect(rest).toEqual(expected);
      expect(order.indexOf(nameAt(kind, 8))).toBeGreaterThan(order.indexOf(nameAt(kind, 4)));
      expect(order.indexOf(nameAt(kind, 13))).toBeGreaterThan(order.indexOf(nameAt(kind, 12)));
    }
  });

  it('đơn vị work ở vị trí 13 trở đi không bao giờ được đề bạt dù là đơn vị work duy nhất', () => {
    const lonely = library({ extraTags: (_k, position) => (position === 13 ? ['work'] : []) });
    const ranked = rank(lonely, jlptProfile({ goalType: 'work' }));
    for (const kind of KINDS) {
      const order = names(ranked, kind);
      const at13 = curriculum(lonely, kind)[12]!.name;
      expect(order.indexOf(at13)).toBe(12);
    }
  });

  it('daily_conversation hoạt động như work với thẻ của nó', () => {
    const talk = library({ extraTags: (_k, p) => (p === 9 ? ['daily_conversation'] : []) });
    const ranked = rank(talk, jlptProfile({ goalType: 'daily_conversation' }));
    for (const kind of KINDS) {
      expect(names(ranked, kind)[0]).toBe(curriculum(talk, kind)[8]!.name);
    }
  });

  it('goalType = jlpt (hoặc rỗng) cho kết quả như (a): thẻ work không tạo đề bạt', () => {
    for (const goalType of ['jlpt', null] as (GoalType | null)[]) {
      const ranked = rank(units, jlptProfile({ goalType }));
      for (const kind of KINDS) {
        const order = names(ranked, kind);
        const expected = curriculum(units, kind).map((u) => u.name);
        expect(new Set(order.slice(0, 3))).toEqual(new Set(expected.slice(0, 3)));
        expect(order.slice(3)).toEqual(expected.slice(3));
      }
    }
  });

  it('mục tiêu work, không có đơn vị work nào trong cửa sổ ⇒ như không mở rộng', () => {
    const none = library();
    const ranked = rank(none, jlptProfile({ goalType: 'work' }));
    for (const kind of KINDS) {
      const order = names(ranked, kind);
      const expected = curriculum(none, kind).map((u) => u.name);
      expect(order.slice(3)).toEqual(expected.slice(3));
    }
  });
});
