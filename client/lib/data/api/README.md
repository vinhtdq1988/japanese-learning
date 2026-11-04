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
