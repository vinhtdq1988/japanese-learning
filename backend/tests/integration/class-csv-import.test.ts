/* eslint-disable @typescript-eslint/no-explicit-any */
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { invitations } from '../../src/db/schema.js';
import { CSV_OUTCOMES } from '../../src/domain/org-types.js';
import { ContractClient } from '../contract/client.js';
import { createTestApp, type TestApp } from './helpers.js';
import {
  addOrgRole,
  createTestClass,
  createTestOrg,
  createTestUser,
  enrollLearner,
  tokenFor,
} from './org-helpers.js';

// Kiểm thử nhập CSV (spec 004, T047, FR-013, contracts/csv-formats.md §1): giới hạn dòng/kích thước, đúng một
// kết quả cho mỗi dòng, đủ 8 outcome theo thứ tự ưu tiên, hết seat ở dòng k, nhập đồng thời.

let ctx: TestApp;
let api: ContractClient;

beforeAll(async () => {
  ctx = await createTestApp({}, { CSV_IMPORT_MAX_ROWS: '200', CSV_IMPORT_MAX_BYTES: '20000' });
  api = new ContractClient(ctx.app);
});
afterAll(async () => {
  await ctx.close();
});

async function setup(seatCount: number) {
  const org = await createTestOrg(ctx, { seats: seatCount });
  const teacher = await createTestUser(ctx);
  await addOrgRole(ctx, org.orgId, teacher.userId, { teacher: true });
  const { classId } = await createTestClass(ctx, org.orgId, { teacherIds: [teacher.userId] });
  return { org, teacher, classId, token: await tokenFor(ctx, teacher) };
}

const importCsv = (classId: string, token: string, body: string) =>
  api.raw('POST', `/classes/${classId}/invitations/import`, {
    token,
    headers: { 'content-type': 'text/csv; charset=utf-8' },
    body,
  });

const pendingCount = async (orgId: string) =>
  (await ctx.handle.db.select().from(invitations).where(eq(invitations.organizationId, orgId)))
    .length;

describe('giới hạn toàn file → 422, không tạo lời mời nào', () => {
  it('201 dòng bị từ chối, 200 dòng được chấp nhận (dòng trống không tính)', async () => {
    const { org, classId, token } = await setup(400);
    const rows = (n: number) =>
      ['email', ...Array.from({ length: n }, (_, i) => `hv${i}@example.com`), '', ''].join('\r\n');

    const tooMany = await importCsv(classId, token, rows(201));
    expect(tooMany.status).toBe(422);
    expect(await pendingCount(org.orgId)).toBe(0);

    const ok = await importCsv(classId, token, rows(200));
    expect(ok.status).toBe(200);
    expect(JSON.parse(ok.text).results).toHaveLength(200);
  });

  it('quá CSV_IMPORT_MAX_BYTES và thiếu cột email → 422', async () => {
    const { org, classId, token } = await setup(5);
    const big = `email\r\n${'a'.repeat(21_000)}@example.com\r\n`;
    expect((await importCsv(classId, token, big)).status).toBe(422);
    const noEmail = await importCsv(classId, token, 'name,phone\r\nAn,0123\r\n');
    expect(noEmail.status).toBe(422);
    expect(JSON.parse(noEmail.text).fields).toHaveProperty('file');
    expect(await pendingCount(org.orgId)).toBe(0);
  });
});

describe('mỗi dòng đúng một outcome', () => {
  it('đủ 8 outcome, tổng kết quả = số dòng dữ liệu, đúng thứ tự ưu tiên', async () => {
    const { org, classId, teacher, token } = await setup(6);
    // 5 seat học viên còn lại (giáo viên giữ 1).
    const { classId: otherClass } = await createTestClass(ctx, org.orgId, {});
    const inClass = await createTestUser(ctx);
    await enrollLearner(ctx, org.orgId, classId, inClass.userId);
    const inOther = await createTestUser(ctx);
    await enrollLearner(ctx, org.orgId, otherClass, inOther.userId);
    const foreignOrg = await createTestOrg(ctx, { seats: 2 });
    const foreign = await createTestUser(ctx);
    await addOrgRole(ctx, foreignOrg.orgId, foreign.userId, { teacher: true });
    const earlier = await createTestUser(ctx);
    await importCsv(classId, token, `email\r\n${earlier.email}\r\n`); // → đã có lời mời chờ
    // Tới đây: giáo viên 1 + inClass 1 + inOther 1 + lời mời earlier 1 = 4 seat; còn 2.

    const csv = [
      'Email;Tên',
      `${inClass.email};Đã trong lớp`,
      `${inOther.email};Lớp khác`,
      `${foreign.email};Tổ chức khác`,
      `${teacher.email};Giáo viên phụ trách`,
      `${earlier.email};Đã mời`,
      'khong-hop-le;Sai',
      'moi1@example.com;Một',
      'moi1@example.com;Trùng trong file',
      'moi2@example.com;Hai',
      'het-cho@example.com;Hết chỗ',
    ].join('\r\n');
    const res = await importCsv(classId, token, csv);
    expect(res.status).toBe(200);
    const body = JSON.parse(res.text);
    expect(body.results.map((r: any) => r.outcome)).toEqual([
      'already_in_class',
      'already_in_other_class',
      'unavailable',
      'unavailable',
      'already_invited',
      'invalid_email',
      'invited',
      'duplicate_in_file',
      'invited',
      'no_seat',
    ]);
    expect(body.results.map((r: any) => r.row)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const sum = Object.entries(body.summary)
      .filter(([k]) => k !== 'total')
      .reduce((n, [, v]) => n + (v as number), 0);
    expect(body.summary.total).toBe(10);
    expect(sum).toBe(10);
    for (const r of body.results) expect(CSV_OUTCOMES).toContain(r.outcome);
  });

  it('hết seat ở dòng k ⇒ các dòng hợp lệ sau đó nhận no_seat', async () => {
    const { classId, token } = await setup(3); // giáo viên 1 + 2 chỗ
    const csv = ['email', 'a@example.com', 'b@example.com', 'c@example.com', 'd@example.com'].join(
      '\r\n',
    );
    const body = JSON.parse((await importCsv(classId, token, csv)).text);
    expect(body.results.map((r: any) => r.outcome)).toEqual([
      'invited',
      'invited',
      'no_seat',
      'no_seat',
    ]);
  });

  it('nhận tên tiếng Việt/Nhật và trường bọc nháy có dấu phẩy; tên lưu làm gợi ý', async () => {
    const { org, classId, token } = await setup(6);
    const csv =
      '﻿email,display_name\r\nan@example.com,Nguyễn Văn An\r\nbinh@example.com,"Trần, Thị Bình"\r\nsato@example.jp,佐藤 花子\r\n';
    const body = JSON.parse((await importCsv(classId, token, csv)).text);
    expect(body.summary).toMatchObject({ total: 3, invited: 3 });
    const rows = await ctx.handle.db
      .select()
      .from(invitations)
      .where(eq(invitations.organizationId, org.orgId));
    expect(rows.map((r) => r.displayNameHint).sort()).toEqual(
      ['Nguyễn Văn An', 'Trần, Thị Bình', '佐藤 花子'].sort(),
    );
  });
});

describe('đồng thời', () => {
  it('hai lần nhập song song không vượt sức chứa', async () => {
    const { org, classId, token } = await setup(5); // giáo viên 1 + 4 chỗ
    const csv = (prefix: string) =>
      ['email', ...Array.from({ length: 4 }, (_, i) => `${prefix}${i}@example.com`)].join('\r\n');
    const [a, b] = await Promise.all([
      importCsv(classId, token, csv('song-a')),
      importCsv(classId, token, csv('song-b')),
    ]);
    const invited = [a, b]
      .flatMap((r) => JSON.parse(r.text).results)
      .filter((r: any) => r.outcome === 'invited');
    expect(invited).toHaveLength(4);
    expect(await pendingCount(org.orgId)).toBe(4);
  });
});
