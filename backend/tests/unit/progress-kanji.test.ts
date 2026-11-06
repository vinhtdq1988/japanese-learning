import { describe, expect, it } from 'vitest';
import { allocateKanjiSeconds } from '../../src/engine/progress.js';

// Kiểm thử hàm phân bổ thời gian phiên ôn hỗn hợp cho Kanji (T067, research K8, FR-017).

describe('allocateKanjiSeconds', () => {
  it('phiên không có câu lượt chính nào → 0 phút', () => {
    expect(allocateKanjiSeconds(600, 0, 0)).toBe(0);
    expect(allocateKanjiSeconds(0, 0, 0)).toBe(0);
  });

  it('phiên không có câu Kanji → 0', () => {
    expect(allocateKanjiSeconds(600, 0, 10)).toBe(0);
  });

  it('phiên toàn Kanji → toàn bộ thời gian', () => {
    expect(allocateKanjiSeconds(600, 12, 12)).toBe(600);
  });

  it('phiên hỗn hợp → theo tỷ lệ câu Kanji / tổng câu', () => {
    expect(allocateKanjiSeconds(600, 3, 12)).toBe(150);
    expect(allocateKanjiSeconds(480, 2, 8)).toBe(120);
    expect(allocateKanjiSeconds(100, 1, 3)).toBeCloseTo(33.333, 2);
  });

  it('không bao giờ vượt thời gian phiên dù dữ liệu đếm lệch', () => {
    expect(allocateKanjiSeconds(300, 9, 6)).toBe(300);
  });

  it('thời gian âm hoặc bằng 0 → 0', () => {
    expect(allocateKanjiSeconds(-5, 3, 6)).toBe(0);
    expect(allocateKanjiSeconds(0, 3, 6)).toBe(0);
  });
});
