import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:japanese_api/japanese_api.dart';

import 'api/api_error.dart';
import 'session_controller.dart';

/// API client sinh từ OpenAPI, dùng chung [Dio] của ứng dụng (token do `createDio` quản lý nên không
/// thêm interceptor xác thực mặc định của mã sinh). Xem `lib/data/api/README.md`.
final japaneseApiProvider = Provider<JapaneseApi>((ref) {
  return JapaneseApi(
    dio: ref.watch(dioProvider),
    interceptors: const <Interceptor>[],
  );
});

/// Chuyển [DioException] thành [ApiError] để màn hình xử lý theo mã lỗi của hợp đồng; lỗi khác giữ nguyên.
Future<T> guardApi<T>(Future<T> Function() call) async {
  try {
    return await call();
  } on DioException catch (e) {
    throw ApiError.fromDio(e);
  }
}
