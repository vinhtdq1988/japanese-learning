import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLearnerProfiles } from '../learner-profiles/index.js';
import { loadSimCatalog, simulatePlans, SIMULATION_DAYS } from './simulate-plans.js';

// Sinh ảnh chụp golden kế hoạch 14 ngày của mọi hồ sơ đại diện CŨ (không chọn Kanji) – T001, SC-006.
// PHẢI chạy trên mã engine CHƯA thêm `applyKanjiSlot`; kết quả là chuẩn so sánh cho kiểm thử hồi quy
// `tests/unit/kanji-regression-golden.test.ts`. Không chạy lại sau khi engine đã đổi, trừ khi chủ ý cập
// nhật chuẩn (khi đó mọi khác biệt cần được duyệt).
//
// Chạy: cd backend && pnpm exec tsx tests/fixtures/golden/generate-plans-pre-kanji.ts

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, 'plans-pre-kanji.json');

// Danh mục mô phỏng không gồm đơn vị Kanji để ảnh chụp không phụ thuộc thư viện Kanji thêm sau.
const catalog = loadSimCatalog(false);
const profiles: Record<string, ReturnType<typeof simulatePlans>> = {};
for (const f of loadLearnerProfiles()) {
  profiles[f.id] = simulatePlans(f, { catalog });
}

const snapshot = { days: SIMULATION_DAYS, profiles };
writeFileSync(OUT, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
console.log(`Đã ghi ${Object.keys(profiles).length} hồ sơ × ${SIMULATION_DAYS} ngày vào ${OUT}`);
