import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:japanese_learning_client/l10n/app_localizations.dart';
import 'package:japanese_learning_client/presentation/lesson/passage_panel.dart';

// Bảng đoạn văn với đoạn đọc N3 dài và nhiều dòng (spec 008, T227, FR-019): giữ ký tự xuống dòng (bảng giá, lịch,
// danh sách) và đoạn tới 700 ký tự không tràn khung, kể cả ở màn hẹp.

Widget _host(Widget child) => MaterialApp(
  locale: const Locale('vi'),
  localizationsDelegates: const <LocalizationsDelegate<dynamic>>[
    AppLocalizations.delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
  ],
  supportedLocales: AppLocalizations.supportedLocales,
  home: Scaffold(body: SingleChildScrollView(child: child)),
);

/// Bảng giá nhiều dòng: mỗi dòng là một mục riêng.
const String _priceList =
    '【料金】\n大人　一日券　　三千円\n子ども　一日券　千五百円\n学生　　二日券　　五千円\n※水曜日は半額です。';

/// Đoạn dài đúng 700 ký tự (giới hạn của đoạn đọc N3 từ 10 phút).
String _longPassage() {
  const line = '来月の社内旅行について、お知らせします。参加を希望する人は、今週の金曜日までに総務課へ連絡してください。\n';
  final buffer = StringBuffer();
  while (buffer.length < 700) {
    buffer.write(line);
  }
  return buffer.toString().substring(0, 700);
}

void main() {
  testWidgets(
    'giữ nguyên xuống dòng của đoạn nhiều dòng (một Text, nhiều dòng hiển thị)',
    (tester) async {
      await tester.pumpWidget(
        _host(const PassagePanel(japanese: _priceList, translation: '')),
      );
      final text = tester.widget<Text>(find.byKey(const Key('passage-text')));
      expect(text.data, _priceList);
      expect(text.data!.split('\n'), hasLength(5));

      // Cao hơn hẳn một dòng đơn: các dòng thật sự được hiển thị tách nhau.
      final height = tester
          .getSize(find.byKey(const Key('passage-text')))
          .height;
      final oneLine = await _heightOf(tester, '【料金】');
      expect(height, greaterThan(oneLine * 4));
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'đoạn 700 ký tự ở màn hẹp không tràn; cuộn được trong khung giới hạn chiều cao',
    (tester) async {
      tester.view.physicalSize = const Size(360, 640);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      final passage = _longPassage();
      expect(passage.length, 700);

      await tester.pumpWidget(
        _host(PassagePanel(japanese: passage, translation: 'Bản dịch ' * 20)),
      );
      expect(tester.takeException(), isNull);

      // Khung đoạn văn bị giới hạn (≈ 40% chiều cao màn hình) nên không đẩy câu hỏi ra khỏi màn hình...
      final frame = tester.getSize(find.byKey(const Key('passage-scroll')));
      expect(frame.height, lessThanOrEqualTo(640 * 0.4 + 0.5));
      // ...nhưng toàn bộ nội dung vẫn nằm trong vùng cuộn được.
      final scrollable = tester.state<ScrollableState>(
        find.descendant(
          of: find.byKey(const Key('passage-scroll')),
          matching: find.byType(Scrollable),
        ),
      );
      expect(scrollable.position.maxScrollExtent, greaterThan(0));
      await tester.drag(
        find.byKey(const Key('passage-scroll')),
        const Offset(0, -300),
      );
      await tester.pump();
      expect(scrollable.position.pixels, greaterThan(0));
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'đoạn ngắn không bị khung giới hạn làm cắt: vẫn hiện đủ, thu gọn/mở lại được',
    (tester) async {
      await tester.pumpWidget(
        _host(
          const PassagePanel(japanese: _priceList, translation: 'Bảng giá'),
        ),
      );
      expect(find.text(_priceList), findsOneWidget);
      await tester.tap(find.byKey(const Key('passage-toggle')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('passage-text')), findsNothing);
      await tester.tap(find.byKey(const Key('passage-toggle')));
      await tester.pumpAndSettle();
      expect(find.text(_priceList), findsOneWidget);
    },
  );
}

/// Chiều cao của một dòng chữ cùng kiểu với đoạn văn (đo bằng một Text tạm).
Future<double> _heightOf(WidgetTester tester, String line) async {
  await tester.pumpWidget(_host(PassagePanel(japanese: line, translation: '')));
  return tester.getSize(find.byKey(const Key('passage-text'))).height;
}
