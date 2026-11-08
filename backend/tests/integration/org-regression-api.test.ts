import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { captureAllProfiles, type ApiSnapshot } from '../fixtures/golden/api-snapshot.js';
import { requireDatabaseUrl } from './helpers.js';

// Hồi quy SC-012 / FR-041 ở MỨC DỊCH VỤ (spec 004, T063): sau khi mọi dịch vụ chuyển sang
// `resolveLearningContext`, phản hồi `GET /path`, `GET /progress`, `GET /today` ngày đầu của người học KHÔNG
// thuộc lớp phải giống hệt ảnh chụp `api-pre-org.json` (T002, sinh từ mã chưa sửa). Chỉ có MỘT khác biệt được
// phép là khóa bổ sung `source` ở `GET /path` (trường tùy chọn mới của hợp đồng 1.12.0, giá trị `personal`).

const GOLDEN = JSON.parse(
  readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), '../fixtures/golden/api-pre-org.json'),
    'utf8',
  ),
) as { profiles: ApiSnapshot };

describe('hồi quy golden dịch vụ: người học không thuộc lớp không đổi gì', () => {
  it('GET /path, /progress, /today ngày đầu giống hệt ảnh chụp trước thay đổi', async () => {
    const actual = await captureAllProfiles(requireDatabaseUrl());
    expect(Object.keys(actual).sort()).toEqual(Object.keys(GOLDEN.profiles).sort());
    for (const [id, snap] of Object.entries(actual)) {
      const body = snap.path.body as Record<string, unknown> | undefined;
      if (snap.path.status === 200 && body) {
        expect(body.source, `${id}: nguồn lộ trình`).toBe('personal');
        delete body.source;
      }
      expect(snap, id).toEqual(GOLDEN.profiles[id]);
    }
  }, 240_000);
});
