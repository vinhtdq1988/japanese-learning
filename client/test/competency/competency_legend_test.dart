import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:japanese_learning_client/l10n/app_localizations.dart';
import 'package:japanese_learning_client/presentation/competency/competency_legend.dart';
import 'package:japanese_learning_client/presentation/shared/theme.dart';

// Chú giải năng lực (spec 007, T110, FR-020): đủ ba mức (biểu tượng + nhãn như chip), màn hẹp xuống dòng, không tràn.

Widget _host({double width = 800}) => MaterialApp(
  theme: buildAppTheme(),
  localizationsDelegates: AppLocalizations.localizationsDelegates,
  supportedLocales: AppLocalizations.supportedLocales,
  locale: const Locale('vi'),
  home: Scaffold(
    body: Align(
      alignment: Alignment.topLeft,
      child: SizedBox(width: width, child: const CompetencyLegend()),
    ),
  ),
);

void main() {
  testWidgets('có tiêu đề và đủ ba mức với biểu tượng + nhãn', (tester) async {
    await tester.pumpWidget(_host());
    expect(find.text('Mức năng lực'), findsOneWidget);
    final expected = <(IconData, String)>[
      (Icons.check_circle, 'Tốt'),
      (Icons.trending_up, 'Cần cải thiện'),
      (Icons.hourglass_empty, 'Chưa đủ dữ liệu'),
    ];
    for (final entry in expected) {
      expect(find.byIcon(entry.$1), findsOneWidget);
      expect(find.text(entry.$2), findsOneWidget);
    }
  });

  testWidgets('màn hẹp (≤ 480 px) xuống dòng bằng Wrap, không tràn', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(_host(width: 320));
    expect(find.byType(Wrap), findsOneWidget);
    expect(tester.takeException(), isNull);
    // Khi chiều rộng không đủ chứa cả ba mục trên một hàng thì chúng xuống dòng.
    await tester.pumpWidget(_host(width: 160));
    final ys = <double>{
      for (final level in <String>['good', 'needs_improvement', 'insufficient'])
        tester.getTopLeft(find.byKey(Key('competency-legend-$level'))).dy,
    };
    expect(ys.length, greaterThan(1));
    expect(tester.takeException(), isNull);
  });
}
