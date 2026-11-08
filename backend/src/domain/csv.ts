// Phân tích và ghi CSV tối thiểu cho nhập danh sách học viên và xuất báo cáo lớp (spec 004,
// research O5, contracts/csv-formats.md §1, §3). Tự cài để không thêm phụ thuộc và kiểm soát chính xác
// phần chống công thức (CSV injection) và BOM.

/** Một bảng CSV đã phân tích: tiêu đề đã chuẩn hóa và các dòng dữ liệu (không gồm dòng trống). */
export interface ParsedCsv {
  /** Tên cột đã chuẩn hóa (hạ chữ thường, cắt khoảng trắng, khoảng trắng/`-` → `_`, bí danh → chuẩn). */
  headers: string[];
  /** Dấu phân tách được nhận diện từ dòng tiêu đề. */
  delimiter: ',' | ';';
  /** Mỗi dòng dữ liệu theo thứ tự; trường thiếu được bù chuỗi rỗng cho đủ số cột. */
  rows: string[][];
}

const BOM = '﻿';

/** Bí danh tên cột → tên chuẩn (csv-formats.md §1). */
const HEADER_ALIASES: Record<string, string> = {
  name: 'display_name',
  ten: 'display_name',
  ten_hien_thi: 'display_name',
};

/** Chuẩn hóa tên cột: hạ chữ thường, cắt khoảng trắng đầu/cuối, khoảng trắng/`-` → `_`, áp bí danh. */
export function normalizeHeader(raw: string): string {
  const key = raw
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  return HEADER_ALIASES[key] ?? key;
}

/** Tách văn bản thành các bản ghi theo RFC 4180 (nháy kép, `""`, CRLF/LF, xuống dòng trong trường bọc nháy). */
function splitRecords(text: string, delimiter: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let inQuotes = false;
  let fieldWasQuoted = false;

  const endField = () => {
    record.push(field);
    field = '';
    fieldWasQuoted = false;
  };
  const endRecord = () => {
    endField();
    records.push(record);
    record = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"' && field === '' && !fieldWasQuoted) {
      inQuotes = true;
      fieldWasQuoted = true;
    } else if (ch === delimiter) {
      endField();
    } else if (ch === '\r') {
      if (text[i + 1] === '\n') i++;
      endRecord();
    } else if (ch === '\n') {
      endRecord();
    } else {
      field += ch;
    }
  }
  // Bản ghi cuối không có ký tự xuống dòng kết thúc.
  if (field !== '' || fieldWasQuoted || record.length > 0) endRecord();
  return records;
}

/** Đoán dấu phân tách từ dòng tiêu đề (dòng đầu tiên): `;` nếu nhiều `;` hơn `,` ngoài nháy kép. */
function detectDelimiter(text: string): ',' | ';' {
  let commas = 0;
  let semicolons = 0;
  let inQuotes = false;
  for (const ch of text) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes) {
      if (ch === '\n' || ch === '\r') break;
      if (ch === ',') commas++;
      else if (ch === ';') semicolons++;
    }
  }
  return semicolons > commas ? ';' : ',';
}

/**
 * Phân tích CSV tối thiểu: chấp nhận BOM UTF-8, CRLF/LF, trường bọc nháy kép với `""`, tự nhận phân tách
 * `,` hoặc `;` từ dòng tiêu đề, bỏ dòng trống. Dòng trống KHÔNG tính là dòng dữ liệu. Văn bản rỗng (hoặc
 * chỉ có dòng trống) trả `headers = []` và `rows = []`.
 */
export function parseCsv(input: string): ParsedCsv {
  const text = input.startsWith(BOM) ? input.slice(1) : input;
  const delimiter = detectDelimiter(text);
  const records = splitRecords(text, delimiter).filter(
    (r) => !(r.length === 1 && r[0]!.trim() === ''),
  );
  const [headerRecord, ...dataRecords] = records;
  if (!headerRecord) return { headers: [], delimiter, rows: [] };
  const headers = headerRecord.map(normalizeHeader);
  const rows = dataRecords.map((r) => {
    const padded = [...r];
    while (padded.length < headers.length) padded.push('');
    return padded;
  });
  return { headers, delimiter, rows };
}

/** Ký tự đầu (sau khi cắt khoảng trắng) khiến bảng tính hiểu ô là công thức (OWASP CSV Injection). */
const FORMULA_TRIGGERS = new Set(['=', '+', '-', '@', '\t', '\r']);

/** Chuỗi có thể bị bảng tính hiểu là công thức, kể cả khi ký tự nguy hiểm đứng sau khoảng trắng đầu. */
function looksLikeFormula(value: string): boolean {
  // Ký tự nguy hiểm là tab/CR phải xét trước khi cắt khoảng trắng (trim sẽ bỏ chúng).
  if (value.length > 0 && FORMULA_TRIGGERS.has(value[0]!)) return true;
  const trimmed = value.trimStart();
  return trimmed.length > 0 && FORMULA_TRIGGERS.has(trimmed[0]!);
}

/**
 * Định dạng một ô CSV (csv-formats.md §3): số ghi thuần (kể cả số âm); chuỗi có ký tự đầu thuộc
 * `= + - @ \t \r` (sau khi bỏ khoảng trắng đầu) được thêm tiền tố `'` rồi mới bọc nháy kép; ô có `,` `"` hoặc
 * xuống dòng được bọc nháy kép. `null`/`undefined` ghi ô rỗng.
 */
export function csvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  const safe = looksLikeFormula(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/** Ghi bảng CSV: BOM UTF-8 (Excel hiển thị đúng tiếng Việt/Nhật), phân tách `,`, xuống dòng CRLF. */
export function toCsv(
  rows: ReadonlyArray<ReadonlyArray<string | number | boolean | null | undefined>>,
): string {
  return `${BOM}${rows.map((r) => r.map(csvCell).join(',')).join('\r\n')}\r\n`;
}
