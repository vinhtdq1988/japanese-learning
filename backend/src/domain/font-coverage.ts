import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Kiểm tra phủ glyph của phông đóng gói cho client (research K9, FR-006): đọc bảng `cmap` của
// `client/assets/fonts/NotoSansJP.ttf` để biết ký tự nào có glyph, chặn nội dung chứa chữ thiếu glyph
// (hiển thị thành ô vuông) trước khi tới người học. Không thêm phụ thuộc: chỉ đọc cmap định dạng 4 và 12.

/** Đường dẫn phông mặc định (cũng đúng trong image Docker: `client/assets/fonts` nằm cạnh `dist/`). */
export const DEFAULT_FONT_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../client/assets/fonts/NotoSansJP.ttf',
);

/** Tìm bảng `tag` trong thư mục bảng của file sfnt; trả [offset, length] hoặc null. */
function findTable(view: DataView, tag: string): [number, number] | null {
  const numTables = view.getUint16(4);
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    let name = '';
    for (let k = 0; k < 4; k++) name += String.fromCharCode(view.getUint8(rec + k));
    if (name === tag) return [view.getUint32(rec + 8), view.getUint32(rec + 12)];
  }
  return null;
}

/** Cmap định dạng 4 (BMP): thêm mọi code point có glyph khác 0 vào `out`. */
function readFormat4(view: DataView, offset: number, out: Set<number>): void {
  const segCount = view.getUint16(offset + 6) / 2;
  const endBase = offset + 14;
  const startBase = endBase + segCount * 2 + 2; // bỏ qua reservedPad
  const deltaBase = startBase + segCount * 2;
  const rangeBase = deltaBase + segCount * 2;
  for (let s = 0; s < segCount; s++) {
    const end = view.getUint16(endBase + s * 2);
    const start = view.getUint16(startBase + s * 2);
    const delta = view.getInt16(deltaBase + s * 2);
    const rangeOffset = view.getUint16(rangeBase + s * 2);
    for (let code = start; code <= end && code !== 0xffff; code++) {
      let glyph: number;
      if (rangeOffset === 0) {
        glyph = (code + delta) & 0xffff;
      } else {
        const at = rangeBase + s * 2 + rangeOffset + (code - start) * 2;
        if (at + 2 > view.byteLength) continue;
        const raw = view.getUint16(at);
        glyph = raw === 0 ? 0 : (raw + delta) & 0xffff;
      }
      if (glyph !== 0) out.add(code);
    }
  }
}

/** Cmap định dạng 12 (toàn Unicode): thêm mọi code point có glyph khác 0 vào `out`. */
function readFormat12(view: DataView, offset: number, out: Set<number>): void {
  const numGroups = view.getUint32(offset + 12);
  for (let g = 0; g < numGroups; g++) {
    const at = offset + 16 + g * 12;
    const start = view.getUint32(at);
    const end = view.getUint32(at + 4);
    const startGlyph = view.getUint32(at + 8);
    for (let code = start; code <= end; code++) {
      if (startGlyph + (code - start) !== 0) out.add(code);
    }
  }
}

/** Tập code point có glyph trong phông TrueType/OpenType `data` (đọc mọi subtable cmap định dạng 4 và 12). */
export function readCmapCodePoints(data: Uint8Array): Set<number> {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const table = findTable(view, 'cmap');
  if (!table) throw new Error('Phông không có bảng cmap');
  const [cmapOffset] = table;
  const numSubtables = view.getUint16(cmapOffset + 2);
  const out = new Set<number>();
  const seen = new Set<number>();
  for (let i = 0; i < numSubtables; i++) {
    const subOffset = cmapOffset + view.getUint32(cmapOffset + 4 + i * 8 + 4);
    if (seen.has(subOffset)) continue;
    seen.add(subOffset);
    const format = view.getUint16(subOffset);
    if (format === 4) readFormat4(view, subOffset, out);
    else if (format === 12) readFormat12(view, subOffset, out);
  }
  return out;
}

let cached: { fontPath: string; codePoints: Set<number> } | null = null;

/** Nạp (một lần, lưu bộ nhớ) tập code point của phông tại `fontPath`. */
export function loadFontCoverage(fontPath: string = DEFAULT_FONT_PATH): Set<number> {
  if (cached?.fontPath === fontPath) return cached.codePoints;
  const codePoints = readCmapCodePoints(readFileSync(fontPath));
  cached = { fontPath, codePoints };
  return codePoints;
}

/**
 * Các ký tự trong `text` không có glyph trong phông (không trùng lặp, theo thứ tự xuất hiện). Bỏ qua ký
 * tự điều khiển (xuống dòng, tab) và biến thể/selector không in ra.
 */
export function findMissingGlyphs(text: string, fontPath: string = DEFAULT_FONT_PATH): string[] {
  const covered = loadFontCoverage(fontPath);
  const missing: string[] = [];
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (code < 0x20 || (code >= 0x7f && code < 0xa0)) continue;
    if (code >= 0xfe00 && code <= 0xfe0f) continue; // variation selectors
    if (!covered.has(code) && !missing.includes(ch)) missing.push(ch);
  }
  return missing;
}
