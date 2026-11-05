import { describe, expect, it } from 'vitest';
import { decodeReviewKey, encodeReviewKey } from '../../src/domain/review-key.js';
import { REVIEW_FACETS } from '../../src/domain/types.js';

// Kiểm thử khóa ghép ôn tập itemId[:facet] (T011, research K3).

const ITEM_ID = '6f1f6a4e-5b0e-4f55-9d0e-0a3c3f0f9a11';

describe('review-key', () => {
  it.each(REVIEW_FACETS)('khứ hồi mã hóa/giải mã cho facet %s', (facet) => {
    expect(decodeReviewKey(encodeReviewKey(ITEM_ID, facet))).toEqual({ itemId: ITEM_ID, facet });
  });

  it('khóa của facet item đúng bằng itemId (bảo đảm SC-006)', () => {
    expect(encodeReviewKey(ITEM_ID, 'item')).toBe(ITEM_ID);
  });

  it('facet Kanji tạo khóa itemId:facet', () => {
    expect(encodeReviewKey(ITEM_ID, 'reading')).toBe(`${ITEM_ID}:reading`);
  });

  it('khóa không có dấu hai chấm giải mã thành facet item', () => {
    expect(decodeReviewKey(ITEM_ID)).toEqual({ itemId: ITEM_ID, facet: 'item' });
  });

  it('từ chối facet lạ', () => {
    expect(() => decodeReviewKey(`${ITEM_ID}:writing`)).toThrow(/Khía cạnh/);
    expect(() => decodeReviewKey(`${ITEM_ID}:`)).toThrow();
  });
});
