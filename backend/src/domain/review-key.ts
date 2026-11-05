import { REVIEW_FACETS, type ReviewFacet } from './types.js';

// Khóa ghép ôn tập (research K3): engine ôn tập (`rankDueItems`, `packReviewBatches`) làm việc trên chuỗi
// định danh nên dịch vụ mã hóa cặp (mục, khía cạnh) thành một khóa duy nhất. Khía cạnh `item` (từ vựng,
// ngữ pháp) giữ nguyên `itemId` → với người học không có Kanji mọi khóa không đổi, kế hoạch giống hệt (SC-006).

const SEPARATOR = ':';

/** Cặp (mục, khía cạnh) – đơn vị của lịch ôn. */
export interface ReviewPair {
  itemId: string;
  facet: ReviewFacet;
}

/** `itemId` khi facet `item`, `itemId:facet` với các khía cạnh khác. */
export function encodeReviewKey(itemId: string, facet: ReviewFacet): string {
  return facet === 'item' ? itemId : `${itemId}${SEPARATOR}${facet}`;
}

/** Giải mã khóa ghép; khóa không có `:` là khía cạnh `item`. Ném lỗi với khía cạnh không hợp lệ. */
export function decodeReviewKey(key: string): ReviewPair {
  const at = key.indexOf(SEPARATOR);
  if (at < 0) return { itemId: key, facet: 'item' };
  const itemId = key.slice(0, at);
  const facet = key.slice(at + 1);
  if (!(REVIEW_FACETS as readonly string[]).includes(facet)) {
    throw new Error(`Khía cạnh ôn tập không hợp lệ: "${facet}"`);
  }
  return { itemId, facet: facet as ReviewFacet };
}
