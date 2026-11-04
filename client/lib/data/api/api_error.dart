import 'package:dio/dio.dart';

/// Lỗi từ API theo schema `Error` của openapi.yaml (`{code, message, fields?}`) hoặc lỗi mạng.
class ApiError implements Exception {
  const ApiError({
    required this.statusCode,
    required this.code,
    required this.message,
    this.fields = const <String, String>{},
    this.retryAfterSeconds,
  });

  /// Mã HTTP; `null` khi không nhận được phản hồi (mất mạng, hết thời gian chờ).
  final int? statusCode;

  /// Mã máy đọc được (`EMAIL_TAKEN`, `VALIDATION_FAILED`, …) hoặc [networkCode] khi mất kết nối.
  final String code;
  final String message;

  /// Thông báo cụ thể theo trường khi `VALIDATION_FAILED`.
  final Map<String, String> fields;

  /// Số giây chờ khi bị giới hạn tần suất (`Retry-After`).
  final int? retryAfterSeconds;

  static const String networkCode = 'NETWORK_ERROR';
  static const String unknownCode = 'UNKNOWN_ERROR';

  bool get isNetwork => code == networkCode;

  /// Chuyển `DioException` thành [ApiError].
  factory ApiError.fromDio(DioException error) {
    final response = error.response;
    if (response == null) {
      return ApiError(
        statusCode: null,
        code: networkCode,
        message: error.message ?? 'Network error',
      );
    }
    final data = response.data;
    final retryAfter = int.tryParse(
      response.headers.value('retry-after') ?? '',
    );
    if (data is Map<String, dynamic>) {
      final rawFields = data['fields'];
      return ApiError(
        statusCode: response.statusCode,
        code: (data['code'] as String?) ?? unknownCode,
        message: (data['message'] as String?) ?? '',
        fields: rawFields is Map
            ? rawFields.map((k, v) => MapEntry(k.toString(), v.toString()))
            : const <String, String>{},
        retryAfterSeconds: retryAfter,
      );
    }
    return ApiError(
      statusCode: response.statusCode,
      code: unknownCode,
      message: error.message ?? '',
      retryAfterSeconds: retryAfter,
    );
  }

  @override
  String toString() => 'ApiError($statusCode $code: $message)';
}
