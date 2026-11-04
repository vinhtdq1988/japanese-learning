import 'package:dio/dio.dart';

import 'fake_backend.dart';

/// Máy chủ giả có trạng thái cho luồng US1 (đăng ký → onboarding → lộ trình + hôm nay). Chỉ mô phỏng
/// phần hợp đồng mà client dùng; logic thật của server được kiểm thử ở backend.
class LearningScenario {
  LearningScenario(this.backend) {
    _install();
  }

  final FakeBackend backend;

  bool onboarded = false;
  Map<String, Object?> draft = <String, Object?>{};
  Map<String, Object?>? currentPlacement;
  String? completedWithPlacementId;

  static const String level = 'N5';

  List<Map<String, Object?>> get questions =>
      List<Map<String, Object?>>.generate(
        3,
        (i) => <String, Object?>{
          'id': 'q${i + 1}',
          'skill': i.isEven ? 'vocabulary' : 'grammar',
          'prompt': '問題${i + 1}',
          'choices': <String>['あ', 'い', 'う', 'え'],
        },
      );

  Map<String, Object?> placementResult({String id = 'placement-1'}) =>
      <String, Object?>{
        'id': id,
        'estimatedLevel': 'N4',
        'score': 12,
        'total': 20,
        'strongTopics': <String>['Trợ từ'],
        'weakTopics': <String>['Số đếm'],
        'guessSuspected': false,
      };

  Map<String, Object?> get pathSummary => <String, Object?>{
    'id': 'path-1',
    'totalUnits': 6,
    'completedUnits': 0,
    'startLevel': 'N5',
    'reason': completedWithPlacementId == null
        ? 'onboarding'
        : 'placement_retake',
    'scopeNotice': null,
    'message': null,
  };

  Map<String, Object?> get todayPlan => <String, Object?>{
    'id': 'plan-1',
    'localDate': '2026-01-05',
    'budgetMinutes': (draft['dailyMinutes'] as int?) ?? 10,
    'estimatedMinutes': 10,
    'status': 'open',
    'notice': null,
    'items': <Map<String, Object?>>[
      <String, Object?>{
        'id': 'item-1',
        'type': 'new_unit',
        'title': 'Chào hỏi',
        'estMinutes': 5,
        'status': 'pending',
        'itemCount': null,
      },
      <String, Object?>{
        'id': 'item-2',
        'type': 'new_unit',
        'title': 'Câu danh từ với です',
        'estMinutes': 5,
        'status': 'pending',
        'itemCount': null,
      },
    ],
  };

  Map<String, Object?> get pathDetail => <String, Object?>{
    ...pathSummary,
    'items': <Map<String, Object?>>[
      <String, Object?>{
        'unitId': 'u1',
        'title': 'Chào hỏi',
        'kind': 'vocabulary',
        'level': 'N5',
        'estMinutes': 5,
        'status': 'pending',
      },
      <String, Object?>{
        'unitId': 'u2',
        'title': 'Câu danh từ với です',
        'kind': 'grammar',
        'level': 'N5',
        'estMinutes': 5,
        'status': 'pending',
      },
    ],
  };

  Map<String, Object?> _body(RequestOptions r) => requestJson(r);

  void _install() {
    backend.on('POST /auth/register', (_) => FakeResponse(201, fakeTokens()));
    backend.on(
      'POST /auth/login',
      (_) => FakeResponse(200, <String, Object?>{
        ...fakeTokens(),
        'accountStatus': 'active',
      }),
    );
    backend.on('POST /auth/logout', (_) => const FakeResponse(204));

    backend.on('GET /onboarding', (_) {
      return FakeResponse(200, <String, Object?>{
        'state': onboarded
            ? 'completed'
            : (draft.isEmpty ? 'not_started' : 'in_progress'),
        'draft': draft,
        if (currentPlacement != null) 'carriedPlacement': currentPlacement,
      });
    });
    backend.on('PUT /onboarding', (r) {
      draft = _body(r)..remove('timezone');
      return FakeResponse(200, <String, Object?>{
        'state': 'in_progress',
        'draft': draft,
      });
    });
    backend.on('POST /onboarding/complete', (r) {
      final body = _body(r);
      draft = Map<String, Object?>.from(body)..remove('timezone');
      completedWithPlacementId = body['placementResultId'] as String?;
      onboarded = true;
      return FakeResponse(200, <String, Object?>{
        'path': pathSummary,
        'today': todayPlan,
      });
    });

    backend.on(
      'GET /placement/questions',
      (_) => FakeResponse(200, <String, Object?>{
        'timeLimitSeconds': 600,
        'questions': questions,
      }),
    );
    backend.on('POST /placement/submit', (_) {
      currentPlacement = placementResult();
      return FakeResponse(200, currentPlacement);
    });

    backend.on(
      'GET /today',
      (_) => onboarded
          ? FakeResponse(200, todayPlan)
          : const FakeResponse(404, <String, Object?>{
              'code': 'NOT_FOUND',
              'message': 'Chưa có lộ trình',
            }),
    );
    backend.on(
      'GET /path',
      (_) => onboarded
          ? FakeResponse(200, pathDetail)
          : const FakeResponse(404, <String, Object?>{
              'code': 'NOT_FOUND',
              'message': 'Chưa có lộ trình',
            }),
    );
    backend.on('POST /path/rebuild', (r) {
      completedWithPlacementId = _body(r)['usePlacementResultId'] as String?;
      return FakeResponse(200, pathSummary);
    });
  }
}
