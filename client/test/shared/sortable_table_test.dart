import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:japanese_learning_client/l10n/app_localizations.dart';
import 'package:japanese_learning_client/presentation/shared/sortable_table.dart';

// Bảng có sắp xếp/lọc dùng chung (spec 004, T076): bấm tiêu đề cột đảo chiều sắp xếp, chip lọc giữ đúng dòng,
// bảng rỗng hiện thông báo.

class _Row {
  const _Row(this.name, this.score);

  final String name;
  final int score;
}

Future<void> _pump(WidgetTester tester, List<_Row> rows) async {
  await tester.pumpWidget(
    ProviderScope(
      child: MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        locale: const Locale('vi'),
        home: Scaffold(
          body: SortableTable<_Row>(
            rows: rows,
            initialSortId: 'name',
            columns: <SortableColumn<_Row>>[
              SortableColumn<_Row>(
                id: 'name',
                label: 'Tên',
                compare: (a, b) => a.name.compareTo(b.name),
                cell: (_, r) => Text(r.name),
              ),
              SortableColumn<_Row>(
                id: 'score',
                label: 'Điểm',
                numeric: true,
                compare: (a, b) => a.score.compareTo(b.score),
                cell: (_, r) => Text('${r.score}'),
              ),
            ],
            filters: <TableFilter<_Row>>[
              TableFilter<_Row>(
                id: 'high',
                label: 'Cao',
                test: (r) => r.score >= 50,
              ),
            ],
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

List<String> _names(WidgetTester tester) => tester
    .widgetList<Text>(find.byType(Text))
    .map((t) => t.data ?? '')
    .where(<String>['An', 'Bình', 'Chi'].contains)
    .toList();

void main() {
  const rows = <_Row>[_Row('Chi', 30), _Row('An', 80), _Row('Bình', 55)];

  testWidgets('sắp xếp ban đầu theo cột chỉ định, bấm lại đảo chiều', (
    tester,
  ) async {
    await _pump(tester, rows);
    expect(_names(tester), <String>['An', 'Bình', 'Chi']);
    await tester.tap(find.byKey(const Key('col-name')));
    await tester.pumpAndSettle();
    expect(_names(tester), <String>['Chi', 'Bình', 'An']);
  });

  testWidgets('sắp xếp theo cột số', (tester) async {
    await _pump(tester, rows);
    await tester.tap(find.byKey(const Key('col-score')));
    await tester.pumpAndSettle();
    expect(_names(tester), <String>['Chi', 'Bình', 'An']);
    await tester.tap(find.byKey(const Key('col-score')));
    await tester.pumpAndSettle();
    expect(_names(tester), <String>['An', 'Bình', 'Chi']);
  });

  testWidgets('chip lọc giữ đúng dòng và "Tất cả" bỏ lọc', (tester) async {
    await _pump(tester, rows);
    await tester.tap(find.byKey(const Key('filter-high')));
    await tester.pumpAndSettle();
    expect(_names(tester), <String>['An', 'Bình']);
    await tester.tap(find.byKey(const Key('filter-all')));
    await tester.pumpAndSettle();
    expect(_names(tester), hasLength(3));
  });

  testWidgets('không còn dòng nào ⇒ hiện thông báo trống', (tester) async {
    await _pump(tester, const <_Row>[]);
    expect(find.byKey(const Key('table-empty')), findsOneWidget);
  });
}
