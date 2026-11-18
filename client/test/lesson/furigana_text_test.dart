import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:japanese_learning_client/data/lookup_repository.dart';
import 'package:japanese_learning_client/l10n/app_localizations.dart';
import 'package:japanese_learning_client/presentation/lesson/furigana_text.dart';
import 'package:japanese_learning_client/presentation/lesson/passage_panel.dart';

// Popup furigana của bài luyện đọc: bấm vào cụm Hán tự mở popup nhỏ hiện furigana + nghĩa, thay cho dòng
// cách đọc hiragana dưới đoạn văn.

Widget _host(Widget child) => MaterialApp(
  localizationsDelegates: AppLocalizations.localizationsDelegates,
  supportedLocales: AppLocalizations.supportedLocales,
  locale: const Locale('vi'),
  home: Scaffold(body: Center(child: child)),
);

const LookupResult _result = LookupResult(
  words: <LookupWord>[
    LookupWord(term: '来週', reading: 'らいしゅう', meaning: 'tuần sau'),
  ],
  kanji: <LookupKanji>[
    LookupKanji(
      char: '来',
      meaning: 'đến',
      onReadings: <String>['ライ'],
      kunReadings: <String>['く.る'],
    ),
    LookupKanji(
      char: '週',
      meaning: 'tuần',
      onReadings: <String>['シュウ'],
      kunReadings: <String>[],
    ),
  ],
);

void main() {
  testWidgets(
    'bấm cụm Hán tự → popup hiện furigana, nghĩa từ và từng chữ Kanji',
    (tester) async {
      final calls = <List<String>>[];
      await tester.pumpWidget(
        _host(
          FuriganaText(
            japanese: '来週',
            reading: 'らいしゅう',
            style: const TextStyle(fontSize: 24),
            lookup: (terms) async {
              calls.add(terms);
              return _result;
            },
          ),
        ),
      );
      expect(find.byKey(const Key('furigana-popup')), findsNothing);

      await tester.tap(find.byType(FuriganaText));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('furigana-popup')), findsOneWidget);
      expect(
        tester.widget<Text>(find.byKey(const Key('furigana-reading'))).data,
        'らいしゅう',
      );
      expect(
        tester.widget<Text>(find.byKey(const Key('furigana-word'))).data,
        '来週',
      );
      expect(find.text('tuần sau'), findsOneWidget);
      expect(find.byKey(const Key('furigana-kanji-来')), findsOneWidget);
      expect(find.byKey(const Key('furigana-kanji-週')), findsOneWidget);
      expect(find.textContaining('Âm On ライ'), findsOneWidget);
      expect(find.textContaining('Âm Kun く(る)'), findsOneWidget);
      expect(calls, <List<String>>[
        <String>['来週'],
      ]);

      // Bấm ra ngoài (nền mờ) → đóng popup.
      await tester.tapAt(const Offset(5, 5));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('furigana-popup')), findsNothing);
    },
  );

  testWidgets('bấm lại cùng cụm dùng kết quả đã tra, không gọi mạng lần nữa', (
    tester,
  ) async {
    var calls = 0;
    await tester.pumpWidget(
      _host(
        FuriganaText(
          japanese: '来週',
          reading: 'らいしゅう',
          style: const TextStyle(fontSize: 24),
          lookup: (terms) async {
            calls++;
            return _result;
          },
        ),
      ),
    );
    for (var i = 0; i < 2; i++) {
      await tester.tap(find.byType(FuriganaText));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('furigana-close')));
      await tester.pumpAndSettle();
    }
    expect(calls, 1);
  });

  testWidgets(
    'không tra được → báo lỗi trong popup, vẫn hiện furigana từ cách đọc cả đoạn',
    (tester) async {
      await tester.pumpWidget(
        _host(
          FuriganaText(
            japanese: '来週',
            reading: 'らいしゅう',
            style: const TextStyle(fontSize: 24),
            lookup: (terms) async => throw Exception('offline'),
          ),
        ),
      );
      await tester.tap(find.byType(FuriganaText));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('furigana-error')), findsOneWidget);
      expect(
        tester.widget<Text>(find.byKey(const Key('furigana-reading'))).data,
        'らいしゅう',
      );
    },
  );

  testWidgets('cụm không có trong thư viện → thông báo chưa có nghĩa', (
    tester,
  ) async {
    await tester.pumpWidget(
      _host(
        FuriganaText(
          japanese: '来週',
          style: const TextStyle(fontSize: 24),
          lookup: (terms) async =>
              const LookupResult(words: <LookupWord>[], kanji: <LookupKanji>[]),
        ),
      ),
    );
    await tester.tap(find.byType(FuriganaText));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('furigana-no-meaning')), findsOneWidget);
    expect(find.byKey(const Key('furigana-reading')), findsNothing);
  });

  testWidgets('không có lookup → văn bản thường, không bấm được', (
    tester,
  ) async {
    await tester.pumpWidget(_host(const FuriganaText(japanese: '来週')));
    await tester.tap(find.byType(FuriganaText));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('furigana-popup')), findsNothing);
  });

  testWidgets('PassagePanel có lookup hiện gợi ý chạm vào chữ Hán', (
    tester,
  ) async {
    await tester.pumpWidget(
      _host(
        PassagePanel(
          japanese: '来週',
          reading: 'らいしゅう',
          translation: '',
          lookup: (terms) async => _result,
        ),
      ),
    );
    expect(
      find.text('Chạm vào chữ Hán để xem cách đọc và nghĩa'),
      findsOneWidget,
    );
    await tester.tapAt(
      tester.getTopLeft(find.byKey(const Key('passage-text'))) + const Offset(10, 10),
    );
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('furigana-popup')), findsOneWidget);
  });
}
