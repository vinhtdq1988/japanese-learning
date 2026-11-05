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
  _FakeAdapter([Map<String, Object?>? body]) : _body = body ?? _defaultPlan;

  final Map<String, Object?> _body;
  final List<RequestOptions> requests = <RequestOptions>[];

  static final Map<String, Object?> _defaultPlan = <String, Object?>{
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
  };

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    return ResponseBody.fromString(
      jsonEncode(_body),
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

  test(
    'API client giải mã được Skill.kanji, PlanItem.kind, kanjiNotice và ReviewFacet',
    () async {
      final adapter = _FakeAdapter(<String, Object?>{
        'id': 'plan-2',
        'localDate': '2026-11-05',
        'budgetMinutes': 10,
        'estimatedMinutes': 5,
        'status': 'open',
        'items': <Object?>[
          <String, Object?>{
            'id': 'item-k',
            'type': 'new_unit',
            'kind': 'kanji',
            'title': 'Kanji số đếm',
            'estMinutes': 5,
            'status': 'pending',
          },
        ],
        'kanjiNotice': <String, Object?>{
          'code': 'kanji_exhausted',
          'suggestion': 'raise_level',
        },
      });
      final dio = createDio(
        tokenStore: MemoryTokenStore(
          const StoredTokens(accessToken: 'a', refreshToken: 'r'),
        ),
        onSessionExpired: () {},
        baseUrl: 'http://api.test/api/v1',
        httpClientAdapter: adapter,
      );
      final api = JapaneseApi(dio: dio, interceptors: const <Interceptor>[]);

      final plan = (await api.getDailyApi().getToday()).data!;

      expect(plan.items!.single.kind, Skill.kanji);
      expect(
        plan.kanjiNotice!.code,
        DailyPlanKanjiNoticeCodeEnum.kanjiExhausted,
      );
      expect(
        plan.kanjiNotice!.suggestion,
        DailyPlanKanjiNoticeSuggestionEnum.raiseLevel,
      );
      expect(
        ReviewFacet.values.map((f) => f.name),
        containsAll(<String>['item', 'meaning', 'reading', 'word']),
      );
    },
  );
}
