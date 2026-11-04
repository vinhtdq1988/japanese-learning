import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:japanese_api/japanese_api.dart';
import 'package:japanese_learning_client/data/api/dio_client.dart';
import 'package:japanese_learning_client/platform/memory_platform.dart';
import 'package:japanese_learning_client/platform/platform.dart';

/// Adapter giả ghi lại yêu cầu và trả JSON cố định.
class _FakeAdapter implements HttpClientAdapter {
  final List<RequestOptions> requests = <RequestOptions>[];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    return ResponseBody.fromString(
      jsonEncode(<String, Object?>{
        'id': 'plan-1',
        'localDate': '2026-11-04',
        'budgetMinutes': 10,
        'estimatedMinutes': 5,
        'status': 'open',
        'items': <Object?>[
          <String, Object?>{
            'id': 'item-1',
            'type': 'new_unit',
            'title': 'あいさつ',
            'estMinutes': 5,
            'status': 'pending',
          },
        ],
      }),
      200,
      headers: <String, List<String>>{
        Headers.contentTypeHeader: <String>['application/json'],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  test(
    'API client sinh từ OpenAPI chạy qua createDio: gắn bearer và giải mã DailyPlan',
    () async {
      final adapter = _FakeAdapter();
      final dio = createDio(
        tokenStore: MemoryTokenStore(
          const StoredTokens(
            accessToken: 'access-1',
            refreshToken: 'refresh-1',
          ),
        ),
        onSessionExpired: () {},
        baseUrl: 'http://api.test/api/v1',
        httpClientAdapter: adapter,
      );
      // interceptors rỗng: không thêm interceptor xác thực mặc định của mã sinh,
      // vì token do AuthInterceptor của createDio quản lý.
      final api = JapaneseApi(dio: dio, interceptors: const <Interceptor>[]);

      final response = await api.getDailyApi().getToday();

      expect(adapter.requests.single.path, '/today');
      expect(
        adapter.requests.single.headers['Authorization'],
        'Bearer access-1',
      );
      final plan = response.data!;
      expect(plan.budgetMinutes, 10);
      expect(plan.status, DailyPlanStatusEnum.open);
      expect(plan.items!.single.type, PlanItemTypeEnum.newUnit);
      expect(plan.items!.single.title, 'あいさつ');
    },
  );
}
