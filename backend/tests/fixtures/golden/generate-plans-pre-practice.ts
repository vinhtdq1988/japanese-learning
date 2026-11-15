import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLearnerProfiles } from '../learner-profiles/index.js';
import { kanjiSlot } from './kanji-slot.js';
import { loadSimCatalog, simulatePlans, SIMULATION_DAYS } from './simulate-plans.js';

// Sinh ảnh chụp golden kế hoạch 14 ngày của mọi hồ sơ đại diện CŨ trước khi thêm luyện đọc/luyện viết
// (spec 007, T002/T003, bất biến I2: người không chọn luyện ⇒ kế hoạch giống hệt). PHẢI chạy trên mã engine
// CHƯA thêm `applyPracticeSlot`; kết quả là chuẩn so sánh cho kiểm thử hồi quy
// `tests/unit/practice-regression-golden.test.ts`. KHÔNG chạy lại sau khi engine đã đổi, trừ khi chủ ý cập
// nhật chuẩn (khi đó mọi khác biệt cần được duyệt).
// `loadLearnerProfiles()` không gồm hồ sơ `practice-*`, `competency-*`, `encouragement-*` (T014) nên tập
// hồ sơ ở đây không bị lệch.
//
// Chạy: cd backend && pnpm exec tsx tests/fixtures/golden/generate-plans-pre-practice.ts

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, 'plans-pre-practice.json');

// Danh mục ĐẦY ĐỦ (gồm Kanji) + `applyKanjiSlot`: đúng hành vi hiện tại của người học cá nhân.
const catalog = loadSimCatalog(true);
const profiles: Record<string, ReturnType<typeof simulatePlans>> = {};
for (const f of loadLearnerProfiles()) {
  profiles[f.id] = simulatePlans(f, { catalog, transform: kanjiSlot });
}

const snapshot = { days: SIMULATION_DAYS, profiles };
writeFileSync(OUT, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
console.log(`Đã ghi ${Object.keys(profiles).length} hồ sơ × ${SIMULATION_DAYS} ngày vào ${OUT}`);
