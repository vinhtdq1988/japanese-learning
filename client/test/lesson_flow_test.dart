import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:japanese_learning_client/app.dart';
import 'package:japanese_learning_client/data/event_queue.dart';
import 'package:japanese_learning_client/presentation/lesson/lesson_controller.dart';

import 'support/fake_backend.dart';
import 'support/lesson_scenario.dart';

// Bài học (T068–T070): giải thích → bài tập có phản hồi tức thì → hỏi lại câu sai → tóm tắt;
// tiếp tục dở dang, mất kết nối, hoàn thành ngày và "Học thêm".

class _Harness {
  _Harness(this.tester, this.env, this.scenario);

  final WidgetTester tester;
  final TestEnv env;
  final LessonScenario scenario;

  Future<void> tap(String key) async {
    final finder = find.byKey(Key(key));
    await tester.ensureVisible(finder);
    await tester.tap(finder);
    await tester.pumpAndSettle();
  }

  bool has(String key) => find.byKey(Key(key)).evaluate().isNotEmpty;

  /// Rời màn hình bài học: khoảng thời gian học còn lại được ghi trước khi cây widget bị hủy.
  Future<void> leave() async {
    GoRouter.of(tester.element(find.byType(Scaffold).first)).go('/progress');
    await tester.pumpAndSettle();
    // Provider tự hủy chạy sau khung hình cuối và gửi khoảng thời gian: cho các tác vụ đó chạy xong.
    await tester.pump(const Duration(milliseconds: 1));
    await tester.pump(const Duration(seconds: 1));
  }

  Future<void> answerFillBlank(String text) async {
    await tester.enterText(find.byKey(const Key('fill-blank-input')), text);
    await tester.pump();
    await tap('submit-answer');
  }

  Future<void> answerMatching({required bool correct}) async {
    // Vế phải hiển thị: [trà, nước]; đúng: 水→nước (right-1), お茶→trà (right-0).
    await tap('match-left-0');
    await tap(correct ? 'match-right-1' : 'match-right-0');
    await tap('match-left-1');
    await tap(correct ? 'match-right-0' : 'match-right-1');
    await tap('submit-answer');
  }
}

Future<_Harness> _open(
  WidgetTester tester, {
  String route = '/today',
  void Function(LessonScenario)? setup,
}) async {
  TestEnv.useDesktopSize(tester);
  addTearDown(tester.view.reset);
  final env = TestEnv(tokens: signedInTokens());
  final scenario = LessonScenario(env.backend);
  setup?.call(scenario);

  var now = DateTime.utc(2026, 1, 5, 8);
  DateTime clock() => now = now.add(const Duration(seconds: 7));

  await tester.pumpWidget(
    ProviderScope(
      overrides: <Override>[
        ...env.overrides,
        lessonClockProvider.overrideWithValue(clock),
      ],
      child: const JapaneseLearningApp(),
    ),
  );
  await tester.pumpAndSettle();
  GoRouter.of(tester.element(find.byType(Scaffold).first)).go(route);
  await tester.pumpAndSettle();
  return _Harness(tester, env, scenario);
}

void main() {
  testWidgets(
    '"Hôm nay": mục bài mới Kanji có nhãn Kanji, bắt đầu bằng một lần nhấp',
    (tester) async {
      final h = await _open(tester, setup: (s) => s.kanjiItems.add('item-2'));
      expect(find.textContaining('Bài Kanji'), findsOneWidget);
      expect(h.has('kanji-notice'), isFalse);
      expect(h.has('start-item-2'), isTrue);
    },
  );

  testWidgets(
    '"Hôm nay": banner hết bài Kanji kèm gợi ý nâng trình độ hoặc hết nội dung',
    (tester) async {
      final raise = await _open(
        tester,
        setup: (s) => s.kanjiNotice = <String, Object?>{
          'code': 'kanji_exhausted',
          'suggestion': 'raise_level',
        },
      );
      expect(raise.has('kanji-notice'), isTrue);
      expect(find.textContaining('nâng trình độ'), findsWidgets);
    },
  );

  testWidgets('"Hôm nay": banner hết toàn bộ nội dung Kanji', (tester) async {
    final h = await _open(
      tester,
      setup: (s) => s.kanjiNotice = <String, Object?>{
        'code': 'kanji_exhausted',
        'suggestion': 'content_exhausted',
      },
    );
    expect(h.has('kanji-notice'), isTrue);
    expect(find.textContaining('hết nội dung Kanji hiện có'), findsOneWidget);
  });

  testWidgets(
    'học trọn một đơn vị: giải thích, phản hồi tức thì, hỏi lại câu sai, tóm tắt',
    (tester) async {
      final h = await _open(tester);

      // "Hôm nay": mỗi mục có nút Bắt đầu.
      expect(h.has('start-item-1'), isTrue);
      await h.tap('start-item-1');

      // Giải thích từ vựng: chữ Nhật, cách đọc, nghĩa, ví dụ.
      expect(find.text('水'), findsOneWidget);
      expect(find.text('Cách đọc: みず'), findsOneWidget);
      expect(find.text('Cho tôi xin nước.'), findsOneWidget);
      await h.tap('start-exercises');

      // Câu 1 (trắc nghiệm) trả lời sai → phản hồi tức thì kèm đáp án đúng.
      expect(find.text('Câu 1/3'), findsOneWidget);
      await h.tap('choice-0');
      expect(h.has('feedback-incorrect'), isTrue);
      expect(find.byKey(const Key('correct-answer')), findsOneWidget);
      expect(find.text('Đáp án đúng: Nước'), findsOneWidget);
      await h.tap('continue');

      // Câu 2 (điền từ) đúng.
      await h.answerFillBlank('は');
      expect(h.has('feedback-correct'), isTrue);
      await h.tap('continue');

      // Câu 3 (ghép cặp) đúng.
      await h.answerMatching(correct: true);
      expect(h.has('feedback-correct'), isTrue);
      await h.tap(
        'continue',
      ); // chưa phải bước hoàn thành vì còn câu sai để hỏi lại

      // Hỏi lại câu sai một lần, gửi với isRetry=true.
      expect(h.has('retry-heading'), isTrue);
      await h.tap('choice-1');
      expect(h.has('feedback-correct'), isTrue);
      await h.tap('continue'); // câu cuối → hoàn thành

      expect(h.scenario.retries, hasLength(1));
      expect(h.scenario.retries.single['isRetry'], isTrue);
      expect(h.has('summary-heading'), isTrue);
      expect(find.text('Bạn trả lời đúng 2/3 câu'), findsOneWidget);
      expect(h.scenario.completedSessions, contains('session-item-1'));
      // Khoảng thời gian học đã được ghi và gửi lên.
      expect(h.scenario.intervals, isNotEmpty);

      // Mục kế hoạch hoàn thành; ngày chưa hoàn thành vì còn mục 2.
      await h.tap('back-to-today');
      expect(h.has('start-item-1'), isFalse);
      expect(h.has('start-item-2'), isTrue);
      expect(h.has('day-completed'), isFalse);
      await h.leave();
    },
  );

  testWidgets(
    'tiếp tục phiên dở dang: bỏ qua giải thích, vào thẳng câu chưa trả lời',
    (tester) async {
      final h = await _open(
        tester,
        setup: (s) {
          s.answered['session-item-1'] = <String, bool>{'ex-1': true};
          s.itemStatus['item-1'] = 'in_progress';
        },
      );
      // Mục đang dở hiển thị "Tiếp tục".
      expect(find.text('Tiếp tục'), findsOneWidget);
      await h.tap('start-item-1');
      expect(h.has('start-exercises'), isFalse);
      expect(find.text('Câu 2/3'), findsOneWidget);
      expect(h.has('fill-blank-input'), isTrue);
      await h.leave();
    },
  );

  testWidgets(
    'mất kết nối khi trả lời: giữ lại câu trả lời, gửi lại sau với cùng clientEventId',
    (tester) async {
      final h = await _open(tester);
      await h.tap('start-item-1');
      await h.tap('start-exercises');

      h.scenario.offline = true;
      await h.tap('choice-1');
      expect(h.has('offline-banner'), isTrue);
      expect(h.has('feedback'), isFalse);

      // Câu trả lời đã được lưu trong hàng đợi bền vững (không mất khi tải lại).
      final queue = EventQueue(h.env.localStore);
      final pending = await queue.pending();
      expect(
        pending.where((e) => e.type == QueuedEventType.answer),
        hasLength(1),
      );
      final eventId = pending.first.clientEventId;

      h.scenario.offline = false;
      await h.tap('retry-send');
      expect(h.has('offline-banner'), isFalse);
      expect(h.has('feedback-correct'), isTrue);
      expect(h.scenario.events.keys, contains(eventId));
      expect(
        (await queue.pending()).where((e) => e.type == QueuedEventType.answer),
        isEmpty,
      );
      await h.leave();
    },
  );

  testWidgets(
    'không báo hoàn thành khi chưa lưu xong: mất kết nối lúc hoàn thành rồi thử lại',
    (tester) async {
      final h = await _open(
        tester,
        setup: (s) {
          s.answered['session-item-1'] = <String, bool>{
            'ex-1': true,
            'ex-2': true,
          };
          s.itemStatus['item-1'] = 'in_progress';
        },
      );
      await h.tap('start-item-1');
      await h.answerMatching(correct: true);

      h.scenario.offline = true;
      await h.tap('continue');
      expect(h.has('complete-offline'), isTrue);
      expect(h.has('summary-heading'), isFalse);
      expect(h.scenario.completedSessions, isEmpty);

      h.scenario.offline = false;
      await h.tap('retry-complete');
      expect(h.has('summary-heading'), isTrue);
      expect(h.scenario.completedSessions, contains('session-item-1'));
      await h.leave();
    },
  );

  testWidgets(
    'hoàn thành ngày: thẻ tóm tắt và "Học thêm" mở đơn vị ngoài kế hoạch',
    (tester) async {
      final h = await _open(
        tester,
        setup: (s) {
          s.itemStatus.updateAll((_, __) => 'completed');
        },
      );
      expect(h.has('day-completed'), isTrue);
      expect(find.text('Đúng 5/6 câu · 2.5 phút'), findsOneWidget);
      expect(h.has('start-item-1'), isFalse);

      await h.tap('study-more');
      expect(find.text('Màu sắc'), findsWidgets);
      expect(h.has('start-exercises'), isTrue);
      expect(h.scenario.base.onboarded, isTrue);
      await h.leave();
    },
  );

  testWidgets('học thêm hết nội dung: thông báo rõ ràng kèm gợi ý', (
    tester,
  ) async {
    final h = await _open(
      tester,
      setup: (s) {
        s.itemStatus.updateAll((_, __) => 'completed');
        s.extraUnits = <Map<String, Object?>>[];
        s.extraSuggestion = 'raise_level';
      },
    );
    await h.tap('study-more');
    expect(h.has('extra-message'), isTrue);
    expect(find.textContaining('nâng trình độ'), findsOneWidget);
    // Vẫn ở "Hôm nay", không có lỗi chung.
    expect(h.has('day-completed'), isTrue);
  });

  testWidgets('đơn vị không còn khả dụng: thông báo và quay về Hôm nay', (
    tester,
  ) async {
    final h = await _open(tester, route: '/lesson?item=khong-co');
    expect(find.text('Bài học này hiện không còn khả dụng.'), findsOneWidget);
    await h.tap('back-to-today');
    expect(h.has('start-item-1'), isTrue);
  });

  testWidgets('mở /lesson không kèm mục → về Hôm nay', (tester) async {
    final h = await _open(tester, route: '/lesson');
    expect(h.has('start-item-1'), isTrue);
  });
}
