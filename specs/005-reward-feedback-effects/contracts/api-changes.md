# Thay đổi hợp đồng REST API: Hiệu ứng thưởng và thành tựu (OpenAPI 1.12.0 → 1.13.0)

**Nhánh**: `005-reward-feedback-effects` | **Đặc tả**: [spec.md](../spec.md) | **Mô hình dữ liệu**: [data-model.md](../data-model.md) | **Danh mục**: [achievement-catalog.md](achievement-catalog.md)

Hợp đồng duy nhất của hệ thống vẫn là [`specs/001-phase1-mvp/contracts/openapi.yaml`](../../001-phase1-mvp/contracts/openapi.yaml). Tài liệu này mô tả các thay đổi PHẢI áp vào file đó khi hiện thực (không tạo file OpenAPI thứ hai). Mọi thay đổi là **bổ sung**, tương thích ngược với client 1.12.0: **không có đường dẫn mới, không có mã lỗi mới**; chỉ thêm trường tùy chọn vào phản hồi và hai trường tùy chọn vào hồ sơ. Sau khi sửa, sinh lại API client Dart (`client/lib/data/api/README.md`).

## 1. Nhật ký thay đổi (dán vào `info.description`)

```text
1.13.0 (spec 005-reward-feedback-effects) – bổ sung hiệu ứng thưởng: (1) `SessionSummary.celebrations`
(tùy chọn) trả MỘT LẦN, trong phản hồi của lần `POST /sessions/{id}/complete` thực sự hoàn thành phiên:
lời chúc mừng hoàn thành ngày (`dayCompleted`) và danh sách thành tựu vừa đạt (`achievements`, đã bản
địa hóa theo ngôn ngữ hồ sơ); gọi lại trên phiên đã hoàn thành KHÔNG trả trường này và không ghi
thêm gì; (2) `Profile` và `ProfileUpdate` thêm `soundEnabled`, `visualEffectsEnabled` (mặc định true;
KHÔNG thuộc nhóm trường bị khóa khi người học thuộc lớp). Thành tựu không có endpoint đọc lại và không
xuất hiện trong các DTO của giáo viên/tổ chức. Thay đổi bổ sung; client 1.12.0 bỏ qua các trường mới.
```

## 2. Schema mới

Thêm vào `components.schemas`:

```yaml
    AchievementKind:
      type: string
      enum: [first_lesson, streak, items_learned, goal_progress, perfect_lesson]
    AchievementEarned:
      type: object
      description: Một thành tựu vừa đạt ở lần ghi nhận này. Chỉ xuất hiện đúng một lần (không đọc lại được).
      required: [code, kind, name, description]
      properties:
        code:
          type: string
          example: streak_7
          description: 'Mã ổn định trong danh mục cố định (xem achievement-catalog.md), ví dụ `streak_7`, `items_100`, `goal_50`, `first_lesson`, `perfect_lesson`.'
        kind: { $ref: '#/components/schemas/AchievementKind' }
        threshold:
          type: integer
          minimum: 1
          description: 'Ngưỡng của mốc (ngày, số mục hoặc phần trăm). Vắng với `first_lesson` và `perfect_lesson`.'
        name: { $ref: '#/components/schemas/LocalizedText' }
        description: { $ref: '#/components/schemas/LocalizedText' }
    Celebrations:
      type: object
      description: Những gì cần chúc mừng sau lần hoàn thành này. Màn chúc mừng gộp hiện `dayCompleted` trước, rồi `achievements` lần lượt theo thứ tự trong mảng.
      required: [dayCompleted, achievements]
      properties:
        dayCompleted:
          type: boolean
          description: 'true khi lần hoàn thành này vừa hoàn thành mục cuối của kế hoạch hôm nay VÀ chưa từng chúc mừng ngày đó (tối đa một lần mỗi ngày, kể cả học thêm).'
        achievements:
          type: array
          description: 'Sắp theo thứ tự trình bày: `first_lesson`, `perfect_lesson`, `streak`, `items_learned`, `goal_progress`; trong cùng loại theo ngưỡng tăng dần.'
          items: { $ref: '#/components/schemas/AchievementEarned' }
```

## 3. `SessionSummary` (thêm trường)

```yaml
    SessionSummary:
      type: object
      properties:
        # … các trường hiện có không đổi (correct, total, minutesSpent, dayCompleted, attentionItems)
        celebrations:
          $ref: '#/components/schemas/Celebrations'
          description: |
            Có mặt khi và chỉ khi phản hồi này đến từ lần `complete` thực sự hoàn thành phiên VÀ có ít nhất
            một thứ để chúc mừng (`dayCompleted = true` hoặc `achievements` không rỗng). Vắng khi: không có
            gì để chúc mừng; gọi lại (idempotent) trên phiên đã hoàn thành; người học là khách (không gọi
            endpoint này). Nếu client không nhận được phản hồi (đóng tab, mất kết nối), thành tựu vẫn được
            ghi nhận nhưng KHÔNG được chúc mừng bù ở lần sau.
```

`dayCompleted` ở mức `SessionSummary` giữ nguyên ngữ nghĩa hiện có ("kế hoạch hôm nay đã xong", tính lại ở mỗi lần gọi); chỉ `celebrations.dayCompleted` là tín hiệu "chúc mừng một lần".

### Hành vi theo tình huống

| Tình huống | `celebrations` |
|---|---|
| Hoàn thành phiên, không vượt mốc nào, ngày chưa xong | vắng |
| Hoàn thành bài học mới đầu tiên | `{ dayCompleted: false, achievements: [first_lesson] }` |
| Hoàn thành mục cuối kế hoạch hôm nay, lần đầu trong ngày | `dayCompleted: true` (cùng các thành tựu nếu có, trong một đối tượng — màn gộp) |
| Học thêm sau khi ngày đã được chúc mừng | `dayCompleted: false`; thành tựu mới (nếu có) vẫn trả |
| Gọi `complete` lại trên phiên đã xong | vắng (kể cả khi lần đầu có chúc mừng) |
| Mốc bị vượt chỉ vì đổi mục tiêu/dựng lại lộ trình/đổi lộ trình lớp | vắng mốc đó (ghi âm thầm) |
| Phiên `review` | không có `first_lesson`/`perfect_lesson`; vẫn có thể có `streak`/`items_learned`/`goal_progress` theo công thức tiến độ hiện có |

## 4. `Profile` và `ProfileUpdate` (thêm trường)

```yaml
    Profile:
      properties:
        # … các trường hiện có
        soundEnabled:
          type: boolean
          default: true
          description: 'Bật/tắt âm thanh phản hồi và chúc mừng. Mặc định true.'
        visualEffectsEnabled:
          type: boolean
          default: true
          description: 'Bật/tắt hiệu ứng hình ảnh (hoạt ảnh, màn chúc mừng động). Khi tắt, kết quả đúng/sai và thành tựu vẫn được thể hiện bằng dạng tĩnh. Mặc định true.'
    ProfileUpdate:
      properties:
        # … các trường hiện có
        soundEnabled: { type: boolean }
        visualEffectsEnabled: { type: boolean }
```

- `GET /me` luôn trả hai trường (người học cũ nhận `true`).
- `PATCH /me` với chỉ hai trường này: không sinh lại lộ trình, không đụng kế hoạch, không cần `currentPassword`.
- **Không** thêm vào `CLASS_LOCKED_PROFILE_FIELDS`: học viên thuộc lớp vẫn sửa được (không trả `CLASS_MANAGED`).
- Kiểu sai (không phải boolean) → 422 `VALIDATION_FAILED` như các trường khác.

## 5. Không thay đổi

- `POST /sessions/{id}/answers`: **không đổi**. Hiệu ứng trả lời hoàn toàn ở client dựa trên `isCorrect` đã có (FR-009: không thưởng theo tốc độ, không gửi thêm gì).
- `/trial/*`, `/placement*`, `/classes*`, `/org*`, `/admin/*`: không đổi. Khách không có thành tựu; kiểm tra trình độ không có hiệu ứng.
- Không có endpoint liệt kê thành tựu (ngoài phạm vi: màn xem lại bộ sưu tập).

## 6. Ma trận phân quyền

Không thêm route ⇒ không thêm dòng vào `tests/fixtures/authz-matrix.json`. Hai trường hồ sơ mới đi qua `PATCH /me` (đã có trong ma trận, vai trò USR chỉ sửa hồ sơ của chính mình). Kiểm thử ma trận hiện có PHẢI vẫn đạt.

## 7. Kiểm thử hợp đồng cần có

| Kiểm thử | Nội dung |
|---|---|
| `reward-us2` | Phiên đầu → `first_lesson`; phiên hoàn hảo → `perfect_lesson`; mốc chuỗi; gọi lại `complete` không trả `celebrations`; hoàn thành mục cuối → `dayCompleted` một lần mỗi ngày; thứ tự trình bày; tên/mô tả theo `profile.language` |
| `reward-us3` | `PATCH /me` hai trường; `GET /me` giữ qua đăng xuất/đăng nhập; học viên thuộc lớp sửa được; kiểu sai → 422 |
| Snapshot DTO | Phản hồi `SessionSummary` cũ không đổi ngoài trường tùy chọn mới; DTO giáo viên/tổ chức KHÔNG chứa thành tựu |
| Hợp đồng OpenAPI | Schema mới khớp ajv; client cũ (1.12.0) giải mã được phản hồi mới |
