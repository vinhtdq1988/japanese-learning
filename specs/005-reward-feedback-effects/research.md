# Nghiên cứu (Phase 0): Hiệu ứng âm thanh và hình ảnh khi trả lời đúng và đạt thành tựu

**Nhánh**: `005-reward-feedback-effects` | **Đặc tả**: [spec.md](spec.md) | **Kế hoạch**: [plan.md](plan.md)

Tài liệu này giải quyết mọi điểm chưa rõ của Bối cảnh kỹ thuật. Mỗi quyết định có dạng **Quyết định / Lý do / Phương án đã xét**. Mã `E1…E16` được tham chiếu từ plan, data-model và hợp đồng. Hiện trạng mã nguồn được khảo sát trực tiếp (backend `services/lesson-session.ts`, `services/progress.ts`, `engine/progress.ts`; client `presentation/lesson/*`, `presentation/trial/*`, `platform/*`).

## Hiện trạng đã khảo sát (căn cứ cho các quyết định)

- **Phản hồi đúng/sai tức thì** nằm ở một chỗ duy nhất cho bài học và ôn tập: `LessonController` + `LessonFeedback` ([lesson_screen.dart](../../client/lib/presentation/lesson/lesson_screen.dart)); bài học mẫu của khách có luồng riêng ở `trial_lesson_screen.dart` (chấm cục bộ qua `TrialExerciseData.grade`). Bài kiểm tra trình độ (`placement_screen.dart`) không có phản hồi từng câu.
- **Client không biết đáp án**: `Exercise.payload` không chứa đáp án; kết quả đúng/sai đến từ server (`POST /sessions/{id}/answers`), nên hiệu ứng buộc phải gắn với kết quả đã được xác nhận (trừ bài học mẫu chấm cục bộ).
- **Bài ghép cặp** hiện nộp **cả bài** một lần bằng nút "Kiểm tra" (`matching_exercise.dart`), không có xác nhận từng cặp.
- **Hoàn thành phiên** là `completeSession` (một giao dịch): đánh dấu phiên, mục kế hoạch, kế hoạch ngày, `unit_progress`, độ khó thích ứng; gọi lại trên phiên đã xong chỉ trả lại tóm tắt (đã idempotent). `SessionSummary.dayCompleted` đã có nhưng được tính lại cả khi gọi lại, nên **không** dùng làm tín hiệu "chúc mừng một lần".
- **Số liệu tiến độ đã có**: chuỗi ngày `currentStreakDays` (tính từ `study_records.local_date`, có xử lý tạm dừng), `goal.completionRatio` (số đơn vị xong / đơn vị trong phạm vi lộ trình hoặc lớp), số chữ Kanji đã học (`countKanjiCharactersLearned`). **Chưa có** tổng số mục đã học cho từ vựng/ngữ pháp.
- **Hồ sơ học tập** `learning_profiles` đã có `language` và đồng bộ với client; `PATCH /me` là đường sửa hồ sơ; danh sách trường bị khóa khi thuộc lớp là `CLASS_LOCKED_PROFILE_FIELDS` (spec 004).
- **CSP** của client (nginx và thẻ meta): `default-src 'self'` không có `media-src` riêng ⇒ âm thanh cùng origin dùng được, không cần nới CSP.

## Quyết định

### E1. Phát hiện thành tựu ở backend, trong giao dịch `completeSession`

- **Quyết định**: Việc phát hiện, ghi nhận và quyết định "chúc mừng hay không" do **backend** thực hiện trong cùng giao dịch hoàn thành phiên; kết quả trả về **một lần** trong `SessionSummary.celebrations` (tùy chọn). Client chỉ hiển thị, KHÔNG tự tính mốc.
- **Lý do**: FR-012/FR-016 đòi "tối đa một lần cho mỗi người học" qua nhiều cửa sổ/thiết bị và "chỉ sau khi kết quả đã được ghi nhận" — chỉ CSDL làm được chắc chắn (khóa duy nhất). Số liệu nguồn (chuỗi, tiến độ) vốn nằm ở backend; Nguyên tắc VI cấm đẩy quy tắc nghiệp vụ sang client. Phản hồi trả một lần khớp Làm rõ Q1 (không chúc mừng bù).
- **Phương án đã xét**: (a) client tính mốc từ `GET /progress` rồi tự nhớ cái đã chúc mừng ở LocalStore — sai khi đổi thiết bị/hai cửa sổ, vi phạm FR-012; (b) bảng "thành tựu chưa chúc mừng" + endpoint lấy và xác nhận đã xem — thêm trạng thái cần xử lý về sau mà spec đã loại bỏ (Làm rõ Q1) và dễ dẫn tới chúc mừng bù; (c) job nền phát hiện thành tựu — chậm, không gắn với khoảnh khắc đạt.

### E2. Phân biệt "đạt nhờ học" và "vượt mốc do thay đổi khác" bằng so sánh trước/sau của chính lần hoàn thành

- **Quyết định**: Mỗi chỉ số (chuỗi ngày, tổng mục đã học, tỷ lệ mục tiêu) được tính **hai lần** quanh lần hoàn thành: `trước` (không tính tác động của phiên này) và `sau`. Với mỗi mốc chưa ghi nhận:
  - mốc ≤ `trước` → ghi **âm thầm** (`source = 'silent'`);
  - `trước` < mốc ≤ `sau` → ghi **và chúc mừng** (`source = 'earned'`);
  - mốc > `sau` → chưa làm gì.

  Cách tính "trước" cho từng chỉ số: chuỗi ngày = chuỗi tính đến hết hôm qua (loại ngày hôm nay khỏi tập ngày hoạt động); tổng mục đã học = đếm trước khi đánh dấu phiên hoàn thành; tỷ lệ mục tiêu = `(done − Δ) / N` với cùng mẫu số `N` hiện tại, `Δ = 1` khi phiên này là lần đầu hoàn thành một đơn vị nằm trong phạm vi lộ trình/lớp, ngược lại `Δ = 0`.
- **Lý do**: Một công thức duy nhất giải quyết cùng lúc ba yêu cầu: FR-017 (người có tiến độ sẵn trước khi ra mắt được ghi âm thầm, không chúc mừng dồn dập), FR-017a (đổi mục tiêu, dựng lại lộ trình, giáo viên đổi lộ trình lớp làm tỷ lệ nhảy qua mốc → ghi âm thầm; chỉ chúc mừng khi tiến độ tăng nhờ kết quả học) và Làm rõ Q1. Không cần cờ "thời điểm ra mắt", không cần job backfill, không cần móc vào các luồng đổi mục tiêu/dựng lại lộ trình/đổi lớp (nhiều điểm, dễ sót). Mốc đã đạt không bao giờ bị thu hồi vì bảng chỉ thêm, không xóa (FR-017a).
- **Phương án đã xét**: (a) job backfill một lần khi ra mắt + hook âm thầm ở mọi chỗ đổi mục tiêu/lộ trình/lớp — nhiều điểm chạm, dễ bỏ sót (ví dụ giáo viên đổi lộ trình lớp khi học viên ngoại tuyến); (b) lưu "điểm kiểm" tỷ lệ cuối cùng cho mỗi người học và so sánh — thêm trạng thái phải giữ đồng bộ, vẫn sai khi mẫu số đổi.

### E3. Danh mục thành tựu là hằng số trong mã, không là bảng

- **Quyết định**: Danh mục cố định 16 mốc nằm trong `backend/src/domain/achievements.ts` (mã, loại, ngưỡng, tên/mô tả vi–en) — xem [contracts/achievement-catalog.md](contracts/achievement-catalog.md). Bảng chỉ lưu bản ghi **đã đạt** theo `achievement_code`.
- **Lý do**: Spec yêu cầu "danh mục cố định" và đưa mốc cụ thể vào Giả định ("có thể điều chỉnh về sau mà không đổi hành vi"). Điều chỉnh mốc là thay đổi sản phẩm có kiểm thử đi kèm, không cần công cụ quản trị. Nguyên tắc VI chỉ buộc **nội dung học** là dữ liệu quản lý độc lập; danh mục thành tựu không phải nội dung học. Tránh bảng + seed + màn quản trị chưa ai yêu cầu (độ phức tạp).
- **Phương án đã xét**: bảng `achievement_definitions` được seed — thêm bảng, seed, đồng bộ i18n mà không có người dùng quản trị nào cần; có thể chuyển sang bảng sau mà không đổi hợp đồng vì client chỉ nhận mã + tên + mô tả đã bản địa hóa.

### E4. Định nghĩa các chỉ số

| Chỉ số | Nguồn | Ghi chú |
|---|---|---|
| Chuỗi ngày | `currentStreakDays(activeDays, today, pauses)` (đã có; trong lớp dùng khoảng tạm dừng của lớp như `getProgress`) | Không đổi cách tính (Giả định). |
| Tỷ lệ mục tiêu | `done / ranked.length` từ `rankForContext(..., {includeMastered: true})` — **cùng** phép tính của `getProgress`; trích thành hàm dùng chung `goalRatio(...)` | So mốc bằng số nguyên `done·100 ≥ T·N` (tránh sai số dấu phẩy động ở 100%). |
| Tổng mục đã học | **Mới**: số `item_id` khác nhau có ≥ 1 dòng `review_schedules` VÀ đơn vị chứa mục có phiên `completed` (mọi loại nội dung) | Tổng quát hóa đúng quy tắc K8 của `countKanjiCharactersLearned` (Kanji chỉ là một trường hợp riêng). |
| Bài học đầu tiên | Phiên `new_unit`/`extra` hoàn thành đầu tiên (loại `review`) | Có phiên không-ôn hoàn thành từ trước → ghi âm thầm. |
| Bài hoàn hảo | Phiên không-ôn có `total > 0` và mọi câu **lượt chính** (`is_retry = false`) đúng | Có phiên hoàn hảo từ trước → ghi âm thầm (chỉ khi mốc chưa ghi nhận). |

Spec nói tổng mục đã học "dùng đúng cách tính đã có", nhưng hiện chỉ có số chữ Kanji (K8) và số bài hoàn thành; chưa có tổng cho từ vựng/ngữ pháp. Quyết định tổng quát hóa K8 giữ nguyên tinh thần ("đã học" = đã lên lịch ôn **và** bài chứa đã hoàn thành) và không đổi con số nào đang hiển thị. Ghi ở "Điểm cần xác nhận" #2.

### E5. Chỉ đánh giá những mốc còn thiếu; chi phí mỗi lần hoàn thành bị chặn

- **Quyết định**: Đọc tập mã đã đạt (≤ 16 dòng, khóa chính `(user_id, achievement_code)`) một lần; chỉ tính chỉ số của loại còn mốc chưa đạt. Người đã đạt hết một loại thì bỏ qua truy vấn tương ứng (ví dụ đạt `goal_100` thì không cần `rankForContext`).
- **Lý do**: `rankForContext` và `listActiveDays` là phần đắt nhất; người học lâu năm không nên trả chi phí đó mỗi phiên. Mục tiêu: `POST /sessions/{id}/complete` p95 tăng ≤ 100 ms so với hiện tại ở hồ sơ đại diện lớn nhất (đo trong kiểm thử tích hợp).
- **Phương án đã xét**: đánh giá tất cả mỗi lần — đơn giản nhưng lãng phí; lưu chỉ số tổng hợp sẵn — thêm nguồn dữ liệu thứ hai dễ lệch.

### E6. Chúc mừng hoàn thành ngày: bảng đánh dấu theo ngày

- **Quyết định**: Bảng nhỏ `daily_completion_celebrations (user_id, local_date)` khóa chính kép. Trong `completeSession`, nếu kế hoạch vừa chuyển sang `completed` ở giao dịch này thì `INSERT … ON CONFLICT DO NOTHING RETURNING`; chỉ khi chèn được mới đặt `celebrations.dayCompleted = true`.
- **Lý do**: FR-015 "tối đa một lần mỗi ngày, kể cả học thêm". Chỉ dựa vào chuyển trạng thái kế hoạch chưa đủ: dựng lại lộ trình/kế hoạch trong ngày có thể sinh một kế hoạch mới cùng ngày rồi hoàn thành lần hai. Bảng này chặn tuyệt đối. `local_date` là ngày địa phương của kế hoạch (múi giờ người học, như `study_records.local_date`).
- **Phương án đã xét**: cột `celebrated_at` trên `daily_plans` — kế hoạch dựng lại là dòng mới nên không chặn được; dùng `SessionSummary.dayCompleted` — được tính lại ở lần gọi sau (không phải tín hiệu một lần).

### E7. Hình dạng hợp đồng: `SessionSummary.celebrations` tùy chọn

- **Quyết định**: Thêm trường tùy chọn `celebrations: { dayCompleted: boolean, achievements: AchievementEarned[] }` vào `SessionSummary`. Chỉ có mặt trong phản hồi của lần gọi **thực sự hoàn thành** phiên và chỉ khi có ít nhất một thứ để chúc mừng; gọi lại (idempotent) KHÔNG trả trường này. `AchievementEarned` mang `code`, `kind`, `threshold` (nếu có), `name`, `description` đã bản địa hóa theo ngôn ngữ hồ sơ. OpenAPI 1.12.0 → 1.13.0, chỉ bổ sung ([contracts/api-changes.md](contracts/api-changes.md)).
- **Lý do**: Khớp Làm rõ Q1 và FR-016 ("báo cho client đúng một lần, trong phản hồi của chính lần ghi nhận"). Một phản hồi chứa cả lời chúc mừng ngày lẫn thành tựu đáp ứng trực tiếp "màn gộp duy nhất" (FR-014) với thứ tự ngày-trước-thành-tựu do client giữ. Client cũ bỏ qua trường lạ.
- **Phương án đã xét**: endpoint riêng `GET /me/celebrations` — cần trạng thái "chưa lấy", đi ngược Q1; sự kiện đẩy (WebSocket/SSE) — thêm hạ tầng không cần thiết.

### E8. Tùy chọn hiệu ứng lưu trong hồ sơ học tập

- **Quyết định**: Hai cột boolean `sound_enabled`, `visual_effects_enabled` (mặc định `true`, `NOT NULL`) trên `learning_profiles`; lộ ra qua `Profile` và `ProfileUpdate` (`soundEnabled`, `visualEffectsEnabled`) của `GET/PATCH /me`. KHÔNG thêm vào `CLASS_LOCKED_PROFILE_FIELDS`.
- **Lý do**: FR-021 yêu cầu lưu theo tài khoản, giữ qua thiết bị khác — đúng chỗ của hồ sơ; không cần endpoint mới, tái dùng kiểm tra đầu vào/DTO sẵn có; Giả định spec nói rõ tùy chọn này không thuộc nhóm bị khóa khi ở trong lớp. `ADD COLUMN … NOT NULL DEFAULT true` không viết lại bảng (PostgreSQL ≥ 11) và người học cũ tự nhận mặc định bật.
- **Phương án đã xét**: bảng `user_preferences` riêng — thêm bảng cho hai boolean, không có lợi; lưu ở LocalStore của trình duyệt — mất khi đổi thiết bị, vi phạm FR-021.

### E9. Tùy chọn của khách dùng thử chỉ nằm trong bộ nhớ phiên

- **Quyết định**: Khách giữ tùy chọn trong một provider Riverpod trong bộ nhớ (mặc định cả hai bật); KHÔNG ghi vào `LocalStore` hay gửi lên server. Tải lại trang quay về mặc định.
- **Lý do**: Spec: "chỉ áp dụng trong phiên dùng thử hiện tại và không được lưu thành dữ liệu định danh" (FR-021). Bộ nhớ trình duyệt vẫn tồn tại qua các lần mở lại và có thể bị coi là dấu vết nhận diện; giữ trong bộ nhớ là cách an toàn nhất và đơn giản nhất. Đánh đổi: tải lại trang làm khách phải tắt tiếng lại — chấp nhận được với phiên dùng thử ngắn (Điểm cần xác nhận #5).
- **Phương án đã xét**: `sessionStorage` — sống sót qua tải lại cùng tab, nhưng thêm bề mặt lưu trữ mà spec không đòi.

### E10. Âm thanh: tệp WAV tự sinh, phát bằng Web Audio sau lớp trừu tượng `SoundPlayer`

- **Quyết định**:
  - Giao diện `SoundPlayer` (`prime()`, `play(SoundCue)`, `stopAll()`) ở `client/lib/platform/sound_player.dart`; cài đặt web dùng **Web Audio API** qua gói `web` đã có trong `pubspec.yaml` (`platform/web/web_sound_player.dart`); cài đặt bộ nhớ ghi lại các cue đã phát để kiểm thử. Android/iOS sau này chỉ cần thêm một cài đặt mới (Nguyên tắc V).
  - Năm cue (`correct`, `incorrect`, `streak`, `achievement`, `dayComplete`) là tệp **WAV 16-bit mono 22,05 kHz** tạo bằng một script xác định `client/tool/generate_sounds.dart` (tổng hợp từ sóng sin + bao biên độ), lưu ở `client/assets/sounds/`. Đội dự án sở hữu hoàn toàn nên không có vấn đề giấy phép (Giả định spec).
  - Chuẩn hóa mọi tệp về cùng mức RMS (≈ −20 dBFS) và đỉnh ≤ −3 dBFS, có fade-in/out 5–20 ms chống tiếng lách tách; cue trả lời ≤ 0,6 s, cue chúc mừng ≤ 1,2 s (FR-023: tín hiệu trả lời ≲ 1 s, âm lượng đồng đều). Kiểm thử đọc tiêu đề WAV và tính RMS/đỉnh để khẳng định các ngưỡng này.
  - Phát bằng `AudioContext` + `decodeAudioData` (giải mã một lần, giữ `AudioBuffer`), mỗi lần phát dừng nguồn đang chạy rồi phát nguồn mới (hiệu ứng mới thay thế, FR-005). Tải tệp qua `rootBundle` (cùng origin, không cần nới CSP `connect-src 'self'`). `prime()` tạo/`resume()` ngữ cảnh ngay trong thao tác người dùng (chạm nút trả lời) để tránh chặn tự phát (FR-025); mọi lỗi (bị chặn, giải mã hỏng, thiết bị tắt tiếng) nuốt êm, KHÔNG hiện lỗi (FR-024).
- **Lý do**: Web Audio có độ trễ thấp (đáp ứng SC-001) và cho phép ngắt âm trước đó; không thêm phụ thuộc chạy mới; WAV giải mã được ở mọi trình duyệt không cần codec; sinh bằng script xác định giúp loại rủi ro giấy phép và dễ chuẩn hóa âm lượng. Người dùng không bị tải tệp lớn: năm tệp tổng ≲ 150 KB.
- **Phương án đã xét**: gói `audioplayers`/`just_audio` — thêm phụ thuộc và plugin web chỉ để phát 5 tiếng ngắn, độ trễ khó kiểm soát; `HTMLAudioElement` — độ trễ cao hơn, khó ngắt/phát chồng sạch; mã hóa mp3/ogg — cần công cụ mã hóa, không lợi hơn với tệp <1 s; tải mẫu âm thanh bên thứ ba — rủi ro giấy phép (Giả định yêu cầu tự chuẩn bị hoặc có giấy phép).

### E11. Hiệu ứng hình ảnh dựng bằng Flutter thuần, không thêm gói

- **Quyết định**: Dùng `AnimationController` + `CustomPainter`/widget ẩn tiêu chuẩn của Flutter:
  - **Đúng**: vòng xung màu xanh lục + một cụm tia lấp lánh nhỏ bay ra từ biểu tượng ✓, thời lượng ≤ 600 ms, **một nhịp**.
  - **Sai**: lớp phủ màu hổ phách ấm, mờ dần ≤ 400 ms, KHÔNG rung/lắc, KHÔNG đỏ gắt (FR-003). Màu đỏ/hổ phách vốn đã có ở `resultColor`; giữ nguyên biểu tượng + chữ "Chưa đúng" (FR-008).
  - **Chuỗi đúng** (ngưỡng 3/5/10): thêm huy hiệu "🔥 N" nảy nhẹ cạnh thẻ phản hồi.
  - **Thành tựu / hoàn thành ngày**: thẻ chúc mừng nổi bật với confetti thả chậm (≤ ~40 hạt, thời lượng ≤ 3 s), không chớp.
  - Mọi hiệu ứng nằm trong `IgnorePointer` + `RepaintBoundary`, không chặn thao tác (FR-004) và không đổi bố cục (FR-026).
  - **Ngân sách chớp sáng (FR-023)**: không có hiệu ứng nào đổi độ sáng toàn màn hình; mỗi hiệu ứng chỉ có một xung biên độ đơn trong ≥ 300 ms ⇒ ≤ 3 lần/giây ngay cả khi chồng; hằng số thời lượng/số nhịp nằm ở một file (`effect_specs.dart`) và có kiểm thử khẳng định.
- **Lý do**: Không phụ thuộc mới; đủ cho nhu cầu; dễ kiểm thử bằng widget test (đọc trạng thái/animation). Phản hồi nhẹ cho đáp án sai theo FR-003.
- **Phương án đã xét**: gói confetti/Lottie/Rive — thêm phụ thuộc và tài nguyên nặng, khó kiểm soát giới hạn chớp; hoạt ảnh Lottie thiết kế sẵn — chuyển phần thiết kế cho công cụ ngoài, khó đảm bảo "giảm chuyển động".

### E12. "Giảm chuyển động" lấy từ `MediaQuery.disableAnimations`

- **Quyết định**: Khi `MediaQuery.disableAnimationsOf(context)` là `true` (Flutter web ánh xạ từ `prefers-reduced-motion`), mọi hiệu ứng dựng ở dạng **tĩnh hoặc chỉ chuyển mờ** (không có chuyển động tịnh tiến/xoay/confetti), kể cả khi `visual_effects_enabled = true` (FR-022). Quyết định "dạng nào" nằm ở một hàm thuần `EffectMode resolveEffectMode({visualEnabled, reduceMotion})` ∈ `{full, reduced, off}`.
- **Lý do**: Dùng đúng cơ chế nền tảng, không đọc API trình duyệt trực tiếp (Nguyên tắc V). Hàm thuần dễ kiểm thử đầy đủ bảng 2×2.
- **Phương án đã xét**: tự đọc `window.matchMedia` qua `platform/` — thừa vì Flutter đã chuyển tiếp giá trị này.

### E13. Ba chế độ hiệu ứng và thông báo tĩnh

- **Quyết định**: `EffectMode.full` (hoạt ảnh đầy đủ), `reduced` (tĩnh/chuyển mờ), `off` (không hoạt ảnh trang trí). Ở `off`: kết quả đúng/sai vẫn hiện như phản hồi vốn có (thẻ + biểu tượng + chữ); thành tựu/hoàn thành ngày hiện bằng **một dòng thông báo tĩnh** ngắn (ví dụ "Thành tựu mới: Chuỗi 7 ngày"), tự biến sau vài giây và đóng được bằng một thao tác, vẫn không chặn (FR-019, FR-013). Âm thanh độc lập hoàn toàn với chế độ hình ảnh (US3.3).
- **Lý do**: Làm đúng US3.4 và SC-004 (không mất thông tin khi tắt hiệu ứng); một chỗ duy nhất quyết định.

### E14. Màn chúc mừng là lớp phủ không chặn gắn ở gốc ứng dụng

- **Quyết định**: Một `CelebrationHost` bọc nội dung ở `MaterialApp.router(builder: …)` (Stack trên router), nên tồn tại xuyên suốt điều hướng. Thẻ chúc mừng nằm ở góc trên/giữa, KHÔNG có `ModalBarrier`; mọi `PointerDown` ở bất kỳ đâu hoặc đổi tuyến đều đóng toàn bộ màn gộp (một thao tác đóng tất cả — FR-013/FR-014), nhưng sự kiện vẫn chạm tới nút bên dưới nhờ `HitTestBehavior.translucent` (nút "Tiếp tục" dùng được ngay). Tự đóng sau 3,5 s mỗi thẻ; hàng đợi gồm lời chúc mừng ngày (nếu có) rồi các thành tựu theo thứ tự trong phản hồi. Nội dung đọc bằng `Semantics(liveRegion: true)`/`SemanticsService.announce`, không yêu cầu tiêu điểm (FR-013, FR-008).
- **Lý do**: Phản hồi hoàn thành đến cùng lúc với chuyển sang màn tóm tắt; đặt ở gốc tránh bị hủy khi màn bài học bị gỡ khi người học bấm "Tiếp tục". Đáp ứng Làm rõ Q4 (không chặn, thao tác đóng màn).
- **Phương án đã xét**: `showDialog` — là modal, vi phạm Q4; `SnackBar`/`MaterialBanner` — gắn vào `Scaffold` bị hủy khi đổi màn hình, không đủ nổi bật.

### E15. Chuỗi đúng liên tiếp chỉ ở client, chỉ đếm lượt chính

- **Quyết định**: Bộ đếm sống trong `LessonState` (mất khi `LessonController` bị hủy ⇒ phiên mới bắt đầu từ 0, US4.3). Chỉ câu **lượt chính** thay đổi bộ đếm (đúng +1, sai về 0); câu ở giai đoạn hỏi lại (`retry`) nhận phản hồi đúng/sai thường nhưng KHÔNG đổi bộ đếm. Ngưỡng 3, 5, 10 kích hoạt cue `streak` + huy hiệu số câu (chỉ đúng khi vừa chạm ngưỡng). Không lưu, không gửi server, không là thành tựu (FR-027).
- **Lý do**: Spec nói "trả lời đúng liên tiếp" và "trả lời sai → về 0"; câu hỏi lại cố tình là cơ hội sửa sai, nếu tính vào chuỗi sẽ thổi phồng (đúng ở lượt hỏi lại liền ngay sau câu sai) hoặc đảo chuỗi. Bài học mẫu của khách và bài ôn dùng cùng quy tắc. Chọn đơn giản nhất phù hợp ý spec; ghi ở "Điểm cần xác nhận" #6 để chủ dự án đổi nếu muốn.
- **Phương án đã xét**: đếm cả lượt hỏi lại — thưởng cho việc đoán lại ngay câu vừa sai, trái FR-009 về tinh thần (không khuyến khích đoán).

### E16. Bài ghép cặp: một hiệu ứng cho mỗi lần nộp, không thêm phản hồi từng cặp

- **Quyết định**: Với bài ghép cặp, **mỗi lần nộp đáp án** (nút "Kiểm tra"; cả ở lượt hỏi lại) là một lần trả lời và nhận đúng một hiệu ứng, như các loại bài khác. KHÔNG thêm xác nhận đúng/sai tức thì cho từng cặp.
- **Lý do**: Phản hồi từng cặp đòi hỏi hoặc lộ đáp án cho client (phá thiết kế "payload không chứa đáp án") hoặc thêm endpoint kiểm tra từng cặp — mà Giả định của chính spec cấm ("không thêm phản hồi đúng/sai mới ở nơi chưa có"). Hiệu ứng nhất quán giữa các loại bài (FR-006). Phần "mỗi lần ghép một cặp được tính là một lần trả lời" ở US1.3 và trường hợp biên về ghép sai nhiều lần đang mâu thuẫn với hiện trạng nộp-cả-bài; plan chọn hiện trạng và đề nghị chỉnh câu chữ spec (Điểm cần xác nhận #1).
- **Phương án đã xét**: endpoint `POST …/matching/check-pair` — thêm bề mặt API và logic chấm, thay đổi UX bài ghép cặp, ngoài phạm vi tính năng "hiệu ứng".

### E17. Nơi phát hiệu ứng trả lời ở client

- **Quyết định**: `EffectsController` (Riverpod) có hai điểm vào: `onAnswer({correct, streakCount?})` và `onCelebrations(Celebrations)`. `LessonController` gọi `onAnswer` khi server xác nhận kết quả **mới** (`duplicate != true` và không phải phát lại từ hàng đợi ngoại tuyến sau khi đã hiện kết quả), và gọi `onCelebrations` ngay sau khi nhận `SessionSummary`. Luồng bài học mẫu (`trial_lesson_screen.dart`) gọi `onAnswer` ngay sau chấm cục bộ; KHÔNG gọi `onCelebrations` (khách không có thành tựu — FR-018). Bài kiểm tra trình độ KHÔNG gọi điểm vào nào (FR-007) và có một kiểm thử khẳng định điều đó.
- **Lý do**: Một đường duy nhất cho mọi nơi có phản hồi tức thì; nhất quán giữa bài học/ôn tập/dùng thử (FR-001, FR-006); hiệu ứng chỉ bắt đầu sau khi kết quả đã thật sự hiện (SC-001).
- **Phương án đã xét**: hiệu ứng phản ứng với thay đổi trạng thái trong từng màn hình (`ref.listen`) — dễ phát lặp khi dựng lại cây widget hoặc khi phục hồi phiên đã dở.

### E18. Khả năng tiếp cận

- **Quyết định**: Thẻ phản hồi (`LessonFeedback`) bọc `Semantics(liveRegion: true)` để đọc "Đúng"/"Chưa đúng" cho trình đọc màn hình; thẻ chúc mừng cũng `liveRegion` và không lấy tiêu điểm; mọi lớp hiệu ứng trang trí `ExcludeSemantics`. Kết quả luôn có biểu tượng + chữ (đã có), không dựa riêng màu hay âm (FR-008).
- **Lý do**: Hiện trạng chưa có `Semantics` ở thẻ phản hồi; đây là khoảng trống thật mà tính năng phải lấp (FR-008, trường hợp biên về trình đọc màn hình).

### E19. Báo cáo chỉ số SC-006/SC-007

- **Quyết định**: Mở rộng `backend/src/reports/product-metrics.sql` (đã có từ spec 001/004) với hai truy vấn: (a) SC-006 — tỷ lệ người học hoạt động ≥ 14 ngày tắt **cả hai** hiệu ứng (`sound_enabled = false AND visual_effects_enabled = false`); (b) SC-007 — tỷ lệ quay lại ngày kế tiếp sau ngày hoàn thành kế hoạch, so hai giai đoạn trước/sau ngày ra mắt. `reports/run.ts` chạy từng khối `-- name:` không có tham số, nên ngày ra mắt được lấy làm ngày có dòng `earned_achievements` sớm nhất (`SELECT min(earned_at)::date`), xấp xỉ ngày ra mắt thực tế. Phần "khảo sát thấy thú vị hơn" của SC-006 là khảo sát ngoài hệ thống, không phát triển ở đây.
- **Lý do**: Spec đặt các tiêu chí này; dữ liệu cần thiết đã có sau tính năng; giữ đúng cách làm của spec trước (SC-010 của 004).

## Điểm cần xác nhận (không chặn plan; đã chọn mặc định)

1. **Bài ghép cặp (US1.3 và trường hợp biên "ghép sai trước khi ghép đúng")**: spec mô tả phản hồi từng cặp, nhưng ứng dụng hiện nộp cả bài và client không có đáp án; thêm phản hồi từng cặp mâu thuẫn Giả định "không thêm phản hồi đúng/sai mới". Mặc định plan: một hiệu ứng cho mỗi lần nộp (E16). *Đề nghị*: chạy `/speckit-clarify` hoặc sửa câu chữ spec cho khớp.
2. **Tổng số mục đã học**: spec bảo dùng cách tính sẵn có, nhưng chỉ có số chữ Kanji. Mặc định plan: tổng quát hóa quy tắc K8 cho mọi loại nội dung (E4). Con số này chỉ phục vụ thành tựu, không hiển thị ở Tiến độ.
3. **SC-001 "trong 0,2 giây sau thao tác"**: kết quả đúng/sai do server chấm nên hiệu ứng bắt đầu cùng lúc phản hồi hiện (như thẻ phản hồi hiện có). Tiêu chí được đo từ lúc kết quả hiện (≤ 0,2 s) và kiểm thử với backend giả có độ trễ cố định; độ trễ mạng nằm ngoài tầm kiểm soát của hiệu ứng.
4. **Chuỗi ngày**: mốc được chúc mừng ở lần hoàn thành phiên **đầu tiên trong ngày** làm chuỗi chạm mốc (mọi loại phiên, vì chuỗi vốn tính theo ngày có hoạt động), không đợi hoàn thành cả kế hoạch ngày. Chúc mừng hoàn thành ngày là lời chúc riêng (FR-015).
5. **Khách dùng thử**: tùy chọn chỉ trong bộ nhớ; tải lại trang quay về mặc định (E9).
6. **Chuỗi đúng liên tiếp (P3)**: chỉ đếm lượt chính, không đếm lượt hỏi lại (E15).

Không còn mục NEEDS CLARIFICATION.
