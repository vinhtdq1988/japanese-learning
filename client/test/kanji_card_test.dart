import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:japanese_api/japanese_api.dart';
import 'package:japanese_learning_client/l10n/app_localizations.dart';
import 'package:japanese_learning_client/presentation/lesson/kanji/kanji_card.dart';
import 'package:japanese_learning_client/presentation/lesson/lesson_screen.dart';

// Thẻ chữ Kanji (T023, US1, research K9): chữ lớn bằng phông đóng gói, chỉ hiện nhóm âm có dữ liệu,
// okurigana dạng た(べる), từ ví dụ kèm cách đọc của chữ.

Widget _host(Widget child, {String locale = 'vi', Size? size}) {
  final app = MaterialApp(
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    locale: Locale(locale),
    home: Scaffold(body: SingleChildScrollView(child: child)),
  );
  return size == null
      ? app
      : MediaQuery(
          data: MediaQueryData(size: size),
          child: app,
        );
}

ContentItem _item({
  List<String> on = const <String>['サン'],
  List<String> kun = const <String>['み', 'み.つ'],
  String? components = 'Ba nét ngang',
  List<ContentItemExamplesInner>? examples,
}) => ContentItem(
  id: 'k1',
  kind: Skill.kanji,
  japanese: '三',
  meaning: 'ba',
  kanji: KanjiDetails(
    onReadings: on,
    kunReadings: kun,
    strokeCount: 3,
    components: components,
  ),
  examples:
      examples ??
      <ContentItemExamplesInner>[
        ContentItemExamplesInner(
          ja: '三月',
          reading: 'さんがつ',
          kanjiReading: 'サン',
          translation: 'tháng Ba',
        ),
        ContentItemExamplesInner(
          ja: '三つ',
          reading: 'みっつ',
          kanjiReading: 'み',
          translation: 'ba cái',
        ),
      ],
);

void main() {
  testWidgets('chữ chính cỡ 96 px với phông Noto Sans JP đóng gói', (
    tester,
  ) async {
    await tester.pumpWidget(_host(KanjiCard(item: _item())));
    final glyph = tester.widget<Text>(find.byKey(const Key('kanji-glyph')));
    expect(glyph.data, '三');
    expect(glyph.style?.fontSize, 96);
    expect(glyph.style?.fontFamily, 'Noto Sans JP');
    expect(find.text('ba'), findsOneWidget);
  });

  testWidgets('cửa sổ hẹp: chữ chính giảm xuống nhưng không dưới 72 px', (
    tester,
  ) async {
    await tester.pumpWidget(
      _host(KanjiCard(item: _item()), size: const Size(360, 800)),
    );
    final glyph = tester.widget<Text>(find.byKey(const Key('kanji-glyph')));
    expect(glyph.style?.fontSize, greaterThanOrEqualTo(72));
    expect(glyph.style?.fontSize, lessThan(96));
  });

  testWidgets('hiện âm On, âm Kun, số nét và thành phần (vi)', (tester) async {
    await tester.pumpWidget(_host(KanjiCard(item: _item())));
    expect(find.textContaining('Âm On'), findsOneWidget);
    expect(find.textContaining('サン'), findsWidgets);
    expect(find.textContaining('Âm Kun'), findsOneWidget);
    expect(find.text('Số nét: 3'), findsOneWidget);
    expect(find.text('Thành phần: Ba nét ngang'), findsOneWidget);
  });

  testWidgets('chữ chỉ có âm Kun không hiện nhãn âm On trống', (tester) async {
    await tester.pumpWidget(
      _host(KanjiCard(item: _item(on: const <String>[]))),
    );
    expect(find.byKey(const Key('kanji-on')), findsNothing);
    expect(find.textContaining('Âm On'), findsNothing);
    expect(find.byKey(const Key('kanji-kun')), findsOneWidget);
  });

  testWidgets('chữ chỉ có âm On không hiện nhãn âm Kun trống', (tester) async {
    await tester.pumpWidget(
      _host(KanjiCard(item: _item(kun: const <String>[], components: null))),
    );
    expect(find.byKey(const Key('kanji-kun')), findsNothing);
    expect(find.byKey(const Key('kanji-components')), findsNothing);
    expect(find.byKey(const Key('kanji-on')), findsOneWidget);
  });

  test(
    'okurigana た.べる hiển thị た(べる), âm Kun không có okurigana giữ nguyên',
    () {
      expect(formatKunReading('た.べる'), 'た(べる)');
      expect(formatKunReading('ひ'), 'ひ');
      expect(formatKunReading('み.つ'), 'み(つ)');
    },
  );

  testWidgets('âm Kun có okurigana hiển thị trong ngoặc', (tester) async {
    await tester.pumpWidget(
      _host(
        KanjiCard(
          item: _item(on: const <String>['ショク'], kun: const <String>['た.べる']),
        ),
      ),
    );
    final kun = tester.widget<Padding>(find.byKey(const Key('kanji-kun')));
    expect((kun.child! as Text).textSpan!.toPlainText(), contains('た(べる)'));
  });

  testWidgets('từ ví dụ có kana, nghĩa và cách đọc của chữ trong từ', (
    tester,
  ) async {
    await tester.pumpWidget(_host(KanjiCard(item: _item())));
    expect(find.text('三月'), findsOneWidget);
    expect(find.text('さんがつ'), findsOneWidget);
    expect(find.text('tháng Ba'), findsOneWidget);
    expect(find.text('Trong từ này đọc là: サン'), findsOneWidget);
    expect(find.text('Trong từ này đọc là: み'), findsOneWidget);
  });

  testWidgets(
    'ví dụ không khai báo kanjiReading không hiện dòng cách đọc của chữ',
    (tester) async {
      await tester.pumpWidget(
        _host(
          KanjiCard(
            item: _item(
              examples: <ContentItemExamplesInner>[
                ContentItemExamplesInner(
                  ja: '経済',
                  reading: 'けいざい',
                  translation: 'kinh tế',
                ),
              ],
            ),
          ),
        ),
      );
      expect(find.byKey(const Key('kanji-example-0-reading')), findsNothing);
      expect(find.text('kinh tế'), findsOneWidget);
    },
  );

  testWidgets('văn bản giao diện theo tiếng Anh khi locale en', (tester) async {
    await tester.pumpWidget(_host(KanjiCard(item: _item()), locale: 'en'));
    expect(find.textContaining('On reading'), findsOneWidget);
    expect(find.textContaining('Kun reading'), findsOneWidget);
    expect(find.text('Strokes: 3'), findsOneWidget);
    expect(find.text('Example words'), findsOneWidget);
  });

  testWidgets('LessonItemCard chuyển mục Kanji sang thẻ Kanji', (tester) async {
    await tester.pumpWidget(_host(LessonItemCard(item: _item())));
    expect(find.byType(KanjiCard), findsOneWidget);
  });
}
