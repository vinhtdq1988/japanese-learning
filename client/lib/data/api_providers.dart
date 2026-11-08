import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:japanese_api/japanese_api.dart';

import 'api/api_error.dart';
import 'class_repository.dart';
import 'classroom_repository.dart';
import 'org_repository.dart';
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

/// Tổ chức, giấy phép, seat và lời mời giáo viên/chủ tổ chức (spec 004, US1).
final orgRepositoryProvider = Provider<OrgRepository>((ref) {
  return OrgRepository(ref.watch(japaneseApiProvider), ref.watch(dioProvider));
});

/// Lớp học cho giáo viên và chủ tổ chức (spec 004, US2).
final classRepositoryProvider = Provider<ClassRepository>((ref) {
  return ClassRepository(
    ref.watch(japaneseApiProvider),
    ref.watch(dioProvider),
  );
});

/// Phía học viên của lớp: lời mời, nhập mã, "Lớp của tôi" (spec 004, US2).
final classroomRepositoryProvider = Provider<ClassroomRepository>((ref) {
  return ClassroomRepository(
    ref.watch(japaneseApiProvider),
    ref.watch(dioProvider),
  );
});
