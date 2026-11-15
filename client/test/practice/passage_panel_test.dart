import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:japanese_learning_client/app.dart';
import 'package:japanese_learning_client/l10n/app_localizations.dart';
import 'package:japanese_learning_client/presentation/lesson/lesson_controller.dart';
import 'package:japanese_learning_client/presentation/lesson/passage_panel.dart';

import '../support/fake_backend.dart';
import '../support/lesson_scenario.dart';

// Bảng đoạn văn ghim khi làm bài luyện đọc (spec 007, US2, T054, research §P5): thu gọn/mở được, trạng thái
// chỉ nằm trong `State`, chỉ hiện với phiên có mục `kind = reading`, không tràn ở màn hẹp.

Widget _host(Widget child) => MaterialApp(
  localizationsDelegates: AppLocalizations.localizationsDelegates,
  supportedLocales: AppLocalizations.supportedLocales,
  locale: const Locale('vi'),
  home: Scaffold(body: SingleChildScrollView(child: child)),
);

const String _passage = '田中さんは毎朝七時に起きます。八時に会社へ行きます。';

Future<void> _open(WidgetTester tester, {required bool reading}) async {
  TestEnv.useDesktopSize(tester);
  addTearDown(tester.view.reset);
  final env = TestEnv(tokens: signedInTokens());
  LessonScenario(env.backend).readingPassage = reading;
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
  GoRouter.of(tester.element(find.byType(Scaffold).first)).go('/today');
  await tester.pumpAndSettle();
}

Future<void> _tap(WidgetTester tester, String key) async {
  final finder = find.byKey(Key(key));
  await tester.ensureVisible(finder);
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

/// Rời màn bài học: khoảng thời gian học còn lại được ghi trước khi cây widget bị hủy (như `lesson_flow_test`).
Future<void> _leave(WidgetTester tester) async {
  GoRouter.of(tester.element(find.byType(Scaffold).first)).go('/progress');
  await tester.pumpAndSettle();
  await tester.pump(const Duration(milliseconds: 1));
  await tester.pump(const Duration(seconds: 1));
}

bool _has(String key) => find.byKey(Key(key)).evaluate().isNotEmpty;

void main() {
  group('PassagePanel', () {
    testWidgets(
      'mặc định mở: hiện đoạn văn và bản dịch; bấm thu gọn rồi mở lại',
      (tester) async {
        await tester.pumpWidget(
          _host(
            const PassagePanel(
              japanese: _passage,
              translation: 'Anh Tanaka dậy lúc 7 giờ.',
            ),
          ),
        );
        expect(find.text(_passage), findsOneWidget);
        expect(find.text('Anh Tanaka dậy lúc 7 giờ.'), findsOneWidget);
        expect(find.text('Đoạn văn'), findsOneWidget);
        expect(find.text('Thu gọn'), findsOneWidget);

        await tester.tap(find.byKey(const Key('passage-toggle')));
        await tester.pumpAndSettle();
        expect(find.text(_passage), findsNothing);
        expect(find.text('Mở rộng'), findsOneWidget);

        await tester.tap(find.byKey(const Key('passage-toggle')));
        await tester.pumpAndSettle();
        expect(find.text(_passage), findsOneWidget);
      },
    );

    testWidgets(
      'trạng thái thu gọn chỉ nằm trong State: dựng lại widget thì mở lại',
      (tester) async {
        const panel = PassagePanel(japanese: _passage, translation: 'Bản dịch');
        await tester.pumpWidget(_host(panel));
        await tester.tap(find.byKey(const Key('passage-toggle')));
        await tester.pumpAndSettle();
        expect(find.text(_passage), findsNothing);

        await tester.pumpWidget(_host(const SizedBox()));
        await tester.pumpWidget(_host(panel));
        expect(find.text(_passage), findsOneWidget);
      },
    );

    testWidgets('màn hẹp (≤ 480 px) không tràn', (tester) async {
      tester.view.physicalSize = const Size(360, 640);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(
        _host(
          PassagePanel(
            japanese: _passage * 4,
            translation: 'Bản dịch dài ' * 12,
          ),
        ),
      );
      expect(tester.takeException(), isNull);
    });
  });

  group('màn bài học', () {
    testWidgets(
      'phiên có mục kind = reading: bước làm bài ghim bảng đoạn văn phía trên câu hỏi',
      (tester) async {
        await _open(tester, reading: true);
        await _tap(tester, 'start-item-1');
        // Bước giới thiệu hiển thị đoạn văn như mọi mục, chưa có bảng ghim.
        expect(find.text('田中さんは毎朝七時に起きます。'), findsOneWidget);
        expect(_has('passage-panel'), isFalse);

        await _tap(tester, 'start-exercises');
        expect(_has('passage-panel'), isTrue);
        expect(find.text('田中さんは毎朝七時に起きます。'), findsOneWidget);

        final panelTop = tester
            .getTopLeft(find.byKey(const Key('passage-panel')))
            .dy;
        final questionTop = tester.getTopLeft(find.text('「水」nghĩa là gì?')).dy;
        expect(panelTop, lessThan(questionTop));

        await _tap(tester, 'passage-toggle');
        expect(find.text('田中さんは毎朝七時に起きます。'), findsNothing);
        await _leave(tester);
      },
    );

    testWidgets('phiên không có mục reading: không hiện bảng đoạn văn', (
      tester,
    ) async {
      await _open(tester, reading: false);
      await _tap(tester, 'start-item-1');
      await _tap(tester, 'start-exercises');
      expect(_has('passage-panel'), isFalse);
      await _leave(tester);
    });
  });
}
