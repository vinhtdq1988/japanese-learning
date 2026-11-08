import { describe, expect, it } from 'vitest';
import { csvCell, normalizeHeader, parseCsv, toCsv } from '../../src/domain/csv.js';

// Kiểm thử bộ phân tích/ghi CSV (spec 004, T013, research O5, csv-formats.md §1, §3, SC-009).

describe('parseCsv', () => {
  it('đọc file đơn giản, chuẩn hóa tên cột và bí danh', () => {
    const r = parseCsv('Email, Name \nan@example.com,An\nbinh@example.com,Bình\n');
    expect(r.headers).toEqual(['email', 'display_name']);
    expect(r.delimiter).toBe(',');
    expect(r.rows).toEqual([
      ['an@example.com', 'An'],
      ['binh@example.com', 'Bình'],
    ]);
  });

  it('chấp nhận BOM UTF-8 và xuống dòng CRLF', () => {
    const r = parseCsv('﻿email,display_name\r\nan@example.com,An\r\nbinh@example.com,Bình\r\n');
    expect(r.headers).toEqual(['email', 'display_name']);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[1]).toEqual(['binh@example.com', 'Bình']);
  });

  it('xử lý trường bọc nháy kép: dấu phẩy, "" và xuống dòng bên trong', () => {
    const r = parseCsv(
      'email,display_name\nan@example.com,"Trần, Thị ""Bình"""\nc@example.com,"a\nb"\n',
    );
    expect(r.rows[0]).toEqual(['an@example.com', 'Trần, Thị "Bình"']);
    expect(r.rows[1]).toEqual(['c@example.com', 'a\nb']);
  });

  it('tự nhận phân tách ";" từ dòng tiêu đề', () => {
    const r = parseCsv('email;ten_hien_thi\nan@example.com;An\n');
    expect(r.delimiter).toBe(';');
    expect(r.headers).toEqual(['email', 'display_name']);
    expect(r.rows).toEqual([['an@example.com', 'An']]);
  });

  it('không nhầm dấu ";" hay "," bên trong nháy kép của dòng tiêu đề', () => {
    const r = parseCsv('"email,x";"display_name"\na;b\n');
    expect(r.delimiter).toBe(';');
    expect(r.headers).toEqual(['email,x', 'display_name']);
  });

  it('dòng trống bị bỏ qua và không tính là dòng dữ liệu', () => {
    const r = parseCsv('email\n\nan@example.com\n   \n\nbinh@example.com\n\n');
    expect(r.rows).toEqual([['an@example.com'], ['binh@example.com']]);
  });

  it('bù ô thiếu bằng chuỗi rỗng; dòng "," không phải dòng trống', () => {
    const r = parseCsv('email,display_name\nan@example.com\n,\n');
    expect(r.rows).toEqual([
      ['an@example.com', ''],
      ['', ''],
    ]);
  });

  it('đọc tên tiếng Việt và tiếng Nhật nguyên vẹn', () => {
    const r = parseCsv(
      'email,display_name\nsato@example.jp,佐藤 花子\nan@example.com,Nguyễn Văn An\n',
    );
    expect(r.rows.map((x) => x[1])).toEqual(['佐藤 花子', 'Nguyễn Văn An']);
  });

  it('file rỗng hoặc chỉ có dòng trống: không có tiêu đề, không có dòng', () => {
    expect(parseCsv('')).toMatchObject({ headers: [], rows: [] });
    expect(parseCsv('﻿\r\n\r\n')).toMatchObject({ headers: [], rows: [] });
  });

  it('phân biệt đúng 200 và 201 dòng dữ liệu', () => {
    const make = (n: number) =>
      `email\n${Array.from({ length: n }, (_, i) => `u${i}@example.com`).join('\n')}\n`;
    expect(parseCsv(make(200)).rows).toHaveLength(200);
    expect(parseCsv(make(201)).rows).toHaveLength(201);
  });

  it('dòng cuối không có ký tự xuống dòng vẫn được đọc', () => {
    expect(parseCsv('email\nan@example.com').rows).toEqual([['an@example.com']]);
  });
});

describe('normalizeHeader', () => {
  it('hạ chữ thường, cắt khoảng trắng, khoảng trắng/"-" → "_", áp bí danh', () => {
    expect(normalizeHeader('  E-Mail ')).toBe('e_mail');
    expect(normalizeHeader('Display Name')).toBe('display_name');
    expect(normalizeHeader('display-name')).toBe('display_name');
    expect(normalizeHeader('NAME')).toBe('display_name');
    expect(normalizeHeader('ten')).toBe('display_name');
    expect(normalizeHeader('Ten Hien Thi')).toBe('display_name');
    expect(normalizeHeader('cot_la')).toBe('cot_la');
  });
});

describe('csvCell – vô hiệu hóa công thức (SC-009)', () => {
  const attacks = [
    "=cmd|' /C calc'!A0",
    '+1+1',
    '-2+3',
    '@SUM(A1)',
    '\t=1+1',
    '\r=1+1',
    '  =1+1',
    ' \t=1+1',
    '=HYPERLINK("http://x")',
  ];

  it.each(attacks)('thêm tiền tố nháy đơn cho %j', (value) => {
    const cell = csvCell(value);
    const unwrapped = cell.startsWith('"') ? cell.slice(1, -1).replaceAll('""', '"') : cell;
    expect(unwrapped.startsWith("'")).toBe(true);
    expect(unwrapped).toBe(`'${value}`);
  });

  it('ô sau khi phân tích lại không bắt đầu bằng ký tự công thức và còn nguyên nội dung', () => {
    const text = toCsv([['name'], ...attacks.map((a) => [a])]);
    const parsed = parseCsv(text);
    for (const [i, row] of parsed.rows.entries()) {
      const first = row[0]!.trimStart()[0];
      expect(['=', '+', '-', '@', '\t', '\r']).not.toContain(first);
      expect(row[0]).toBe(`'${attacks[i]}`);
    }
  });

  it('chuỗi bắt đầu bằng nháy kép literal không phải công thức và được thoát đúng', () => {
    expect(csvCell('"=1+1"')).toBe('"""=1+1"""');
  });

  it('số ghi thuần kể cả số âm, không tiền tố', () => {
    expect(csvCell(-5)).toBe('-5');
    expect(csvCell(12.5)).toBe('12.5');
    expect(csvCell(0)).toBe('0');
    expect(csvCell(Number.NaN)).toBe('');
  });

  it('chuỗi bình thường, tên tiếng Việt/Nhật không bị đổi', () => {
    expect(csvCell('Nguyễn Văn An')).toBe('Nguyễn Văn An');
    expect(csvCell('佐藤 花子')).toBe('佐藤 花子');
    expect(csvCell('an@example.com')).toBe('an@example.com');
    // Ký tự nguy hiểm không ở đầu thì giữ nguyên.
    expect(csvCell('a=b')).toBe('a=b');
    expect(csvCell('x-y')).toBe('x-y');
  });

  it('bọc nháy kép khi có dấu phẩy, nháy kép hoặc xuống dòng; null/undefined → rỗng', () => {
    expect(csvCell('Trần, Thị')).toBe('"Trần, Thị"');
    expect(csvCell('a"b')).toBe('"a""b"');
    expect(csvCell('a\nb')).toBe('"a\nb"');
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
    expect(csvCell(true)).toBe('true');
  });

  it('tiền tố nháy đơn được thực hiện TRƯỚC khi bọc nháy kép', () => {
    expect(csvCell('=A,B')).toBe(`"'=A,B"`);
  });
});

describe('toCsv', () => {
  it('thêm BOM, dùng CRLF, kết thúc bằng CRLF và chống công thức mọi ô chuỗi', () => {
    const text = toCsv([
      ['display_name', 'minutes'],
      ['=1+1', -3],
    ]);
    expect(text.startsWith('﻿')).toBe(true);
    expect(text).toBe("﻿display_name,minutes\r\n'=1+1,-3\r\n");
  });

  it('ghi rồi đọc lại cho kết quả giống ban đầu (không công thức)', () => {
    const rows = [
      ['email', 'display_name'],
      ['an@example.com', 'Trần, "Bình"'],
      ['c@example.com', '佐藤'],
    ];
    const parsed = parseCsv(toCsv(rows));
    expect(parsed.headers).toEqual(['email', 'display_name']);
    expect(parsed.rows).toEqual(rows.slice(1));
  });
});
