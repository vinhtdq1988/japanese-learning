# Thay đổi hợp đồng REST API: Bài học Kanji (OpenAPI 1.10.0 → 1.11.0)

**Nhánh**: `003-kanji-lessons` | **Đặc tả**: [spec.md](../spec.md) | **Mô hình dữ liệu**: [data-model.md](../data-model.md)

Hợp đồng duy nhất của hệ thống vẫn là [`specs/001-phase1-mvp/contracts/openapi.yaml`](../../001-phase1-mvp/contracts/openapi.yaml). Tài liệu này mô tả các thay đổi PHẢI áp vào file đó khi hiện thực (không tạo file OpenAPI thứ hai để tránh hai nguồn sự thật). Mọi thay đổi là **bổ sung**, không phá vỡ tương thích; ghi nhật ký `1.11.0` trong `info.description` và sinh lại API client Dart.

## 1. Nhật ký thay đổi (dán vào `info.description`)

```text
1.11.0 (spec 003-kanji-lessons) – bổ sung Kanji: (1) `Skill` thêm `kanji` (placement và dùng thử
vẫn chỉ vocabulary/grammar); (2) `ProfileUpdate` thêm `skills` – đổi kỹ năng không sinh lộ trình mới,
có hiệu lực ở kế hoạch kế tiếp; bỏ kỹ năng đang ưu tiên thì `prioritizedSkill` về null; (3) thêm
`PUT /path/items/{itemId}/master` (chỉ mục Kanji); (4) `ContentItem` thêm `kanji`, `topicId`,
`examples[].kanjiReading`; `Exercise` thêm `facet`; (5) `DailyPlan` thêm `kanjiNotice`; `PlanItem`
thêm `kind`; (6) `SessionSummary` thêm `attentionItems`; (7) `ProgressSummary` thêm `kanji` và
`weakTopics[].skill`; (8) `AdminUnitWrite` nhận `kind=kanji`, mục thêm `topicId`/`kanjiDetails`,
bài tập thêm `facet`. Thay đổi bổ sung; client sinh mã cũ có thể không giải mã được `Skill=kanji` nên
client và backend PHẢI phát hành cùng lúc.
```

## 2. Schema dùng chung

```yaml
Skill: { type: string, enum: [vocabulary, grammar, kanji] }

ReviewFacet:
  type: string
  enum: [item, meaning, reading, word]
  description: '`item` cho từ vựng/ngữ pháp và bài tập không gắn chữ; Kanji dùng meaning | reading | word (lịch ôn theo cặp chữ–khía cạnh)'

KanjiDetails:            # dạng gửi cho người học (đã bản địa hóa)
  type: object
  required: [onReadings, kunReadings, strokeCount]
  properties:
    onReadings:  { type: array, items: { type: string }, description: 'Âm On (katakana); có thể rỗng' }
    kunReadings: { type: array, items: { type: string }, description: 'Âm Kun (hiragana, `.` phân cách okurigana); có thể rỗng. onReadings ∪ kunReadings không rỗng' }
    strokeCount: { type: integer, minimum: 1, maximum: 30 }
    components:  { $ref: '#/components/schemas/LocalizedText' }

KanjiDetailsWrite:       # dạng admin ghi (song ngữ)
  type: object
  required: [onReadings, kunReadings, strokeCount]
  properties:
    onReadings:  { type: array, items: { type: string } }
    kunReadings: { type: array, items: { type: string } }
    strokeCount: { type: integer, minimum: 1, maximum: 30 }
    components:  { type: object, allOf: [{ $ref: '#/components/schemas/I18nText' }], nullable: true }
```

`Skill` được dùng ở `Profile.skills`, `prioritizedSkill`, `ContentItem.kind`, `AdminTopic.skill`, `AdminUnitWrite.kind`. `AdminPlacementQuestion.skill` đổi sang enum riêng `[vocabulary, grammar]` (không nhận `kanji`, 422 nếu gửi).

## 3. Luồng người học

### 3.1 `PATCH /me` – `ProfileUpdate`

```yaml
ProfileUpdate:
  properties:
    skills:
      type: array
      minItems: 1
      uniqueItems: true
      items: { $ref: '#/components/schemas/Skill' }
      description: 'Kỹ năng muốn cải thiện. Đổi giá trị KHÔNG sinh lộ trình mới; có hiệu lực ở kế hoạch sinh kế tiếp (kế hoạch đã sinh hôm nay không đổi). Tiến độ và lịch ôn giữ nguyên. Nếu `prioritizedSkill` hiện tại (hoặc gửi kèm) không thuộc `skills` mới thì được đặt null.'
```

- 422 `VALIDATION_FAILED` (`fields.skills`): rỗng hoặc chứa giá trị ngoài `Skill` (ví dụ `listening`, `reading` – "chưa có trong phiên bản này").
- 422 khi chưa hoàn tất onboarding (như các trường lộ trình khác).
- `PUT /onboarding`, `POST /onboarding/complete`: `skills` nay nhận `kanji` (không đổi cấu trúc).

### 3.2 `PUT /path/items/{itemId}/master` (mới)

```yaml
/path/items/{itemId}/master:
  put:
    operationId: setItemMastered
    tags: [path]
    summary: Đánh dấu / bỏ đánh dấu một chữ Kanji đã thành thạo (dừng / tiếp tục ôn mọi khía cạnh)
    parameters:
      - { name: itemId, in: path, required: true, schema: { type: string, format: uuid } }
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required: [mastered]
            properties:
              mastered: { type: boolean }
    responses:
      '200':
        description: Đã cập nhật
        content:
          application/json:
            schema:
              type: object
              required: [itemId, mastered]
              properties:
                itemId: { type: string, format: uuid }
                mastered: { type: boolean }
      '404': { description: 'Chưa hoàn tất onboarding, hoặc người học chưa học chữ này (không có lịch ôn)', content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
      '422': { description: 'Mục không phải Kanji, hoặc thân yêu cầu sai', content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
```

Idempotent: gửi lại cùng giá trị trả 200 không đổi dữ liệu. Đánh dấu cả bài Kanji dùng `PUT /path/units/{unitId}/master` sẵn có (không đổi).

### 3.3 `GET /today` – `DailyPlan`, `PlanItem`

```yaml
PlanItem:
  properties:
    kind:
      type: string
      allOf: [{ $ref: '#/components/schemas/Skill' }]
      nullable: true
      description: 'Kỹ năng của đơn vị với `new_unit` (client hiển thị nhãn Kanji); null với `review_batch`'

DailyPlan:
  properties:
    kanjiNotice:
      type: object
      nullable: true
      description: 'Chỉ có khi người học đã chọn Kanji và đã học hết bài Kanji phù hợp trình độ (FR-013). Kế hoạch vẫn có bài của kỹ năng khác và ôn tập'
      required: [code, suggestion]
      properties:
        code: { type: string, enum: [kanji_exhausted] }
        suggestion: { type: string, enum: [raise_level, content_exhausted] }
```

`POST /today/extra`: có thể trả đơn vị Kanji (khi đã chọn Kanji); `fields.suggestion` không đổi.

### 3.4 `/sessions/*` – `LessonSession`, `ContentItem`, `Exercise`, `SessionSummary`

```yaml
ContentItem:
  properties:
    topicId: { type: string, format: uuid, nullable: true, description: 'Chủ đề của chữ (chỉ Kanji)' }
    kanji:
      type: object
      allOf: [{ $ref: '#/components/schemas/KanjiDetails' }]
      nullable: true
      description: 'Chỉ có khi `kind=kanji`; `reading` khi đó là null'
    examples:
      items:
        properties:
          kanjiReading: { type: string, nullable: true, description: 'Kanji: cách đọc của chữ trong từ ví dụ này' }

Exercise:
  properties:
    facet: { $ref: '#/components/schemas/ReviewFacet' }

SessionSummary:
  properties:
    attentionItems:
      type: array
      description: 'Chữ Kanji có ít nhất một câu lượt chính sai trong phiên (US1.4); vắng mặt với phiên không có Kanji'
      items:
        type: object
        required: [itemId, japanese]
        properties:
          itemId: { type: string, format: uuid }
          japanese: { type: string }
```

Không đổi: `POST /sessions`, `POST /sessions/{id}/answers` (idempotent bằng `clientEventId`), `/intervals`, `/complete`. `AnswerResult.nextReviewDate` là ngày đến hạn của **cặp** (chữ, khía cạnh) vừa trả lời.

### 3.5 `GET /progress` – `ProgressSummary`

```yaml
ProgressSummary:
  properties:
    kanji:
      type: object
      nullable: true
      description: 'null khi người học không chọn Kanji và chưa có dữ liệu Kanji. Các trường tổng (totalMinutes, lessonsCompleted, reviewAccuracy, currentStreakDays) đã bao gồm Kanji'
      required: [charactersLearned, lessonsCompleted, minutes]
      properties:
        charactersLearned: { type: integer, description: 'Số chữ có ít nhất một khía cạnh đã lên lịch ôn' }
        lessonsCompleted: { type: integer }
        minutes: { type: number, description: 'Thời gian học Kanji (phút); phiên ôn hỗn hợp được phân bổ theo tỷ lệ câu trả lời Kanji' }
        reviewAccuracy: { type: number, nullable: true, minimum: 0, maximum: 1 }
    weakTopics:
      items:
        properties:
          skill: { $ref: '#/components/schemas/Skill' }
```

`goal.completionRatio`/`onTrack` tự động tính bài Kanji khi `kanji ∈ skills` (không đổi cấu trúc).

## 4. Quản trị (`/admin/*`)

### 4.1 `AdminUnitWrite` / `AdminUnit`

```yaml
AdminUnitWrite:
  properties:
    kind: { $ref: '#/components/schemas/Skill' }          # nay nhận kanji
    items:
      items:
        properties:
          topicId: { type: string, format: uuid, nullable: true, description: 'Bắt buộc khi kind=kanji (chủ đề skill=kanji); bỏ qua với kind khác' }
          kanjiDetails:
            type: object
            allOf: [{ $ref: '#/components/schemas/KanjiDetailsWrite' }]
            nullable: true
            description: 'Bắt buộc khi kind=kanji; `reading` khi đó để null'
          examples:
            description: '`[{ja, reading, translation: I18nText, kanjiReading?}]`'
    exercises:
      items:
        properties:
          facet:
            allOf: [{ $ref: '#/components/schemas/ReviewFacet' }]
            default: item
            description: 'Bài tập gắn chữ Kanji (`itemIndex` khác null trong đơn vị Kanji) PHẢI có meaning | reading | word; bài tập khác PHẢI là item'
```

- `POST /admin/units`, `PUT /admin/units/{unitId}`: lưu nháp không chặn bởi quy tắc Kanji (như đơn vị khác); chỉ kiểm tra kiểu dữ liệu.
- `PUT /admin/units/{unitId}/status` với `status=active`: 422 `VALIDATION_FAILED`, `fields` = bản đồ `đường dẫn → thông điệp` theo [research K10](../research.md#k10-quy-tắc-nội-dung-kanji-fr-021-sc-003), ví dụ:

```json
{
  "code": "VALIDATION_FAILED",
  "message": "Đơn vị chưa đủ điều kiện kích hoạt",
  "fields": {
    "items": "bài Kanji phải có từ 3 đến 5 chữ đang hoạt động",
    "items[1].kanjiDetails": "cần ít nhất một cách đọc (âm On hoặc âm Kun)",
    "items[2].topicId": "chữ Kanji phải có thẻ chủ đề Kanji",
    "items[3].japanese": "chữ 「日」 đã có ở bài 「n5-kanji-time」 đang hoạt động",
    "items[0].meaning": "bản dịch vi + en phải đầy đủ",
    "exercises": "chữ 「月」 chưa có bài tập cho khía cạnh reading"
  }
}
```

- Khóa `exercises` còn dùng cho lỗi thời lượng, ví dụ `"exercises": "số bài tập (12) vượt quỹ 10 câu cho bài 5 phút"` (một khóa có thể gộp nhiều thông điệp, phân cách bằng `; `).
- `GET /admin/units`: thêm tham số lọc tùy chọn `kind` (`Skill`).
- `GET /admin/topics`: thêm tham số lọc tùy chọn `skill` (`Skill`); không đổi phản hồi.
- Nhật ký (`AdminActionLog`): không đổi cấu trúc.

## 5. Bất biến được kiểm thử hợp đồng

- Mọi phản hồi khớp OpenAPI 1.11.0 (`backend/tests/contract/`), kể cả khi `kanji`/`kanjiNotice`/`attentionItems` vắng mặt.
- Người học không chọn Kanji: `GET /today`, `GET /progress` không có `kanjiNotice`, `kanji` = null, không có `PlanItem.kind = kanji`.
- `GET /trial/content`, `GET /placement/questions` không bao giờ chứa nội dung Kanji.
- `Exercise` gửi cho người học không chứa đáp án (như 001).
