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

  test(
    'API client giải mã Me.learningSource, classSummary và SharedDataDisclosure (spec 004)',
    () async {
      final adapter = _FakeAdapter(<String, Object?>{
        'id': 'u-1',
        'email': 'hocvien@example.com',
        'role': 'learner',
        'status': 'active',
        'learningSource': 'class',
        'classSummary': <String, Object?>{
          'classId': 'c-1',
          'className': 'N5 buổi tối',
          'organizationName': 'Trung tâm Sakura',
          'lockedFields': <Object?>['dailyMinutes', 'skills'],
        },
        'organization': <String, Object?>{
          'id': 'o-1',
          'name': 'Trung tâm Sakura',
          'roles': <Object?>['teacher'],
          'dataAccess': true,
          'license': <String, Object?>{
            'state': 'in_grace',
            'endsOn': '2026-12-31',
            'graceEndsOn': '2027-01-07',
          },
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

      final me = (await api.getAccountApi().getMe()).data!;

      expect(me.learningSource, MeLearningSourceEnum.class_);
      expect(me.classSummary!.lockedFields, <String>['dailyMinutes', 'skills']);
      expect(me.organization!.roles.single, MeOrganizationRolesEnum.teacher);
      expect(me.organization!.license!.state, LicenseState.inGrace);

      final disclosure = SharedDataDisclosure.fromJson(<String, Object?>{
        'version': 1,
        'visible': <Object?>[
          <String, Object?>{'code': 'progress', 'label': 'Tiến độ'},
        ],
        'notVisible': <Object?>['từng câu trả lời'],
        'lockedControls': <Object?>['dailyMinutes'],
        'canLeaveAnytime': true,
        'mayBeMovedWithinOrganization': false,
      });
      expect(disclosure.visible.single.code, SharedDataItemCodeEnum.progress);
      expect(disclosure.canLeaveAnytime, isTrue);
    },
  );

  test('API client giải mã ClassDashboard của bảng điều khiển lớp', () async {
    final adapter = _FakeAdapter(<String, Object?>{
      'classId': 'c-1',
      'learners': <Object?>[
        <String, Object?>{
          'userId': 'u-1',
          'displayName': 'An',
          'email': 'an@example.com',
          'hasStarted': true,
          'pathCompleted': false,
          'completionRatio': 0.4,
          'progressStatus': 'behind',
          'alerts': <Object?>['absent', 'overdue_assignment'],
        },
      ],
      'summary': <String, Object?>{
        'learnerCount': 1,
        'onTrack': 0,
        'behind': 1,
        'ahead': 0,
        'paused': 0,
        'needAttention': 1,
      },
      'contentNotices': <Object?>[],
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

    final dashboard = (await api.getClassesApi().getClassDashboard(
      id: 'c-1',
      filter: 'behind',
    )).data!;

    expect(adapter.requests.single.path, '/classes/c-1/dashboard');
    expect(adapter.requests.single.queryParameters['filter'], 'behind');
    final row = dashboard.learners.single;
    expect(row.progressStatus, ClassProgressStatus.behind);
    expect(row.alerts, <ClassAlert>[
      ClassAlert.absent,
      ClassAlert.overdueAssignment,
    ]);
    expect(dashboard.summary.needAttention, 1);
  });
}
