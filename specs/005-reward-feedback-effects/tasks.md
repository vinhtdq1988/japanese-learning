---

description: "Danh sách nhiệm vụ triển khai: Hiệu ứng âm thanh và hình ảnh khi trả lời đúng và đạt thành tựu"
---

# Nhiệm vụ: Hiệu ứng âm thanh và hình ảnh khi trả lời đúng và đạt thành tựu

**Đầu vào**: Tài liệu thiết kế tại `specs/005-reward-feedback-effects/`

**Điều kiện tiên quyết**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/api-changes.md](contracts/api-changes.md), [contracts/achievement-catalog.md](contracts/achievement-catalog.md), [contracts/client-effects.md](contracts/client-effects.md), [quickstart.md](quickstart.md)

**Kiểm thử**: CÓ. Hiến pháp yêu cầu kiểm thử engine bằng hồ sơ đại diện; plan và quickstart cam kết kiểm thử đơn vị, hợp đồng, tích hợp PostgreSQL và widget test cho từng câu chuyện. Trong mỗi câu chuyện, viết kiểm thử TRƯỚC và bảo đảm chúng ĐỎ trước khi hiện thực.

**Tổ chức**: Nhiệm vụ nhóm theo câu chuyện người dùng để mỗi câu chuyện hiện thực và kiểm thử độc lập được.

## Định dạng: `[ID] [P?] [Story] Mô tả kèm đường dẫn file`

- **[P]**: Chạy song song được (khác file, không phụ thuộc nhiệm vụ chưa xong).
- **[Story]**: Câu chuyện người dùng (US1…US4) mà nhiệm vụ thuộc về. Setup, Foundational và Polish không có nhãn này.
- Mọi đường dẫn tính từ thư mục gốc kho mã `D:\my_owner_workspace\japanese-learning` (tài liệu dùng dấu `/`).

## Quy ước đường dẫn (ứng dụng web: `backend/` + `client/`)

- Backend: `backend/src/{domain,engine,db,db/repositories,services,api,reports}`, kiểm thử `backend/tests/{unit,contract,integration,fixtures}`.
- Client Flutter: `client/lib/{platform,presentation,data,l10n}`, kiểm thử `client/test/`, tài sản `client/assets/`.
- Hợp đồng duy nhất: `specs/001-phase1-mvp/contracts/openapi.yaml` (KHÔNG tạo file OpenAPI thứ hai).

## Ghi chú chạy kiểm thử

- Các kịch bản thủ công trên trình duyệt thật của `quickstart.md` (RF1–RF7) KHÔNG nằm trong nhiệm vụ nào; tính năng được kiểm chứng bằng kiểm thử tự động. Quickstart vẫn dùng để người phát hành tự thử khi cần.
- Kiểm thử cần PostgreSQL: dùng PostgreSQL nhúng (không Docker) và `vitest --project db` — xem memory "Chạy test backend cần DB". Năm test spec 003 (`kanji-admin`, `kanji-us5`) đỏ sẵn tại HEAD, KHÔNG phải hồi quy của spec 005 — ghi lại ở T001 để so sánh.
- Client: `cd client && flutter test <đường-dẫn>`; kiểm tra l10n: `dart run tool/check_l10n.dart`.

---

## Phase 1: Setup (hạ tầng dùng chung)

**Mục đích**: Chốt chuẩn so sánh trước khi sửa mã và chuẩn bị khung tài sản client.

- [X] T001 Chạy và ghi lại kết quả baseline TRƯỚC khi sửa bất kỳ dịch vụ nào: `cd backend && pnpm typecheck && pnpm test:unit` và `pnpm vitest run --project db tests/integration/org-regression-api.test.ts tests/contract/us2.test.ts tests/integration/us2-lesson.test.ts` (golden `backend/tests/fixtures/golden/api-pre-org.json`, `plans-pre-org.json` là chuẩn hồi quy cho FR-009); ghi danh sách test đỏ sẵn vào mô tả commit/ghi chú để phân biệt với hồi quy về sau (không tạo file mới nếu golden hiện có đã đủ).
- [X] T002 Khai báo thư mục tài sản âm thanh trong `client/pubspec.yaml`: thêm `assets/sounds/` vào mục `flutter: assets:` (giữ nguyên `assets/fonts/` hiện có) và tạo thư mục rỗng `client/assets/sounds/` (có `.gitkeep` cho tới khi T016 sinh tệp).

---

## Phase 2: Foundational (điều kiện chặn mọi câu chuyện)

**Mục đích**: Migration, danh mục thành tựu, hợp đồng OpenAPI 1.13.0, hai tùy chọn hồ sơ, lớp trừu tượng âm thanh, tệp âm thanh, hàm chế độ hiệu ứng và thông số hiệu ứng — mọi câu chuyện đều dùng.

**⚠️ QUAN TRỌNG**: Chưa câu chuyện nào được bắt đầu khi phase này chưa xong.

### Cơ sở dữ liệu và danh mục (backend)

- [X] T003 Tạo migration `backend/src/db/migrations/0005_reward_effects.sql` đúng nội dung [data-model.md §2](data-model.md#2-migration-0005_reward_effectssql): `CREATE TYPE achievement_source AS ENUM ('earned', 'silent')`; bảng `earned_achievements` gồm `user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE`, `achievement_code text NOT NULL CHECK (char_length(achievement_code) BETWEEN 1 AND 40)`, `earned_at timestamptz NOT NULL`, `source achievement_source NOT NULL`, `PRIMARY KEY (user_id, achievement_code)`; bảng `daily_completion_celebrations` gồm `user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE`, `local_date date NOT NULL`, `celebrated_at timestamptz NOT NULL`, `PRIMARY KEY (user_id, local_date)`; `ALTER TABLE learning_profiles ADD COLUMN sound_enabled boolean NOT NULL DEFAULT true, ADD COLUMN visual_effects_enabled boolean NOT NULL DEFAULT true`. Chỉ THÊM, không sửa dữ liệu cũ; không có chỉ mục phụ. Kiểm tra `backend/src/db/migrate.ts` nhận file mới (một file, một giao dịch như 0004).
- [X] T004 Cập nhật `backend/src/db/schema.ts`: thêm enum `achievementSource` (`'earned' | 'silent'`), bảng `earnedAchievements` (khóa chính kép `(userId, achievementCode)`), bảng `dailyCompletionCelebrations` (khóa chính kép `(userId, localDate)`), và hai cột `soundEnabled`, `visualEffectsEnabled` (`boolean`, `notNull`, `default(true)`) trên `learningProfiles`. Phụ thuộc T003.
- [X] T005 [P] Mở rộng `backend/tests/integration/migration.test.ts`: sau migrate, hai bảng mới tồn tại và rỗng; MỌI hồ sơ cũ có `sound_enabled = true` và `visual_effects_enabled = true`; số dòng các bảng cũ không đổi; chèn `achievement_code` dài 41 ký tự hoặc rỗng bị `CHECK` từ chối; chèn trùng `(user_id, achievement_code)` bị khóa chính từ chối. Phụ thuộc T003.
- [X] T006 [P] Tạo `backend/src/domain/achievements.ts`: hằng số danh mục cố định 16 mốc đúng [contracts/achievement-catalog.md](contracts/achievement-catalog.md) — kiểu `AchievementKind = 'first_lesson' | 'streak' | 'items_learned' | 'goal_progress' | 'perfect_lesson'`, mỗi mốc có `code`, `kind`, `threshold` (vắng với `first_lesson`/`perfect_lesson`), `name` và `description` dạng `{ vi, en }`; xuất `ACHIEVEMENT_CATALOG`, `achievementByCode(code)` và hàm so sánh thứ tự trình bày (`first_lesson` → `perfect_lesson` → `streak_*` → `items_*` → `goal_*`, cùng loại theo ngưỡng tăng dần). Mã `streak_3/7/14/30/60/100`, `items_50/100/250/500`, `goal_25/50/75/100`. `name` ≤ 30 ký tự.
- [X] T007 [P] Tạo `backend/tests/unit/achievement-catalog.test.ts` theo [achievement-catalog.md §6](contracts/achievement-catalog.md): mã duy nhất; mọi mã khớp `^[a-z]+(_[a-z]+)*(_[0-9]+)?$` và ≤ 40 ký tự; mỗi mốc có `name`/`description` không rỗng ở cả `vi` và `en`, `name` ≤ 30 ký tự; ngưỡng tăng ngặt trong từng loại, `goal_progress` kết thúc ở 100; tổng đúng 16 mốc; hai thành tựu một lần không có `threshold`; hàm sắp thứ tự trình bày cho kết quả đúng. Phụ thuộc T006.

### Hợp đồng và tùy chọn hồ sơ

- [X] T008 Áp thay đổi OpenAPI 1.12.0 → 1.13.0 vào `specs/001-phase1-mvp/contracts/openapi.yaml` đúng [contracts/api-changes.md](contracts/api-changes.md): dán nhật ký 1.13.0 vào `info.description` và đổi `info.version`; thêm schema `AchievementKind`, `AchievementEarned` (bắt buộc `code`, `kind`, `name`, `description`; `threshold` integer `minimum: 1`, tùy chọn), `Celebrations` (bắt buộc `dayCompleted: boolean`, `achievements: AchievementEarned[]`); thêm `SessionSummary.celebrations` (tùy chọn, `$ref Celebrations`); thêm `soundEnabled`, `visualEffectsEnabled` (boolean, `default: true`) vào `Profile` và (tùy chọn) vào `ProfileUpdate`. KHÔNG thêm route, KHÔNG thêm mã lỗi.
- [X] T009 Sinh lại API client Dart từ OpenAPI 1.13.0 vào `client/lib/data/api/generated/` đúng các bước trong `client/lib/data/api/README.md` (kể cả `client/tool/patch_generated_api.dart` nếu README yêu cầu); ghi chú phiên bản 1.13.0 vào README đó; chạy `cd client && flutter pub get && flutter analyze` để chắc chắn mô hình `Celebrations`, `AchievementEarned`, `Profile.soundEnabled`/`visualEffectsEnabled` biên dịch được. Phụ thuộc T008.
- [X] T010 Cập nhật `backend/src/domain/profile-validation.ts`: thêm `soundEnabled` và `visualEffectsEnabled` (`z.boolean()`, tùy chọn) vào schema `ProfileUpdate`; kiểu sai (không phải boolean) PHẢI cho `422 VALIDATION_FAILED` như các trường khác. KHÔNG thêm hai trường vào `CLASS_LOCKED_PROFILE_FIELDS` trong `backend/src/domain/org-types.ts`.
- [X] T011 Cập nhật `backend/src/db/repositories/profiles.ts` (kiểu `ProfileRow`/`ProfilePatch` mang hai cột mới nếu chúng không tự suy ra từ `schema.ts`) và `backend/src/services/profile.ts`: `profileToDto`/`GET /me` luôn trả `soundEnabled`, `visualEffectsEnabled`; `PATCH /me` ghi hai trường; khi payload CHỈ gồm hai trường này thì không sinh lại lộ trình, không đụng kế hoạch, không cần `currentPassword`, không gọi `assertNotClassManaged` (học viên thuộc lớp vẫn sửa được, không trả `CLASS_MANAGED`). Cập nhật schema phản hồi Zod ở `backend/src/api/` (grep `Profile` trong `backend/src/api/`) nếu có. Phụ thuộc T004, T010.

### Lớp trừu tượng nền tảng và tài sản âm thanh (client)

- [X] T012 [P] Tạo `client/lib/platform/sound_player.dart`: `enum SoundCue { correct, incorrect, streak, achievement, dayComplete }` và `abstract interface class SoundPlayer { Future<void> prime(); Future<void> play(SoundCue cue); Future<void> stopAll(); }` đúng [client-effects.md §1](contracts/client-effects.md) (chú thích tiếng Việt: `prime()` gọi trong thao tác người học, không bao giờ ném lỗi; `play` dừng cue trước (FR-005) và nuốt mọi lỗi (FR-024); chỉ gọi sau thao tác người học (FR-025)). Export trong `client/lib/platform/platform.dart`.
- [X] T013 Thêm `MemorySoundPlayer` vào `client/lib/platform/memory_platform.dart`: ghi danh sách `played` (các `SoundCue` đã phát), đếm `stopAllCount`, `primeCount`; cờ `throwOnPlay` để kiểm thử FR-024 (khi bật, `play` ném lỗi nội bộ — controller PHẢI nuốt). Phụ thuộc T012.
- [X] T014 Thêm `soundPlayerProvider` vào `client/lib/platform/platform_providers.dart` theo đúng kiểu hiện có (`Provider<SoundPlayer>((ref) => throw _missing('SoundPlayer'))`, được override trong `ProviderScope` ở `main.dart`/kiểm thử). Phụ thuộc T012.
- [X] T015 [P] Tạo `client/tool/generate_sounds.dart` (thuần Dart, không phụ thuộc gói ngoài, xác định): tổng hợp sóng sin + bao biên độ ra 5 tệp WAV PCM 16-bit mono 22,05 kHz vào `client/assets/sounds/` theo [client-effects.md §1 "Tài sản âm thanh"](contracts/client-effects.md): `correct.wav` ≤ 0,6 s (hai nốt đi lên, sáng), `incorrect.wav` ≤ 0,4 s (một nốt trầm mềm, tắt nhanh, trung tính), `streak.wav` ≤ 0,7 s (ba nốt đi lên nhanh), `achievement.wav` ≤ 1,2 s (hợp âm rải), `day_complete.wav` ≤ 1,2 s (giai điệu ngắn khép lại, ấm). Chuẩn hóa mọi tệp về cùng mức RMS (≈ −20 dBFS, chênh ≤ ±1,5 dB giữa các tệp), đỉnh ≤ −3 dBFS, fade-in/out 5–20 ms; tổng dung lượng ≤ 200 KB.
- [X] T016 Chạy `cd client && dart run tool/generate_sounds.dart` để sinh và commit 5 tệp `client/assets/sounds/{correct,incorrect,streak,achievement,day_complete}.wav`. Phụ thuộc T002, T015.
- [X] T017 [P] Tạo `client/test/effects/sound_assets_test.dart`: đọc từng tệp WAV, khẳng định tiêu đề PCM 16-bit mono 22.050 Hz, thời lượng không vượt ngưỡng từng cue (0,6/0,4/0,7/1,2/1,2 s), RMS giữa các tệp chênh ≤ 1,5 dB, đỉnh ≤ −3 dBFS, mẫu đầu/cuối gần 0 (có fade), tổng dung lượng ≤ 200 KB, và `pubspec.yaml` khai báo `assets/sounds/`. Phụ thuộc T016.
- [X] T018 Tạo `client/lib/platform/web/web_sound_player.dart` (`WebSoundPlayer implements SoundPlayer`) bằng Web Audio qua gói `web` đã có: `AudioContext` + `decodeAudioData` giải mã MỘT lần giữ `AudioBuffer` (tải tệp qua `rootBundle`, cùng origin — không đổi CSP); `prime()` tạo/`resume()` ngữ cảnh trong thao tác người dùng; `play(cue)` dừng nguồn đang chạy rồi phát nguồn mới; MỌI lỗi (bị chặn, giải mã hỏng, thiết bị tắt tiếng) nuốt êm, không hiện lỗi. Export trong `client/lib/platform/web/web_platform.dart` và thêm `soundPlayerProvider.overrideWithValue(WebSoundPlayer())` vào `client/lib/main.dart`. KHÔNG import `package:web`/`dart:html` ngoài `platform/`. Phụ thuộc T012, T014, T016.
- [X] T019 [P] Tạo `client/lib/presentation/effects/effect_mode.dart`: `enum EffectMode { full, reduced, off }` và hàm thuần `EffectMode resolveEffectMode({required bool visualEnabled, required bool reduceMotion})` — `visualEnabled=false → off`; `visualEnabled=true, reduceMotion=true → reduced`; `visualEnabled=true, reduceMotion=false → full`.
- [X] T020 [P] Tạo `client/test/effects/effect_mode_test.dart`: kiểm thử đầy đủ bảng 2×2 của `resolveEffectMode`. Phụ thuộc T019.
- [X] T021 [P] Tạo `client/lib/presentation/effects/effect_specs.dart`: hằng số duy nhất cho thời lượng/số nhịp theo [client-effects.md §4](contracts/client-effects.md) — Đúng 600 ms / 1 nhịp, Sai 400 ms / 1 nhịp, Chuỗi đúng 700 ms / 1 nhịp, Thẻ chúc mừng 3,5 s mỗi thẻ, confetti tối đa 40 hạt; thời gian tự đóng thông báo tĩnh.
- [X] T022 [P] Tạo `client/test/effects/effect_specs_test.dart`: khẳng định ngân sách an toàn FR-023 — mỗi hiệu ứng `peaks ≤ 1` trong cửa sổ 333 ms (⇒ ≤ 3 lần/giây), không hiệu ứng nào đổi độ sáng toàn màn hình, số hạt confetti ≤ 40, thời lượng không vượt bảng. Phụ thuộc T021.
- [X] T023 Cập nhật hỗ trợ kiểm thử client để màn hình bài học/bài học mẫu không ném lỗi thiếu `SoundPlayer`: thêm `soundPlayerProvider.overrideWithValue(MemorySoundPlayer())` vào `client/test/support/lesson_scenario.dart`, `client/test/support/trial_scenario.dart`, `client/test/support/learning_scenario.dart` (và mọi test khác dựng `LessonScreen`/`TrialLessonScreen`/ứng dụng đầy đủ — tìm bằng grep `LessonScreen|TrialLessonScreen|ProviderScope` trong `client/test/`); chạy `cd client && flutter test` để chắc chắn không hồi quy. Phụ thuộc T013, T014.

**Checkpoint**: Nền tảng sẵn sàng — migration/schema/danh mục/hợp đồng/hồ sơ ở backend, `SoundPlayer` + tệp âm thanh + `resolveEffectMode` + `effect_specs` ở client. Có thể bắt đầu các câu chuyện.

---

## Phase 3: Câu chuyện người dùng 1 — Phản hồi âm thanh và hình ảnh khi trả lời (Ưu tiên: P1) 🎯 MVP

**Mục tiêu**: Mỗi lần trả lời ở bài học, ôn tập, bài học mẫu của khách phát đúng một cue âm thanh và một hiệu ứng hình ảnh phân biệt đúng/sai, không chặn thao tác; bài kiểm tra trình độ không có hiệu ứng.

**Kiểm thử độc lập**: Mở bài học, bài ôn tập và bài học mẫu; trả lời đúng/sai ở trắc nghiệm, ghép cặp, điền chỗ trống: mỗi lần nộp có đúng một hiệu ứng + một cue ≤ 0,2 s sau khi kết quả hiện, "Tiếp tục" bấm được ngay, trả lời dồn dập thì cái sau thay cái trước, kiểm tra trình độ không có hiệu ứng (quickstart RF1).

### Kiểm thử cho US1 (viết TRƯỚC, phải đỏ) ⚠️

- [X] T024 [P] [US1] Tạo `client/test/effects/effects_controller_test.dart`: `onAnswer(correct: true)` phát cue `correct`, `false` phát `incorrect`; `soundEnabled=false` thì KHÔNG phát cue nhưng VẪN phát `AnswerEffectEvent`; hai lần gọi liên tiếp nhanh → `stopAll` trước `play`, event mới có `id` tăng dần và thay event cũ (FR-005); `MemorySoundPlayer.throwOnPlay` không làm `onAnswer` ném lỗi (FR-024); không có thao tác đọc/ghi `LocalStore` nào cho tùy chọn (E9); khách đọc tùy chọn từ bộ nhớ (mặc định cả hai bật), người học từ hồ sơ.
- [X] T025 [P] [US1] Tạo `client/test/effects/answer_effect_test.dart`: widget `AnswerEffect` ở `EffectMode.full` có hoạt ảnh đúng (≤ 600 ms) / sai (≤ 400 ms, không rung/lắc, màu hổ phách), `reduced` chỉ mờ dần, `off` không dựng hoạt ảnh; lớp hiệu ứng nằm trong `IgnorePointer` + `RepaintBoundary` + `ExcludeSemantics`; không đổi kích thước bố cục (FR-026); event mới thay hiệu ứng đang chạy.
- [X] T026 [P] [US1] Tạo `client/test/effects/lesson_effects_flow_test.dart` (dùng `client/test/support/lesson_scenario.dart` + `fake_backend.dart`): với trắc nghiệm, điền chỗ trống, ghép cặp (một hiệu ứng cho mỗi lần "Kiểm tra", kể cả ở lượt hỏi lại — research E16) và ở từ vựng/ngữ pháp/Kanji + phiên ôn tập: mỗi kết quả MỚI từ server gọi đúng một `onAnswer`; `duplicate == true`, khôi phục phiên dở và xả hàng đợi ngoại tuyến KHÔNG phát lại hiệu ứng; thẻ `LessonFeedback` có biểu tượng + chữ "Đúng"/"Chưa đúng" khi tắt màu, đáp án đúng + giải thích vẫn hiện (FR-003, FR-008); `Semantics(liveRegion: true)`; nút "Tiếp tục" bấm được ngay khi hiệu ứng đang chạy (FR-004); backend giả độ trễ cố định → hiệu ứng bắt đầu ≤ 0,2 s sau khi kết quả hiện (SC-001).
- [X] T027 [P] [US1] Tạo `client/test/effects/trial_effects_test.dart` (dùng `client/test/support/trial_scenario.dart`): bài học mẫu của khách gọi `onAnswer` ngay sau chấm cục bộ, KHÔNG gọi `onCelebrations`, không có yêu cầu mạng nào liên quan đến hiệu ứng.
- [X] T028 [P] [US1] Tạo `client/test/effects/no_effects_in_placement_test.dart`: `placement_screen.dart` không phụ thuộc/đọc `effectsControllerProvider` và không phát cue hay hiệu ứng nào khi trả lời (FR-007).

### Hiện thực US1

- [X] T029 [US1] Tạo `client/lib/presentation/effects/effects_controller.dart` (Riverpod, `effectsControllerProvider`): `EffectsSettings { bool soundEnabled; bool visualEnabled; }` (mặc định cả hai `true`), `AnswerEffectEvent { id, correct, streakMilestone? }`, `Stream<AnswerEffectEvent> answerEvents`, `void onAnswer({required bool correct, int? streakMilestone})` theo [client-effects.md §2](contracts/client-effects.md) quy tắc 1–2 (nếu `soundEnabled` thì `stopAll` rồi `play` — `correct`/`incorrect`, hoặc `streak` khi `streakMilestone != null`; luôn phát event mới với `id` tăng dần; nuốt mọi lỗi của `SoundPlayer`). Tùy chọn của người học đăng ký lấy từ hồ sơ hiện có (provider hồ sơ/`Me` trong `client/lib/data/account_repository.dart` hoặc `session_controller.dart` — dùng trường `soundEnabled`/`visualEffectsEnabled` của API client sinh ở T009); khách: provider trong bộ nhớ, KHÔNG ghi `LocalStore`. Phụ thuộc T012, T014, T009.
- [X] T030 [P] [US1] Tạo `client/lib/presentation/effects/answer_effect.dart`: widget `AnswerEffect` lắng nghe `answerEvents`, dựng hiệu ứng theo `EffectMode` (từ `resolveEffectMode` + `MediaQuery.disableAnimationsOf(context)`) và thông số `effect_specs.dart`: Đúng = vòng xung xanh lục + cụm tia lấp lánh nhỏ một nhịp; Sai = lớp phủ hổ phách mờ dần, KHÔNG rung/lắc/đỏ gắt; `reduced` = chỉ mờ dần; `off` = không hoạt ảnh. Bọc `IgnorePointer` + `RepaintBoundary` + `ExcludeSemantics`; ≤ 40 hạt; không đổi bố cục.
- [X] T031 [US1] Thêm chuỗi l10n vi/en vào `client/lib/l10n/app_vi.arb` và `app_en.arb` (rồi sinh lại `client/lib/l10n/app_localizations*.dart` theo cách dự án đang làm): nhãn trợ năng cho thẻ phản hồi (đọc "Đúng"/"Chưa đúng"), nhãn cho lớp hiệu ứng trang trí nếu cần. Chạy `dart run tool/check_l10n.dart`.
- [X] T032 [US1] Sửa `client/lib/presentation/lesson/lesson_screen.dart`: bọc `LessonFeedback` bằng `Semantics(liveRegion: true)` (nhãn từ T031); đặt `AnswerEffect` chồng lên khu vực phản hồi mà không che câu hỏi/đáp án/nút chính (FR-026); gọi `ref.read(soundPlayerProvider).prime()` ngay trong thao tác nộp đáp án (chạm trả lời) để mở khóa âm thanh (FR-025). Phụ thuộc T029, T030, T031.
- [X] T033 [US1] Sửa `client/lib/presentation/lesson/lesson_controller.dart`: gọi `onAnswer(correct: …)` đúng khi server xác nhận kết quả MỚI (`duplicate != true`; không phát lại khi khôi phục phiên dở hoặc xả hàng đợi ngoại tuyến sau khi đã hiện kết quả) — E17, [client-effects.md §7](contracts/client-effects.md). KHÔNG đọc tốc độ/thời gian trả lời (FR-009). Phụ thuộc T029.
- [X] T034 [US1] Sửa `client/lib/presentation/trial/trial_lesson_screen.dart` (hàm `_submit`): gọi `onAnswer(correct: …)` ngay sau chấm cục bộ (`TrialExerciseData.grade`), `prime()` trong thao tác nộp, đặt `AnswerEffect`; KHÔNG gọi `onCelebrations` (FR-018). Phụ thuộc T029, T030, T031.
- [X] T035 [US1] Chạy `cd client && flutter test test/effects` (T017–T028 PHẢI xanh) và `flutter test` toàn bộ để chắc chắn không hồi quy. *(Đã xong: `flutter analyze` sạch, `flutter test` xanh, `check_l10n` đạt.)*

**Checkpoint**: US1 chạy độc lập — đã có phản hồi âm thanh/hình ảnh cho mọi nơi có đúng/sai tức thì (MVP phần "trả lời đúng").

---

## Phase 4: Câu chuyện người dùng 2 — Được chúc mừng khi đạt thành tựu (Ưu tiên: P1)

**Mục tiêu**: Backend phát hiện thành tựu/hoàn thành ngày trong giao dịch `completeSession`, trả MỘT LẦN qua `SessionSummary.celebrations`; client hiện một màn chúc mừng gộp, lớp phủ không chặn.

**Kiểm thử độc lập**: Tài khoản sát mốc hoàn thành hành động đưa qua mốc → màn chúc mừng đúng một lần với tên/mô tả, có âm thanh và hình ảnh, tắt được; tải lại/lặp lại/đăng nhập lại không hiện lại; ghi âm thầm khi đổi mục tiêu hoặc người học cũ (quickstart RF2–RF4).

### Kiểm thử cho US2 (viết TRƯỚC, phải đỏ) ⚠️

- [X] T036 [P] [US2] Tạo hồ sơ đại diện `backend/tests/fixtures/learner-profiles/reward-newcomer.json`, `reward-near-streak.json` (6 ngày học liên tiếp), `reward-veteran.json` (chuỗi 20 ngày, 120 mục, chưa có dòng thành tựu), `reward-goal-jump.json` (tỷ lệ mục tiêu nhảy mốc khi đổi cấu hình), `reward-perfect.json`; đăng ký trong `backend/tests/fixtures/learner-profiles/index.ts` theo cùng định dạng các hồ sơ hiện có.
- [X] T037 [P] [US2] Tạo `backend/tests/unit/achievements-engine.test.ts` kiểm thử hàm thuần `evaluate(input) -> { celebrate, silent }` ([data-model.md §3.2](data-model.md#32-quy-tắc-hàm-thuần-engineachievementsts)): streak/items (`silent` nếu `T ≤ before`, `celebrate` nếu `before < T ≤ after`), goal (so số nguyên `beforeDone·100 ≥ T·goalTotal`, `goalTotal = 0` bỏ qua, 100% không sai số), `first_lesson` (chỉ phiên không-ôn; `hasEarlierLesson` → silent), `perfect_lesson` (chỉ phiên không-ôn, `total > 0`, `correct = total`; `hadEarlierPerfect` → silent), phiên `review` KHÔNG BAO GIỜ tạo `first_lesson`/`perfect_lesson`, mốc đã trong `earned` bị bỏ qua, một mốc không đồng thời `silent` và `celebrate`, vượt nhiều cấp cùng lúc, và người học đại diện (mới, gần mốc chuỗi, cũ 20 ngày/120 mục → 3/7/14 và 50/100 silent, nhảy mốc do đổi mục tiêu).
- [X] T038 [P] [US2] Tạo `backend/tests/unit/goal-ratio.test.ts`: hàm dùng chung `goalRatio(...)` (T045) cho cùng kết quả với phép tính hiện tại của `getProgress` trên các hồ sơ đại diện (một nguồn duy nhất, không đổi hành vi `GET /progress`).
- [X] T039 [US2] Mở rộng `backend/tests/contract/helper.ts` với trợ giúp dựng tình huống thưởng: đặt `study_records` cho N ngày liên tiếp, đặt số mục đã học/tỷ lệ mục tiêu sát mốc, hoàn thành một phiên qua API (`/sessions/{id}/complete`), và đọc `earned_achievements`/`daily_completion_celebrations` bằng truy vấn trực tiếp. *(Ghi chú: các trợ giúp nằm ở `backend/tests/integration/reward-helpers.ts` cạnh `lesson-helpers.ts` vì `contract/helper.ts` chỉ chứa đối chiếu OpenAPI, không có kết nối CSDL.)*
- [X] T040 [US2] Tạo `backend/tests/contract/reward-us2.test.ts` ([api-changes.md §7](contracts/api-changes.md)): phiên đầu → `celebrations.achievements = [first_lesson]`; phiên hoàn hảo → `perfect_lesson` (cả hai thứ tự `first_lesson` → `perfect_lesson`); mốc chuỗi `streak_7` đúng một lần; gọi lại `complete` trên phiên đã xong KHÔNG trả `celebrations` và không ghi dòng thêm; hoàn thành mục cuối kế hoạch → `dayCompleted: true` một lần mỗi ngày kể cả học thêm và dựng lại kế hoạch cùng ngày; thứ tự trình bày; tên/mô tả theo `profile.language` (vi/en); phiên `review` không tạo `first_lesson`/`perfect_lesson`; schema khớp ajv; snapshot: các trường `SessionSummary` cũ (`correct`, `total`, `minutesSpent`, `dayCompleted`, `attentionItems`) không đổi; học viên thuộc lớp nhận thành tựu như người học cá nhân và DTO `/classes*`, `/org*` KHÔNG chứa thành tựu. Phụ thuộc T039.
- [X] T041 [US2] Tạo `backend/tests/integration/reward-achievements.test.ts` (PostgreSQL, `--project db`): (a) đồng thời — hai phiên cùng vượt một mốc → đúng một dòng và chỉ một phản hồi có mốc; (b) idempotent — gọi lại `complete`; (c) mốc `earned` ⇔ đã trả client; (d) `countItemsLearned`/`hasEarlierCompletedLesson`/`hasEarlierPerfectLesson` đúng trên dữ liệu thật (tổng quát hóa quy tắc K8, research E4); (e) đổi mục tiêu / dựng lại lộ trình / đổi lộ trình lớp làm tỷ lệ nhảy qua mốc → ghi `silent`, không chúc mừng; (f) tỷ lệ tụt dưới mốc đã đạt → dòng cũ giữ nguyên, không đạt lại; (g) người học cũ chuỗi 20 ngày → 3/7/14 ghi `silent`; (h) tạm dừng lộ trình/tiếp tục không sinh chúc mừng; (i) ranh giới ngày bằng đồng hồ giả; (j) xóa tài khoản cascade xóa hai bảng; (k) hiệu năng: p95 của `POST /sessions/{id}/complete` tăng ≤ 100 ms ở hồ sơ lớn nhất so với baseline T001 (E5). Phụ thuộc T036, T039.
- [X] T042 [P] [US2] Tạo `client/test/effects/celebration_host_test.dart`: thứ tự thẻ — lời chúc mừng ngày (nếu `dayCompleted`) trước, rồi từng thành tựu theo thứ tự phản hồi, cùng MỘT màn gộp (FR-014); không `ModalBarrier`; mọi `PointerDown` hoặc đổi tuyến đóng toàn bộ màn gộp nhưng sự kiện vẫn tới nút bên dưới (nút "Tiếp tục" dùng được ngay); tự đóng sau 3,5 s mỗi thẻ; nút ✕ có nhãn trợ năng; `Semantics(liveRegion: true)` và KHÔNG cướp tiêu điểm bàn phím; mỗi thẻ phát đúng cue (`dayComplete` cho ngày, `achievement` cho thành tựu) chỉ khi `soundEnabled`; `full` có confetti ≤ 40 hạt, `reduced` chỉ mờ vào/ra, `off` chỉ hiện một dòng thông báo tĩnh; không lưu hàng đợi ở `LocalStore` (không chúc mừng bù); không che nút thao tác chính trên màn hình hẹp, không cuộn ngang (FR-026).
- [X] T043 [P] [US2] Tạo `client/test/effects/lesson_celebrations_flow_test.dart` (dùng `lesson_scenario.dart`): `LessonController.finish()` nhận `SessionSummary.celebrations` → gọi `onCelebrations` đúng một lần; không có trường `celebrations` thì không hiện gì; bấm "Tiếp tục" trong lúc màn chúc mừng hiện → điều hướng xảy ra ngay và màn đóng; bài học mẫu của khách không bao giờ hiện chúc mừng.

### Hiện thực US2 — backend

- [X] T044 [P] [US2] Tạo `backend/src/engine/achievements.ts`: hàm thuần `evaluate(input)` theo [data-model.md §3.1–3.2](data-model.md#3-thuật-toán-đánh-giá-khi-hoàn-thành-phiên-e1-e2-e5) (đầu vào: `earned`, `isNewLesson`, `streakBefore/After`, `itemsBefore/After`, `goalDone/goalTotal/delta`, `hasEarlierLesson`, `isPerfect`, `hadEarlierPerfect`); trả `{ celebrate: code[], silent: code[] }`; bỏ qua loại đã đạt hết; không I/O, không đụng `engine/daily-plan.ts`, `path.ts`, `srs.ts`, `difficulty.ts`. Dùng danh mục T006.
- [X] T045 [P] [US2] Tạo `backend/src/db/repositories/achievements.ts`: `listEarnedCodes(db, userId)`; `insertAchievements(tx, userId, rows)` thực hiện `INSERT … ON CONFLICT (user_id, achievement_code) DO NOTHING RETURNING achievement_code` (mỗi dòng `source` = `'earned'` hoặc `'silent'`, `earned_at` = `now`); `markDayCelebrated(tx, userId, localDate, now)` thực hiện `INSERT INTO daily_completion_celebrations … ON CONFLICT DO NOTHING RETURNING 1` và trả `boolean` (đã chèn được hay không). Bảng chỉ THÊM, KHÔNG xóa/sửa (FR-017a). Phụ thuộc T004.
- [X] T046 [P] [US2] Mở rộng `backend/src/db/repositories/progress.ts`: `countItemsLearned(db, userId)` — số `item_id` KHÁC NHAU có ≥ 1 dòng `review_schedules` VÀ đơn vị chứa mục có phiên `completed`, mọi loại nội dung (tổng quát hóa quy tắc K8 của `countKanjiCharactersLearned`); `hasEarlierCompletedLesson(db, userId, excludeSessionId)` — có phiên `kind <> 'review'` nào khác đã `completed`; `hasEarlierPerfectLesson(db, userId, excludeSessionId)` — có phiên không-ôn khác đã `completed` mà mọi câu lượt chính (`is_retry = false`) đều đúng. Phụ thuộc T004.
- [X] T047 [US2] Trích hàm dùng chung `goalRatio(...)` (done/total từ `rankForContext(..., { includeMastered: true })`) khỏi `getProgress` trong `backend/src/services/progress.ts`; `getProgress` gọi lại hàm này và KHÔNG đổi hành vi `GET /progress` (golden phải xanh). Phụ thuộc T038.
- [X] T048 [US2] Tạo `backend/src/services/achievements.ts`: `evaluateOnSessionCompletion(...)` chạy BÊN TRONG giao dịch `completeSession`: đọc tập mã đã đạt một lần; chỉ tính chỉ số của loại còn mốc chưa đạt (E5) — `streakBefore` = `currentStreakDays(activeDays \ {today}, today, pauses)` (trong lớp dùng khoảng tạm dừng của lớp như `getProgress`) và `streakAfter` với tập đầy đủ; `itemsBefore/After` = `countItemsLearned` gọi trước/sau khi đánh dấu hoàn thành (chỉ khi `isNewLesson`, có `unit_id`); `goalDone/goalTotal` qua `goalRatio` và `delta` (1 nếu phiên vừa đưa một đơn vị trong phạm vi từ chưa-xong thành xong, đọc `unit_progress.status` TRƯỚC `markUnitCompleted`); gọi `evaluate`, `insertAchievements`, chỉ mốc thật sự được chèn mới được chúc mừng; nếu `dayJustCompleted` thì `markDayCelebrated`; trả `CelebrationsDto` đã bản địa hóa theo `profile.language`, sắp theo thứ tự trình bày, hoặc `undefined` khi không có gì (`dayCompleted = false` và `achievements` rỗng). Phụ thuộc T006, T044, T045, T046, T047.
- [X] T049 [US2] Tích hợp vào `completeSession` trong `backend/src/services/lesson-session.ts`: chụp trạng thái "trước" (đếm mục, `unit_progress.status` của đơn vị) TRƯỚC khi đánh dấu phiên/đơn vị hoàn thành; ghi nhận cờ `dayJustCompleted` khi vào nhánh `markPlanCompleted` (hàm hiện trả `void`); gọi `evaluateOnSessionCompletion` ngay trong giao dịch sau khi `unit_progress`/kế hoạch đã cập nhật; mở rộng `SessionSummaryDto` với `celebrations?`; nhánh trả sớm cho phiên đã hoàn thành KHÔNG chạy đánh giá và KHÔNG trả `celebrations`. Cập nhật Zod/schema phản hồi của route `POST /sessions/{id}/complete` trong `backend/src/api/sessions.ts` để serialize trường mới. Không thêm khóa hàng ngoài `FOR UPDATE` trên `lesson_sessions` đã có. Phụ thuộc T048.
- [X] T050 [US2] Chạy backend: `cd backend && pnpm typecheck && pnpm lint && pnpm test:unit` và `pnpm vitest run --project db tests/contract/reward-us2.test.ts tests/integration/reward-achievements.test.ts tests/integration/org-regression-api.test.ts tests/contract/us2.test.ts tests/integration/us2-lesson.test.ts tests/integration/concurrency.test.ts` — T037–T041 PHẢI xanh và golden/hồi quy giống baseline T001 (FR-009, Learning Engine không đổi). Phụ thuộc T049.

### Hiện thực US2 — client

- [X] T051 [US2] Thêm chuỗi l10n vi/en vào `client/lib/l10n/app_vi.arb`/`app_en.arb`: tiêu đề + mô tả thẻ "Hoàn thành ngày", nhãn nút đóng ✕, tiền tố thông báo tĩnh ("Thành tựu mới: …", "Hoàn thành ngày học!"), nhãn trợ năng của thẻ (tên/mô tả thành tựu do backend trả đã bản địa hóa). Chạy `dart run tool/check_l10n.dart`.
- [X] T052 [US2] Mở rộng `client/lib/presentation/effects/effects_controller.dart` với `void onCelebrations(Celebrations c)`: đưa `dayCompleted` (nếu có) rồi từng `achievements[i]` vào hàng đợi của `CelebrationHost`; phát một cue cho mỗi thẻ (`dayComplete` cho ngày, `achievement` cho thành tựu) chỉ khi `soundEnabled`; KHÔNG đọc/ghi `LocalStore`. Phụ thuộc T029, T009.
- [X] T053 [P] [US2] Tạo `client/lib/presentation/effects/celebration_card.dart`: thẻ thành tựu / hoàn thành ngày theo `EffectMode` — `full`: confetti thả chậm ≤ 40 hạt, ≤ 3 s, không chớp; `reduced`: không confetti, chỉ mờ vào/ra; `off`: một dòng thông báo tĩnh ngắn, đóng được bằng một thao tác; `Semantics(liveRegion: true)`, hiệu ứng trang trí `ExcludeSemantics`; nút ✕ có nhãn trợ năng.
- [X] T054 [US2] Tạo `client/lib/presentation/effects/celebration_host.dart`: widget bọc nội dung dạng `Stack[ child, host ]`, KHÔNG `ModalBarrier`; lắng nghe `PointerDown` toàn ứng dụng (`HitTestBehavior.translucent`) và đổi tuyến để đóng toàn bộ màn gộp mà sự kiện vẫn chạm tới nút bên dưới; tự đóng sau 3,5 s mỗi thẻ; hàng đợi "ngày trước, thành tựu theo thứ tự" trong cùng một màn gộp; không lấy tiêu điểm bàn phím; không lưu hàng đợi ở nơi nào. Phụ thuộc T052, T053.
- [X] T055 [US2] Sửa `client/lib/app.dart`: dùng `MaterialApp.router(builder: …)` bọc `CelebrationHost` quanh router để thẻ sống qua điều hướng "Tiếp tục". Phụ thuộc T054.
- [X] T056 [US2] Sửa `client/lib/presentation/lesson/lesson_controller.dart` (hàm `finish()`): sau khi nhận `SessionSummary`, nếu `celebrations` có mặt thì `ref.read(effectsControllerProvider).onCelebrations(...)` (chỉ khi lần hoàn thành thật sự mới; client không tự tính mốc). Phụ thuộc T052.
- [X] T057 [US2] Chạy `cd client && flutter test test/effects` (T042–T043 xanh). Phụ thuộc T055, T056, T050. *(Đã xong: `flutter test` 381/381 xanh, `flutter analyze` sạch, `check_l10n` đạt.)*

**Checkpoint**: US1 + US2 hoạt động độc lập — đã đủ hai câu chuyện P1 của yêu cầu ban đầu.

---

## Phase 5: Câu chuyện người dùng 3 — Tự điều chỉnh hoặc tắt hiệu ứng (Ưu tiên: P2, BẮT BUỘC trước khi phát hành)

**Mục tiêu**: Hai tùy chọn độc lập "Âm thanh" và "Hiệu ứng hình ảnh" (lưu theo tài khoản; khách chỉ trong bộ nhớ), nút tắt tiếng nhanh trong bài, tôn trọng "giảm chuyển động", kết quả/thành tựu luôn truyền đạt được khi tắt.

**Kiểm thử độc lập**: Bật/tắt từng tùy chọn, làm vài bài tập và một hành động đạt thành tựu: tắt âm thanh → không tiếng nhưng hình ảnh còn; tắt hiệu ứng hình ảnh → không hoạt ảnh, đúng/sai và thành tựu vẫn rõ; thiết lập giữ sau đăng nhập lại; giảm chuyển động → dạng tĩnh/mờ (quickstart RF5).

### Kiểm thử cho US3 (viết TRƯỚC, phải đỏ) ⚠️

- [X] T058 [P] [US3] Tạo `backend/tests/contract/reward-us3.test.ts`: `PATCH /me` với `soundEnabled`/`visualEffectsEnabled` lưu và `GET /me` trả đúng; giữ nguyên qua đăng xuất/đăng nhập lại; mặc định `true` cho người học mới và cũ; PATCH chỉ hai trường này không sinh lại lộ trình, không đụng kế hoạch, không cần `currentPassword`; học viên thuộc lớp PATCH được (200, KHÔNG `CLASS_MANAGED`); kiểu sai (chuỗi/số) → 422 `VALIDATION_FAILED`; ma trận phân quyền `tests/fixtures/authz-matrix.json` không thêm dòng và `org-authz-matrix.test.ts` vẫn đạt. *(Ghi chú: phía backend của hai tùy chọn đã làm ở T010–T011 nên test xanh ngay khi viết; các test client mới của US3 thì viết trước khi gắn UI.)*
- [X] T059 [P] [US3] Tạo `client/test/effects/settings_section_test.dart`: `EffectsSettingsSection` hiện hai công tắc "Âm thanh" và "Hiệu ứng hình ảnh", mặc định bật, độc lập nhau; đổi giá trị gọi `PATCH /me` đúng trường; thất bại thì hoàn lại giá trị và báo lỗi chung; học viên thuộc lớp KHÔNG thấy công tắc bị khóa.
- [X] T060 [P] [US3] Tạo `client/test/effects/quick_control_test.dart`: `EffectsQuickControl` ở thanh tiêu đề `LessonScreen` và `TrialLessonScreen` tắt/bật âm thanh bằng MỘT thao tác không rời bài; có `tooltip` + nhãn trợ năng; trạng thái thể hiện bằng biểu tượng (không chỉ màu); với khách có thêm nút bật/tắt hiệu ứng hình ảnh; âm thanh tắt → `MemorySoundPlayer.played` rỗng nhưng hình ảnh vẫn hiện (US3.3).
- [X] T061 [P] [US3] Tạo `client/test/effects/reduced_motion_test.dart`: `MediaQuery(disableAnimations: true)` với `visualEnabled=true` → `EffectMode.reduced` ở `AnswerEffect` và `CelebrationCard` (không confetti, không chuyển động tịnh tiến/xoay, chỉ mờ/tĩnh); `visualEnabled=false` → `off`: kết quả đúng/sai vẫn hiện bằng biểu tượng + chữ, thành tựu hiện bằng một dòng thông báo tĩnh tự biến và đóng được, vẫn không chặn; âm thanh độc lập với chế độ hình ảnh.
- [X] T062 [P] [US3] Tạo `client/test/effects/guest_settings_not_persisted_test.dart`: khách đổi tùy chọn → chỉ áp dụng trong phiên; KHÔNG có yêu cầu mạng nào; `LocalStore`/`TokenStore` (và `sessionStorage` mô phỏng) không có khóa tùy chọn; dựng lại `ProviderScope` (mô phỏng tải lại trang) → quay về mặc định cả hai bật.

### Hiện thực US3

- [X] T063 [US3] Mở rộng `client/lib/presentation/effects/effects_controller.dart` với `Future<void> setSound(bool)` và `Future<void> setVisual(bool)`: người học đăng ký → cập nhật lạc quan rồi `PATCH /me` (`soundEnabled`/`visualEffectsEnabled`), thất bại thì hoàn lại và báo lỗi chung; khách → cập nhật provider trong bộ nhớ, KHÔNG gọi mạng, KHÔNG ghi `LocalStore`. Phụ thuộc T029, T011, T009.
- [X] T064 [P] [US3] Tạo `client/lib/presentation/effects/effects_settings_section.dart`: mục "Hiệu ứng" gồm hai `SwitchListTile` "Âm thanh" và "Hiệu ứng hình ảnh" (mặc định bật, dùng `setSound`/`setVisual`), có mô tả ngắn; tìm và đổi được trong ≤ 10 giây (SC-005).
- [X] T065 [US3] Sửa `client/lib/presentation/profile/profile_screen.dart`: gắn `EffectsSettingsSection` (không bọc `locked_control` — hai trường này không bị khóa khi thuộc lớp). Phụ thuộc T064.
- [X] T066 [P] [US3] Tạo `client/lib/presentation/effects/effects_quick_control.dart`: nút bật/tắt âm thanh một thao tác (biểu tượng loa bật/tắt, `tooltip`, `Semantics` nhãn); tham số `showVisualToggle` cho khách để thêm nút hiệu ứng hình ảnh cạnh nút âm thanh.
- [X] T067 [US3] Gắn `EffectsQuickControl` vào thanh tiêu đề của `client/lib/presentation/lesson/lesson_screen.dart` (người học) và `client/lib/presentation/trial/trial_lesson_screen.dart` (khách, `showVisualToggle: true`). Phụ thuộc T066, T032, T034.
- [X] T068 [US3] Thêm chuỗi l10n vi/en cho mục "Hiệu ứng" ở Hồ sơ ("Hiệu ứng", "Âm thanh", "Hiệu ứng hình ảnh", mô tả), nhãn/tooltip nút tắt tiếng nhanh và nút hiệu ứng hình ảnh của khách (`client/lib/l10n/app_vi.arb`, `app_en.arb`); chạy `dart run tool/check_l10n.dart`.
- [X] T069 [US3] Rà soát `client/lib/presentation/effects/answer_effect.dart`, `celebration_card.dart`, `celebration_host.dart` để chế độ `reduced`/`off` đúng T061 (không còn chuyển động ở `reduced`; thông báo tĩnh ở `off` tự biến sau vài giây, đóng được bằng một thao tác, không chặn) và sửa nếu thiếu. Phụ thuộc T061.
- [X] T070 [US3] Chạy `cd backend && pnpm vitest run --project db tests/contract/reward-us3.test.ts tests/contract/org-authz-matrix.test.ts` và `cd client && flutter test test/effects`. Phụ thuộc T058–T069. *(Đã xong: `reward-us3` + `org-authz-matrix` 908/908 xanh trên PostgreSQL nhúng; `flutter test test/effects` 93/93 xanh; `flutter test` 409/409 xanh, `flutter analyze` sạch, `check_l10n` đạt.)*

**Checkpoint**: US1–US3 hoạt động; đủ điều kiện phát hành (spec: US3 bắt buộc xong trước phát hành).

---

## Phase 6: Câu chuyện người dùng 4 — Động lực khi trả lời đúng liên tiếp (Ưu tiên: P3)

**Mục tiêu**: Đếm câu đúng liên tiếp (chỉ lượt chính) trong một phiên và tăng mức phản hồi ở ngưỡng 3/5/10; về 0 khi sai hoặc phiên mới; không lưu, không là thành tựu.

**Kiểm thử độc lập**: Trong một bài, đúng liên tiếp rồi sai một câu: mức phản hồi tăng ở ngưỡng, trở lại thường sau câu sai (quickstart RF6).

### Kiểm thử cho US4 (viết TRƯỚC, phải đỏ) ⚠️

- [X] T071 [P] [US4] Tạo `client/test/effects/lesson_streak_test.dart`: `LessonState.correctStreak` +1 mỗi câu đúng lượt chính, về 0 khi sai lượt chính; câu ở giai đoạn `retry` nhận phản hồi đúng/sai thường nhưng KHÔNG đổi bộ đếm (E15); `onAnswer` nhận `streakMilestone` 3/5/10 chỉ khi vừa chạm ngưỡng (cue `streak` + huy hiệu "N liên tiếp"); sau câu sai chỉ có phản hồi sai nhẹ thông thường; hủy controller/phiên mới → bộ đếm bắt đầu từ 0; không có yêu cầu mạng, không có khóa `LocalStore`; bài học mẫu của khách và bài ôn dùng cùng quy tắc.

### Hiện thực US4

- [X] T072 [US4] Sửa `client/lib/presentation/lesson/lesson_controller.dart`: thêm `correctStreak` vào `LessonState` (mất khi controller bị hủy); cập nhật bộ đếm chỉ với lượt chính; tính `streakMilestone` ∈ {3, 5, 10} khi vừa chạm ngưỡng và truyền vào `onAnswer`. Phụ thuộc T033, T071.
- [X] T073 [US4] Áp cùng quy tắc cho bài học mẫu: thêm bộ đếm đúng liên tiếp (chỉ lượt chính) vào `client/lib/presentation/trial/trial_state.dart` và gọi `onAnswer(streakMilestone: …)` trong `client/lib/presentation/trial/trial_lesson_screen.dart`. Phụ thuộc T034, T071. *(Ghi chú lệch: bộ đếm của khách nằm ở `_TrialLessonScreenState` (`ValueNotifier<CorrectStreak>`, giữ qua các đơn vị) chứ KHÔNG ở `trial_state.dart`, vì `TrialState` được lưu vào `LocalStore` còn bộ đếm phải chỉ sống trong bộ nhớ; quy tắc đếm dùng chung với bài học qua `client/lib/presentation/effects/correct_streak.dart`.)*
- [X] T074 [US4] Mở rộng `client/lib/presentation/effects/answer_effect.dart` với huy hiệu "N liên tiếp" nảy nhẹ cạnh thẻ phản hồi (`full`: nảy một nhịp ≤ 700 ms; `reduced`: chỉ hiện/mờ; `off`: chữ tĩnh); đảm bảo `effects_controller.dart` đã phát cue `streak` khi có `streakMilestone` (T029) và không thưởng theo tốc độ (FR-009). Phụ thuộc T072.
- [X] T075 [US4] Thêm chuỗi l10n vi/en cho huy hiệu "N liên tiếp" (có số, dùng ICU plural nếu dự án đang dùng) trong `client/lib/l10n/app_vi.arb`/`app_en.arb`; chạy `dart run tool/check_l10n.dart`; chạy `cd client && flutter test test/effects/lesson_streak_test.dart`. Phụ thuộc T074. *(Đã xong: khóa `effectsStreakBadge` = "{count} liên tiếp" / "{count} in a row", đủ vi/en; `lesson_streak_test.dart` xanh.)*

**Checkpoint**: Cả bốn câu chuyện hoạt động độc lập.

---

## Phase 7: Hoàn thiện và các vấn đề xuyên suốt

**Mục đích**: Chỉ số sản phẩm, hồi quy, hiệu năng, riêng tư và kiểm chứng cuối.

- [X] T076 Mở rộng `backend/src/reports/product-metrics.sql` ([research E19](research.md)) với hai khối `-- name:` không tham số: (a) SC-006 — tỷ lệ người học hoạt động ≥ 14 ngày có `sound_enabled = false AND visual_effects_enabled = false`; (b) SC-007 — tỷ lệ quay lại ngày kế tiếp sau ngày hoàn thành kế hoạch, so hai giai đoạn trước/sau ngày ra mắt lấy từ `SELECT min(earned_at)::date FROM earned_achievements`. Phụ thuộc T004.
- [X] T077 [P] Mở rộng `backend/tests/integration/reports.test.ts`: hai khối mới chạy được, trả đúng cấu trúc và kết quả trên dữ liệu dựng sẵn (kể cả trường hợp chưa có dòng `earned_achievements`). Phụ thuộc T076.
- [X] T078 [P] Mở rộng `backend/tests/integration/org-privacy.test.ts` (hoặc `class-dashboard.test.ts`): xác nhận mọi DTO `/classes*`, `/org*` KHÔNG chứa trường thành tựu/hiệu ứng và snapshot khóa DTO của spec 004 vẫn đạt (thành tựu không lộ cho giáo viên/tổ chức).
- [X] T079 [P] Chạy `cd client && dart run tool/check_l10n.dart` và `flutter test test/l10n_keys_test.dart`: khóa vi/en khớp nhau, không chuỗi cứng tiếng Việt/Anh trong `client/lib/presentation/effects/`.
- [X] T080 [P] Thêm kịch bản đo SC-002 vào `client/test/effects/` (ví dụ `plan_duration_test.dart`, đồng hồ giả, `lesson_scenario.dart`): thời gian hoàn thành một kế hoạch điển hình với hiệu ứng không tăng quá 3% so với tắt hiệu ứng; không có thời gian chờ nào sau khi trả lời; `estMinutes`/quỹ thời gian của kế hoạch không đổi (FR-004).
- [X] T081 Chạy lại toàn bộ hồi quy Learning Engine: `cd backend && pnpm vitest run --project db tests/integration/org-regression-api.test.ts` và các kiểm thử golden kế hoạch/tiến độ (`plans-pre-org.json`, `api-pre-org.json`) — kết quả giống baseline T001, chứng minh `engine/daily-plan.ts`, `path.ts`, `srs.ts`, `difficulty.ts` và `GET /path`, `GET /progress`, kế hoạch 14 ngày KHÔNG đổi (FR-009). Phụ thuộc mọi nhiệm vụ backend. *(Đã xong: `org-regression-api`, `us2`, `us2-lesson` xanh; golden unit xanh trong T083; chỉ `engine/progress.ts` được THÊM `goalRatio`, không đổi `daily-plan/path/srs/difficulty`.)*
- [X] T082 Rà soát CSP/bảo mật: xác nhận `client/web/index.html` và `client/nginx.conf` KHÔNG cần nới (`default-src 'self'`, không `media-src` riêng), `backend/tests/unit/web-csp.test.ts` vẫn đạt.
- [X] T083 Chạy toàn bộ kiểm tra chất lượng: `cd backend && pnpm typecheck && pnpm lint && pnpm test` (so với baseline T001: chỉ năm test spec 003 đỏ sẵn) và `cd client && flutter analyze && flutter test`. *(Đã xong: typecheck + lint sạch; backend 2370/2375 xanh — chỉ 5 test spec 003 đỏ sẵn (`kanji-admin` ×4, `kanji-us5` ×1) như baseline; client `flutter analyze` sạch, `flutter test` 412/412 xanh.)*
- [X] T084 Chạy `pnpm report:metrics` (RF8) trên dữ liệu kiểm thử và ghi các điểm lệch (nếu có) vào mô tả commit. Phụ thuộc T083. *(Đã xong: hai truy vấn mới chạy được qua `tsx src/reports/run.ts`; CSDL kiểm thử rỗng sau TRUNCATE nên chỉ trả cấu trúc, tỷ lệ NULL — không có điểm lệch.)*

---

## Phụ thuộc và thứ tự thực thi

### Phụ thuộc giữa các phase

- **Setup (Phase 1)**: không phụ thuộc — làm ngay (T001 PHẢI xong TRƯỚC khi sửa dịch vụ backend).
- **Foundational (Phase 2)**: phụ thuộc Setup — CHẶN mọi câu chuyện.
- **Câu chuyện (Phase 3–6)**: phụ thuộc Foundational; làm theo ưu tiên P1 → P2 → P3 hoặc song song nếu đủ người.
- **Polish (Phase 7)**: phụ thuộc các câu chuyện mong muốn đã xong.

### Phụ thuộc giữa các câu chuyện

- **US1 (P1)**: bắt đầu sau Foundational; không phụ thuộc câu chuyện khác.
- **US2 (P1)**: bắt đầu sau Foundational; phần backend độc lập với US1; phần client (T052, T056) dùng `effects_controller.dart` và `lesson_controller.dart` đã tạo ở US1 (T029, T033) nên làm sau US1 hoặc phối hợp trên cùng file.
- **US3 (P2)**: bắt đầu sau Foundational; phần UI cần `LessonScreen`/`TrialLessonScreen` đã gắn hiệu ứng (T032, T034) và `effects_controller.dart` (T029); phần hồ sơ backend đã nằm ở Foundational (T010–T011). BẮT BUỘC xong trước phát hành.
- **US4 (P3)**: sau US1 (mở rộng `lesson_controller.dart`, `answer_effect.dart`).

### Trong mỗi câu chuyện

- Kiểm thử viết TRƯỚC và PHẢI đỏ trước khi hiện thực.
- Hàm thuần/danh mục → repository → dịch vụ → tích hợp `completeSession`.
- Controller/hàm thuần → widget → gắn vào màn hình.
- Xong câu chuyện (chạy kiểm thử của nó) rồi mới sang câu chuyện kế.

### Cơ hội chạy song song

- Foundational: T005, T006→T007, T012, T015, T019–T022 chạy song song (khác file); T008→T009 và T003→T004→T011 là hai chuỗi độc lập.
- US1: T024–T028 (kiểm thử) song song; T030 song song với T029.
- US2: T036–T038, T042–T043 (kiểm thử) song song; T044, T045, T046 (engine/repository) song song; T053 song song với T052.
- US3: T058–T062 song song; T064 và T066 song song.
- Backend và client của cùng một câu chuyện có thể do hai người làm song song sau khi xong Foundational.

---

## Ví dụ chạy song song: US2

```bash
# Kiểm thử US2 chạy cùng lúc (khác file):
Task: "achievements-engine unit test trong backend/tests/unit/achievements-engine.test.ts"      # T037
Task: "goal-ratio unit test trong backend/tests/unit/goal-ratio.test.ts"                        # T038
Task: "celebration_host_test trong client/test/effects/celebration_host_test.dart"              # T042
Task: "lesson_celebrations_flow_test trong client/test/effects/lesson_celebrations_flow_test.dart"  # T043

# Hiện thực backend độc lập (khác file):
Task: "engine/achievements.ts hàm thuần evaluate"                    # T044
Task: "db/repositories/achievements.ts"                              # T045
Task: "db/repositories/progress.ts countItemsLearned & hasEarlier*"  # T046
```

---

## Chiến lược triển khai

### MVP trước (US1, rồi US2 cho đủ hai câu chuyện P1)

1. Hoàn thành Phase 1: Setup.
2. Hoàn thành Phase 2: Foundational (CHẶN mọi câu chuyện).
3. Hoàn thành Phase 3: US1.
4. **DỪNG và KIỂM CHỨNG**: kiểm thử US1 độc lập (RF1). Demo được: mỗi câu trả lời có âm thanh + hiệu ứng, kiểm tra trình độ không có hiệu ứng.
5. Hoàn thành Phase 4: US2 — không phát hành US2 khi thiếu kiểm thử đồng thời và "không chúc mừng bù/không chúc mừng lại" (T040, T041).
6. Hoàn thành Phase 5: US3 — BẮT BUỘC trước khi phát hành vì người học văn phòng học ở nơi cần yên lặng và Nguyên tắc III.

### Giao hàng tăng dần

1. Setup + Foundational → nền sẵn sàng.
2. US1 → kiểm thử độc lập → demo (MVP).
3. US2 → kiểm thử độc lập → demo.
4. US3 → kiểm thử độc lập → ĐỦ ĐIỀU KIỆN PHÁT HÀNH.
5. US4 → kiểm thử độc lập → bổ sung (P3, không chặn phát hành).
6. Mỗi câu chuyện thêm giá trị mà không làm hỏng câu chuyện trước. Phát hành client và backend cùng lúc (client 1.12.0 cũ bỏ qua trường mới nhưng thành tựu sẽ bị "tiêu" không ai thấy).

### Chiến lược nhiều người

1. Cả nhóm cùng Setup + Foundational.
2. Sau đó: Người A — US1 (client); Người B — US2 phần backend (T036–T050); Người C — US3 phần backend/kiểm thử hợp đồng rồi UI sau khi US1 gắn xong màn hình.
3. Hợp nhất ở Polish.

---

## Ghi chú

- [P] = khác file, không phụ thuộc nhiệm vụ chưa xong.
- Nhãn [Story] liên kết nhiệm vụ với câu chuyện để truy vết.
- Kiểm thử PHẢI đỏ trước khi hiện thực; commit sau mỗi nhiệm vụ hoặc nhóm logic.
- Dừng ở mỗi checkpoint để kiểm chứng câu chuyện độc lập.
- Tránh: nhiệm vụ mơ hồ, xung đột cùng file (ghi chú các nhiệm vụ cùng file như `lesson_screen.dart`, `lesson_controller.dart`, `effects_controller.dart`, `answer_effect.dart` — đã đặt tuần tự theo phụ thuộc), phụ thuộc chéo phá tính độc lập.
- **Điểm cần chủ dự án biết khi hiện thực** (research "Điểm cần xác nhận"): #1 bài ghép cặp — một hiệu ứng cho mỗi lần nộp (E16), spec US1.3 nên được chỉnh câu chữ hoặc chạy `/speckit-clarify`; #2 định nghĩa "tổng số mục đã học" (T046 `countItemsLearned`); #5 khách tải lại trang quay về mặc định (T062); #6 chuỗi đúng chỉ đếm lượt chính (T071–T072).
