import { describe, expect, it } from 'vitest';
import {
  MAX_ITEM_MINUTES,
  packReviewBatches,
  rankDueItems,
  reviewMinutesFor,
} from '../../src/engine/daily-plan.js';
import { addDays } from '../../src/engine/clock.js';
import { dueDateAfter, nextSrsState, type SrsState } from '../../src/engine/srs.js';
import { decodeReviewKey, encodeReviewKey } from '../../src/domain/review-key.js';
import { KANJI_FACETS, type ReviewFacet } from '../../src/domain/types.js';
import { loadKanjiProfiles } from '../fixtures/learner-profiles/index.js';

// Kiểm thử SRS theo cặp (chữ, khía cạnh) – US3 (T057, SC-005, FR-014 → FR-016): mỗi cặp có lịch SM-2 riêng,
// khóa ghép `itemId:facet` đi qua `rankDueItems` + `packReviewBatches` không đổi chữ ký.

const TODAY = '2026-01-05';
const SECONDS = 30; // REVIEW_SECONDS_PER_ITEM mặc định

/** Lịch ôn theo cặp: khóa ghép → trạng thái SRS. */
type Schedules = Map<string, SrsState>;

const keyOf = (itemId: string, facet: ReviewFacet) => encodeReviewKey(itemId, facet);

/** Trả lời một cặp: chỉ trạng thái của ĐÚNG cặp đó thay đổi. */
function answer(schedules: Schedules, itemId: string, facet: ReviewFacet, correct: boolean): void {
  const key = keyOf(itemId, facet);
  schedules.set(key, nextSrsState(schedules.get(key) ?? null, correct, correct ? 1 : 0.5));
}

/** Học một chữ lần đầu (đúng cả ba khía cạnh). */
function learn(schedules: Schedules, itemId: string): void {
  for (const facet of KANJI_FACETS) answer(schedules, itemId, facet, true);
}

describe('cập nhật lịch độc lập theo cặp (US3.3)', () => {
  it('trả lời sai một khía cạnh không đổi lịch các khía cạnh khác của cùng chữ', () => {
    const schedules: Schedules = new Map();
    learn(schedules, 'k1');
    const before = new Map(schedules);

    answer(schedules, 'k1', 'reading', false);

    expect(schedules.get(keyOf('k1', 'meaning'))).toEqual(before.get(keyOf('k1', 'meaning')));
    expect(schedules.get(keyOf('k1', 'word'))).toEqual(before.get(keyOf('k1', 'word')));
    expect(schedules.get(keyOf('k1', 'reading'))).toMatchObject({
      intervalDays: 1,
      repetitions: 0,
      lapses: 1,
    });
  });

  it('cặp trả lời sai đến hạn sớm hơn cặp trả lời đúng của cùng chữ (lần ôn thứ hai)', () => {
    const schedules: Schedules = new Map();
    learn(schedules, 'k1');
    answer(schedules, 'k1', 'meaning', true);
    answer(schedules, 'k1', 'reading', false);

    const dueOf = (facet: ReviewFacet) =>
      dueDateAfter(TODAY, schedules.get(keyOf('k1', facet))!.intervalDays);
    expect(dueOf('reading') < dueOf('meaning')).toBe(true);
    expect(dueOf('reading')).toBe(addDays(TODAY, 1));
    // Khía cạnh `word` không bị ảnh hưởng: vẫn ở lần ôn đầu (1 ngày).
    expect(schedules.get(keyOf('k1', 'word'))!.intervalDays).toBe(1);
  });

  it('đúng liên tiếp làm khoảng cách tăng dần (US3.4)', () => {
    const schedules: Schedules = new Map();
    const intervals: number[] = [];
    for (let i = 0; i < 6; i++) {
      answer(schedules, 'k1', 'meaning', true);
      intervals.push(schedules.get(keyOf('k1', 'meaning'))!.intervalDays);
    }
    for (let i = 1; i < intervals.length; i++) {
      expect(intervals[i]).toBeGreaterThanOrEqual(intervals[i - 1]!);
    }
    expect(intervals.at(-1)).toBeGreaterThan(intervals[0]!);
  });
});

describe('SC-005 trên hồ sơ Kanji đại diện – cặp sai ôn sớm hơn cặp đúng ≥ 50%', () => {
  const profiles = loadKanjiProfiles();

  it('có hồ sơ Kanji để kiểm thử', () => {
    expect(profiles.length).toBeGreaterThan(0);
  });

  it.each(profiles.map((p) => [p.id, p] as const))('%s', (_id, profile) => {
    // Mô phỏng 8 chữ × 3 khía cạnh; mỗi vòng ôn xen kẽ đúng/sai theo cặp, 5 lần ôn.
    const items = Array.from({ length: 8 }, (_, i) => `k${i}`);
    const schedules: Schedules = new Map();
    for (const item of items) learn(schedules, item);

    const wrongIntervals: number[] = [];
    const rightIntervals: number[] = [];
    for (let round = 1; round <= 5; round++) {
      items.forEach((item, i) => {
        KANJI_FACETS.forEach((facet, f) => {
          const correct = (i + f + round) % 3 !== 0;
          answer(schedules, item, facet, correct);
          if (round >= 2) {
            (correct ? rightIntervals : wrongIntervals).push(
              schedules.get(keyOf(item, facet))!.intervalDays,
            );
          }
        });
      });
    }
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(wrongIntervals.length).toBeGreaterThan(0);
    expect(rightIntervals.length).toBeGreaterThan(0);
    // Cặp sai luôn quay lại sau 1 ngày; trung bình của cặp đúng dài hơn gấp ≥ 2 lần.
    expect(mean(wrongIntervals)).toBeLessThanOrEqual(mean(rightIntervals) * 0.5);
    // Hồ sơ có tồn đọng ôn Kanji: mỗi mục tồn đọng vẫn tuân quy tắc "sai → 1 ngày".
    for (const entry of profile.reviewBacklog) {
      const prior = nextSrsState(nextSrsState(nextSrsState(null, true, 1), true, 1), true, 1);
      expect(nextSrsState(prior, false, entry.isHard ? 0.4 : 0.8).intervalDays).toBe(1);
    }
  });
});

describe('khóa ghép itemId:facet qua rankDueItems + packReviewBatches', () => {
  const due = (itemId: string, facet: ReviewFacet, daysOverdue: number, isHard = false) => ({
    itemId: keyOf(itemId, facet),
    dueDate: addDays(TODAY, -daysOverdue),
    isHard,
  });

  it('giữ thứ tự quá hạn: mục khó trước, quá hạn lâu nhất trước, rồi theo khóa', () => {
    const ranked = rankDueItems(
      [
        due('k1', 'meaning', 1),
        due('k1', 'reading', 4),
        due('k2', 'word', 2, true),
        due('v1', 'item', 3),
      ],
      TODAY,
    );
    expect(ranked.map((r) => r.itemId)).toEqual([
      keyOf('k2', 'word'),
      keyOf('k1', 'reading'),
      keyOf('v1', 'item'),
      keyOf('k1', 'meaning'),
    ]);
  });

  it('mỗi gói ≤ 15 phút, tôn trọng REVIEW_SECONDS_PER_ITEM và khóa giải mã khứ hồi', () => {
    const keys = Array.from({ length: 90 }, (_, i) =>
      keyOf(`item${String(i % 30).padStart(3, '0')}`, KANJI_FACETS[i % 3]!),
    );
    const unique = [...new Set(keys)];
    for (const minutes of [5, 10, 18, 30]) {
      const batches = packReviewBatches(unique, minutes, SECONDS);
      let total = 0;
      for (const batch of batches) {
        expect(batch.estMinutes).toBeLessThanOrEqual(MAX_ITEM_MINUTES);
        expect(batch.estMinutes).toBe(reviewMinutesFor(batch.itemIds.length, SECONDS));
        total += batch.estMinutes;
        for (const key of batch.itemIds) {
          const pair = decodeReviewKey(key);
          expect(keyOf(pair.itemId, pair.facet)).toBe(key);
        }
      }
      expect(total).toBeLessThanOrEqual(minutes);
    }
  });

  it('khóa của facet item giữ nguyên itemId (SC-006)', () => {
    expect(keyOf('abc', 'item')).toBe('abc');
    expect(decodeReviewKey('abc')).toEqual({ itemId: 'abc', facet: 'item' });
  });
});
