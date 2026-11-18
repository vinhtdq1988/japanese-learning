import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { contentItems } from '../../src/db/schema.js';
import { seedContent } from '../../src/seed/index.js';
import { createTestApp, type TestApp } from '../integration/helpers.js';
import { ContractClient, registerUser } from './client.js';

// Kiểm thử hợp đồng `GET /lookup` (popup furigana bài luyện đọc, OpenAPI 1.16.0): phản hồi đối chiếu
// `openapi.yaml`; chữ Kanji và từ vựng lấy từ nội dung đã seed.

let ctx: TestApp;
let api: ContractClient;

beforeAll(async () => {
  ctx = await createTestApp();
  await seedContent(ctx.handle.db);
  api = new ContractClient(ctx.app);
});
afterAll(async () => {
  await ctx.close();
});

describe('GET /lookup', () => {
  it('trả chữ Kanji trong cụm kèm nghĩa và âm đọc', async () => {
    const [kanjiRow] = await ctx.handle.db
      .select()
      .from(contentItems)
      .where(and(eq(contentItems.kind, 'kanji'), eq(contentItems.status, 'active')))
      .limit(1);
    expect(kanjiRow).toBeDefined();
    const user = await registerUser(api);
    const res = await api.get(`/lookup?terms=${encodeURIComponent(kanjiRow!.japanese)}`, {
      token: user.accessToken,
    });
    expect(res.status).toBe(200);
    const found = res.body.kanji.find((k: { char: string }) => k.char === kanjiRow!.japanese);
    expect(found).toBeDefined();
    expect(found.meaning).not.toBe('');
    expect(Array.isArray(found.onReadings)).toBe(true);
    expect(Array.isArray(found.kunReadings)).toBe(true);
  });

  it('trả từ vựng trùng khít kèm cách đọc', async () => {
    const [vocabRow] = await ctx.handle.db
      .select()
      .from(contentItems)
      .where(and(eq(contentItems.kind, 'vocabulary'), eq(contentItems.status, 'active')))
      .limit(1);
    expect(vocabRow).toBeDefined();
    const user = await registerUser(api);
    const res = await api.get(`/lookup?terms=${encodeURIComponent(vocabRow!.japanese)}`, {
      token: user.accessToken,
    });
    expect(res.status).toBe(200);
    const word = res.body.words.find((w: { term: string }) => w.term === vocabRow!.japanese);
    expect(word).toBeDefined();
    expect(word.meaning).not.toBe('');
  });

  it('cụm không có trong thư viện → 200 với mảng rỗng', async () => {
    const user = await registerUser(api);
    const res = await api.get(`/lookup?terms=${encodeURIComponent('abc')}`, {
      token: user.accessToken,
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ words: [], kanji: [] });
  });

  it('thiếu terms hoặc quá 60 cụm → 422', async () => {
    const user = await registerUser(api);
    const missing = await api.get('/lookup', { token: user.accessToken });
    expect(missing.status).toBe(422);
    const many = Array.from({ length: 61 }, (_, i) => `語${i}`).join(',');
    const tooMany = await api.get(`/lookup?terms=${encodeURIComponent(many)}`, {
      token: user.accessToken,
    });
    expect(tooMany.status).toBe(422);
  });

  it('không token → 401', async () => {
    const res = await api.get('/lookup?terms=%E6%97%A5', { validateResponse: false });
    expect(res.status).toBe(401);
  });
});
