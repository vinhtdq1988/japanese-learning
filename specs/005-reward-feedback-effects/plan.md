# Kế hoạch triển khai: Hiệu ứng âm thanh và hình ảnh khi trả lời đúng và đạt thành tựu

**Nhánh**: `005-reward-feedback-effects` (tên thư mục tính năng; nhánh git hiện tại là `master`) | **Ngày**: 2026-11-08 | **Đặc tả**: [spec.md](spec.md)

**Đầu vào**: Đặc tả tính năng tại `specs/005-reward-feedback-effects/spec.md` (Giai đoạn 1 – MVP, cải tiến trải nghiệm theo hiến pháp v1.2.0)

## Tóm tắt

Thêm lớp "thưởng và phản hồi" lên hệ thống đã hoàn tất (001 MVP, 003 Kanji, 004 Lớp học): mỗi lần trả lời ở nơi ứng dụng vốn đã có phản hồi đúng/sai tức thì (bài học, ôn tập, bài học mẫu của khách) phát một âm thanh ngắn và một hiệu ứng hình ảnh phân biệt đúng/sai (sai thì nhẹ nhàng, không trừng phạt); khi hoàn thành bài/ngày học có thể đạt một trong 16 **thành tựu** cố định (bài học đầu tiên, bài hoàn hảo, chuỗi ngày, tổng mục đã học, tiến độ mục tiêu) hoặc **lời chúc mừng hoàn thành ngày**, hiện trong **một màn chúc mừng gộp, lớp phủ không chặn**, chỉ một lần duy nhất. Người học tự bật/tắt riêng **âm thanh** và **hiệu ứng hình ảnh** (lưu theo tài khoản; khách chỉ trong phiên), có nút tắt tiếng nhanh trong bài, và hệ thống tôn trọng "giảm chuyển động". Chuỗi đúng liên tiếp trong phiên (P3) tăng mức hứng khởi ở các ngưỡng 3/5/10.

**Cách tiếp cận kỹ thuật** (chi tiết ở [research.md](research.md)):

- **Thành tựu phát hiện ở backend, trong giao dịch `completeSession`**; trả **một lần** trong `SessionSummary.celebrations`. Khóa chính `(user_id, achievement_code)` + `INSERT … ON CONFLICT DO NOTHING RETURNING` đảm bảo "tối đa một lần" qua nhiều cửa sổ/thiết bị (E1, E6, [data-model.md §3](data-model.md#3-thuật-toán-đánh-giá-khi-hoàn-thành-phiên-e1-e2-e5)).
- **So sánh trước/sau của chính lần hoàn thành** xử lý cùng lúc người học cũ (ghi âm thầm), đổi mục tiêu/dựng lại lộ trình/đổi lộ trình lớp (ghi âm thầm), chỉ chúc mừng mốc vượt nhờ học; không cần job backfill hay móc vào nhiều luồng khác (E2).
- **Danh mục thành tựu là hằng số trong mã** ([contracts/achievement-catalog.md](contracts/achievement-catalog.md)); tùy chọn hiệu ứng là **hai cột boolean** trên hồ sơ học tập, đi qua `GET/PATCH /me` (E3, E8).
- **Client**: một điểm vào duy nhất `EffectsController` cho mọi nơi có phản hồi tức thì; âm thanh qua lớp trừu tượng `SoundPlayer` (Web Audio, WAV tự sinh) nên Android/iOS sau này chỉ thêm một cài đặt; hiệu ứng hình ảnh bằng Flutter thuần, chế độ `full/reduced/off`; màn chúc mừng gắn ở gốc ứng dụng, không chặn ([contracts/client-effects.md](contracts/client-effects.md)).
- **Hợp đồng**: OpenAPI 1.12.0 → 1.13.0, chỉ bổ sung (một trường tùy chọn ở `SessionSummary`, hai trường hồ sơ), không route mới, không mã lỗi mới ([contracts/api-changes.md](contracts/api-changes.md)).

## Bối cảnh kỹ thuật (Technical Context)

**Ngôn ngữ/Phiên bản**: Backend TypeScript 5.x trên Node.js 22 LTS; client Dart 3.x / Flutter stable (web) – không đổi so với 001–004.

**Phụ thuộc chính**: **Không thêm phụ thuộc chạy** ở cả backend lẫn client. Backend: Fastify, Zod, Drizzle ORM (đã có). Client: Riverpod, go_router, dio, gói `web` (đã có, dùng cho Web Audio sau lớp `platform/`), API client sinh bằng openapi-generator `dart-dio`. Một script công cụ mới `client/tool/generate_sounds.dart` (chỉ chạy lúc phát triển, thuần Dart, không phụ thuộc) sinh tệp âm thanh.

**Lưu trữ**: PostgreSQL 16; migration mới `0005_reward_effects.sql` (một file): 2 bảng mới (`earned_achievements`, `daily_completion_celebrations`), 1 kiểu liệt kê mới, 2 cột `NOT NULL DEFAULT true` trên `learning_profiles` – [data-model.md §2](data-model.md#2-migration-0005_reward_effectssql). Tài sản âm thanh `client/assets/sounds/*.wav` (≲ 200 KB tổng).

**Kiểm thử**: Vitest – đơn vị (engine đánh giá thành tựu bằng hồ sơ đại diện, danh mục, định nghĩa chỉ số mới), hợp đồng (`reward-us2`, `reward-us3`, OpenAPI 1.13.0), tích hợp PostgreSQL (đồng thời hai cửa sổ, idempotent, vượt mốc do đổi cấu hình, người học cũ, migration, hiệu năng `complete`), golden hồi quy kế hoạch/tiến độ. `flutter test` – widget/đơn vị (chế độ hiệu ứng, sự kiện trả lời, chuỗi đúng, màn chúc mừng không chặn, thiết lập, giảm chuyển động, khách không lưu, tài sản âm thanh, l10n).

**Nền tảng đích**: Trình duyệt desktop (Chrome, Edge, Firefox, Safari); server Linux (Docker) – không đổi. Hành vi riêng nền tảng (rung trên di động) ngoài phạm vi.

**Loại dự án**: Ứng dụng web (frontend Flutter + backend REST) với thư mục nội dung `content/` – mở rộng dự án hiện có; **không đổi nội dung học**.

**Mục tiêu hiệu năng**: Hiệu ứng bắt đầu ≤ 0,2 s sau khi kết quả đúng/sai hiện (SC-001, đo bằng widget test với backend giả độ trễ cố định; xem Điểm cần xác nhận #3); hiệu ứng KHÔNG làm tăng thời gian hoàn thành kế hoạch điển hình quá 3% (SC-002); `POST /sessions/{id}/complete` p95 tăng ≤ 100 ms (E5). Hiệu ứng chạy ≥ 60 fps trên máy văn phòng thông thường (≤ 40 hạt, `RepaintBoundary`).

**Ràng buộc**: không chặn thao tác, không chồng chất (FR-004/005); không chớp > 3 lần/giây (FR-023); âm thanh chỉ phát sau thao tác người học và lỗi âm thanh không hiện cho người học (FR-024/025); kết quả không chỉ truyền đạt bằng màu/âm (FR-008); không đổi chấm điểm, lịch ôn, độ khó, kế hoạch và không thưởng theo tốc độ (FR-009); thành tựu tối đa một lần/người học (FR-012); không chúc mừng bù (FR-016); khách không có thành tựu và không lưu tùy chọn (FR-018/021); thành tựu không lộ cho giáo viên/tổ chức; song ngữ vi/en.

**Quy mô/Phạm vi**: 16 mốc thành tựu, 5 cue âm thanh, 3 chế độ hiệu ứng; ~4 màn hình client được chạm (bài học, bài học mẫu, tóm tắt bài, Hồ sơ) + 1 thành phần gốc ứng dụng; 2 bảng + 2 cột; 0 route mới. Hiệu ứng tải ở mỗi câu trả lời (hàng chục lần mỗi người mỗi ngày) nhưng hoàn toàn ở client; backend chỉ thêm chi phí ở lần hoàn thành phiên (vài truy vấn nhỏ, có điều kiện).

Không còn mục NEEDS CLARIFICATION (đã giải quyết trong [research.md](research.md)); sáu giả định cần chủ dự án biết nằm ở mục "Điểm cần xác nhận" của research (đáng chú ý: #1 bài ghép cặp và #2 định nghĩa "tổng số mục đã học").

## Kiểm tra hiến pháp (Constitution Check)

*CỔNG: Phải đạt trước Phase 0. Kiểm tra lại sau Phase 1.*

Đánh giá theo [hiến pháp](../../.specify/memory/constitution.md) v1.2.0:

| Nguyên tắc / ràng buộc | Đánh giá trước Phase 0 | Đánh giá sau thiết kế Phase 1 |
|---|---|---|
| I. Micro-Learning First | ĐẠT – spec đặt FR-004 và SC-002: hiệu ứng không kéo dài phiên | ĐẠT – mọi hiệu ứng ≤ 0,6 s (trả lời) / 3,5 s mỗi thẻ (chúc mừng) chạy song song, `IgnorePointer`, nút "Tiếp tục" luôn bấm được; không đổi `estMinutes` hay quỹ thời gian của kế hoạch; có kiểm thử thời gian hoàn thành kế hoạch (RF7) |
| II. Personalized Learning Engine | ĐẠT – FR-009 cấm đụng chấm điểm/lịch ôn/độ khó/kế hoạch | ĐẠT – thành tựu chỉ **đọc** số liệu của Learning Engine (`rankForContext`, `currentStreakDays`) và ghi vào bảng riêng; `engine/daily-plan.ts`, `path.ts`, `srs.ts`, `difficulty.ts` KHÔNG đổi; golden hồi quy kế hoạch/tiến độ trước–sau; hiệu ứng không đọc tốc độ trả lời |
| III. Learner Control | ĐẠT – US3 cho tắt riêng âm thanh/hiệu ứng, tôn trọng giảm chuyển động | ĐẠT – hai tùy chọn độc lập, nút tắt tiếng một thao tác trong bài, lưu theo tài khoản; **không** nằm trong nhóm trường bị khóa của lớp (học viên thuộc lớp vẫn chỉnh được); tự động hóa không loại bỏ quyền chọn; màn chúc mừng đóng được bằng một thao tác và không chặn |
| IV. Evidence-Based Learning Methods | ĐẠT – phục vụ xây dựng thói quen hằng ngày và làm tiến độ hữu hình | ĐẠT – mốc chuỗi/hoàn thành ngày củng cố thói quen; mốc tiến độ/mục tiêu dùng đúng số liệu theo dõi tiến độ; không thưởng theo tốc độ (không khuyến khích đoán nhanh); SRS giữ nguyên |
| V. Cross-Platform, Web-First | ĐẠT – spec đòi lớp trừu tượng cho hành vi riêng nền tảng | ĐẠT – phát âm thanh sau `SoundPlayer` (cài đặt web trong `platform/web/`, cài đặt bộ nhớ để kiểm thử); "giảm chuyển động" qua `MediaQuery.disableAnimations`; không `package:web`/`dart:html` ngoài `platform/`; mọi quy tắc thành tựu ở backend nên mobile dùng lại nguyên; tệp âm thanh dùng chung giữa nền tảng |
| VI. Separated Architecture | ĐẠT – dữ liệu thành tựu/tùy chọn ở server | ĐẠT – thành tựu và tùy chọn là dữ liệu backend, hợp đồng OpenAPI 1.13.0 tường minh; client không tự tính mốc; danh mục thành tựu là hằng số backend (không phải nội dung học, E3); nội dung học không đổi |
| Phạm vi theo giai đoạn | ĐẠT – Giai đoạn 1 (cải tiến Daily Learning / Review / Progress) | ĐẠT – **không** xây bộ sưu tập thành tựu, bảng xếp hạng, điểm thưởng, chia sẻ xã hội, thông báo nhắc học, rung di động, hiển thị cho giáo viên (spec "Ngoài phạm vi"); không có endpoint đọc thành tựu |
| Kiểm thử engine bằng hồ sơ đại diện | Cam kết | ĐẠT – `engine/achievements.ts` là hàm thuần có kiểm thử với hồ sơ đại diện (người mới, chuỗi gần mốc, người cũ 20 ngày/120 mục, đổi mục tiêu nhảy mốc, tụt dưới mốc, bài hoàn hảo, ôn tập); golden hồi quy chứng minh Learning Engine không đổi |
| Thay đổi hợp đồng/schema được ghi nhận, không phá dữ liệu | Cam kết | ĐẠT – OpenAPI 1.13.0 chỉ bổ sung, nhật ký trong `info.description`; migration chỉ thêm bảng/cột `DEFAULT true`; client 1.12.0 bỏ qua trường lạ; client mới + server cũ không nhận `celebrations` thì không hiện gì |
| Độ phức tạp phải biện minh | Cam kết | ĐẠT – 2 bảng nhỏ + 1 lớp trừu tượng nền tảng, đều có lý do ở "Theo dõi độ phức tạp"; không thêm phụ thuộc, dịch vụ hay job nền |

**Kết luận**: Cổng ĐẠT trước Phase 0 và sau thiết kế Phase 1; không có vi phạm cần biện minh, không có điều kiện treo. Các điểm cần chủ dự án biết (research, "Điểm cần xác nhận") là lựa chọn thiết kế, không phải vi phạm hiến pháp.

## Cấu trúc dự án

### Tài liệu (tính năng này)

```text
specs/005-reward-feedback-effects/
├── plan.md                          # Tệp này (/speckit-plan)
├── research.md                      # Phase 0 – quyết định E1…E19 + điểm cần xác nhận
├── data-model.md                    # Phase 1 – bảng/cột, thuật toán đánh giá, bất biến, trạng thái client
├── quickstart.md                    # Phase 1 – kịch bản kiểm chứng RF1…RF8
├── contracts/
│   ├── api-changes.md               # Phase 1 – OpenAPI 1.12.0 → 1.13.0 (áp vào specs/001-phase1-mvp/contracts/openapi.yaml)
│   ├── achievement-catalog.md       # Phase 1 – 16 mốc thành tựu (mã, ngưỡng, văn bản vi/en)
│   └── client-effects.md            # Phase 1 – giao diện nội bộ client: SoundPlayer, EffectsController, CelebrationHost
├── checklists/
│   └── requirements.md
└── tasks.md                         # Phase 2 (/speckit-tasks – KHÔNG do /speckit-plan tạo)
```

### Mã nguồn (thư mục gốc kho mã) – các vị trí thay đổi

```text
backend/
├── src/
│   ├── domain/
│   │   ├── achievements.ts          # mới: danh mục 16 mốc (mã, loại, ngưỡng, văn bản vi/en)
│   │   └── profile-validation.ts    # SỬA: + soundEnabled, visualEffectsEnabled (Zod)
│   ├── engine/
│   │   └── achievements.ts          # mới: evaluate(input) -> { celebrate, silent } (hàm thuần)
│   ├── db/
│   │   ├── migrations/0005_reward_effects.sql   # mới
│   │   ├── schema.ts                            # SỬA: + 2 bảng, enum achievementSource, 2 cột learningProfiles
│   │   └── repositories/
│   │       ├── achievements.ts      # mới: listEarnedCodes, insertAchievements (RETURNING), markDayCelebrated
│   │       ├── progress.ts          # SỬA: + countItemsLearned, hasEarlierCompletedLesson, hasEarlierPerfectLesson
│   │       └── profiles.ts          # (không đổi chữ ký; ProfilePatch tự mang 2 cột mới)
│   ├── services/
│   │   ├── achievements.ts          # mới: evaluateOnSessionCompletion -> CelebrationsDto (bản địa hóa)
│   │   ├── lesson-session.ts        # SỬA: completeSession chụp trạng thái "trước", gọi dịch vụ, gắn celebrations
│   │   ├── progress.ts              # SỬA: trích goalRatio(...) dùng chung (KHÔNG đổi hành vi GET /progress)
│   │   └── profile.ts               # SỬA: profileToDto + patch hai trường mới (không khóa lớp)
│   └── reports/product-metrics.sql  # SỬA: + SC-006 (tắt cả hai hiệu ứng), SC-007 (quay lại ngày kế tiếp)
└── tests/
    ├── unit/                        # achievements-engine, achievement-catalog, goal-ratio, items-learned (hàm thuần/DTO)
    ├── contract/                    # reward-us2 (thành tựu/chúc mừng), reward-us3 (tùy chọn hồ sơ); mở rộng contract helper
    ├── integration/                 # reward-achievements (đồng thời, idempotent, silent, đổi mục tiêu, lớp, hiệu năng), migration (mở rộng)
    └── fixtures/learner-profiles/reward-*.json   # hồ sơ đại diện: mới, gần mốc chuỗi, cũ 20 ngày/120 mục, nhảy mốc, hoàn hảo

client/
├── assets/sounds/                   # mới: correct|incorrect|streak|achievement|day_complete .wav
├── tool/generate_sounds.dart        # mới: sinh WAV xác định (chuẩn hóa mức âm lượng)
├── pubspec.yaml                     # SỬA: khai báo assets/sounds/
├── lib/
│   ├── data/api/generated/          # sinh lại từ OpenAPI 1.13.0
│   ├── platform/
│   │   ├── sound_player.dart        # mới: giao diện SoundPlayer + SoundCue
│   │   ├── web/web_sound_player.dart# mới: Web Audio
│   │   ├── memory_platform.dart     # SỬA: + MemorySoundPlayer
│   │   └── platform_providers.dart  # SỬA: + soundPlayerProvider
│   ├── presentation/
│   │   ├── effects/                 # mới
│   │   │   ├── effects_controller.dart   # onAnswer / onCelebrations / settings (người học vs khách)
│   │   │   ├── effect_mode.dart          # resolveEffectMode (hàm thuần)
│   │   │   ├── effect_specs.dart         # hằng số thời lượng/số nhịp (ngân sách chớp)
│   │   │   ├── answer_effect.dart        # hiệu ứng đúng/sai/chuỗi (IgnorePointer, RepaintBoundary)
│   │   │   ├── celebration_host.dart     # lớp phủ không chặn ở gốc ứng dụng + hàng đợi thẻ
│   │   │   ├── celebration_card.dart     # thẻ thành tựu / hoàn thành ngày (+ confetti, thông báo tĩnh)
│   │   │   ├── effects_quick_control.dart# nút tắt/bật nhanh ở thanh tiêu đề bài
│   │   │   └── effects_settings_section.dart # mục "Hiệu ứng" ở Hồ sơ
│   │   ├── lesson/lesson_controller.dart # SỬA: correctStreak, gọi onAnswer/onCelebrations
│   │   ├── lesson/lesson_screen.dart     # SỬA: LessonFeedback + liveRegion + AnswerEffect; QuickControl; prime() khi nộp
│   │   ├── trial/trial_lesson_screen.dart# SỬA: onAnswer, QuickControl (+ nút hiệu ứng hình ảnh cho khách)
│   │   ├── profile/profile_screen.dart   # SỬA: gắn EffectsSettingsSection
│   │   └── placement/                    # KHÔNG đổi (FR-007)
│   ├── app.dart                     # SỬA: MaterialApp.router builder bọc CelebrationHost
│   └── l10n/app_vi.arb, app_en.arb  # SỬA: chuỗi hiệu ứng/thành tựu tĩnh/nhãn nút/trợ năng
└── test/effects/                    # mới: effect_mode, effects_controller, answer_effect, celebration_host,
                                     #   lesson_effects_flow, trial_effects, settings_section, sound_assets,
                                     #   reduced_motion, no_effects_in_placement
```

**Quyết định cấu trúc**: Giữ nguyên ba phần `backend/`, `client/`, `content/` (Nguyên tắc VI); không thêm dự án, dịch vụ, job hay thư viện. Quy tắc quyết định (mốc nào được chúc mừng) nằm ở `engine/achievements.ts` thuần hàm để kiểm thử bằng hồ sơ đại diện; phần có trạng thái ở `services/` + `db/repositories/`; phần riêng nền tảng (âm thanh) duy nhất ở `client/lib/platform/`.

## Thứ tự triển khai đề xuất

0. **Chụp ảnh golden trước khi sửa dịch vụ**: kế hoạch 14 ngày, `GET /path`, `GET /progress` của các hồ sơ đại diện (mở rộng bộ golden hiện có) – chuẩn so sánh cho FR-009; thêm nhanh vào kiểm thử hợp đồng một kiểm tra "phản hồi `SessionSummary` cũ không đổi".
1. **Nền tảng** (chặn mọi câu chuyện): migration 0005 + `schema.ts`; `domain/achievements.ts` + kiểm thử danh mục; OpenAPI 1.13.0 + sinh lại API client; `profiles`/`profile.ts`/validation cho hai tùy chọn; giao diện `SoundPlayer` + `MemorySoundPlayer` + script và tệp âm thanh + kiểm thử tài sản; `effect_mode.dart` + `effect_specs.dart`.
2. **US1 (P1) – phản hồi trả lời**: `EffectsController.onAnswer` + `answer_effect.dart` + Web Audio; gắn vào `LessonController`/`LessonFeedback` (kể cả `Semantics`), bài học mẫu; kiểm thử "bài kiểm tra trình độ không có hiệu ứng", thay thế khi trả lời dồn dập, âm thanh thất bại êm.
3. **US2 (P1) – thành tựu**: `engine/achievements.ts` (hàm thuần + hồ sơ đại diện) → repository + `services/achievements.ts` → tích hợp vào `completeSession` + `countItemsLearned`/`goalRatio` → `CelebrationHost`/`celebration_card` + gắn `onCelebrations` ở `finish()`; kiểm thử đồng thời/idempotent/silent/đổi mục tiêu/lớp. *Không phát hành US2 khi thiếu kiểm thử đồng thời và kiểm thử "không chúc mừng bù/không chúc mừng lại".*
4. **US3 (P2) – tùy chỉnh và tiếp cận**: `EffectsSettingsSection` (Hồ sơ), `EffectsQuickControl` (bài học + bài học mẫu), chế độ `reduced`/`off` và thông báo tĩnh, khách chỉ trong bộ nhớ. PHẢI xong trước khi phát hành (spec: P2 nhưng bắt buộc trước phát hành).
5. **US4 (P3)**: `correctStreak` trong `LessonState`, ngưỡng 3/5/10, cue `streak` + huy hiệu.
6. Báo cáo chỉ số SC-006/SC-007 (`product-metrics.sql`); rà soát l10n (`tool/check_l10n.dart`); chạy lại golden + ma trận quyền + toàn bộ kiểm thử; đo hiệu năng `complete` và thời gian hoàn thành kế hoạch.

## Theo dõi độ phức tạp

| Sai lệch / quyết định có chi phí | Lý do cần | Phương án đơn giản hơn bị bác vì |
|---|---|---|
| Bảng `earned_achievements` (khóa chính kép) | "Tối đa một lần cho mỗi người học" qua nhiều cửa sổ/thiết bị/đăng nhập lại phải do CSDL đảm bảo (FR-012, SC-003); đồng thời là nguồn "đã vượt mốc" để ghi âm thầm (FR-017/017a) | Ghi nhớ ở client (LocalStore) sai khi đổi thiết bị; tính lại từ tiến độ mỗi lần không phân biệt được "đã chúc mừng" với "chưa" |
| Bảng `daily_completion_celebrations` | Chặn chúc mừng ngày lần hai khi kế hoạch được dựng lại cùng ngày (FR-015) | Cột trên `daily_plans` không chặn được vì kế hoạch dựng lại là dòng mới |
| Đánh giá "trước/sau" (tính chỉ số hai lần) | Một công thức giải quyết FR-017, FR-017a và Q1 mà không cần cờ ra mắt, job backfill hay hook ở mọi luồng đổi cấu hình | Backfill + hook: nhiều điểm chạm, dễ sót (giáo viên đổi lộ trình lớp khi học viên ngoại tuyến); điểm kiểm tỷ lệ lưu sẵn: thêm trạng thái dễ lệch khi mẫu số đổi |
| Danh mục là hằng số trong mã (không bảng) | Giữ đơn giản; spec coi danh mục là cố định | Bảng + seed + quản trị: thêm bề mặt chưa ai yêu cầu; chuyển sang bảng sau không đổi hợp đồng |
| Giao diện `SoundPlayer` + cài đặt web riêng | Nguyên tắc V: hành vi riêng nền tảng phải sau lớp trừu tượng; kiểm thử được bằng cài đặt bộ nhớ (FR-024/025) | Gọi `package:web` thẳng từ widget: vi phạm V, khó kiểm thử |
| Tệp WAV tự sinh bằng script xác định | Loại rủi ro giấy phép, chuẩn hóa âm lượng đồng đều kiểm thử được (FR-023), không thêm gói | Thư viện âm thanh/mẫu bên thứ ba: thêm phụ thuộc hoặc rủi ro giấy phép, khó chuẩn hóa mức âm lượng |
| `CelebrationHost` ở gốc ứng dụng | Phải sống qua điều hướng "Tiếp tục" và không chặn (Q4, FR-013) | `showDialog` là modal; `SnackBar` mất theo `Scaffold` |
| Hàm `goalRatio` trích khỏi `getProgress` | Thành tựu mục tiêu phải dùng đúng phép tính của màn Tiến độ (Giả định spec) – một nguồn duy nhất | Sao chép công thức: dễ lệch khi 003/004 đổi cách xếp hạng |

## Rủi ro và điểm cần theo dõi

- **Mâu thuẫn spec – bài ghép cặp**: US1.3 và một trường hợp biên mô tả phản hồi *từng cặp*, nhưng app hiện nộp cả bài và client không có đáp án; phản hồi từng cặp phá thiết kế hoặc thêm API mới (trái Giả định "không thêm phản hồi đúng/sai mới"). Plan chọn một hiệu ứng mỗi lần nộp (E16). *Nên chạy `/speckit-clarify` hoặc sửa câu chữ spec trước khi `/speckit-tasks`.*
- **Định nghĩa "tổng số mục đã học"**: spec bảo dùng cách tính sẵn có nhưng chỉ có số chữ Kanji; plan tổng quát hóa quy tắc K8 (E4). Nếu chủ dự án muốn định nghĩa khác (ví dụ mọi mục đã trả lời ≥ 1 lần), chỉ thay `countItemsLearned` và bài kiểm tra tương ứng; hợp đồng không đổi.
- **SC-001 phụ thuộc độ trễ mạng**: kết quả do server chấm nên hiệu ứng đến cùng thẻ phản hồi; không thể "tức thì" hơn phản hồi hiện có mà không để client biết đáp án. Đo từ lúc kết quả hiện (Điểm cần xác nhận #3).
- **Chi phí `complete`**: đánh giá thành tựu thêm `rankForContext` + `listActiveDays` + hai lần đếm mục. Giảm bằng đánh giá có điều kiện (bỏ loại đã đạt hết, E5) và đo p95 ≤ +100 ms; nếu vượt, cân nhắc tính mốc tỷ lệ mục tiêu chỉ khi phiên làm đổi trạng thái một đơn vị (`delta = 1`) — phần lớn phiên ôn tập khỏi tính.
- **Cửa sổ "mất chúc mừng"**: giao dịch commit nhưng phản hồi mất (đóng tab) ⇒ thành tựu đã ghi, không chúc mừng bù (quyết định của chủ dự án, Q1). Người dùng có thể thấy thiếu lời chúc mừng đôi khi; chấp nhận, đã có trong spec.
- **Cue âm thanh trên Safari/iOS Safari-web**: chính sách tự phát chặt hơn; `prime()` trong thao tác chạm và nuốt lỗi êm (FR-024). Cần chạy thử tay trên Safari trước phát hành (RF5.10).
- **Ngân sách chớp sáng**: kiểm soát bằng hằng số + kiểm thử, nhưng đánh giá thị giác cuối cùng cần xem tay trên màn hình thật (không có công cụ đo tự động trong dự án).
- **Client cũ (1.12.0)** không hiện chúc mừng nhưng vẫn chạy bình thường (bỏ qua trường mới); thành tựu bị "tiêu" (ghi nhận) mà không ai thấy nếu người học dùng client cũ — chấp nhận, phát hành client và backend cùng lúc như 004.
- **Múi giờ**: `local_date` của chúc mừng ngày theo ngày của kế hoạch (múi giờ người học lúc lập); chuỗi ngày theo `study_records.local_date` – dùng lại nguyên cách tính hiện có, kiểm thử ranh giới ngày bằng đồng hồ giả.
