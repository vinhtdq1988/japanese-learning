# API client

Thư mục này chứa lớp truy cập REST API của backend.

| File | Nội dung |
|---|---|
| `dio_client.dart` | Cấu hình `dio`: địa chỉ gốc, bearer token, tự làm mới token qua `/auth/refresh` (single-flight) |
| `api_error.dart` | `ApiError` – chuyển lỗi `dio` thành lỗi theo schema `Error` của hợp đồng |
| `generated/` | **Mã API client sinh từ OpenAPI** (không sửa tay, không lint – xem `analysis_options.yaml`) |

## Sinh API client từ hợp đồng

Hợp đồng là nguồn sự thật: [`specs/001-phase1-mvp/contracts/openapi.yaml`](../../../../specs/001-phase1-mvp/contracts/openapi.yaml).
Tên hàm của client lấy theo `operationId` trong hợp đồng (ví dụ `register`, `getToday`, `submitAnswer`), vì vậy
đổi `operationId` về sau là thay đổi hợp đồng và PHẢI ghi vào nhật ký thay đổi của `openapi.yaml`.

Dùng [OpenAPI Generator](https://openapi-generator.tech) với generator `dart-dio` (cần Java 11+):

```bash
# từ thư mục gốc kho mã
npx @openapitools/openapi-generator-cli generate \
  -i specs/001-phase1-mvp/contracts/openapi.yaml \
  -g dart-dio \
  -o client/lib/data/api/generated \
  --additional-properties=pubName=japanese_api,nullSafe=true,serializationLibrary=json_serializable

cd client/lib/data/api/generated
dart pub get
dart run build_runner build                                # sinh mã json_serializable (*.g.dart)
cd ../../../..
flutter pub get
dart run tool/patch_generated_api.dart                     # vá lỗi enum mặc định của generator
```

Gói `generated` (`japanese_api`) đã được khai báo là path dependency trong `client/pubspec.yaml`. Ghi chú:

- `build_runner` PHẢI chạy **trong thư mục `generated/`** (không phải `client/`), vì đó là gói chứa các `*.g.dart`:
  `cd client/lib/data/api/generated && dart pub get && dart run build_runner build`.
- `generated/pubspec.yaml` được chỉnh tay (cận dưới SDK `>=3.8.0` để `json_serializable` dùng được cú pháp null-aware elements)
  và nằm trong `generated/.openapi-generator-ignore` nên lần sinh lại không ghi đè.
- Sau khi vá, chạy lại `dart run build_runner build --delete-conflicting-outputs` trong `generated/` một lần nữa: các `*.g.dart` sinh trước khi vá còn sai kiểu enum và làm hỏng biên dịch.
- `tool/patch_generated_api.dart` PHẢI chạy sau mỗi lần sinh: generator sinh giá trị mặc định enum sai cú pháp
  (`const XEnum._('core')`) làm mã sinh không biên dịch được. `flutter analyze` bỏ qua thư mục `generated/`
  nên lỗi này chỉ lộ khi biên dịch/chạy test (xem `test/generated_api_test.dart`).
- Các file `*.g.dart` là mã sinh, KHÔNG commit (xem `.gitignore`); máy mới phải chạy `build_runner` như trên trước `flutter analyze`/`flutter test`.

Tạo client với `Dio` dùng chung (truyền `interceptors` rỗng để không thêm interceptor xác thực mặc định của mã sinh,
vì token do `createDio` quản lý):

```dart
final dio = createDio(tokenStore: tokenStore, onSessionExpired: signOut);
final api = JapaneseApi(dio: dio, interceptors: const []); // lớp gốc do generator sinh ra
final today = await api.getDailyApi().getToday();          // tên hàm = operationId
```

Chạy lại lệnh trên mỗi khi `openapi.yaml` đổi `info.version`.

## Phiên bản hợp đồng hiện tại: OpenAPI 1.13.0 (spec 005)

Client sinh từ **OpenAPI 1.13.0** (chỉ bổ sung, không route mới, không mã lỗi mới): `SessionSummary.celebrations` (tùy chọn,
`Celebrations` gồm `dayCompleted` + `achievements[]` kiểu `AchievementEarned`/`AchievementKind`) và `Profile`/`ProfileUpdate`
thêm `soundEnabled`, `visualEffectsEnabled` (mặc định `true`). Sau khi sinh, chạy `dart format lib doc` trong `generated/`
để diff gọn như các lần trước, và xóa các tệp `generated/test/*_test.dart` mà generator tự tạo (kho mã không giữ chúng).
Các thay đổi 1.12.0 bên dưới vẫn giữ nguyên.

### Ghi chú 1.12.0 (spec 004)

Client sinh từ **OpenAPI 1.12.0** (bổ sung, không phá hợp đồng 1.11.0): nhóm `classes`, `classroom`, `org` và các
route `/admin/organizations*`, `/org*`, `/classes*`, `/invitations/{token}*`, `/me/class*`; `Me` thêm `learningSource`,
`classSummary`, `organization`; `PlacementAnswers.classRequestId`; `GET /path` thêm `source`; mã lỗi mới `CLASS_MANAGED`,
`SEAT_*`, `CLASS_*`, `LAST_TEACHER`, `ALREADY_IN_CLASS`, `INVITEE_UNAVAILABLE`. Nhật ký thay đổi đầy đủ nằm trong
`info.description` của `openapi.yaml`.

**Ghi chú phát hành — client và backend PHẢI phát hành CÙNG LÚC**: client cũ (1.11.0) không hiển thị khóa điều khiển
của học viên thuộc lớp; trình duyệt giữ bản cũ trong bộ đệm có thể cho học viên thuộc lớp thấy điều khiển cá nhân
(máy chủ vẫn từ chối bằng `409 CLASS_MANAGED`). Hãy ép tải lại bản web mới khi triển khai backend 1.12.0.

Lưu ý khi sinh lại: `POST /classes/{id}/members/{userId}/move` trả **202** (chỉ mời chuyển lớp, học viên phải đồng ý
lại) và `SharedDataDisclosure.mayBeMovedWithinOrganization` luôn là `false`.
