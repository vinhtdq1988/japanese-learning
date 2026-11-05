import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FONT_PATH,
  findMissingGlyphs,
  loadFontCoverage,
  readCmapCodePoints,
} from '../../src/domain/font-coverage.js';

// Kiểm thử phủ glyph (T018, research K9, FR-006): bộ đọc cmap trên phông thật và trên phông tổng hợp.

/** 27 chữ Kanji của thư viện ban đầu (research K14). */
const LIBRARY_KANJI = '一二三四五六七八日月年時体首顔空海林森風職給務政経済民';
const KANA =
  'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんアイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';

describe('phủ glyph của phông Noto Sans JP đóng gói', () => {
  it('có glyph cho 27 chữ Kanji của thư viện ban đầu', () => {
    expect([...LIBRARY_KANJI]).toHaveLength(27);
    expect(findMissingGlyphs(LIBRARY_KANJI)).toEqual([]);
  });

  it('có glyph cho kana thông dụng và dấu câu tiếng Nhật', () => {
    expect(findMissingGlyphs(KANA)).toEqual([]);
    expect(findMissingGlyphs('「三月」です。ー、')).toEqual([]);
  });

  it('báo thiếu ký tự ngoài phông (CJK Extension B), không trùng lặp, đúng thứ tự', () => {
    expect(findMissingGlyphs('日\u{20000}月\u{20000}\u{2A6D6}')).toEqual([
      '\u{20000}',
      '\u{2A6D6}',
    ]);
  });

  it('bỏ qua ký tự điều khiển như xuống dòng', () => {
    expect(findMissingGlyphs('日\n月\t')).toEqual([]);
  });

  it('tập code point được lưu bộ nhớ (cùng một đối tượng ở lần gọi sau)', () => {
    expect(loadFontCoverage(DEFAULT_FONT_PATH)).toBe(loadFontCoverage(DEFAULT_FONT_PATH));
  });
});

// --- Phông tổng hợp: kiểm bộ đọc cmap định dạng 4 và 12 ---

const u16 = (v: number) => [(v >> 8) & 0xff, v & 0xff];
const u32 = (v: number) => [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff];

/** Dựng file sfnt tối thiểu chỉ gồm bảng cmap với các subtable cho trước. */
function buildFont(subtables: number[][]): Uint8Array {
  const header = [...u32(0x00010000), ...u16(1), ...u16(0), ...u16(0), ...u16(0)];
  const cmapOffset = 12 + 16;
  const tag = [...'cmap'].map((c) => c.charCodeAt(0));
  const cmapHeader = [...u16(0), ...u16(subtables.length)];
  let subOffset = 4 + subtables.length * 8;
  const records: number[] = [];
  for (const sub of subtables) {
    records.push(...u16(3), ...u16(10), ...u32(subOffset));
    subOffset += sub.length;
  }
  const cmap = [...cmapHeader, ...records, ...subtables.flat()];
  const dir = [...tag, ...u32(0), ...u32(cmapOffset), ...u32(cmap.length)];
  return Uint8Array.from([...header, ...dir, ...cmap]);
}

/** Subtable định dạng 4 với hai đoạn: [0x41..0x43] (idDelta) và [0x3042..0x3043] (idRangeOffset + glyphIdArray). */
function format4(): number[] {
  const segCount = 3; // gồm đoạn kết thúc 0xFFFF
  const ends = [0x43, 0x3043, 0xffff];
  const starts = [0x41, 0x3042, 0xffff];
  const deltas = [-0x40, 0, 1];
  // Đoạn 2 dùng idRangeOffset: glyphIdArray = [5, 0] → 0x3042 có glyph, 0x3043 thiếu (glyph 0).
  const rangeOffsets = [0, (segCount - 1) * 2, 0];
  const body = [
    ...u16(segCount * 2),
    ...u16(0),
    ...u16(0),
    ...u16(0),
    ...ends.flatMap(u16),
    ...u16(0),
    ...starts.flatMap(u16),
    ...deltas.flatMap((d) => u16(d & 0xffff)),
    ...rangeOffsets.flatMap(u16),
    ...u16(5),
    ...u16(0),
  ];
  return [...u16(4), ...u16(6 + body.length), ...u16(0), ...body];
}

/** Subtable định dạng 12 với nhóm [0x20000..0x20002] bắt đầu từ glyph 10. */
function format12(): number[] {
  const groups = [...u32(0x20000), ...u32(0x20002), ...u32(10)];
  return [...u16(12), ...u16(0), ...u32(16 + groups.length), ...u32(0), ...u32(1), ...groups];
}

describe('readCmapCodePoints – cmap định dạng 4 và 12', () => {
  it('đọc định dạng 4 gồm cả đoạn dùng idRangeOffset (glyph 0 coi như thiếu)', () => {
    const cps = readCmapCodePoints(buildFont([format4()]));
    expect([...cps].sort((a, b) => a - b)).toEqual([0x41, 0x42, 0x43, 0x3042]);
  });

  it('đọc định dạng 12 (ngoài BMP)', () => {
    const cps = readCmapCodePoints(buildFont([format12()]));
    expect([...cps].sort((a, b) => a - b)).toEqual([0x20000, 0x20001, 0x20002]);
  });

  it('hợp nhất nhiều subtable', () => {
    const cps = readCmapCodePoints(buildFont([format4(), format12()]));
    expect(cps.has(0x41)).toBe(true);
    expect(cps.has(0x20001)).toBe(true);
    expect(cps.has(0x3043)).toBe(false);
  });

  it('ném lỗi khi phông không có bảng cmap', () => {
    const noTables = Uint8Array.from([
      ...u32(0x00010000),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u16(0),
    ]);
    expect(() => readCmapCodePoints(noTables)).toThrow(/cmap/);
  });
});
