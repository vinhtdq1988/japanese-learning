import 'package:dio/dio.dart';

import 'fake_backend.dart';
import 'learning_scenario.dart';

/// Máy chủ giả có trạng thái cho luồng US2 (kế hoạch hôm nay → phiên học → hoàn thành ngày → học thêm).
/// Chấm bài ở phía "server" giả như thật (client không có đáp án), loại trùng theo `clientEventId`, và
/// mô phỏng mất kết nối bằng cờ [offline]. Logic thật của server được kiểm thử ở `backend/tests`.
class LessonScenario {
  LessonScenario(this.backend) : base = LearningScenario(backend) {
    base.onboarded = true;
    _install();
  }

  final FakeBackend backend;
  final LearningScenario base;

  /// `true` → mọi yêu cầu liên quan phiên học lỗi mạng (không có phản hồi).
  bool offline = false;

  /// Các đơn vị còn lại cho "học thêm"; rỗng → 404 `CONTENT_EXHAUSTED`.
  List<Map<String, Object?>> extraUnits = <Map<String, Object?>>[
    <String, Object?>{
      'id': 'unit-extra',
      'type': 'new_unit',
      'title': 'Màu sắc',
      'estMinutes': 5,
      'status': 'pending',
      'itemCount': null,
    },
  ];
  String extraSuggestion = 'content_exhausted';

  final Map<String, String> itemStatus = <String, String>{
    'item-1': 'pending',
    'item-2': 'pending',
  };

  /// Mã mục kế hoạch được gắn `kind = kanji` (nhãn bài Kanji ở "Hôm nay").
  final Set<String> kanjiItems = <String>{};

  /// `DailyPlan.kanjiNotice` server giả trả; null = không có thông báo.
  Map<String, Object?>? kanjiNotice;

  /// Thêm một gói ôn (`review_batch`, 3 mục) vào kế hoạch hôm nay (US3).
  void addReviewBatch() => itemStatus['item-review'] = 'pending';

  /// Ngày ôn kế tiếp server giả trả cho mỗi câu của phiên ôn tập.
  static const String reviewNextDate = '2026-01-08';

  /// Đáp án đúng (chỉ server giả biết): id bài tập → đáp án.
  static const Map<String, Object> correct = <String, Object>{
    'ex-1': 1,
    'ex-2': 'は',
    'ex-3': <List<String>>[
      <String>['水', 'nước'],
      <String>['お茶', 'trà'],
    ],
  };

  /// Mỗi phiên: các câu đã trả lời lượt chính (id bài tập → đúng/sai).
  final Map<String, Map<String, bool>> answered = <String, Map<String, bool>>{};
  final Set<String> completedSessions = <String>{};

  /// Mọi yêu cầu đã được "ghi" thật, theo `clientEventId` (loại trùng).
  final Map<String, Map<String, Object?>> events =
      <String, Map<String, Object?>>{};
  final List<Map<String, Object?>> intervals = <Map<String, Object?>>[];
  final List<Map<String, Object?>> retries = <Map<String, Object?>>[];

  bool get dayCompleted => itemStatus.values.every((s) => s == 'completed');

  List<Map<String, Object?>> get _exercises => <Map<String, Object?>>[
    <String, Object?>{
      'id': 'ex-1',
      'type': 'multiple_choice',
      'prompt': '「水」nghĩa là gì?',
      'payload': <String, Object?>{
        'choices': <String>['Trà', 'Nước', 'Cơm'],
      },
    },
    <String, Object?>{
      'id': 'ex-2',
      'type': 'fill_blank',
      'prompt': 'Điền trợ từ: 私___学生です。',
      'payload': <String, Object?>{},
    },
    <String, Object?>{
      'id': 'ex-3',
      'type': 'matching',
      'prompt': 'Ghép từ với nghĩa.',
      'payload': <String, Object?>{
        'left': <String>['水', 'お茶'],
        'right': <String>['trà', 'nước'],
      },
    },
  ];

  Map<String, Object?> session(String sessionId, String title, String kind) {
    final done = answered[sessionId] ?? <String, bool>{};
    return <String, Object?>{
      'id': sessionId,
      'status': completedSessions.contains(sessionId)
          ? 'completed'
          : 'in_progress',
      'kind': kind,
      'title': title,
      'items': <Map<String, Object?>>[
        <String, Object?>{
          'id': 'it-1',
          'kind': 'vocabulary',
          'japanese': '水',
          'reading': 'みず',
          'meaning': 'nước',
          'examples': <Map<String, Object?>>[
            <String, Object?>{
              'ja': '水をください。',
              'reading': 'みずをください。',
              'translation': 'Cho tôi xin nước.',
            },
          ],
        },
      ],
      'exercises': _exercises,
      'answered': <Map<String, Object?>>[
        for (final e in done.entries)
          <String, Object?>{'exerciseId': e.key, 'isCorrect': e.value},
      ],
    };
  }

  bool _isCorrect(String exerciseId, Object? answer) {
    final expected = correct[exerciseId];
    if (expected is List) {
      if (answer is! List || answer.length != expected.length) return false;
      final given = answer.map((p) => (p as List).join('|')).toSet();
      return given.length == expected.length &&
          expected.every((p) => given.contains((p as List).join('|')));
    }
    return expected == answer;
  }

  FakeResponse _guardOffline(FakeResponse Function() reply) {
    if (offline) {
      throw DioException(
        requestOptions: RequestOptions(path: ''),
        type: DioExceptionType.connectionError,
        message: 'offline',
      );
    }
    return reply();
  }

  Map<String, Object?> get todayPlan => <String, Object?>{
    ...base.todayPlan,
    'status': dayCompleted ? 'completed' : 'open',
    'items': <Map<String, Object?>>[
      if (itemStatus.containsKey('item-review'))
        <String, Object?>{
          'id': 'item-review',
          'type': 'review_batch',
          'title': 'Ôn tập',
          'estMinutes': 2,
          'status': itemStatus['item-review'],
          'itemCount': 3,
          'kind': null,
        },
      for (final item in (base.todayPlan['items']! as List<Object?>))
        <String, Object?>{
          ...(item! as Map<String, Object?>),
          'status': itemStatus[(item as Map<String, Object?>)['id']],
          'kind': kanjiItems.contains(item['id']) ? 'kanji' : 'vocabulary',
        },
    ],
    if (kanjiNotice != null) 'kanjiNotice': kanjiNotice,
    if (dayCompleted)
      'summary': <String, Object?>{
        'correct': 5,
        'total': 6,
        'minutesSpent': 2.5,
        'dayCompleted': true,
      },
  };

  void _install() {
    backend.on('GET /today', (_) => FakeResponse(200, todayPlan));

    backend.on('POST /sessions', (r) {
      return _guardOffline(() {
        final id = requestJson(r)['planItemId']! as String;
        if (id == 'unit-extra') {
          return FakeResponse(
            200,
            session('session-extra', 'Màu sắc', 'extra'),
          );
        }
        if (id == 'item-review' && itemStatus.containsKey(id)) {
          if (itemStatus[id] == 'pending') itemStatus[id] = 'in_progress';
          return FakeResponse(
            200,
            session('session-item-review', 'Ôn tập', 'review'),
          );
        }
        if (!itemStatus.containsKey(id)) {
          return const FakeResponse(404, <String, Object?>{
            'code': 'NOT_FOUND',
            'message': 'Không tìm thấy',
          });
        }
        if (itemStatus[id] == 'pending') itemStatus[id] = 'in_progress';
        return FakeResponse(
          200,
          session(
            'session-$id',
            id == 'item-1' ? 'Chào hỏi' : 'Câu danh từ với です',
            'new_unit',
          ),
        );
      });
    });

    for (final sessionId in <String>[
      'session-item-1',
      'session-item-2',
      'session-item-review',
      'session-extra',
    ]) {
      backend.on('POST /sessions/$sessionId/answers', (r) {
        return _guardOffline(() {
          final body = requestJson(r);
          final eventId = body['clientEventId']! as String;
          final exerciseId = body['exerciseId']! as String;
          final prior = events[eventId];
          if (prior != null) {
            return FakeResponse(200, <String, Object?>{
              ...prior,
              'duplicate': true,
            });
          }
          final isRetry = body['isRetry'] == true;
          final ok = _isCorrect(exerciseId, body['answer']);
          final result = <String, Object?>{
            'isCorrect': ok,
            'feedback': ok ? 'Đúng rồi!' : 'Chưa đúng.',
            if (!ok) 'correctAnswer': correct[exerciseId],
            'nextReviewDate': sessionId == 'session-item-review'
                ? reviewNextDate
                : null,
            'duplicate': false,
          };
          events[eventId] = result;
          if (isRetry) {
            retries.add(body);
          } else {
            (answered[sessionId] ??= <String, bool>{})[exerciseId] = ok;
          }
          return FakeResponse(200, result);
        });
      });

      backend.on('POST /sessions/$sessionId/intervals', (r) {
        return _guardOffline(() {
          final body = requestJson(r);
          final eventId = body['clientEventId']! as String;
          if (!events.containsKey(eventId)) {
            events[eventId] = body;
            intervals.add(body);
          }
          return const FakeResponse(204);
        });
      });

      backend.on('POST /sessions/$sessionId/complete', (r) {
        return _guardOffline(() {
          final done = answered[sessionId] ?? <String, bool>{};
          if (done.length < _exercises.length) {
            return const FakeResponse(409, <String, Object?>{
              'code': 'SESSION_INCOMPLETE',
              'message': 'Còn câu chưa trả lời',
            });
          }
          completedSessions.add(sessionId);
          final itemId = sessionId.replaceFirst('session-', '');
          if (itemStatus.containsKey(itemId)) itemStatus[itemId] = 'completed';
          return FakeResponse(200, <String, Object?>{
            'correct': done.values.where((v) => v).length,
            'total': done.length,
            'minutesSpent': 1.5,
            'dayCompleted': dayCompleted,
          });
        });
      });
    }

    backend.on('POST /today/extra', (_) {
      if (extraUnits.isEmpty) {
        return FakeResponse(404, <String, Object?>{
          'code': 'CONTENT_EXHAUSTED',
          'message': 'Hết nội dung',
          'fields': <String, String>{'suggestion': extraSuggestion},
        });
      }
      return FakeResponse(200, extraUnits.first);
    });
  }
}
