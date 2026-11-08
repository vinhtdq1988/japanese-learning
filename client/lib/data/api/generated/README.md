# japanese_api (EXPERIMENTAL)
Hợp đồng REST API cho Giai đoạn 1 – MVP (nhánh `001-phase1-mvp`).
- Tiền tố: `/api/v1`. Xác thực: `Authorization: Bearer <accessToken>` trừ các endpoint đánh dấu công khai.
- Mọi bản ghi do client tạo mang `clientEventId` (UUID) để đảm bảo idempotent (FR-041).
- Thay đổi phá vỡ tương thích PHẢI tăng phiên bản chính và được ghi trong tài liệu (Hiến pháp).
- Nhật ký thay đổi: 1.1.0 (2026-11-04, trước khi hiện thực, chưa có client nào dùng 1.0.0) – thêm `PUT /admin/placement-questions/{questionId}` và `PUT /admin/placement-questions/active-set`; `isActive` của câu placement thành chỉ đọc; thêm `isRetry` khi ghi câu trả lời; thêm `scopeNotice` và `reason` cho lộ trình, `scopeNotice` cho tiến độ, `tier` cho đơn vị admin, `currentLevel` trong `ProfileUpdate`; `targetLevel` nhận N5–N1; bỏ trạng thái `skipped` của đơn vị trong lộ trình; `/auth/refresh` trả 403 `ACCOUNT_DISABLED`.
  1.2.0 (2026-11-04, trước khi hiện thực, chưa có client nào dùng) – `PUT /path/units/{unitId}/master` trả 200 `MasterResult` thay cho 204; `PlanItem.estMinutes` giới hạn 1–15 (gói ôn chia theo R7).
  1.3.0 (2026-11-04, trước khi hiện thực, chưa có client nào dùng) – mục và bài tập trong `AdminUnitWrite` có `id` (tùy chọn) và `status`; mục/bài tập vắng mặt trong payload sửa bị chuyển `inactive` thay vì xóa cứng; `POST /path/rebuild` với `usePlacementResultId` lưu `reason='placement_retake'`; `ProfileUpdate.currentPassword` bắt buộc khi đổi `email`, 409 trả `EMAIL_TAKEN`/`EMAIL_PENDING_DELETION`; `PUT /me/password` thu hồi các phiên khác. Thay đổi bổ sung, không phá vỡ tương thích.
  1.3.1 (2026-11-04) – sửa lỗi cú pháp, không đổi ngữ nghĩa: đặt các `description` chứa dấu phẩy trong dấu nháy (YAML tách sai thành thuộc tính thừa); thêm `type` cho các trường `nullable` dùng `allOf` theo OpenAPI 3.0.3.
  1.4.0 (2026-11-04, trước khi hiện thực, chưa có client nào dùng) – thêm `operationId` (camelCase, duy nhất) cho mọi operation; đây là tên hàm của API client sinh ra (T030), nên đổi `operationId` về sau phải ghi vào nhật ký như một thay đổi hợp đồng. Không đổi đường dẫn, request hay response.
  1.5.0 (2026-11-04, trong lúc hiện thực US1, chưa có client nào phụ thuộc) – `GET /today` khai báo thêm 404 (chưa hoàn tất onboarding nên chưa có lộ trình), khớp `GET /path`. Thay đổi bổ sung, không phá vỡ tương thích; API client sinh ra không đổi.
  1.6.0 (2026-11-04, trong lúc hiện thực US2, chưa có client nào phụ thuộc) – (1) `LessonSession` thêm `kind` và `title` (client cần tiêu đề phiên và biết phiên \"học thêm\"); (2) học thêm: `POST /today/extra` trả `PlanItem` có `id` là id đơn vị, client bắt đầu bằng `POST /sessions` với `planItemId` = id đó (phiên `kind='extra'`, không gắn mục kế hoạch), khai báo thêm 409 `PATH_PAUSED` và 404 mang mã `CONTENT_EXHAUSTED` kèm gợi ý `fields.suggestion` ∈ {raise_level, add_skill, content_exhausted}; (3) payload bài tập `matching` cho người học là `left[]` và `right[]` (vế phải đã xáo) thay cho `pairs[]`; (4) khai báo các mã lỗi 404/409/422 còn thiếu của `/sessions/_*` (409 `SESSION_COMPLETED` khi ghi câu trả lời vào phiên đã hoàn thành) và 422 của `PUT /onboarding` (đã có từ US1 nhưng chưa khai báo). Thay đổi bổ sung và làm rõ, không phá vỡ tương thích; cần sinh lại API client vì `LessonSession` thêm trường.
  1.7.0 (2026-11-04, trong lúc hiện thực US4/US5, chưa có client nào phụ thuộc) – khai báo các mã lỗi còn thiếu của `POST /path/rebuild` (404 chưa onboarding, 422), `POST /path/pause`, `POST /path/resume` (404 chưa onboarding) và `PUT /path/units/{unitId}/master` (404 không tìm thấy đơn vị, 422 thân yêu cầu sai); làm rõ `MasterResult.remainingUnits` là số đơn vị còn có thể học (chưa học hoặc đang học dở, chưa thành thạo) và `suggestion` chỉ có mặt khi `remainingUnits = 0`; làm rõ `PATCH /me` khi chưa hoàn tất onboarding (422 cho các trường lộ trình). Thay đổi bổ sung và làm rõ, không phá vỡ tương thích; API client sinh ra không đổi.
  1.8.0 (2026-11-04, trong lúc hiện thực US8, chưa có client nào phụ thuộc) – (1) `POST /trial/events` làm rõ 422 khi tên sự kiện ngoài danh sách hoặc thân có trường ngoài `event`; (2) `TrialContent` mô tả cụ thể `answerKey` theo loại bài tập (`correctIndex` | `pairs` | `acceptedAnswers`) để client chấm cục bộ; (3) `GET /trial/content` và `POST /trial/placement/grade` làm rõ chỉ tăng bộ đếm ẩn danh; (4) sửa lỗi cú pháp YAML của `MasterResult.remainingUnits.description` (đặt trong dấu nháy; trình sinh mã từ chối spec) – không đổi ngữ nghĩa. Thay đổi bổ sung và làm rõ, không phá vỡ tương thích; cần sinh lại API client vì `answerKey` có thuộc tính.
  1.9.0 (2026-11-05, trong lúc hiện thực US6, chưa có client nào phụ thuộc) – bổ sung cho `/admin/_*`: (0) thêm `GET /admin/topics` (`adminListTopics`, schema `AdminTopic`) để admin chọn `topicId` khi soạn đơn vị và câu hỏi; (1) bài tập trong `AdminUnitWrite` thêm `itemIndex` (chỉ số 0 của mục trong `items` cùng payload mà bài tập kiểm tra; cần để bài tập do admin tạo vào được lịch ôn tập, `exercises.item_id`); (2) `AdminPlacementQuestion` thêm `hint` (gợi ý song ngữ, tùy chọn) và khai báo trường bắt buộc khi ghi; (3) `AdminUserPage.items[]` thêm `role`; (4) `AdminActionLog` thêm `diff` (đã loại thông tin nhạy cảm) và `targetId` có thể null (thao tác trên cả bộ câu hỏi); (5) `GET /admin/action-logs` trả con trỏ trang kế tiếp ở header `X-Next-Cursor`; `GET /admin/units` không kèm `items`/`exercises` (xem chi tiết bằng `GET /admin/units/{unitId}`); (6) khai báo các mã 404/422 còn thiếu của `/admin/_*`. Thay đổi bổ sung và làm rõ, không phá vỡ tương thích; API client sinh ra không bị ảnh hưởng vì các trường mới đều tùy chọn.
  1.10.0 (2026-11-05, trong lúc hiện thực US7, chưa có client nào phụ thuộc) – làm rõ và khai báo đủ mã lỗi cho tài khoản: (1) `PUT /me/password` thêm 422 (mật khẩu mới không hợp lệ hoặc trùng email); (2) `POST /account/delete` thêm 401 (mật khẩu sai) và 422 (thiếu mật khẩu), `permanentDeletionAt` bắt buộc; phản hồi 200 yêu cầu client xóa token ngay vì mọi phiên của tài khoản đã bị thu hồi; (3) `POST /account/restore` thêm 401 và mã lỗi `ACCOUNT_DELETED` cho 410; sau khi khôi phục client PHẢI gọi `POST /auth/refresh` vì access token hiện tại còn mang trạng thái `pending_deletion`; (4) `PATCH /me` thêm 401 `UNAUTHORIZED` cho thiếu/sai `currentPassword` khi đổi email (đã khai báo từ 1.3.0). Thay đổi bổ sung và làm rõ, không phá vỡ tương thích.
  1.11.0 (2026-11-05, spec 003-kanji-lessons) – bổ sung Kanji: (1) `Skill` thêm `kanji` (placement và dùng thử vẫn chỉ vocabulary/grammar); (2) `ProfileUpdate` thêm `skills` – đổi kỹ năng không sinh lộ trình mới, có hiệu lực ở kế hoạch kế tiếp; bỏ kỹ năng đang ưu tiên thì `prioritizedSkill` về null; (3) thêm `PUT /path/items/{itemId}/master` (chỉ mục Kanji); (4) `ContentItem` thêm `kanji`, `topicId`, `examples[].kanjiReading`; `Exercise` thêm `facet`; (5) `DailyPlan` thêm `kanjiNotice`; `PlanItem` thêm `kind`; (6) `SessionSummary` thêm `attentionItems`; (7) `ProgressSummary` thêm `kanji` và `weakTopics[].skill`; (8) `AdminUnitWrite` nhận `kind=kanji`, mục thêm `topicId`/`kanjiDetails`, bài tập thêm `facet`; `GET /admin/units` lọc `kind=kanji`, `GET /admin/topics` thêm tham số lọc `skill`. Thay đổi bổ sung; client sinh mã cũ có thể không giải mã được `Skill=kanji` nên client và backend PHẢI phát hành cùng lúc.
  1.12.0 (2026-11-07, spec 004-org-classes) – bổ sung tổ chức, lớp học, lộ trình lớp (B2B theo seat): (1) nhóm `/admin/organizations*` cho quản trị viên hệ thống (tổ chức, giấy phép, seat; KHÔNG có dữ liệu học); (2) nhóm `/org*` cho chủ tổ chức; (3) nhóm `/classes*` cho giáo viên phụ trách và chủ tổ chức (lớp, thành viên, lời mời, mã tham gia, nhập CSV, lộ trình lớp, bài giao, ghi đè cá nhân, tạm dừng, bảng điều khiển, điểm yếu, xuất CSV, yêu cầu kiểm tra trình độ); (4) `/invitations/{token}*`, `/me/class*` cho người học (xem trước + hai lựa chọn, nhập mã, \"Lớp của tôi\", chuyển sang lộ trình cá nhân); (5) `Me` thêm `learningSource`, `classSummary`, `organization`; `GET /path` thêm `source`; (6) `PlacementAnswers` thêm `classRequestId`; (7) mã lỗi mới `CLASS_MANAGED` (409) và các mã seat/lớp (`SEAT_UNAVAILABLE`, `SEAT_REASSIGN_LIMIT`, `SEAT_BELOW_USAGE`, `CLASS_NOT_READY`, `CLASS_FULL`, `CLASS_ARCHIVED`, `LAST_TEACHER`, `ALREADY_IN_CLASS`, `INVITEE_UNAVAILABLE`); (8) `GET /admin/action-logs` thêm tham số `organizationId`. Người học không thuộc lớp: mọi phản hồi cũ không đổi (chỉ thêm trường tùy chọn `learningSource: personal`). Vai trò tổ chức KHÔNG nằm trong access token; quyền được tra CSDL mỗi yêu cầu nên mất quyền có hiệu lực ngay. `DELETE /invitations/{token}` nhận id lời mời (uuid) ở cùng vị trí đường dẫn. Thay đổi bổ sung, không phá vỡ tương thích; client và backend PHẢI phát hành cùng lúc để hiển thị khóa lớp.
  1.13.0 (2026-11-08, spec 005-reward-feedback-effects) – bổ sung hiệu ứng thưởng: (1) `SessionSummary.celebrations` (tùy chọn) trả MỘT LẦN, trong phản hồi của lần `POST /sessions/{id}/complete` thực sự hoàn thành phiên: lời chúc mừng hoàn thành ngày (`dayCompleted`) và danh sách thành tựu vừa đạt (`achievements`, đã bản địa hóa theo ngôn ngữ hồ sơ); gọi lại trên phiên đã hoàn thành KHÔNG trả trường này và không ghi thêm gì; (2) `Profile` và `ProfileUpdate` thêm `soundEnabled`, `visualEffectsEnabled` (mặc định true; KHÔNG thuộc nhóm trường bị khóa khi người học thuộc lớp). Thành tựu không có endpoint đọc lại và không xuất hiện trong các DTO của giáo viên/tổ chức. Thay đổi bổ sung; client 1.12.0 bỏ qua các trường mới.


This Dart package is automatically generated by the [OpenAPI Generator](https://openapi-generator.tech) project:

- API version: 1.13.0
- Generator version: 7.27.0
- Build package: org.openapitools.codegen.languages.DartDioClientCodegen

## Requirements

* Dart 2.15.0+ or Flutter 2.8.0+
* Dio 5.0.0+ (https://pub.dev/packages/dio)
* JSON Serializable 6.1.5+ (https://pub.dev/packages/json_serializable)

## Installation & Usage

### pub.dev
To use the package from [pub.dev](https://pub.dev), please include the following in pubspec.yaml
```yaml
dependencies:
  japanese_api: 1.0.0
```

### Github
If this Dart package is published to Github, please include the following in pubspec.yaml
```yaml
dependencies:
  japanese_api:
    git:
      url: https://github.com/GIT_USER_ID/GIT_REPO_ID.git
      #ref: main
```

### Local development
To use the package from your local drive, please include the following in pubspec.yaml
```yaml
dependencies:
  japanese_api:
    path: /path/to/japanese_api
```

## Getting Started

Please follow the [installation procedure](#installation--usage) and then run the following:

```dart
import 'package:japanese_api/japanese_api.dart';


final api = JapaneseApi().getAccountApi();
final ChangePasswordRequest changePasswordRequest = ; // ChangePasswordRequest | 

try {
    api.changePassword(changePasswordRequest);
} on DioException catch (e) {
    print("Exception when calling AccountApi->changePassword: $e\n");
}

```

## Documentation for API Endpoints

All URIs are relative to */api/v1*

Class | Method | HTTP request | Description
------------ | ------------- | ------------- | -------------
[*AccountApi*](doc/AccountApi.md) | [**changePassword**](doc/AccountApi.md#changepassword) | **PUT** /me/password | Đổi mật khẩu
[*AccountApi*](doc/AccountApi.md) | [**deleteAccount**](doc/AccountApi.md#deleteaccount) | **POST** /account/delete | Xóa tài khoản – vô hiệu hóa ngay, xóa vĩnh viễn sau 30 ngày (FR-003)
[*AccountApi*](doc/AccountApi.md) | [**getMe**](doc/AccountApi.md#getme) | **GET** /me | Thông tin tài khoản + hồ sơ học tập
[*AccountApi*](doc/AccountApi.md) | [**restoreAccount**](doc/AccountApi.md#restoreaccount) | **POST** /account/restore | Khôi phục tài khoản trong 30 ngày chờ xóa
[*AccountApi*](doc/AccountApi.md) | [**updateMe**](doc/AccountApi.md#updateme) | **PATCH** /me | Sửa hồ sơ (FR-002)
[*AdminApi*](doc/AdminApi.md) | [**adminCreateLicense**](doc/AdminApi.md#admincreatelicense) | **POST** /admin/organizations/{orgId}/licenses | Cấp giấy phép (kỳ hạn + số seat)
[*AdminApi*](doc/AdminApi.md) | [**adminCreateOrganization**](doc/AdminApi.md#admincreateorganization) | **POST** /admin/organizations | Tạo tổ chức, mời chủ tổ chức, cấp giấy phép/seat tùy chọn
[*AdminApi*](doc/AdminApi.md) | [**adminCreatePlacementQuestion**](doc/AdminApi.md#admincreateplacementquestion) | **POST** /admin/placement-questions | Tạo câu hỏi kiểm tra trình độ (luôn ở trạng thái chưa kích hoạt; đưa vào bộ hiện hành bằng &#x60;PUT /admin/placement-questions/active-set&#x60;)
[*AdminApi*](doc/AdminApi.md) | [**adminCreateUnit**](doc/AdminApi.md#admincreateunit) | **POST** /admin/units | Tạo đơn vị học (kèm mục nội dung và bài tập) – FR-030
[*AdminApi*](doc/AdminApi.md) | [**adminGetOrganization**](doc/AdminApi.md#admingetorganization) | **GET** /admin/organizations/{orgId} | Chi tiết tổ chức - giấy phép, người giữ seat, chủ tổ chức
[*AdminApi*](doc/AdminApi.md) | [**adminGetUnit**](doc/AdminApi.md#admingetunit) | **GET** /admin/units/{unitId} | Chi tiết đơn vị học (kèm mọi mục và bài tập, cả &#x60;inactive&#x60;)
[*AdminApi*](doc/AdminApi.md) | [**adminInviteOwner**](doc/AdminApi.md#admininviteowner) | **POST** /admin/organizations/{orgId}/owners/invitations | Mời thêm/thay chủ tổ chức (không chiếm seat)
[*AdminApi*](doc/AdminApi.md) | [**adminListActionLogs**](doc/AdminApi.md#adminlistactionlogs) | **GET** /admin/action-logs | Nhật ký hành động quản trị (FR-032), mới nhất trước
[*AdminApi*](doc/AdminApi.md) | [**adminListOrganizations**](doc/AdminApi.md#adminlistorganizations) | **GET** /admin/organizations | Danh sách tổ chức (không có dữ liệu học viên)
[*AdminApi*](doc/AdminApi.md) | [**adminListPlacementQuestions**](doc/AdminApi.md#adminlistplacementquestions) | **GET** /admin/placement-questions | Danh sách câu hỏi kiểm tra trình độ
[*AdminApi*](doc/AdminApi.md) | [**adminListTopics**](doc/AdminApi.md#adminlisttopics) | **GET** /admin/topics | Danh sách mảng nội dung (để chọn &#x60;topicId&#x60; khi soạn đơn vị học và câu hỏi kiểm tra trình độ)
[*AdminApi*](doc/AdminApi.md) | [**adminListUnits**](doc/AdminApi.md#adminlistunits) | **GET** /admin/units | Danh sách đơn vị học (lọc theo trạng thái, trình độ, loại); không kèm &#x60;items&#x60;/&#x60;exercises&#x60;
[*AdminApi*](doc/AdminApi.md) | [**adminListUsers**](doc/AdminApi.md#adminlistusers) | **GET** /admin/users | Tìm tài khoản người học (FR-031), mới nhất trước
[*AdminApi*](doc/AdminApi.md) | [**adminRevokeLicense**](doc/AdminApi.md#adminrevokelicense) | **POST** /admin/organizations/{orgId}/licenses/{licenseId}/revoke | Thu hồi giấy phép - xử lý như hết hạn
[*AdminApi*](doc/AdminApi.md) | [**adminRevokeSeat**](doc/AdminApi.md#adminrevokeseat) | **DELETE** /admin/organizations/{orgId}/seats/{userId} | Thu hồi seat của một người (học viên - đóng thành viên; giáo viên - giữ vai trò, mất quyền dữ liệu)
[*AdminApi*](doc/AdminApi.md) | [**adminSetActivePlacementSet**](doc/AdminApi.md#adminsetactiveplacementset) | **PUT** /admin/placement-questions/active-set | Kích hoạt nguyên tử một bộ câu hỏi (thay thế bộ hiện hành) – PHẢI đúng 20 câu (8 N5, 6 N4, 6 N3) (FR-007, FR-030)
[*AdminApi*](doc/AdminApi.md) | [**adminSetUnitStatus**](doc/AdminApi.md#adminsetunitstatus) | **PUT** /admin/units/{unitId}/status | Kích hoạt / vô hiệu hóa; đánh dấu thuộc tập dùng thử (FR-037)
[*AdminApi*](doc/AdminApi.md) | [**adminSetUserStatus**](doc/AdminApi.md#adminsetuserstatus) | **PUT** /admin/users/{userId}/status | Vô hiệu hóa / kích hoạt lại tài khoản
[*AdminApi*](doc/AdminApi.md) | [**adminUpdateLicense**](doc/AdminApi.md#adminupdatelicense) | **PATCH** /admin/organizations/{orgId}/licenses/{licenseId} | Chỉnh giấy phép (số seat, hạn, ân hạn, giới hạn đổi người giữ)
[*AdminApi*](doc/AdminApi.md) | [**adminUpdateOrganization**](doc/AdminApi.md#adminupdateorganization) | **PATCH** /admin/organizations/{orgId} | Đổi tên hoặc vô hiệu hóa/kích hoạt lại tổ chức
[*AdminApi*](doc/AdminApi.md) | [**adminUpdatePlacementQuestion**](doc/AdminApi.md#adminupdateplacementquestion) | **PUT** /admin/placement-questions/{questionId} | Sửa câu hỏi kiểm tra trình độ (nội dung, lựa chọn, đáp án, position) – ghi nhật ký quản trị (FR-030, FR-032)
[*AdminApi*](doc/AdminApi.md) | [**adminUpdateUnit**](doc/AdminApi.md#adminupdateunit) | **PUT** /admin/units/{unitId} | Sửa đơn vị học (có hiệu lực với phiên mới; phiên đang học giữ nguyên ảnh chụp). Đơn vị đang &#x60;active&#x60; PHẢI vẫn đạt kiểm tra nội dung sau khi sửa.
[*AuthApi*](doc/AuthApi.md) | [**confirmPasswordReset**](doc/AuthApi.md#confirmpasswordreset) | **POST** /auth/password-reset/confirm | Đặt mật khẩu mới bằng token một lần
[*AuthApi*](doc/AuthApi.md) | [**login**](doc/AuthApi.md#login) | **POST** /auth/login | Đăng nhập
[*AuthApi*](doc/AuthApi.md) | [**logout**](doc/AuthApi.md#logout) | **POST** /auth/logout | Đăng xuất (thu hồi phiên hiện tại)
[*AuthApi*](doc/AuthApi.md) | [**refreshToken**](doc/AuthApi.md#refreshtoken) | **POST** /auth/refresh | Làm mới access token (xoay vòng refresh token)
[*AuthApi*](doc/AuthApi.md) | [**register**](doc/AuthApi.md#register) | **POST** /auth/register | Đăng ký (FR-001) – không yêu cầu xác minh email
[*AuthApi*](doc/AuthApi.md) | [**requestPasswordReset**](doc/AuthApi.md#requestpasswordreset) | **POST** /auth/password-reset/request | Yêu cầu liên kết đặt lại mật khẩu (FR-001)
[*ClassesApi*](doc/ClassesApi.md) | [**archiveClass**](doc/ClassesApi.md#archiveclass) | **POST** /classes/{id}/archive | Lưu trữ lớp (một chiều) - đóng mọi thành viên, vô hiệu mã và lời mời chờ
[*ClassesApi*](doc/ClassesApi.md) | [**cancelClassAssignment**](doc/ClassesApi.md#cancelclassassignment) | **DELETE** /classes/{id}/assignments/{assignmentId} | Hủy bài giao
[*ClassesApi*](doc/ClassesApi.md) | [**closeClassPlacementRequest**](doc/ClassesApi.md#closeclassplacementrequest) | **POST** /classes/{id}/placement-requests/current/close | Đóng yêu cầu kiểm tra trình độ
[*ClassesApi*](doc/ClassesApi.md) | [**createClass**](doc/ClassesApi.md#createclass) | **POST** /classes | Tạo lớp (giáo viên tự là phụ trách; &#x60;teacherIds&#x60; chỉ chủ tổ chức)
[*ClassesApi*](doc/ClassesApi.md) | [**createClassAssignments**](doc/ClassesApi.md#createclassassignments) | **POST** /classes/{id}/assignments | Giao bài (1-20 đơn vị, một hạn)
[*ClassesApi*](doc/ClassesApi.md) | [**createClassPause**](doc/ClassesApi.md#createclasspause) | **POST** /classes/{id}/pauses | Tạm dừng cả lớp (vắng &#x60;userId&#x60;) hoặc một học viên
[*ClassesApi*](doc/ClassesApi.md) | [**createClassPlacementRequest**](doc/ClassesApi.md#createclassplacementrequest) | **POST** /classes/{id}/placement-requests | Yêu cầu cả lớp làm bài kiểm tra trình độ
[*ClassesApi*](doc/ClassesApi.md) | [**endClassPause**](doc/ClassesApi.md#endclasspause) | **POST** /classes/{id}/pauses/{pauseId}/end | Kết thúc khoảng tạm dừng (mặc định hôm nay)
[*ClassesApi*](doc/ClassesApi.md) | [**exemptLearnerUnit**](doc/ClassesApi.md#exemptlearnerunit) | **PUT** /classes/{id}/members/{userId}/exemptions/{unitId} | Miễn một đơn vị cho học viên
[*ClassesApi*](doc/ClassesApi.md) | [**exportClassCsv**](doc/ClassesApi.md#exportclasscsv) | **GET** /classes/{id}/export.csv | Xuất báo cáo lớp (CSV có BOM, chống công thức; ghi nhật ký &#x60;class.export&#x60;)
[*ClassesApi*](doc/ClassesApi.md) | [**exportClassLearnerCsv**](doc/ClassesApi.md#exportclasslearnercsv) | **GET** /classes/{id}/members/{userId}/export.csv | Xuất CSV chi tiết một học viên
[*ClassesApi*](doc/ClassesApi.md) | [**getClass**](doc/ClassesApi.md#getclass) | **GET** /classes/{id} | Chi tiết cấu trúc lớp (không có dữ liệu học); lớp lưu trữ vẫn xem được
[*ClassesApi*](doc/ClassesApi.md) | [**getClassDashboard**](doc/ClassesApi.md#getclassdashboard) | **GET** /classes/{id}/dashboard | Bảng điều khiển lớp (số liệu kể từ ngày vào lớp của từng học viên)
[*ClassesApi*](doc/ClassesApi.md) | [**getClassLearnerDetail**](doc/ClassesApi.md#getclasslearnerdetail) | **GET** /classes/{id}/members/{userId}/detail | Chi tiết một học viên - KHÔNG có từng câu trả lời
[*ClassesApi*](doc/ClassesApi.md) | [**getClassPath**](doc/ClassesApi.md#getclasspath) | **GET** /classes/{id}/path | Lộ trình lớp (&#x60;path&#x60; là null khi chưa đặt)
[*ClassesApi*](doc/ClassesApi.md) | [**getClassPlacementRequest**](doc/ClassesApi.md#getclassplacementrequest) | **GET** /classes/{id}/placement-requests/current | Kết quả kiểm tra trình độ của lớp (không tự đổi lộ trình lớp)
[*ClassesApi*](doc/ClassesApi.md) | [**getClassRoster**](doc/ClassesApi.md#getclassroster) | **GET** /classes/{id}/roster | Danh sách học viên theo trạng thái (đã vào, chờ, từ chối, tự chuyển cá nhân, bị gỡ)
[*ClassesApi*](doc/ClassesApi.md) | [**getClassWeakTopics**](doc/ClassesApi.md#getclassweaktopics) | **GET** /classes/{id}/weak-topics | Điểm yếu chung của lớp (mức yếu giảm dần)
[*ClassesApi*](doc/ClassesApi.md) | [**getJoinCode**](doc/ClassesApi.md#getjoincode) | **GET** /classes/{id}/join-code | Xem mã tham gia (chỉ người quản lý lớp)
[*ClassesApi*](doc/ClassesApi.md) | [**importClassLearnersCsv**](doc/ClassesApi.md#importclasslearnerscsv) | **POST** /classes/{id}/invitations/import | Nhập danh sách học viên từ CSV - đúng một kết quả cho mỗi dòng dữ liệu
[*ClassesApi*](doc/ClassesApi.md) | [**inviteClassLearners**](doc/ClassesApi.md#inviteclasslearners) | **POST** /classes/{id}/invitations | Mời học viên bằng email (≤ 50 mỗi lần) - mỗi lời mời giữ chỗ một seat
[*ClassesApi*](doc/ClassesApi.md) | [**listClassPauses**](doc/ClassesApi.md#listclasspauses) | **GET** /classes/{id}/pauses | Các khoảng tạm dừng (cả lớp và từng học viên)
[*ClassesApi*](doc/ClassesApi.md) | [**listClasses**](doc/ClassesApi.md#listclasses) | **GET** /classes | Danh sách lớp (giáo viên - lớp mình phụ trách; chủ tổ chức - mọi lớp)
[*ClassesApi*](doc/ClassesApi.md) | [**moveClassMember**](doc/ClassesApi.md#moveclassmember) | **POST** /classes/{id}/members/{userId}/move | Mời học viên chuyển sang lớp khác trong cùng tổ chức (học viên PHẢI đồng ý lại; khi đồng ý giữ seat, tiến độ, lịch ôn)
[*ClassesApi*](doc/ClassesApi.md) | [**putClassPath**](doc/ClassesApi.md#putclasspath) | **PUT** /classes/{id}/path | Tạo/sửa lộ trình lớp theo mẫu (không có thao tác xóa)
[*ClassesApi*](doc/ClassesApi.md) | [**putClassPathUnits**](doc/ClassesApi.md#putclasspathunits) | **PUT** /classes/{id}/path/units | Chọn bài, thứ tự và ngày mở (&#x60;units&#x60; rỗng quay lại chế độ mẫu)
[*ClassesApi*](doc/ClassesApi.md) | [**putLearnerOverride**](doc/ClassesApi.md#putlearneroverride) | **PUT** /classes/{id}/members/{userId}/override | Ghi đè riêng một học viên (phút mỗi ngày, dời mốc)
[*ClassesApi*](doc/ClassesApi.md) | [**removeClassMember**](doc/ClassesApi.md#removeclassmember) | **DELETE** /classes/{id}/members/{userId} | Gỡ học viên khỏi lớp, giải phóng seat
[*ClassesApi*](doc/ClassesApi.md) | [**rotateJoinCode**](doc/ClassesApi.md#rotatejoincode) | **POST** /classes/{id}/join-code/rotate | Đổi mã tham gia (mã cũ vô hiệu ngay)
[*ClassesApi*](doc/ClassesApi.md) | [**setClassTeachers**](doc/ClassesApi.md#setclassteachers) | **PUT** /classes/{id}/teachers | Đặt danh sách giáo viên phụ trách (chủ tổ chức; luôn ≥ 1)
[*ClassesApi*](doc/ClassesApi.md) | [**setJoinCode**](doc/ClassesApi.md#setjoincode) | **PUT** /classes/{id}/join-code | Bật/tắt mã tham gia (bật lần đầu sinh mã), đặt hạn tùy chọn
[*ClassesApi*](doc/ClassesApi.md) | [**unexemptLearnerUnit**](doc/ClassesApi.md#unexemptlearnerunit) | **DELETE** /classes/{id}/members/{userId}/exemptions/{unitId} | Bỏ miễn đơn vị cho học viên
[*ClassesApi*](doc/ClassesApi.md) | [**updateClass**](doc/ClassesApi.md#updateclass) | **PATCH** /classes/{id} | Sửa tên, mô tả, ngưỡng vắng mặt
[*ClassroomApi*](doc/ClassroomApi.md) | [**getInvitation**](doc/ClassroomApi.md#getinvitation) | **GET** /invitations/{token} | Xem trước lời mời (kèm danh sách dữ liệu chia sẻ khi mời học viên)
[*ClassroomApi*](doc/ClassroomApi.md) | [**getMyClass**](doc/ClassroomApi.md#getmyclass) | **GET** /me/class | Lớp của tôi (lộ trình lớp, bài giao, tiến độ trong lớp, dữ liệu chia sẻ)
[*ClassroomApi*](doc/ClassroomApi.md) | [**joinClassByCode**](doc/ClassroomApi.md#joinclassbycode) | **POST** /me/class/join | Nhập mã tham gia lớp (hai bước không trạng thái - xem trước rồi xác nhận)
[*ClassroomApi*](doc/ClassroomApi.md) | [**leaveMyClass**](doc/ClassroomApi.md#leavemyclass) | **POST** /me/class/leave | Chuyển sang lộ trình cá nhân (rời lớp bất cứ lúc nào)
[*ClassroomApi*](doc/ClassroomApi.md) | [**respondInvitation**](doc/ClassroomApi.md#respondinvitation) | **POST** /invitations/{token}/respond | Trả lời lời mời (học viên - hai lựa chọn ngang nhau; giáo viên/chủ tổ chức - chấp nhận/từ chối)
[*DailyApi*](doc/DailyApi.md) | [**completeSession**](doc/DailyApi.md#completesession) | **POST** /sessions/{sessionId}/complete | Hoàn thành phiên – cập nhật trạng thái mục kế hoạch/ngày và trả tóm tắt
[*DailyApi*](doc/DailyApi.md) | [**getExtraUnit**](doc/DailyApi.md#getextraunit) | **POST** /today/extra | Học thêm sau khi xong kế hoạch (US2.5) – không đổi kế hoạch mặc định
[*DailyApi*](doc/DailyApi.md) | [**getToday**](doc/DailyApi.md#gettoday) | **GET** /today | Kế hoạch hôm nay (sinh một lần theo ngày địa phương)
[*DailyApi*](doc/DailyApi.md) | [**recordStudyInterval**](doc/DailyApi.md#recordstudyinterval) | **POST** /sessions/{sessionId}/intervals | Ghi khoảng thời gian học (idempotent)
[*DailyApi*](doc/DailyApi.md) | [**startSession**](doc/DailyApi.md#startsession) | **POST** /sessions | Bắt đầu hoặc tiếp tục một phiên học cho mục kế hoạch
[*DailyApi*](doc/DailyApi.md) | [**submitAnswer**](doc/DailyApi.md#submitanswer) | **POST** /sessions/{sessionId}/answers | Ghi câu trả lời – chấm tự động, idempotent (FR-025, FR-041)
[*OnboardingApi*](doc/OnboardingApi.md) | [**completeOnboarding**](doc/OnboardingApi.md#completeonboarding) | **POST** /onboarding/complete | Hoàn tất onboarding – sinh lộ trình và bài học hôm nay (FR-008, FR-010)
[*OnboardingApi*](doc/OnboardingApi.md) | [**getOnboarding**](doc/OnboardingApi.md#getonboarding) | **GET** /onboarding | Trạng thái và bản nháp onboarding (tiếp tục khi bỏ dở)
[*OnboardingApi*](doc/OnboardingApi.md) | [**listPlacementQuestions**](doc/OnboardingApi.md#listplacementquestions) | **GET** /placement/questions | Bộ câu hỏi kiểm tra trình độ (công khai, KHÔNG kèm đáp án)
[*OnboardingApi*](doc/OnboardingApi.md) | [**saveOnboarding**](doc/OnboardingApi.md#saveonboarding) | **PUT** /onboarding | Lưu nháp các bước đã nhập (FR-005)
[*OnboardingApi*](doc/OnboardingApi.md) | [**submitPlacement**](doc/OnboardingApi.md#submitplacement) | **POST** /placement/submit | Nộp bài kiểm tra trình độ (cũng dùng để mang kết quả dùng thử sang – FR-039; làm lại – FR-009)
[*OrgApi*](doc/OrgApi.md) | [**getOrg**](doc/OrgApi.md#getorg) | **GET** /org | Tổng quan tổ chức - seat, giấy phép, giáo viên, lớp, lời mời chờ
[*OrgApi*](doc/OrgApi.md) | [**grantSeat**](doc/OrgApi.md#grantseat) | **POST** /org/seats/{userId}/grant | Cấp lại seat cho giáo viên đang mất seat
[*OrgApi*](doc/OrgApi.md) | [**inviteTeacher**](doc/OrgApi.md#inviteteacher) | **POST** /org/teachers/invitations | Mời giáo viên (giữ chỗ một seat)
[*OrgApi*](doc/OrgApi.md) | [**removeTeacher**](doc/OrgApi.md#removeteacher) | **DELETE** /org/teachers/{userId} | Gỡ vai trò giáo viên - mất quyền ngay, giải phóng seat
[*OrgApi*](doc/OrgApi.md) | [**revokeInvitation**](doc/OrgApi.md#revokeinvitation) | **DELETE** /invitations/{token} | Thu hồi lời mời (OWN - mọi lời mời của tổ chức; TCH - lời mời học viên của lớp mình)
[*OrgApi*](doc/OrgApi.md) | [**revokeOrgSeat**](doc/OrgApi.md#revokeorgseat) | **POST** /org/seats/{userId}/revoke | Thu hồi seat của giáo viên/học viên trong tổ chức mình
[*PathApi*](doc/PathApi.md) | [**getPath**](doc/PathApi.md#getpath) | **GET** /path | Lộ trình hiện tại
[*PathApi*](doc/PathApi.md) | [**pausePath**](doc/PathApi.md#pausepath) | **POST** /path/pause | Tạm dừng lộ trình
[*PathApi*](doc/PathApi.md) | [**rebuildPath**](doc/PathApi.md#rebuildpath) | **POST** /path/rebuild | Xây dựng lại lộ trình (FR-016) – giữ lịch sử và lịch ôn
[*PathApi*](doc/PathApi.md) | [**resumePath**](doc/PathApi.md#resumepath) | **POST** /path/resume | Tiếp tục lộ trình
[*PathApi*](doc/PathApi.md) | [**setItemMastered**](doc/PathApi.md#setitemmastered) | **PUT** /path/items/{itemId}/master | Đánh dấu / bỏ đánh dấu một chữ Kanji đã thành thạo (dừng / tiếp tục ôn mọi khía cạnh)
[*PathApi*](doc/PathApi.md) | [**setUnitMastered**](doc/PathApi.md#setunitmastered) | **PUT** /path/units/{unitId}/master | Đánh dấu / bỏ đánh dấu đã thành thạo
[*ProgressApi*](doc/ProgressApi.md) | [**getProgress**](doc/ProgressApi.md#getprogress) | **GET** /progress | Tóm tắt tiến độ (FR-026 → FR-029)
[*TrialApi*](doc/TrialApi.md) | [**getTrialContent**](doc/TrialApi.md#gettrialcontent) | **GET** /trial/content | Nội dung dùng thử cố định (công khai) – FR-036/037
[*TrialApi*](doc/TrialApi.md) | [**gradeTrialPlacement**](doc/TrialApi.md#gradetrialplacement) | **POST** /trial/placement/grade | Chấm bài kiểm tra trình độ cho khách – không lưu gì
[*TrialApi*](doc/TrialApi.md) | [**listPlacementQuestions**](doc/TrialApi.md#listplacementquestions) | **GET** /placement/questions | Bộ câu hỏi kiểm tra trình độ (công khai, KHÔNG kèm đáp án)
[*TrialApi*](doc/TrialApi.md) | [**recordTrialEvent**](doc/TrialApi.md#recordtrialevent) | **POST** /trial/events | Ghi nhận sự kiện dùng thử ẩn danh (chỉ tăng bộ đếm tổng hợp theo ngày, FR-038)


## Documentation For Models

 - [AccountStatus](doc/AccountStatus.md)
 - [AchievementEarned](doc/AchievementEarned.md)
 - [AchievementKind](doc/AchievementKind.md)
 - [AdminActionLog](doc/AdminActionLog.md)
 - [AdminOrganizationCreate](doc/AdminOrganizationCreate.md)
 - [AdminOrganizationDetail](doc/AdminOrganizationDetail.md)
 - [AdminOrganizationDetailAllOfSeatHolders](doc/AdminOrganizationDetailAllOfSeatHolders.md)
 - [AdminOrganizationPage](doc/AdminOrganizationPage.md)
 - [AdminOrganizationRow](doc/AdminOrganizationRow.md)
 - [AdminOrganizationRowLicense](doc/AdminOrganizationRowLicense.md)
 - [AdminOrganizationRowOwnersInner](doc/AdminOrganizationRowOwnersInner.md)
 - [AdminPlacementQuestion](doc/AdminPlacementQuestion.md)
 - [AdminSetActivePlacementSetRequest](doc/AdminSetActivePlacementSetRequest.md)
 - [AdminSetUnitStatusRequest](doc/AdminSetUnitStatusRequest.md)
 - [AdminSetUserStatusRequest](doc/AdminSetUserStatusRequest.md)
 - [AdminTopic](doc/AdminTopic.md)
 - [AdminUnit](doc/AdminUnit.md)
 - [AdminUnitWrite](doc/AdminUnitWrite.md)
 - [AdminUnitWriteExercisesInner](doc/AdminUnitWriteExercisesInner.md)
 - [AdminUnitWriteItemsInner](doc/AdminUnitWriteItemsInner.md)
 - [AdminUpdateOrganizationRequest](doc/AdminUpdateOrganizationRequest.md)
 - [AdminUserPage](doc/AdminUserPage.md)
 - [AdminUserPageItemsInner](doc/AdminUserPageItemsInner.md)
 - [AnswerResult](doc/AnswerResult.md)
 - [AnswerSubmission](doc/AnswerSubmission.md)
 - [ArchiveClass200Response](doc/ArchiveClass200Response.md)
 - [AuthTokens](doc/AuthTokens.md)
 - [Celebrations](doc/Celebrations.md)
 - [ChangePasswordRequest](doc/ChangePasswordRequest.md)
 - [ClassAlert](doc/ClassAlert.md)
 - [ClassAssignment](doc/ClassAssignment.md)
 - [ClassBrief](doc/ClassBrief.md)
 - [ClassBriefTeachersInner](doc/ClassBriefTeachersInner.md)
 - [ClassDashboard](doc/ClassDashboard.md)
 - [ClassDashboardSummary](doc/ClassDashboardSummary.md)
 - [ClassDetail](doc/ClassDetail.md)
 - [ClassLearnerDetail](doc/ClassLearnerDetail.md)
 - [ClassLearnerDetailAssignmentStatesInner](doc/ClassLearnerDetailAssignmentStatesInner.md)
 - [ClassLearnerDetailDailyMinutes30Inner](doc/ClassLearnerDetailDailyMinutes30Inner.md)
 - [ClassLearnerDetailPlacement](doc/ClassLearnerDetailPlacement.md)
 - [ClassLearnerDetailUnitsInner](doc/ClassLearnerDetailUnitsInner.md)
 - [ClassLearnerDetailWeakTopicsInner](doc/ClassLearnerDetailWeakTopicsInner.md)
 - [ClassLearnerRow](doc/ClassLearnerRow.md)
 - [ClassPath](doc/ClassPath.md)
 - [ClassPathTemplate](doc/ClassPathTemplate.md)
 - [ClassPathUnit](doc/ClassPathUnit.md)
 - [ClassPause](doc/ClassPause.md)
 - [ClassPlacementRequest](doc/ClassPlacementRequest.md)
 - [ClassPlacementResults](doc/ClassPlacementResults.md)
 - [ClassPlacementResultsResultsInner](doc/ClassPlacementResultsResultsInner.md)
 - [ClassProgressStatus](doc/ClassProgressStatus.md)
 - [ClassRow](doc/ClassRow.md)
 - [ClassRowTeachersInner](doc/ClassRowTeachersInner.md)
 - [ClassWeakTopic](doc/ClassWeakTopic.md)
 - [CompleteOnboarding200Response](doc/CompleteOnboarding200Response.md)
 - [ConfirmPasswordResetRequest](doc/ConfirmPasswordResetRequest.md)
 - [ContentItem](doc/ContentItem.md)
 - [ContentItemExamplesInner](doc/ContentItemExamplesInner.md)
 - [ContentLevel](doc/ContentLevel.md)
 - [ContentNotice](doc/ContentNotice.md)
 - [CreateClassAssignments201Response](doc/CreateClassAssignments201Response.md)
 - [CreateClassAssignmentsRequest](doc/CreateClassAssignmentsRequest.md)
 - [CreateClassPauseRequest](doc/CreateClassPauseRequest.md)
 - [CreateClassRequest](doc/CreateClassRequest.md)
 - [DailyPlan](doc/DailyPlan.md)
 - [DailyPlanKanjiNotice](doc/DailyPlanKanjiNotice.md)
 - [DeleteAccount200Response](doc/DeleteAccount200Response.md)
 - [DeleteAccountRequest](doc/DeleteAccountRequest.md)
 - [EndClassPauseRequest](doc/EndClassPauseRequest.md)
 - [Error](doc/Error.md)
 - [Exercise](doc/Exercise.md)
 - [GetClassPath200Response](doc/GetClassPath200Response.md)
 - [GoalType](doc/GoalType.md)
 - [I18nText](doc/I18nText.md)
 - [ImportResults](doc/ImportResults.md)
 - [ImportResultsResultsInner](doc/ImportResultsResultsInner.md)
 - [InvitationPreview](doc/InvitationPreview.md)
 - [InvitationRespond](doc/InvitationRespond.md)
 - [InvitationRespondResult](doc/InvitationRespondResult.md)
 - [InvitationRow](doc/InvitationRow.md)
 - [InviteClassLearnersRequest](doc/InviteClassLearnersRequest.md)
 - [InviteClassLearnersRequestInviteesInner](doc/InviteClassLearnersRequestInviteesInner.md)
 - [JoinByCode](doc/JoinByCode.md)
 - [JoinByCodeResult](doc/JoinByCodeResult.md)
 - [JoinCode](doc/JoinCode.md)
 - [KanjiDetails](doc/KanjiDetails.md)
 - [KanjiDetailsWrite](doc/KanjiDetailsWrite.md)
 - [Lang](doc/Lang.md)
 - [LearnerOverride](doc/LearnerOverride.md)
 - [LeaveMyClassRequest](doc/LeaveMyClassRequest.md)
 - [LessonSession](doc/LessonSession.md)
 - [LessonSessionAnsweredInner](doc/LessonSessionAnsweredInner.md)
 - [Level](doc/Level.md)
 - [LicenseState](doc/LicenseState.md)
 - [LicenseUpdate](doc/LicenseUpdate.md)
 - [LicenseWrite](doc/LicenseWrite.md)
 - [Login200Response](doc/Login200Response.md)
 - [LoginRequest](doc/LoginRequest.md)
 - [MasterResult](doc/MasterResult.md)
 - [Me](doc/Me.md)
 - [MeClassSummary](doc/MeClassSummary.md)
 - [MeOrganization](doc/MeOrganization.md)
 - [MeOrganizationLicense](doc/MeOrganizationLicense.md)
 - [MoveClassMemberRequest](doc/MoveClassMemberRequest.md)
 - [MyClass](doc/MyClass.md)
 - [MyClassAssignmentsInner](doc/MyClassAssignmentsInner.md)
 - [MyClassMovedNotice](doc/MyClassMovedNotice.md)
 - [MyClassPlacementRequest](doc/MyClassPlacementRequest.md)
 - [MyClassProgress](doc/MyClassProgress.md)
 - [OnboardingDraft](doc/OnboardingDraft.md)
 - [OnboardingState](doc/OnboardingState.md)
 - [OrgLicense](doc/OrgLicense.md)
 - [OrgOverview](doc/OrgOverview.md)
 - [OrgOverviewLicense](doc/OrgOverviewLicense.md)
 - [OrgOverviewTeachersInner](doc/OrgOverviewTeachersInner.md)
 - [OrgStatus](doc/OrgStatus.md)
 - [PathDetail](doc/PathDetail.md)
 - [PathDetailAllOfItems](doc/PathDetailAllOfItems.md)
 - [PathSummary](doc/PathSummary.md)
 - [PathWarning](doc/PathWarning.md)
 - [PlacementAnswers](doc/PlacementAnswers.md)
 - [PlacementAnswersAnswersInner](doc/PlacementAnswersAnswersInner.md)
 - [PlacementQuestionSet](doc/PlacementQuestionSet.md)
 - [PlacementQuestionSetQuestionsInner](doc/PlacementQuestionSetQuestionsInner.md)
 - [PlacementResult](doc/PlacementResult.md)
 - [PlanItem](doc/PlanItem.md)
 - [Profile](doc/Profile.md)
 - [ProfileUpdate](doc/ProfileUpdate.md)
 - [ProgressSummary](doc/ProgressSummary.md)
 - [ProgressSummaryGoal](doc/ProgressSummaryGoal.md)
 - [ProgressSummaryKanji](doc/ProgressSummaryKanji.md)
 - [ProgressSummaryWeakTopicsInner](doc/ProgressSummaryWeakTopicsInner.md)
 - [PutClassPathUnitsRequest](doc/PutClassPathUnitsRequest.md)
 - [PutClassPathUnitsRequestUnitsInner](doc/PutClassPathUnitsRequestUnitsInner.md)
 - [PutLearnerOverrideRequest](doc/PutLearnerOverrideRequest.md)
 - [RebuildPathRequest](doc/RebuildPathRequest.md)
 - [RecordStudyIntervalRequest](doc/RecordStudyIntervalRequest.md)
 - [RecordTrialEventRequest](doc/RecordTrialEventRequest.md)
 - [RefreshTokenRequest](doc/RefreshTokenRequest.md)
 - [RegisterRequest](doc/RegisterRequest.md)
 - [RequestPasswordResetRequest](doc/RequestPasswordResetRequest.md)
 - [ReviewFacet](doc/ReviewFacet.md)
 - [RosterRow](doc/RosterRow.md)
 - [ScopeNotice](doc/ScopeNotice.md)
 - [SeatSummary](doc/SeatSummary.md)
 - [SessionSummary](doc/SessionSummary.md)
 - [SessionSummaryAttentionItemsInner](doc/SessionSummaryAttentionItemsInner.md)
 - [SetClassTeachersRequest](doc/SetClassTeachersRequest.md)
 - [SetItemMastered200Response](doc/SetItemMastered200Response.md)
 - [SetJoinCodeRequest](doc/SetJoinCodeRequest.md)
 - [SetUnitMasteredRequest](doc/SetUnitMasteredRequest.md)
 - [SharedDataDisclosure](doc/SharedDataDisclosure.md)
 - [SharedDataItem](doc/SharedDataItem.md)
 - [Skill](doc/Skill.md)
 - [StartSessionRequest](doc/StartSessionRequest.md)
 - [TargetLevel](doc/TargetLevel.md)
 - [TrialContent](doc/TrialContent.md)
 - [TrialContentUnitsInner](doc/TrialContentUnitsInner.md)
 - [TrialContentUnitsInnerExercisesInner](doc/TrialContentUnitsInnerExercisesInner.md)
 - [TrialContentUnitsInnerExercisesInnerAllOfAnswerKey](doc/TrialContentUnitsInnerExercisesInnerAllOfAnswerKey.md)
 - [UpdateClassRequest](doc/UpdateClassRequest.md)


## Documentation For Authorization


Authentication schemes defined for the API:
### bearerAuth

- **Type**: HTTP Bearer Token authentication (JWT)


## Author



