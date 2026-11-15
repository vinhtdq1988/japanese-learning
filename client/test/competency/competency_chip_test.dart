import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:japanese_api/japanese_api.dart';
import 'package:japanese_learning_client/l10n/app_localizations.dart';
import 'package:japanese_learning_client/presentation/competency/competency_chip.dart';
import 'package:japanese_learning_client/presentation/shared/theme.dart';

// Chip năng lực (spec 007, T109, FR-016, FR-019): mỗi mức có biểu tượng + nhãn chữ + Semantics bằng lời;
// màu không phải kênh thông tin duy nhất.

Widget _host(Widget child, {String locale = 'vi'}) => MaterialApp(
  theme: buildAppTheme(),
  localizationsDelegates: AppLocalizations.localizationsDelegates,
  supportedLocales: AppLocalizations.supportedLocales,
  locale: Locale(locale),
  home: Scaffold(body: Center(child: child)),
);

void main() {
  final cases = <CompetencyLevel, (IconData, String)>{
    CompetencyLevel.good: (Icons.check_circle, 'Tốt'),
    CompetencyLevel.needsImprovement: (Icons.trending_up, 'Cần cải thiện'),
    CompetencyLevel.insufficient: (Icons.hourglass_empty, 'Chưa đủ dữ liệu'),
  };

  for (final entry in cases.entries) {
    testWidgets('${entry.key.value}: biểu tượng + nhãn chữ', (tester) async {
      await tester.pumpWidget(
        _host(CompetencyChip(level: entry.key, label: 'Từ vựng')),
      );
      expect(find.byIcon(entry.value.$1), findsOneWidget);
      expect(find.text(entry.value.$2), findsOneWidget);
    });

    testWidgets('${entry.key.value}: Semantics nêu mức bằng lời', (
      tester,
    ) async {
      final handle = tester.ensureSemantics();
      await tester.pumpWidget(
        _host(CompetencyChip(level: entry.key, label: 'Từ vựng')),
      );
      expect(
        find.bySemanticsLabel('Từ vựng: ${entry.value.$2}'),
        findsOneWidget,
      );
      handle.dispose();
    });
  }

  testWidgets('bản tiếng Anh dùng nhãn en', (tester) async {
    await tester.pumpWidget(
      _host(
        const CompetencyChip(level: CompetencyLevel.good, label: 'Vocabulary'),
        locale: 'en',
      ),
    );
    expect(find.text('Strong'), findsOneWidget);
  });

  testWidgets('level == null (máy chủ cũ) không hiển thị gì', (tester) async {
    await tester.pumpWidget(
      _host(const CompetencyChip(level: null, label: 'Từ vựng')),
    );
    expect(find.byType(Icon), findsNothing);
    expect(find.byType(Text), findsNothing);
  });

  testWidgets('hai mức khác nhau khác cả biểu tượng lẫn chữ, không chỉ màu', (
    tester,
  ) async {
    await tester.pumpWidget(
      _host(
        const Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            CompetencyChip(level: CompetencyLevel.good, label: 'A'),
            CompetencyChip(level: CompetencyLevel.needsImprovement, label: 'B'),
          ],
        ),
      ),
    );
    expect(find.byIcon(Icons.check_circle), findsOneWidget);
    expect(find.byIcon(Icons.trending_up), findsOneWidget);
    expect(find.text('Tốt'), findsOneWidget);
    expect(find.text('Cần cải thiện'), findsOneWidget);
  });
}
