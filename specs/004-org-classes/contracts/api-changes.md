# Thay đổi hợp đồng REST API: Tổ chức, Lớp học và Lộ trình lớp (OpenAPI 1.11.0 → 1.12.0)

**Nhánh**: `004-org-classes` | **Đặc tả**: [spec.md](../spec.md) | **Mô hình dữ liệu**: [data-model.md](../data-model.md) | **Phân quyền**: [permissions-matrix.md](permissions-matrix.md) | **CSV**: [csv-formats.md](csv-formats.md)

Hợp đồng duy nhất của hệ thống vẫn là [`specs/001-phase1-mvp/contracts/openapi.yaml`](../../001-phase1-mvp/contracts/openapi.yaml). Tài liệu này mô tả các thay đổi PHẢI áp vào file đó khi hiện thực (không tạo file OpenAPI thứ hai). Mọi thay đổi là **bổ sung**, không phá vỡ tương thích với client 1.11.0: đường dẫn mới, trường phản hồi tùy chọn mới, mã lỗi mới. Ghi nhật ký `1.12.0` trong `info.description` và sinh lại API client Dart (`client/lib/data/api/README.md`).

## 1. Nhật ký thay đổi (dán vào `info.description`)

```text
1.12.0 (spec 004-org-classes) – bổ sung tổ chức, lớp học, lộ trình lớp (B2B theo seat): (1) nhóm
`/admin/organizations*` cho quản trị viên hệ thống (tổ chức, giấy phép, seat; KHÔNG có dữ liệu học);
(2) nhóm `/org*` cho chủ tổ chức; (3) nhóm `/classes*` cho giáo viên phụ trách và chủ tổ chức (lớp,
thành viên, lời mời, mã tham gia, nhập CSV, lộ trình lớp, bài giao, ghi đè cá nhân, tạm dừng, bảng
điều khiển, điểm yếu, xuất CSV, yêu cầu kiểm tra trình độ); (4) `/invitations/{token}*`, `/me/class*`
cho người học (xem trước + hai lựa chọn, nhập mã, "Lớp của tôi", chuyển sang lộ trình cá nhân);
(5) `Me` thêm `learningSource`, `classSummary`, `organization`; (6) `PlacementAnswers` thêm
`classRequestId`; (7) mã lỗi mới `CLASS_MANAGED` (409) và các mã seat/lớp; (8) `GET /admin/action-logs` thêm
tham số `organizationId`. Người học không thuộc lớp: mọi phản hồi cũ không đổi (chỉ thêm trường tùy
chọn `learningSource: personal`). Vai trò tổ chức KHÔNG nằm trong access token; quyền được tra CSDL mỗi
yêu cầu nên mất quyền có hiệu lực ngay. Thay đổi bổ sung.
```

## 2. Quy ước chung

- Tiền tố `/api/v1`; xác thực Bearer như hiện có. **Không** thêm claim vào JWT.
- Ký hiệu quyền ở các bảng dưới: **ADM** quản trị viên hệ thống (`role=admin`); **OWN** chủ tổ chức; **TCH** giáo viên *phụ trách lớp đó*; **MGR** = TCH hoặc OWN của tổ chức chứa lớp; **LRN** học viên đang thuộc lớp (về chính mình); **USR** mọi tài khoản đăng nhập. Chi tiết từng vai trò ở [permissions-matrix.md](permissions-matrix.md).
- Đối tượng ngoài phạm vi người gọi (tổ chức/lớp/học viên/lời mời khác) → **404 `NOT_FOUND` với thông điệp chung**, thân phản hồi giống hệt "không tồn tại" (FR-007). 403 `FORBIDDEN` chỉ khi sai vai trò mà không lộ đối tượng.
- Thao tác ghi quan trọng nhận `confirm: true` (lưu trữ lớp, rời lớp) — thiếu ⇒ 422.
- Tất cả thao tác ghi tổ chức/lớp ghi `admin_action_logs` (data-model §4). Thao tác sức chứa (mời, chấp nhận, gán/thu hồi, chỉnh giấy phép) chạy trong giao dịch khóa `organizations`.
- Ngày (`startsOn`, `dueOn`, …) là `YYYY-MM-DD`; thời điểm là ISO-8601 UTC. Trường bản địa hóa trả theo ngôn ngữ người gọi (như hiện có).

## 3. Mã lỗi mới

| HTTP | `code` | Khi nào |
|---|---|---|
| 409 | `CLASS_MANAGED` | Học viên thuộc lớp gọi thao tác bị khóa (đổi mục tiêu/thời gian/kỹ năng, tạm dừng, thành thạo, dựng lại lộ trình, làm lại placement, onboarding mục tiêu). `fields` liệt kê trường bị khóa. |
| 409 | `SEAT_UNAVAILABLE` | Không còn seat trống (sau khi trừ lời mời chờ) khi mời/chấp nhận/nhập mã/CSV (FR-005); không có trạng thái "chờ seat". |
| 422 | `SEAT_REASSIGN_LIMIT` | Seat trống còn lại đã vượt `max_reassignments` (FR-004); quản trị viên nâng giới hạn. |
| 422 | `SEAT_BELOW_USAGE` | Giảm số seat dưới (đang dùng + giữ chỗ) (FR-005). |
| 409 | `CLASS_NOT_READY` | Mời/bật mã/nhập CSV khi lớp chưa có lộ trình (FR-010). |
| 409 | `CLASS_FULL` | Lớp đủ `CLASS_MAX_MEMBERS` thành viên. |
| 409 | `CLASS_ARCHIVED` | Thao tác ghi trên lớp đã lưu trữ. |
| 409 | `LAST_TEACHER` | Gỡ giáo viên phụ trách cuối cùng khỏi lớp bằng thao tác đổi giáo viên. |
| 409 | `ALREADY_IN_CLASS` | Học viên đã thuộc một lớp hiệu lực (FR-014). |
| 409 | `INVITEE_UNAVAILABLE` | Email thuộc tài khoản của tổ chức khác — **không nêu tên tổ chức** (FR-002). |
| 429 | `TOO_MANY_REQUESTS` | Nhập mã sai quá số lần (khóa theo tài khoản, `Retry-After`). |

Mã hiện có tái sử dụng: `VALIDATION_FAILED` (422, có `fields`), `NOT_FOUND` (404), `FORBIDDEN` (403), `UNAUTHORIZED`.

## 4. Schema dùng chung (rút gọn)

```yaml
SharedDataItem:            # một mục trong danh sách dữ liệu giáo viên/chủ tổ chức xem được (FR-035, FR-036)
  type: object
  required: [code, label]
  properties:
    code:  { type: string, enum: [display_name, email, progress, study_time, review_accuracy, weak_topics, streak, assignments, placement_result] }
    label: { type: string, description: 'đã bản địa hóa' }
SharedDataDisclosure:
  type: object
  required: [version, visible, notVisible, lockedControls, canLeaveAnytime, mayBeMovedWithinOrganization]
  properties:
    version: { type: integer, example: 1 }
    visible: { type: array, items: { $ref: '#/components/schemas/SharedDataItem' } }
    notVisible: { type: array, items: { type: string }, description: 'mật khẩu/phiên, hoạt động trước ngày vào lớp, từng câu trả lời, dữ liệu hồ sơ ngoài danh sách' }
    lockedControls: { type: array, items: { type: string }, description: 'các quyền bị khóa khi thuộc lớp' }
    canLeaveAnytime: { type: boolean, const: true }
    mayBeMovedWithinOrganization: { type: boolean, const: false }   # luôn false: trung tâm KHÔNG tự chuyển học viên, chỉ mời và học viên đồng ý lại

ClassBrief:
  type: object
  required: [id, name, organizationName, teachers]
  properties:
    id: { type: string, format: uuid }
    name: { type: string }
    organizationName: { type: string }
    teachers: { type: array, items: { type: object, required: [displayName], properties: { displayName: { type: string } } } }

ClassPathTemplate:
  type: object
  required: [startLevel, targetLevel, skills, startsOn, endsOn, dailyMinutes]
  properties:
    startLevel:   { $ref: '#/components/schemas/Level' }           # none|N5|N4|N3|N2|N1 (schema `Level` sẵn có; openapi.yaml không có `SelfLevel`)
    targetLevel:  { $ref: '#/components/schemas/TargetLevel' }
    skills:       { type: array, minItems: 1, uniqueItems: true, items: { $ref: '#/components/schemas/Skill' } }
    startsOn:     { type: string, format: date }
    endsOn:       { type: string, format: date, description: '> startsOn' }
    dailyMinutes: { type: integer, enum: [5, 10, 15, 30] }

ClassPath:
  allOf:
    - $ref: '#/components/schemas/ClassPathTemplate'
    - type: object
      required: [mode, units, assignments, warnings, contentNotices, updatedAt]
      properties:
        mode: { type: string, enum: [template, explicit] }
        scopeNotice: { type: string, enum: [content_ceiling_n3], nullable: true }
        units:
          type: array
          description: 'chế độ explicit: đúng danh sách + thứ tự giáo viên chọn; chế độ template: thứ tự tham khảo tính động'
          items: { $ref: '#/components/schemas/ClassPathUnit' }
        assignments: { type: array, items: { $ref: '#/components/schemas/ClassAssignment' } }
        warnings: { type: array, items: { $ref: '#/components/schemas/PathWarning' } }
        contentNotices: { type: array, items: { $ref: '#/components/schemas/ContentNotice' } }
        updatedAt: { type: string, format: date-time }
ClassPathUnit:
  type: object
  required: [unitId, title, kind, level, estMinutes, position]
  properties:
    unitId: { type: string, format: uuid }
    title: { type: string }
    kind: { $ref: '#/components/schemas/Skill' }
    level: { type: string }
    estMinutes: { type: integer }
    position: { type: integer }
    opensOn: { type: string, format: date, nullable: true }
    isOpen: { type: boolean }
PathWarning:                # FR-025: không chặn lưu
  type: object
  required: [code, requiredMinutes, capacityMinutes]
  properties:
    code: { type: string, enum: [over_capacity] }
    requiredMinutes: { type: integer }
    capacityMinutes: { type: integer }
    assignmentId: { type: string, format: uuid, nullable: true }
ContentNotice:              # FR-020: đơn vị đã bị vô hiệu hóa còn nằm trong lộ trình/bài giao
  type: object
  required: [unitId, title, source]
  properties:
    unitId: { type: string, format: uuid }
    title: { type: string }
    source: { type: string, enum: [path, assignment] }
ClassAssignment:
  type: object
  required: [id, batchId, unitId, title, dueOn]
  properties:
    id: { type: string, format: uuid }
    batchId: { type: string, format: uuid }
    unitId: { type: string, format: uuid }
    title: { type: string }
    dueOn: { type: string, format: date }

ClassProgressStatus: { type: string, enum: [on_track, behind, ahead, paused] }
ClassAlert:           { type: string, enum: [absent, behind, overdue_assignment] }
ClassLearnerRow:        # danh sách trắng theo FR-035 – KHÔNG thêm trường ngoài danh sách này nếu không đổi spec
  type: object
  required: [userId, displayName, email, hasStarted, pathCompleted, progressStatus, alerts]
  properties:
    userId: { type: string, format: uuid }
    displayName: { type: string }
    email: { type: string, format: email }
    joinedAt: { type: string, format: date-time }
    hasStarted: { type: boolean, description: 'false ⇒ giao diện hiện "chưa bắt đầu" thay vì số 0' }
    pathCompleted: { type: boolean }
    completionRatio: { type: number, minimum: 0, maximum: 1, nullable: true }
    expectedRatio:   { type: number, minimum: 0, maximum: 1 }
    streakDays: { type: integer }
    minutesLast7Days: { type: number }
    minutesTotal: { type: number, description: 'từ khi vào lớp' }
    reviewAccuracy: { type: number, nullable: true }
    lastActiveOn: { type: string, format: date, nullable: true }
    progressStatus: { $ref: '#/components/schemas/ClassProgressStatus' }
    alerts: { type: array, items: { $ref: '#/components/schemas/ClassAlert' } }
    absentDays: { type: integer }
    overrides: { $ref: '#/components/schemas/LearnerOverride' }
LearnerOverride:
  type: object
  properties:
    dailyMinutes: { type: integer, enum: [5, 10, 15, 30], nullable: true }
    shiftDays: { type: integer, minimum: -60, maximum: 60 }
    exemptUnitIds: { type: array, items: { type: string, format: uuid } }
ClassDashboard:
  type: object
  required: [classId, learners, summary, contentNotices]
  properties:
    classId: { type: string, format: uuid }
    learners: { type: array, items: { $ref: '#/components/schemas/ClassLearnerRow' } }
    summary:
      type: object
      required: [learnerCount, onTrack, behind, ahead, paused, needAttention]
      properties:
        learnerCount: { type: integer }
        onTrack: { type: integer }
        behind: { type: integer }
        ahead: { type: integer }
        paused: { type: integer }
        needAttention: { type: integer }
        avgCompletionRatio: { type: number, nullable: true }
        avgReviewAccuracy: { type: number, nullable: true }
    contentNotices: { type: array, items: { $ref: '#/components/schemas/ContentNotice' } }
    teacherlessWarning: { type: boolean }
```

## 5. Luồng người học

### 5.1 `GET /me` (mở rộng `Me`)

Thêm (tùy chọn, luôn có `learningSource`):

```yaml
Me:
  properties:
    learningSource: { type: string, enum: [personal, class] }
    classSummary:                 # chỉ khi learningSource = class
      type: object
      required: [classId, className, organizationName, lockedFields]
      properties:
        classId: { type: string, format: uuid }
        className: { type: string }
        organizationName: { type: string }
        lockedFields: { type: array, items: { type: string }, description: 'trường hồ sơ/điều khiển bị khóa → client hiển thị khóa kèm lý do (FR-018)' }
    organization:                 # khi tài khoản là chủ tổ chức hoặc giáo viên
      type: object
      required: [id, name, roles, dataAccess]
      properties:
        id: { type: string, format: uuid }
        name: { type: string }
        roles: { type: array, items: { type: string, enum: [owner, teacher] } }
        dataAccess: { type: boolean, description: 'false nếu mất seat/hết hạn: chỉ xem cấu trúc' }
        license:                    # để giáo viên (không gọi được GET /org) cũng thấy cảnh báo hết hạn (FR-006)
          type: object
          nullable: true            # null khi tổ chức chưa có giấy phép nào
          required: [state, endsOn, graceEndsOn]
          properties:
            state: { type: string, enum: [ok, expiring, in_grace, lapsed] }
            endsOn: { type: string, format: date }
            graceEndsOn: { type: string, format: date }
```

### 5.2 Lời mời

| Phương thức & đường dẫn | Quyền | Mô tả |
|---|---|---|
| `GET /invitations/{token}` | USR (email khớp) | Xem trước: `kind`, tổ chức, lớp (`ClassBrief`) nếu học viên, người mời, hạn, và **`disclosure: SharedDataDisclosure`** khi `kind=student`. Token sai/hết hạn/đã dùng/email không khớp → 404 chung. |
| `POST /invitations/{token}/respond` | USR (email khớp) | Body `{decision, confirmed}`. `kind=student`: `decision ∈ {join_class, stay_personal}`; `join_class` cần `confirmed:true` ⇒ tạo thành viên lớp, tính seat (409 `SEAT_UNAVAILABLE`/422 `SEAT_REASSIGN_LIMIT` nếu mất seat; khi đó lời mời giữ `pending` và học viên tiếp tục lộ trình cá nhân, thông báo rõ); `stay_personal` ⇒ lời mời `declined`, không tốn seat, hồ sơ không đổi (FR-016). `kind=teacher`/`owner`: `decision ∈ {accept, decline}`; `accept` ⇒ đặt cờ vai trò, giáo viên chiếm seat. Lỗi chung: 409 `ALREADY_IN_CLASS`, 409 `INVITEE_UNAVAILABLE`, 409 `CLASS_FULL`, 409 `CLASS_NOT_READY`. |

Phản hồi `respond` (join_class): `{ status: 'joined', class: ClassBrief, joinedAt }`.

### 5.3 Nhập mã và "Lớp của tôi"

| Phương thức & đường dẫn | Quyền | Mô tả |
|---|---|---|
| `POST /me/class/join` | USR | Body `{code, decision?, confirmed?}`. Không `decision` ⇒ 200 `{class: ClassBrief, disclosure}` (xem trước). `decision=join_class` + `confirmed:true` ⇒ tham gia (như 5.2); `decision=stay_personal` ⇒ 204, không đổi gì. Sai mã/đã tắt/hết hạn/lớp lưu trữ/lớp chưa lộ trình ⇒ **cùng một** 404 chung; sai liên tiếp ⇒ 429 (khóa theo tài khoản). |
| `GET /me/class` | LRN | `MyClass` (dưới). Không thuộc lớp ⇒ 404. |
| `POST /me/class/leave` | LRN | Body `{confirm:true}`. Chuyển sang lộ trình cá nhân (rời lớp): đóng thành viên (`switched_personal`), giải phóng seat, tổ chức mất quyền xem ngay, giữ nguyên lịch sử; 204. |

```yaml
MyClass:
  type: object
  required: [class, path, assignments, disclosure, progress, joinedAt]
  properties:
    class: { $ref: '#/components/schemas/ClassBrief' }
    joinedAt: { type: string, format: date-time }
    path: { $ref: '#/components/schemas/ClassPathTemplate' }
    assignments:
      type: array
      items: { allOf: [ { $ref: '#/components/schemas/ClassAssignment' }, { type: object, required: [state], properties: { state: { type: string, enum: [pending, on_time, late, overdue] } } } ] }
    teacherAdjustments: { $ref: '#/components/schemas/LearnerOverride' }   # "giáo viên đã điều chỉnh cho bạn" (FR-026)
    pausedToday: { type: boolean }
    movedNotice: { type: object, nullable: true, description: 'Không còn dùng (luôn null): chuyển lớp cần học viên đồng ý lại', properties: { fromClassName: { type: string }, at: { type: string, format: date-time } } }
    disclosure: { $ref: '#/components/schemas/SharedDataDisclosure' }
    progress:                    # CÙNG nguồn repository với bảng điều khiển, cùng cửa sổ từ joinedAt (research O11)
      type: object
      required: [hasStarted, minutesTotal, minutesLast7Days, streakDays]
      properties:
        hasStarted: { type: boolean }
        completionRatio: { type: number, nullable: true }
        minutesTotal: { type: number }
        minutesLast7Days: { type: number }
        reviewAccuracy: { type: number, nullable: true }
        streakDays: { type: integer }
        lastActiveOn: { type: string, format: date, nullable: true }
    placementRequest:            # có khi lớp đang yêu cầu kiểm tra trình độ và học viên chưa làm
      type: object
      nullable: true
      properties: { id: { type: string, format: uuid }, requestedAt: { type: string, format: date-time } }
```

### 5.4 Thao tác hiện có bị khóa khi thuộc lớp (409 `CLASS_MANAGED`)

`PATCH /me` với `dailyMinutes | skills | prioritizedSkill | currentLevel | goalType | targetLevel | targetDate` (các trường `displayName | language | timezone | email` vẫn hợp lệ); `PUT /onboarding`, `POST /onboarding/complete`; `POST /path/pause`, `POST /path/resume`, `POST /path/rebuild`; `PUT /path/units/{unitId}/master`, `PUT /path/items/{itemId}/master`; `POST /placement/submit` **không có** `classRequestId`.

Hành vi đổi nguồn (ghi trong mô tả endpoint, không đổi schema): với học viên thuộc lớp, `GET /today`, `POST /today/extra`, `POST /sessions` (học thêm), `GET /path`, `GET /progress` dùng **lộ trình lớp** (đơn vị khóa/miễn/chưa mở bị loại; 404 `CONTENT_EXHAUSTED` khi hết); tổng thời lượng kế hoạch ≤ phút mỗi ngày áp dụng. `GET /path` thêm `source: personal|class`.

### 5.5 `POST /placement/submit` (mở rộng)

`PlacementAnswers` thêm `classRequestId` (uuid, tùy chọn). Có ⇒ yêu cầu học viên thuộc lớp có yêu cầu đang mở; kết quả lưu `is_current=false`, không đổi lộ trình/kết quả hiện hành; 409 `CLASS_MANAGED` nếu không có yêu cầu hợp lệ. Học viên không thuộc lớp gửi `classRequestId` ⇒ 404 chung.

## 6. Quản trị viên hệ thống – `/admin/organizations` (ADM, FR-001/002)

| Phương thức & đường dẫn | Mô tả |
|---|---|
| `GET /admin/organizations` | Danh sách (`query`, `status`, `page`): id, tên, trạng thái, chủ tổ chức (email + `pending/active`), `seats {total, used, reserved}`, `license {endsOn, graceEndsOn, state}`, cảnh báo (`noOwner`, `expiring`, `inGrace`, `lapsed`). **Không** có dữ liệu học viên. |
| `POST /admin/organizations` | Body `{name, ownerEmail, license?: {seats, startsOn, endsOn, graceDays?, maxReassignments?}}` → 201; tạo tổ chức, gửi lời mời `owner`, tạo giấy phép tùy chọn; ghi nhật ký. |
| `GET /admin/organizations/{orgId}` | Chi tiết: giấy phép, danh sách người giữ seat (email, vai trò, từ khi nào), chủ tổ chức, số lớp. |
| `PATCH /admin/organizations/{orgId}` | `{name?, status?}`; `status=disabled` ⇒ xử lý hết seat ngay (O3, FR-038); `enabled` lại không tự mời lại học viên. |
| `POST /admin/organizations/{orgId}/owners/invitations` | `{email}` mời thêm/thay chủ tổ chức (lời mời `owner`, không chiếm seat). |
| `POST /admin/organizations/{orgId}/licenses` | `{seats, startsOn, endsOn, graceDays?, maxReassignments?}` → 201; 409 nếu chồng ngày; tạo `seats`; cấp lại seat cho giáo viên chưa có seat. |
| `PATCH /admin/organizations/{orgId}/licenses/{licenseId}` | `{seats?, endsOn?, graceDays?, maxReassignments?}`; giảm `seats` dưới (đang dùng + giữ chỗ) ⇒ 422 `SEAT_BELOW_USAGE`. |
| `POST /admin/organizations/{orgId}/licenses/{licenseId}/revoke` | Thu hồi giấy phép ⇒ xử lý như hết hạn. |
| `DELETE /admin/organizations/{orgId}/seats/{userId}` | Thu hồi seat của một người (học viên ⇒ đóng thành viên `seat_revoked`; giáo viên ⇒ giữ vai trò, mất quyền dữ liệu). |
| `GET /admin/action-logs?organizationId=` | Lọc nhật ký theo tổ chức (mở rộng endpoint hiện có `adminListActionLogs`; tên đường dẫn thực trong openapi.yaml là `/admin/action-logs`). |

## 7. Chủ tổ chức – `/org` (OWN, FR-003)

| Phương thức & đường dẫn | Mô tả |
|---|---|
| `GET /org` | Tổng quan: tên, trạng thái, `seats {total, used, reserved, available}`, giấy phép (`startsOn`, `endsOn`, `graceEndsOn`, `state: ok\|expiring\|in_grace\|lapsed`), giáo viên (kèm có seat không, lớp phụ trách), lớp (tên, số học viên, `teacherless`), lời mời giáo viên đang chờ. |
| `POST /org/teachers/invitations` | `{email}` mời giáo viên (409 `SEAT_UNAVAILABLE` khi hết chỗ; 409 `INVITEE_UNAVAILABLE`). |
| `DELETE /org/teachers/{userId}` | Gỡ vai trò giáo viên: mất quyền ngay, giải phóng seat, gỡ khỏi `class_teachers`; lớp thành `teacherless` nếu hết người (FR-040). |
| `POST /org/seats/{userId}/grant` | Cấp lại seat cho giáo viên đang mất seat (409 `SEAT_UNAVAILABLE`). |
| `POST /org/seats/{userId}/revoke` | Thu hồi seat của giáo viên/học viên trong tổ chức mình. |
| `DELETE /invitations/{invitationId}` | Thu hồi lời mời (OWN: mọi lời mời tổ chức; TCH: lời mời học viên của lớp mình). Trong openapi.yaml 1.12.0 nằm cùng path item `/invitations/{token}` (OpenAPI không cho hai mẫu đường dẫn chỉ khác tên tham số): tham số `token` của `DELETE` mang **id (uuid) của lời mời**. |

## 8. Lớp học – `/classes` (MGR trừ khi ghi khác; FR-009 → FR-016)

| Phương thức & đường dẫn | Quyền | Mô tả |
|---|---|---|
| `GET /classes` | TCH/OWN | TCH: lớp mình phụ trách; OWN: mọi lớp. Mỗi dòng: id, tên, `status`, `memberCount`, `hasPath`, `teachers[]`, `needAttentionCount`, `teacherless`. |
| `POST /classes` | TCH/OWN | `{name, description?, teacherIds?}` → 201. TCH tạo ⇒ tự là phụ trách; `teacherIds` chỉ OWN. Cần `is_teacher` hoặc `is_owner`. |
| `GET /classes/{id}` | MGR | Chi tiết cấu trúc (không dữ liệu học). Lớp lưu trữ vẫn xem được (cấu trúc + thành viên). |
| `PATCH /classes/{id}` | MGR | `{name?, description?, absenceThresholdDays? (1–14)}`. |
| `POST /classes/{id}/archive` | MGR | `{confirm:true}`; 200 trả hậu quả đã áp dụng `{learnersMoved}`. Đóng mọi thành viên (`class_archived`), vô hiệu mã + lời mời chờ. Không khôi phục. |
| `PUT /classes/{id}/teachers` | OWN | `{userIds[]}` (≥ 1, đều là giáo viên cùng tổ chức) — 409 `LAST_TEACHER` nếu rỗng. |
| `GET /classes/{id}/roster` | MGR | Danh sách học viên theo trạng thái (FR-015): `joined`, `invited`, `declined`, `switched_personal`, `removed`, `other_ended`; mỗi dòng `{userId?, displayName, email?, status, at}`; học viên đã rời lớp chỉ có tên + ngày (O13). |
| `DELETE /classes/{id}/members/{userId}` | MGR | Gỡ học viên (`removed`), giải phóng seat. |
| `POST /classes/{id}/members/{userId}/move` | MGR (quyền ở lớp nguồn **và** lớp đích, hoặc OWN) | `{toClassId}` — **MỜI** chuyển lớp (202, không chuyển ngay): tạo lời mời `student` tới lớp đích; học viên chấp nhận qua `POST /invitations/{token}/respond` mới đóng thành viên cũ (`moved`) và mở thành viên mới, giữ seat/tiến độ/lịch ôn; 409 `CLASS_FULL`/`CLASS_NOT_READY`/`CLASS_ARCHIVED`; lớp đích ngoài phạm vi ⇒ 404 chung. |

### 8.1 Đưa học viên vào lớp (FR-010 → FR-013)

| Phương thức & đường dẫn | Mô tả |
|---|---|
| `POST /classes/{id}/invitations` | `{invitees: [{email, displayName?}]}` (≤ 50/lần) → 200 `{results: [{email, outcome}]}` với `outcome ∈ invited \| invalid_email \| duplicate_in_file \| already_in_class \| already_in_other_class \| already_invited \| no_seat \| unavailable`. Mỗi lời mời giữ chỗ một seat. 409 `CLASS_NOT_READY` khi lớp chưa lộ trình. |
| `POST /classes/{id}/invitations/import` | `Content-Type: text/csv`; ≤ 200 dòng, ≤ `CSV_IMPORT_MAX_BYTES`. 200 `{results: [{row, email, outcome}], summary}` — **đúng một kết quả cho mỗi dòng dữ liệu**; định dạng ở [csv-formats.md](csv-formats.md). 422 toàn file khi sai định dạng/quá cỡ. |
| `GET /classes/{id}/join-code` | `{code, enabled, expiresAt}` (chỉ MGR; mã chỉ hiện cho người quản lý). |
| `PUT /classes/{id}/join-code` | `{enabled, expiresAt?}`; bật lần đầu sinh mã; 409 `CLASS_NOT_READY` nếu chưa lộ trình. |
| `POST /classes/{id}/join-code/rotate` | Đổi mã (mã cũ vô hiệu ngay). |

## 9. Lộ trình lớp, bài giao, ghi đè, tạm dừng (MGR; FR-017 → FR-026)

| Phương thức & đường dẫn | Mô tả |
|---|---|
| `GET /classes/{id}/path` | 200 `{path: ClassPath \| null}` — `path: null` khi lớp chưa có lộ trình (để client hiện lời nhắc đặt lộ trình trước khi mời). |
| `PUT /classes/{id}/path` | Body `ClassPathTemplate`; tạo/sửa (FR-017: không có thao tác xóa). 200 `ClassPath` kèm `warnings`. Có hiệu lực từ kế hoạch sinh kế tiếp; tiến độ/lịch ôn giữ nguyên. Lưu trọn vẹn hoặc không đổi. |
| `PUT /classes/{id}/path/units` | `{units: [{unitId, opensOn?}]}` thay toàn bộ danh sách chọn/thứ tự/ngày mở (đơn vị phải `active`, không trùng); `units: []` quay lại chế độ mẫu. Cần lộ trình lớp có trước (409 `CLASS_NOT_READY`). |
| `POST /classes/{id}/assignments` | `{unitIds[] (1–20), dueOn}` → 201 `{batchId, assignments[]}`; đơn vị phải `active`; `warnings` nếu khối lượng vượt quỹ. |
| `DELETE /classes/{id}/assignments/{assignmentId}` | Hủy bài giao. |
| `PUT /classes/{id}/members/{userId}/override` | `{dailyMinutes: 5\|10\|15\|30\|null, shiftDays: -60..60}` — ghi đè riêng (FR-026). |
| `PUT /classes/{id}/members/{userId}/exemptions/{unitId}` · `DELETE …` | Miễn / bỏ miễn đơn vị cho học viên. |
| `GET /classes/{id}/pauses` | Danh sách khoảng tạm dừng (cả lớp + từng học viên). |
| `POST /classes/{id}/pauses` | `{userId?, startedOn, endedOn?}` — `userId` vắng ⇒ cả lớp. 409 nếu đã có khoảng mở cùng phạm vi. |
| `POST /classes/{id}/pauses/{pauseId}/end` | `{endedOn?}` mặc định hôm nay (theo múi giờ lớp/ngày giáo viên). |

## 10. Bảng điều khiển, điểm yếu, xuất CSV (MGR có `dataAccess`; FR-027 → FR-033, FR-035)

| Phương thức & đường dẫn | Mô tả |
|---|---|
| `GET /classes/{id}/dashboard` | Query `sort` ∈ `name\|completion\|streak\|minutes7\|accuracy\|lastActive\|status` (+ `order`), `filter` ∈ `behind\|absent\|needs_attention\|paused\|not_started`. Trả `ClassDashboard`. Chỉ số kể từ `joinedAt` từng học viên. |
| `GET /classes/{id}/members/{userId}/detail` | `ClassLearnerDetail`: `units[]` (trạng thái từng đơn vị lộ trình lớp, bài giao + `state`), `dailyMinutes30[]` (30 ngày), `reviewAccuracy`, `weakTopics[]`, `placement` (nếu có), `assignmentStates[]`. **Không** có từng câu trả lời. 404 nếu học viên không thuộc lớp *hiện tại* (đã rời/bị gỡ ⇒ 404 ngay, SC-008). |
| `GET /classes/{id}/weak-topics` | `[{topicId, name, skill, accuracy, answers, flaggedLearners: [{userId, displayName}]}]` xếp mức yếu giảm dần; ngưỡng 60% / 30 câu (cấu hình). |
| `GET /classes/{id}/export.csv` | `text/csv; charset=utf-8` (BOM), mỗi học viên một dòng, cột như `ClassLearnerRow`; ghi nhật ký `class.export`. |
| `GET /classes/{id}/members/{userId}/export.csv` | CSV chi tiết một học viên. |

## 11. Kiểm tra trình độ cho cả lớp (US8, FR-034)

| Phương thức & đường dẫn | Mô tả |
|---|---|
| `POST /classes/{id}/placement-requests` | Tạo yêu cầu (409 nếu đã có yêu cầu mở). |
| `GET /classes/{id}/placement-requests/current` | `{request, results: [{userId, displayName, status: done\|pending, estimatedLevel?, score?, total?, takenAt?}], distribution: {none, N5, N4, N3}}` hoặc 404 khi không có yêu cầu mở. Không tự đổi lộ trình lớp. |
| `POST /classes/{id}/placement-requests/current/close` | Đóng yêu cầu. |

## 12. Việc cần làm khi hiện thực hợp đồng

1. Áp các mục trên vào `specs/001-phase1-mvp/contracts/openapi.yaml`, tăng `info.version` 1.12.0 và dán nhật ký §1.
2. Kiểm thử hợp đồng (`tests/contract/org-*.test.ts`) dùng `helper.ts` hiện có để so phản hồi với schema; **ma trận quyền** sinh từ [permissions-matrix.md](permissions-matrix.md).
3. Sinh lại client Dart; client cũ (1.11.0) vẫn chạy với người học không thuộc lớp vì không có thay đổi phá vỡ, nhưng không hiển thị khóa lớp — phát hành client cùng backend.
