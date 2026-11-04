import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:japanese_learning_client/data/api/api_error.dart';
import 'package:japanese_learning_client/data/api/dio_client.dart';
import 'package:japanese_learning_client/platform/memory_platform.dart';
import 'package:japanese_learning_client/platform/platform.dart';

class _FakeAdapter implements HttpClientAdapter {
  _FakeAdapter(this.respond);

  final FutureOr<ResponseBody> Function(RequestOptions options) respond;
  final List<RequestOptions> requests = <RequestOptions>[];

  int count(String path) => requests.where((r) => r.path == path).length;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    return respond(options);
  }

  @override
  void close({bool force = false}) {}
}

ResponseBody _json(
  int status,
  Object body, {
  Map<String, List<String>>? headers,
}) {
  return ResponseBody.fromString(
    jsonEncode(body),
    status,
    headers: <String, List<String>>{
      Headers.contentTypeHeader: <String>['application/json'],
      ...?headers,
    },
  );
}

const StoredTokens _oldTokens = StoredTokens(
  accessToken: 'old-access',
  refreshToken: 'old-refresh',
);

void main() {
  late MemoryTokenStore store;
  late int expired;

  setUp(() {
    store = MemoryTokenStore(_oldTokens);
    expired = 0;
  });

  Dio build(_FakeAdapter adapter) => createDio(
    tokenStore: store,
    onSessionExpired: () => expired++,
    baseUrl: 'http://api.test/api/v1',
    httpClientAdapter: adapter,
  );

  test('gắn bearer token vào yêu cầu', () async {
    final adapter = _FakeAdapter(
      (o) => _json(200, <String, Object?>{'ok': true}),
    );
    await build(adapter).get<dynamic>('/me');
    expect(
      adapter.requests.single.headers['Authorization'],
      'Bearer old-access',
    );
  });

  test('401 → làm mới token một lần rồi thử lại với token mới', () async {
    final adapter = _FakeAdapter((o) {
      if (o.path == '/auth/refresh') {
        return _json(200, <String, Object?>{
          'accessToken': 'new-access',
          'refreshToken': 'new-refresh',
          'expiresIn': 900,
        });
      }
      return o.headers['Authorization'] == 'Bearer new-access'
          ? _json(200, <String, Object?>{'ok': true})
          : _json(401, <String, Object?>{
              'code': 'UNAUTHORIZED',
              'message': 'hết hạn',
            });
    });
    final response = await build(adapter).get<dynamic>('/me');

    expect(response.statusCode, 200);
    expect(adapter.count('/me'), 2);
    expect(adapter.count('/auth/refresh'), 1);
    expect(
      adapter.requests.firstWhere((r) => r.path == '/auth/refresh').data,
      <String, dynamic>{'refreshToken': 'old-refresh'},
    );
    expect(
      await store.read(),
      const StoredTokens(
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
      ),
    );
    expect(expired, 0);
  });

  test(
    'nhiều yêu cầu cùng 401 chỉ làm mới token đúng một lần (refresh token xoay vòng)',
    () async {
      final adapter = _FakeAdapter((o) async {
        if (o.path == '/auth/refresh') {
          await Future<void>.delayed(const Duration(milliseconds: 20));
          return _json(200, <String, Object?>{
            'accessToken': 'new-access',
            'refreshToken': 'new-refresh',
            'expiresIn': 900,
          });
        }
        return o.headers['Authorization'] == 'Bearer new-access'
            ? _json(200, <String, Object?>{'ok': true})
            : _json(401, <String, Object?>{
                'code': 'UNAUTHORIZED',
                'message': 'hết hạn',
              });
      });
      final dio = build(adapter);

      final results = await Future.wait(<Future<Response<dynamic>>>[
        dio.get<dynamic>('/today'),
        dio.get<dynamic>('/path'),
        dio.get<dynamic>('/progress'),
      ]);

      expect(results.map((r) => r.statusCode), everyElement(200));
      expect(adapter.count('/auth/refresh'), 1);
      expect(expired, 0);
    },
  );

  test(
    'refresh token bị từ chối → xóa token, báo hết phiên, trả lỗi gốc',
    () async {
      final adapter = _FakeAdapter((o) {
        if (o.path == '/auth/refresh') {
          return _json(401, <String, Object?>{
            'code': 'UNAUTHORIZED',
            'message': 'thu hồi',
          });
        }
        return _json(401, <String, Object?>{
          'code': 'UNAUTHORIZED',
          'message': 'hết hạn',
        });
      });

      await expectLater(
        build(adapter).get<dynamic>('/me'),
        throwsA(
          isA<DioException>().having(
            (e) => e.response?.statusCode,
            'status',
            401,
          ),
        ),
      );
      expect(expired, 1);
      expect(await store.read(), isNull);
    },
  );

  test('lỗi tạm thời khi làm mới (5xx) không làm mất phiên', () async {
    final adapter = _FakeAdapter((o) {
      if (o.path == '/auth/refresh') {
        return _json(503, <String, Object?>{
          'code': 'INTERNAL_ERROR',
          'message': 'bận',
        });
      }
      return _json(401, <String, Object?>{
        'code': 'UNAUTHORIZED',
        'message': 'hết hạn',
      });
    });

    await expectLater(
      build(adapter).get<dynamic>('/me'),
      throwsA(isA<DioException>()),
    );
    expect(expired, 0);
    expect(await store.read(), _oldTokens);
  });

  test(
    '401 của /auth/* (đăng nhập sai) không kích hoạt làm mới token',
    () async {
      final adapter = _FakeAdapter(
        (o) => _json(401, <String, Object?>{
          'code': 'UNAUTHORIZED',
          'message': 'sai mật khẩu',
        }),
      );
      await expectLater(
        build(adapter).post<dynamic>(
          '/auth/login',
          data: <String, String>{'email': 'a@b.co'},
        ),
        throwsA(isA<DioException>()),
      );
      expect(adapter.count('/auth/refresh'), 0);
      expect(expired, 0);
    },
  );

  test(
    'không có token thì không gắn Authorization và không cố làm mới',
    () async {
      store = MemoryTokenStore();
      final adapter = _FakeAdapter(
        (o) => _json(401, <String, Object?>{
          'code': 'UNAUTHORIZED',
          'message': 'chưa đăng nhập',
        }),
      );
      await expectLater(
        build(adapter).get<dynamic>('/me'),
        throwsA(isA<DioException>()),
      );
      expect(
        adapter.requests.single.headers.containsKey('Authorization'),
        isFalse,
      );
      expect(adapter.count('/auth/refresh'), 0);
    },
  );

  group('ApiError.fromDio', () {
    test('đọc mã, thông báo, lỗi theo trường và Retry-After', () async {
      final adapter = _FakeAdapter(
        (o) => _json(
          429,
          <String, Object?>{
            'code': 'TOO_MANY_REQUESTS',
            'message': 'chậm lại',
            'fields': <String, String>{'email': 'sai định dạng'},
          },
          headers: <String, List<String>>{
            'retry-after': <String>['42'],
          },
        ),
      );
      try {
        await build(adapter).post<dynamic>('/auth/login');
        fail('phải ném lỗi');
      } on DioException catch (e) {
        final api = ApiError.fromDio(e);
        expect(api.statusCode, 429);
        expect(api.code, 'TOO_MANY_REQUESTS');
        expect(api.fields, <String, String>{'email': 'sai định dạng'});
        expect(api.retryAfterSeconds, 42);
        expect(api.isNetwork, isFalse);
      }
    });

    test('không có phản hồi → lỗi mạng', () {
      final error = DioException(
        requestOptions: RequestOptions(path: '/me'),
        type: DioExceptionType.connectionError,
      );
      expect(ApiError.fromDio(error).isNetwork, isTrue);
      expect(ApiError.fromDio(error).statusCode, isNull);
    });
  });
}
