// Chạy báo cáo chỉ số sản phẩm: `pnpm report:metrics [tên_truy_vấn…]` (T119; thêm chỉ số Kanji ở T084, chỉ số lớp học SC-010 ở T129).
// Đọc `product-metrics.sql`, chạy từng khối `-- name:` trên CSDL của DATABASE_URL và in kết quả dạng bảng.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const SQL_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'product-metrics.sql');

export interface ReportQuery {
  name: string;
  sql: string;
}

/** Tách file SQL thành các truy vấn theo dòng `-- name: <tên>`; phần đầu file (chú thích chung) bị bỏ. */
export function parseReportQueries(text: string): ReportQuery[] {
  const queries: ReportQuery[] = [];
  let current: ReportQuery | null = null;
  for (const line of text.split(/\r?\n/)) {
    const header = /^--\s*name:\s*(\S+)\s*$/.exec(line);
    if (header) {
      current = { name: header[1]!, sql: '' };
      queries.push(current);
    } else if (current) {
      current.sql += `${line}\n`;
    }
  }
  return queries.map((q) => ({ ...q, sql: q.sql.trim() }));
}

export async function loadReportQueries(file: string = SQL_FILE): Promise<ReportQuery[]> {
  return parseReportQueries(await readFile(file, 'utf8'));
}

async function main(): Promise<void> {
  const { loadDotEnv } = await import('../config.js');
  loadDotEnv();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('Thiếu biến môi trường DATABASE_URL (xem backend/.env.example)');
  }
  const wanted = process.argv.slice(2);
  const all = await loadReportQueries();
  const selected = wanted.length > 0 ? all.filter((q) => wanted.includes(q.name)) : all;
  if (selected.length === 0) {
    throw new Error(`Không có truy vấn nào khớp. Có sẵn: ${all.map((q) => q.name).join(', ')}`);
  }
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    // Báo cáo chỉ đọc: chặn ghi nhầm ngay ở mức phiên.
    await client.query('SET default_transaction_read_only = on');
    for (const q of selected) {
      console.log(`\n== ${q.name} ==`);
      const { rows } = await client.query(q.sql);
      if (rows.length === 0) console.log('(không có dữ liệu)');
      else console.table(rows);
    }
  } finally {
    await client.end();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
