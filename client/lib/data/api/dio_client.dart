import 'package:dio/dio.dart';

import '../../platform/platform.dart';

/// Địa chỉ gốc của API; đặt khi chạy bằng `--dart-define=API_BASE_URL=http://localhost:3000/api/v1`.
/// Mặc định `/api/v1` (nginx proxy cùng origin, xem T118).
const String apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: '/api/v1',
);

/// Cờ trong `RequestOptions.extra`: yêu cầu đã được thử lại sau khi làm mới token (tránh lặp vô hạn).
const String _retriedKey = 'jl.retried';

/// Tạo [Dio] cho toàn ứng dụng (API client sinh ra từ OpenAPI dùng chung instance này, xem README.md):
/// gắn bearer token vào mọi yêu cầu và tự làm mới qua `/auth/refresh` khi gặp 401.
///
/// [onSessionExpired] được gọi khi không làm mới được nữa (refresh token hết hạn/bị thu hồi) để
/// ứng dụng đăng xuất và đưa người dùng về màn hình đăng nhập.
Dio createDio({
  required TokenStore tokenStore,
  required void Function() onSessionExpired,
  String baseUrl = apiBaseUrl,
  HttpClientAdapter? httpClientAdapter,
}) {
  final options = BaseOptions(
    baseUrl: baseUrl,
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 20),
    contentType: Headers.jsonContentType,
    responseType: ResponseType.json,
  );
  final dio = Dio(options);
  // Dio riêng không có interceptor để gọi /auth/refresh, tránh đệ quy.
  final refreshDio = Dio(options);
  if (httpClientAdapter != null) {
    dio.httpClientAdapter = httpClientAdapter;
    refreshDio.httpClientAdapter = httpClientAdapter;
  }
  dio.interceptors.add(
    AuthInterceptor(
      dio: dio,
      refreshDio: refreshDio,
      tokenStore: tokenStore,
      onSessionExpired: onSessionExpired,
    ),
  );
  return dio;
}

/// Gắn `Authorization: Bearer …` và làm mới token khi nhận 401.
///
/// Nhiều yêu cầu cùng nhận 401 chỉ gây MỘT lần làm mới (single-flight) vì refresh token xoay vòng:
/// dùng lại token cũ lần hai sẽ bị từ chối và làm mất phiên oan.
class AuthInterceptor extends Interceptor {
  AuthInterceptor({
    required this.dio,
    required this.refreshDio,
    required this.tokenStore,
    required this.onSessionExpired,
  });

  final Dio dio;
  final Dio refreshDio;
  final TokenStore tokenStore;
  final void Function() onSessionExpired;

  Future<StoredTokens?>? _refreshing;

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final tokens = await tokenStore.read();
    if (tokens != null && !options.headers.containsKey('Authorization')) {
      options.headers['Authorization'] = 'Bearer ${tokens.accessToken}';
    }
    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final request = err.requestOptions;
    final isAuthEndpoint = request.path.startsWith('/auth/');
    if (err.response?.statusCode != 401 ||
        isAuthEndpoint ||
        request.extra[_retriedKey] == true) {
      return handler.next(err);
    }

    StoredTokens? tokens;
    try {
      tokens = await _refresh();
    } on _RefreshRejected {
      // Refresh token không còn hiệu lực: hết phiên.
      onSessionExpired();
      return handler.next(err);
    } on DioException {
      // Lỗi tạm thời (mất mạng…): giữ phiên, trả lỗi gốc cho nơi gọi.
      return handler.next(err);
    }
    if (tokens == null) {
      onSessionExpired();
      return handler.next(err);
    }

    request.headers['Authorization'] = 'Bearer ${tokens.accessToken}';
    request.extra[_retriedKey] = true;
    try {
      handler.resolve(await dio.fetch<dynamic>(request));
    } on DioException catch (retryError) {
      handler.next(retryError);
    }
  }

  Future<StoredTokens?> _refresh() {
    return _refreshing ??= _doRefresh().whenComplete(() => _refreshing = null);
  }

  Future<StoredTokens?> _doRefresh() async {
    final current = await tokenStore.read();
    if (current == null) return null;
    try {
      final response = await refreshDio.post<Map<String, dynamic>>(
        '/auth/refresh',
        data: <String, dynamic>{'refreshToken': current.refreshToken},
      );
      final data = response.data!;
      final tokens = StoredTokens(
        accessToken: data['accessToken'] as String,
        refreshToken: data['refreshToken'] as String,
      );
      await tokenStore.write(tokens);
      return tokens;
    } on DioException catch (e) {
      final status = e.response?.statusCode;
      if (status == 401 || status == 403) {
        await tokenStore.clear();
        throw _RefreshRejected();
      }
      rethrow;
    }
  }
}

class _RefreshRejected implements Exception {}
