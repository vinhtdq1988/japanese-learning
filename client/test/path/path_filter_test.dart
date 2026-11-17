import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import '../support/fake_backend.dart';
import '../support/learning_scenario.dart';

// Màn Lộ trình ở thư viện lớn (spec 008, T227, FR-019 ngoài lề, SC-007): danh sách dựng lười, phân trang bằng
// `limit`/`offset`, lọc theo loại và trình độ gửi `kind`/`level` cho `GET /path`.

const int _total = 120;

/// 120 đơn vị: chẵn = từ vựng, lẻ = ngữ pháp; 60 đầu N4, 60 sau N3.
List<Map<String, Object?>> _library() => List<Map<String, Object?>>.generate(
  _total,
  (i) => <String, Object?>{
    'unitId': 'u$i',
    'title': 'Bài $i',
    'kind': i.isEven ? 'vocabulary' : 'grammar',
    'level': i < 60 ? 'N4' : 'N3',
    'estMinutes': 5,
    'status': 'pending',
  },
);

/// Máy chủ giả của `GET /path`: lọc rồi cắt `limit`/`offset` giống hợp đồng, trả `itemsTotal`.
void _installPath(FakeBackend backend) {
  final library = _library();
  backend.on('GET /path', (r) {
    final q = r.queryParameters;
    final items = library
        .where(
          (u) =>
              (q['kind'] == null || u['kind'] == q['kind'].toString()) &&
              (q['level'] == null || u['level'] == q['level'].toString()),
        )
        .toList();
    final offset = int.parse((q['offset'] ?? 0).toString());
    final limit = q['limit'] == null ? null : int.parse(q['limit'].toString());
    final page = items.skip(offset).take(limit ?? items.length).toList();
    return FakeResponse(200, <String, Object?>{
      'id': 'path-1',
      'totalUnits': _total,
      'completedUnits': 0,
      'startLevel': 'N4',
      'reason': 'onboarding',
      'scopeNotice': null,
      'notices': <String>[],
      'message': null,
      'source': 'personal',
      'itemsTotal': items.length,
      'items': page,
    });
  });
}

Future<TestEnv> _open(WidgetTester tester) async {
  TestEnv.useDesktopSize(tester);
  addTearDown(tester.view.reset);
  final env = TestEnv(tokens: signedInTokens());
  LearningScenario(env.backend).onboarded = true;
  _installPath(env.backend);
  await tester.pumpWidget(env.app());
  await tester.pumpAndSettle();
  GoRouter.of(tester.element(find.byType(Scaffold).first)).go('/path');
  await tester.pumpAndSettle();
  return env;
}

Map<String, dynamic> _lastQuery(TestEnv env) =>
    env.backend.sent('GET /path').last.queryParameters;

Future<void> _choose(
  WidgetTester tester, {
  required String dropdownKey,
  required String label,
}) async {
  await tester.tap(find.byKey(Key(dropdownKey)));
  await tester.pumpAndSettle();
  await tester.tap(find.text(label).last);
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('chỉ lấy trang đầu (limit) và dựng lười: không dựng cả 50 thẻ ngay', (
    tester,
  ) async {
    final env = await _open(tester);
    final first = env.backend.sent('GET /path').first.queryParameters;
    expect(first['limit'].toString(), '50');
    expect(first.containsKey('kind'), isFalse);
    expect(first.containsKey('level'), isFalse);

    // Thẻ đầu có mặt; thẻ cuối của trang đầu chưa được dựng vì nằm ngoài vùng nhìn thấy.
    expect(find.byKey(const Key('unit-u0')), findsOneWidget);
    expect(find.byKey(const Key('unit-u49')), findsNothing);
    expect(find.byType(ListTile).evaluate().length, lessThan(25));

    // Tiến độ vẫn là của TOÀN BỘ lộ trình (totalUnits), không phải của trang đã nạp.
    expect(find.text('Đã xong 0/$_total đơn vị'), findsOneWidget);
  });

  testWidgets('cuộn gần cuối thì tự nạp trang kế bằng offset', (tester) async {
    final env = await _open(tester);
    for (var i = 0; i < 12; i++) {
      final offsets = env.backend
          .sent('GET /path')
          .map((r) => r.queryParameters['offset'].toString());
      if (offsets.contains('50')) break;
      await tester.fling(
        find.byType(CustomScrollView),
        const Offset(0, -2500),
        4000,
      );
      await tester.pumpAndSettle();
    }
    final requests = env.backend.sent('GET /path');
    final second = requests.firstWhere(
      (r) => r.queryParameters['offset'].toString() == '50',
      orElse: () =>
          throw TestFailure('Không có yêu cầu nạp trang kế (offset=50)'),
    );
    expect(second.queryParameters['limit'].toString(), '50');
    expect(tester.takeException(), isNull);
  });

  testWidgets('lọc theo loại gửi kind và bắt đầu lại từ offset 0', (
    tester,
  ) async {
    final env = await _open(tester);
    await _choose(tester, dropdownKey: 'path-filter-kind', label: 'Ngữ pháp');

    final q = _lastQuery(env);
    expect(q['kind'].toString(), 'grammar');
    expect(q['offset'].toString(), '0');
    expect(q.containsKey('level'), isFalse);
    // Chỉ còn ngữ pháp (id lẻ); từ vựng (id chẵn) biến mất.
    expect(find.byKey(const Key('unit-u1')), findsOneWidget);
    expect(find.byKey(const Key('unit-u0')), findsNothing);
    // Tổng của toàn bộ lộ trình không đổi theo bộ lọc.
    expect(find.text('Đã xong 0/$_total đơn vị'), findsOneWidget);
  });

  testWidgets('lọc kết hợp loại + trình độ; bỏ lọc trả về danh sách đầy đủ', (
    tester,
  ) async {
    final env = await _open(tester);
    await _choose(tester, dropdownKey: 'path-filter-kind', label: 'Ngữ pháp');
    await _choose(tester, dropdownKey: 'path-filter-level', label: 'N3');

    final q = _lastQuery(env);
    expect(q['kind'].toString(), 'grammar');
    expect(q['level'].toString(), 'N3');
    // Ngữ pháp N3 đầu tiên là u61 (lẻ, ≥ 60).
    expect(find.byKey(const Key('unit-u61')), findsOneWidget);
    expect(find.byKey(const Key('unit-u1')), findsNothing);

    await _choose(tester, dropdownKey: 'path-filter-kind', label: 'Tất cả');
    await _choose(tester, dropdownKey: 'path-filter-level', label: 'Tất cả');
    final cleared = _lastQuery(env);
    expect(cleared.containsKey('kind'), isFalse);
    expect(cleared.containsKey('level'), isFalse);
    expect(find.byKey(const Key('unit-u0')), findsOneWidget);
  });

  testWidgets(
    'máy chủ không trả itemsTotal (cũ): không có nút/nạp thêm, danh sách đủ',
    (tester) async {
      TestEnv.useDesktopSize(tester);
      addTearDown(tester.view.reset);
      final env = TestEnv(tokens: signedInTokens());
      final scenario = LearningScenario(env.backend)..onboarded = true;
      await tester.pumpWidget(env.app());
      await tester.pumpAndSettle();
      GoRouter.of(tester.element(find.byType(Scaffold).first)).go('/path');
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('unit-u1')), findsOneWidget);
      expect(find.byKey(const Key('path-load-more')), findsNothing);
      // Không có yêu cầu nạp trang kế (offset = 50) vì không biết còn đơn vị nào.
      expect(
        env.backend
            .sent('GET /path')
            .any((r) => r.queryParameters['offset'].toString() == '50'),
        isFalse,
      );
      expect(scenario.pathDetail['items'], isNotEmpty);
    },
  );
}
