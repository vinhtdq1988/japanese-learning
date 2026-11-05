import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:japanese_learning_client/data/api/dio_client.dart';
import 'package:japanese_learning_client/data/session_controller.dart';
import 'package:japanese_learning_client/app.dart';
import 'package:japanese_learning_client/platform/memory_platform.dart';
import 'package:japanese_learning_client/platform/platform.dart';
import 'package:japanese_learning_client/platform/platform_providers.dart';

/// Phản hồi giả của một route.
class FakeResponse {
  const FakeResponse(
    this.status, [
    this.body,
    this.headers = const <String, String>{},
  ]);

  final int status;
  final Object? body;

  /// Header phản hồi bổ sung (ví dụ `x-next-cursor` của nhật ký quản trị).
  final Map<String, String> headers;
}

typedef FakeHandler = FutureOr<FakeResponse> Function(RequestOptions request);

/// Máy chủ giả ở tầng `HttpClientAdapter`: khớp theo `METHOD /đường-dẫn` (không gồm tiền tố cơ sở),
/// ghi lại mọi yêu cầu để kiểm thử xác nhận cái gì đã được gửi.
class FakeBackend implements HttpClientAdapter {
  final Map<String, FakeHandler> routes = <String, FakeHandler>{};
  final List<RequestOptions> requests = <RequestOptions>[];

  void on(String route, FakeHandler handler) => routes[route] = handler;

  void reply(String route, int status, [Object? body]) =>
      routes[route] = (_) => FakeResponse(status, body);

  /// Các yêu cầu đã nhận khớp với [route] (ví dụ `PUT /onboarding`).
  List<RequestOptions> sent(String route) =>
      requests.where((r) => '${r.method} ${r.path}' == route).toList();

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    final handler = routes['${options.method} ${options.path}'];
    final response = handler == null
        ? FakeResponse(404, <String, Object?>{
            'code': 'NOT_FOUND',
            'message':
                'Không có route giả cho ${options.method} ${options.path}',
          })
        : await handler(options);
    final body = response.body == null ? '' : jsonEncode(response.body);
    return ResponseBody.fromString(
      body,
      response.status,
      headers: <String, List<String>>{
        Headers.contentTypeHeader: <String>[Headers.jsonContentType],
        for (final entry in response.headers.entries)
          entry.key.toLowerCase(): <String>[entry.value],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

/// Token giả có dạng JWT để client đọc được `sub`, `role`, `status` (không ký).
String fakeJwt({
  String role = 'learner',
  String status = 'active',
  String sub = 'user-1',
}) {
  String enc(Object value) =>
      base64Url.encode(utf8.encode(jsonEncode(value))).replaceAll('=', '');
  return '${enc(<String, Object?>{'alg': 'none'})}.'
      '${enc(<String, Object?>{'sub': sub, 'role': role, 'status': status})}.sig';
}

Map<String, Object?> fakeTokens({String status = 'active'}) =>
    <String, Object?>{
      'accessToken': fakeJwt(status: status),
      'refreshToken': 'refresh-1',
      'expiresIn': 900,
    };

/// Môi trường kiểm thử: máy chủ giả + kho token/bộ nhớ cục bộ trong bộ nhớ + `ProviderScope` đủ ghi đè.
class TestEnv {
  TestEnv({StoredTokens? tokens, String? timezone = 'Asia/Ho_Chi_Minh'})
    : tokenStore = MemoryTokenStore(tokens),
      localStore = MemoryLocalStore(),
      timezone = FixedTimezone(timezone) {
    dio = createDio(
      tokenStore: tokenStore,
      onSessionExpired: () {},
      baseUrl: 'http://api.test/api/v1',
      httpClientAdapter: backend,
    );
  }

  final FakeBackend backend = FakeBackend();
  final MemoryTokenStore tokenStore;
  final MemoryLocalStore localStore;
  final FixedTimezone timezone;
  late final Dio dio;

  List<Override> get overrides => <Override>[
    tokenStoreProvider.overrideWithValue(tokenStore),
    localStoreProvider.overrideWithValue(localStore),
    timezoneProvider.overrideWithValue(timezone),
    linksProvider.overrideWithValue(RecordingLinks()),
    dioProvider.overrideWithValue(dio),
  ];

  /// Toàn bộ ứng dụng (router + guard) với môi trường giả.
  Widget app() =>
      ProviderScope(overrides: overrides, child: const JapaneseLearningApp());

  /// Đặt kích thước màn hình desktop để bố cục không bị cắt.
  static void useDesktopSize(dynamic tester) {
    tester.view.physicalSize = const Size(1280, 1000);
    tester.view.devicePixelRatio = 1.0;
  }
}

StoredTokens signedInTokens() =>
    StoredTokens(accessToken: fakeJwt(), refreshToken: 'refresh-1');

/// Thân JSON của yêu cầu: mã sinh từ OpenAPI gửi chuỗi JSON, còn gọi `dio` trực tiếp thì gửi `Map`.
Map<String, Object?> requestJson(RequestOptions request) {
  final data = request.data;
  final decoded = data is String ? jsonDecode(data) : data;
  return Map<String, Object?>.from(decoded as Map<dynamic, dynamic>);
}
