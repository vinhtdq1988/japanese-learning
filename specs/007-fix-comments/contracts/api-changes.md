# Thay đổi hợp đồng REST API: Luyện đọc/viết, năng lực, gợi ý mặc định, khích lệ (OpenAPI 1.13.0 → 1.14.0)

**Nhánh**: `007-fix-comments` | **Đặc tả**: [spec.md](../spec.md) | **Mô hình dữ liệu**: [data-model.md](../data-model.md) | **Quy tắc**: [competency-rules.md](competency-rules.md), [encouragement-catalog.md](encouragement-catalog.md), [practice-content.md](practice-content.md)

Hợp đồng duy nhất của hệ thống vẫn là [`specs/001-phase1-mvp/contracts/openapi.yaml`](../../001-phase1-mvp/contracts/openapi.yaml). Tài liệu này mô tả các thay đổi PHẢI áp vào file đó khi hiện thực (không tạo file OpenAPI thứ hai). Mọi thay đổi là **bổ sung**: một route mới (`GET /study-defaults`), hai giá trị enum `Skill`, một mã lỗi mới và các trường tùy chọn trong phản hồi. Không route cũ nào đổi nghĩa hay bị xóa. Sau khi sửa, sinh lại API client Dart (`client/lib/data/api/README.md`).

## 1. Nhật ký thay đổi (dán vào `info.description`, đổi `info.version` thành `1.14.0`)

```text
1.14.0 (spec 007-fix-comments) – hoàn thiện trải nghiệm học: (1) enum `Skill` thêm `reading`
(luyện đọc) và `writing` (luyện viết, gõ bàn phím); hai kỹ năng này chỉ có hiệu lực với học viên có quỹ
thời gian đang áp dụng ≥ 30 phút/ngày (kiểm ở máy chủ); thêm mã lỗi `PRACTICE_LOCKED` (403); thêm
`GET /study-defaults` (bảng gợi ý kỹ năng theo quỹ thời gian); (2) `DailyPlan.encouragement` (lời khích
lệ theo tiến độ, đã bản địa hóa) và `PlanItem.competency`; `ProgressSummary.competency`; mục `items`
của `PathDetail` thêm `competency` (mức năng lực: good | needs_improvement | insufficient); (3)
`Profile.skills` vẫn trả giá trị ĐÃ LƯU (kể cả `reading/writing` đang bị khóa do quỹ thời gian < 30
phút); `PATCH /me` và `PUT /onboarding*` từ chối THÊM `reading/writing` khi quỹ thời gian sau cập nhật
< 30 phút (422). Thay đổi bổ sung; client PHẢI phát hành cùng backend (enum `Skill` mở rộng).
```

## 2. Enum `Skill`

```yaml
    Skill: { type: string, enum: [vocabulary, grammar, kanji, reading, writing] }
```

Phạm vi ảnh hưởng (mọi nơi tham chiếu `#/components/schemas/Skill`): `Profile.skills`, `Profile.prioritizedSkill`, `ProfileUpdate`, `OnboardingDraft.skills`, `PlanItem.kind`, `PathDetail.items[].kind`, `ProgressSummary.weakTopics[].skill`, `AdminUnit`/`AdminUnitWrite.kind`, `AdminTopic.skill`, `ClassPath*.skills`.

Ghi chú theo schema:

- `TrialContent`, `PlacementQuestionSet` dùng tập con (vocabulary, grammar) – **không đổi**; mô tả thêm "không có `reading/writing`".
- `AdminUnitWrite` với `kind = reading | writing` chịu quy tắc nội dung ở [practice-content.md](practice-content.md); vi phạm → `422 VALIDATION_FAILED` kèm `fields` theo đường dẫn lỗi (khuôn của Kanji).
- `ClassPath*.skills` (API giáo viên) chấp nhận hai giá trị mới; hiệu lực với học viên vẫn phụ thuộc quỹ thời gian đang áp dụng ≥ 30 (giao diện giáo viên chưa thêm lựa chọn ở bản này – research C5).

## 3. Mã lỗi mới `PRACTICE_LOCKED` (403)

`Error.code` là chuỗi tự do trong hợp đồng hiện tại nên chỉ cần ghi vào mô tả. Thêm vào danh sách ví dụ của `Error.code` và vào mô tả response `403`:

```yaml
      description: '... PRACTICE_LOCKED: luyện đọc/viết chỉ dành cho học viên có quỹ thời gian từ 30 phút mỗi ngày; `fields.minimumDailyMinutes` = "30"'
```

Phát ra bởi `POST /sessions` (bắt đầu), `POST /sessions/{id}/answers`, `POST /sessions/{id}/intervals`, `POST /sessions/{id}/complete` khi đơn vị của phiên có `kind ∈ {reading, writing}` mà quỹ thời gian hiệu lực < 30. Phiên dở dang giữ trạng thái `in_progress`, không mất dữ liệu (data-model §3.1). `403` đã có trong `components.responses` của hợp đồng; nếu chưa dùng cho các route phiên thì thêm tham chiếu vào từng route.

## 4. `GET /study-defaults` (route mới)

```yaml
  /study-defaults:
    get:
      operationId: getStudyDefaults
      tags: [onboarding]
      summary: Bảng gợi ý kỹ năng mặc định theo quỹ thời gian mỗi ngày (spec 007, FR-021…023)
      description: >-
        Chỉ đọc, giống nhau cho mọi người học, có thể cache theo phiên đăng nhập. Đây là GỢI Ý: người học
        luôn đổi/bỏ được từng lựa chọn; máy chủ không tự áp dụng vào hồ sơ.
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema: { $ref: '#/components/schemas/StudyDefaults' }
```

```yaml
    StudyDefaults:
      type: object
      required: [items, practiceMinDailyMinutes]
      properties:
        practiceMinDailyMinutes:
          type: integer
          example: 30
          description: 'Quỹ thời gian tối thiểu (phút/ngày) để dùng luyện đọc/viết'
        items:
          type: array
          description: 'Một dòng cho mỗi mức 5, 10, 15, 30 theo thứ tự tăng dần'
          items:
            type: object
            required: [dailyMinutes, skills]
            properties:
              dailyMinutes: { type: integer, enum: [5, 10, 15, 30] }
              skills:
                type: array
                description: 'Kỹ năng gợi ý bật; tập của mức nhỏ hơn là tập con của mức lớn hơn; `reading`, `writing` chỉ ở mức 30'
                items: { $ref: '#/components/schemas/Skill' }
```

Phản hồi mẫu:

```json
{ "practiceMinDailyMinutes": 30,
  "items": [
    { "dailyMinutes": 5,  "skills": ["vocabulary"] },
    { "dailyMinutes": 10, "skills": ["vocabulary", "grammar"] },
    { "dailyMinutes": 15, "skills": ["vocabulary", "grammar", "kanji"] },
    { "dailyMinutes": 30, "skills": ["vocabulary", "grammar", "kanji", "reading", "writing"] }
  ] }
```

Lỗi: `401` như mọi route cần đăng nhập. Không có tham số, không có `403`/`409` (đọc bảng tĩnh, kể cả học viên thuộc lớp – việc khóa lựa chọn do `PATCH /me` quyết định).

## 5. Năng lực (`competency`)

Schema dùng chung:

```yaml
    CompetencyLevel:
      type: string
      enum: [good, needs_improvement, insufficient]
      description: 'Xanh lục / vàng nhạt / chưa đủ dữ liệu (trung tính). Quy tắc: competency-rules.md'
```

### 5.1. `PlanItem.competency` (trong `GET /today`)

```yaml
        competency:
          type: string
          nullable: true
          allOf: [{ $ref: '#/components/schemas/CompetencyLevel' }]
          description: 'Mức năng lực của KỸ NĂNG của đơn vị với `new_unit`; null với `review_batch` (không thuộc một kỹ năng)'
```

### 5.2. `ProgressSummary.competency` (trong `GET /progress`)

```yaml
        competency:
          type: object
          required: [skills, topics]
          properties:
            skills:
              type: array
              description: 'Mỗi kỹ năng hiệu lực của người học (và kỹ năng đã có dữ liệu), theo thứ tự vocabulary, grammar, kanji, reading, writing'
              items:
                type: object
                required: [skill, level, answered]
                properties:
                  skill: { $ref: '#/components/schemas/Skill' }
                  level: { $ref: '#/components/schemas/CompetencyLevel' }
                  answered: { type: integer, minimum: 0, description: 'Số câu lượt chính trong cửa sổ gần nhất (tối đa 20 mỗi chủ đề, cộng theo chủ đề)' }
                  accuracy: { type: number, nullable: true, minimum: 0, maximum: 1 }
            topics:
              type: array
              description: 'Mọi chủ đề có dữ liệu; luôn gồm các chủ đề trong `weakTopics`'
              items:
                type: object
                required: [topicId, skill, level, answered]
                properties:
                  topicId: { type: string, format: uuid }
                  skill: { $ref: '#/components/schemas/Skill' }
                  level: { $ref: '#/components/schemas/CompetencyLevel' }
                  answered: { type: integer, minimum: 0 }
                  accuracy: { type: number, nullable: true, minimum: 0, maximum: 1 }
```

Bất biến: mọi `weakTopics[i].topicId` xuất hiện trong `competency.topics` với `level = needs_improvement`; không chủ đề `good` nào nằm trong `weakTopics`.

### 5.3. `PathDetail.items[].competency` (trong `GET /path`)

```yaml
                  competency:
                    allOf: [{ $ref: '#/components/schemas/CompetencyLevel' }]
                    description: 'Mức năng lực của CHỦ ĐỀ của đơn vị (đơn vị chưa có dữ liệu chủ đề → insufficient)'
```

## 6. `DailyPlan.encouragement` (trong `GET /today`)

```yaml
        encouragement:
          type: object
          nullable: true
          description: 'Lời khích lệ theo tiến độ hiện tại, đã bản địa hóa theo ngôn ngữ hồ sơ. Luôn tích cực (encouragement-catalog.md). Ổn định trong cùng ngày địa phương và cùng trạng thái'
          required: [state, message]
          properties:
            state:
              type: string
              enum: [not_started, in_progress, day_completed, streak, welcome_back, behind_target]
            message: { type: string, description: 'Câu hiển thị; đã thay `{n}` bằng số ngày của chuỗi nếu có' }
```

Không có khi lộ trình đang tạm dừng (`GET /today` trả `409 PATH_PAUSED` như hiện nay). Tính từ dữ liệu đã ghi; không có tham số. Không đổi `notice`, `kanjiNotice`, `summary`.

## 7. Thay đổi hành vi (không đổi schema)

| Route | Thay đổi |
|---|---|
| `PATCH /me`, `PUT /onboarding`, `POST /onboarding/complete` | `skills` chứa `reading`/`writing` **mới thêm** (so với giá trị đã lưu) khi `dailyMinutes` sau cập nhật < 30 → `422 VALIDATION_FAILED`, `fields.skills = "Luyện đọc/viết dành cho người học từ 30 phút mỗi ngày"`. Giá trị đã lưu không bị xóa khi hạ phút. |
| `GET /me` | `skills` là giá trị **đã lưu** (không lọc theo quỹ thời gian) để màn Hồ sơ hiện đúng và khóa đúng. |
| `GET /today`, `GET /path`, `POST /today/extra` | Dựa trên `skills` **hiệu lực** (đã lọc theo phút); học viên < 30 phút không bao giờ thấy `reading/writing`. |
| `POST /sessions` (+ answers, intervals, complete) | Xem §3. |
| Học viên thuộc lớp | `PATCH /me` với `skills` vẫn `409 CLASS_MANAGED` như cũ; phút áp dụng để xét điều kiện = ghi đè của giáo viên ?? phút lớp. |

## 8. Tương thích

- Client 1.13.0 bỏ qua trường mới (`competency`, `encouragement`) và không gọi `/study-defaults`. **Hạn chế**: enum `Skill` mở rộng – client sinh sẵn cũ có thể lỗi khi gặp `reading/writing` trong `PlanItem.kind`/`Profile.skills`; chỉ xảy ra khi người học chủ động bật (≥ 30 phút). Phát hành client và backend cùng lúc (như 004/005).
- Nội dung đã lưu không bị sửa; migration 0006 chỉ thêm giá trị enum.
- Ma trận quyền (`authz-matrix.json`) thêm dòng `GET /study-defaults` = mọi người học đã đăng nhập (và admin), khách bị `401`.
