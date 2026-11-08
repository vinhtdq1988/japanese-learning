import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:japanese_api/japanese_api.dart';
import 'package:japanese_learning_client/l10n/app_localizations.dart';
import 'package:japanese_learning_client/platform/sound_player.dart';
import 'package:japanese_learning_client/presentation/effects/celebration_host.dart';
import 'package:japanese_learning_client/presentation/effects/effect_specs.dart';
import 'package:japanese_learning_client/presentation/effects/effects_controller.dart';

import '../support/fake_backend.dart';

// CelebrationHost (spec 005, US2): màn chúc mừng gộp không chặn — thứ tự thẻ, đóng bằng chạm/đổi tuyến/✕/tự
// đóng, trợ năng, âm thanh theo thẻ, ba chế độ hiển thị, không lưu hàng đợi và không che nút chính (FR-026).

/// Controller với tùy chọn cố định để chọn chế độ hiển thị/âm thanh mà không cần server.
class _FixedEffects extends EffectsController {
  _FixedEffects(this.fixed);

  final EffectsSettings fixed;

  @override
  EffectsSettings build() => fixed;
}

AchievementEarned _achievement(String code, String name) => AchievementEarned(
  code: code,
  kind: AchievementKind.streak,
  threshold: 7,
  name: name,
  description: 'Mô tả $name',
);

Celebrations _batch({
  bool day = false,
  List<AchievementEarned> achievements = const <AchievementEarned>[],
}) => Celebrations(dayCompleted: day, achievements: achievements);

class _Harness {
  _Harness(this.tester, this.env, this.container, this.routeChanges);

  final WidgetTester tester;
  final TestEnv env;
  final ProviderContainer container;
  final ValueNotifier<int> routeChanges;
  String location = '/lesson';
  int underlyingTaps = 0;

  EffectsController get effects =>
      container.read(effectsControllerProvider.notifier);
  List<SoundCue> get played => env.soundPlayer.played;
  bool get overlayShown =>
      find.byKey(const Key('celebration-overlay')).evaluate().isNotEmpty;

  Future<void> emit(Celebrations c) async {
    effects.onCelebrations(c);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 1));
  }

  Future<void> advance(Duration d) async {
    await tester.pump(d);
    await tester.pump(const Duration(milliseconds: 1));
  }
}

Future<_Harness> _pump(
  WidgetTester tester, {
  EffectsSettings settings = const EffectsSettings(),
  bool disableAnimations = false,
  Size size = const Size(1280, 1000),
}) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
  final env = TestEnv();
  final routeChanges = ValueNotifier<int>(0);
  late _Harness harness;
  final container = ProviderContainer(
    overrides: <Override>[
      ...env.overrides,
      effectsControllerProvider.overrideWith(() => _FixedEffects(settings)),
    ],
  );
  addTearDown(container.dispose);
  harness = _Harness(tester, env, container, routeChanges);
  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: MaterialApp(
        locale: const Locale('vi'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(
            context,
          ).copyWith(disableAnimations: disableAnimations),
          child: CelebrationHost(
            routeChanges: routeChanges,
            currentLocation: () => harness.location,
            child: child!,
          ),
        ),
        home: Scaffold(
          body: Center(
            child: ElevatedButton(
              key: const Key('underlying'),
              onPressed: () => harness.underlyingTaps++,
              child: const Text('Tiếp tục'),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.pump();
  return harness;
}

void main() {
  testWidgets(
    'thứ tự thẻ: hoàn thành ngày trước, rồi từng thành tựu; một màn gộp, tự đóng 3,5 s mỗi thẻ',
    (tester) async {
      final h = await _pump(tester);
      await h.emit(
        _batch(
          day: true,
          achievements: <AchievementEarned>[
            _achievement('streak_7', 'Chuỗi 7 ngày'),
            _achievement('items_50', 'Đã học 50 mục'),
          ],
        ),
      );

      expect(find.text('Hoàn thành ngày học!'), findsOneWidget);
      expect(find.text('Chuỗi 7 ngày'), findsNothing);
      expect(find.byKey(const Key('celebration-overlay')), findsOneWidget);

      await h.advance(celebrationCardDuration);
      expect(find.text('Hoàn thành ngày học!'), findsNothing);
      expect(find.text('Chuỗi 7 ngày'), findsOneWidget);
      expect(find.byKey(const Key('celebration-overlay')), findsOneWidget);

      await h.advance(celebrationCardDuration);
      expect(find.text('Đã học 50 mục'), findsOneWidget);

      await h.advance(celebrationCardDuration);
      expect(h.overlayShown, isFalse);

      // Mỗi thẻ đúng một cue: ngày → dayComplete, thành tựu → achievement.
      await tester.pump();
      expect(h.played, <SoundCue>[
        SoundCue.dayComplete,
        SoundCue.achievement,
        SoundCue.achievement,
      ]);
    },
  );

  testWidgets(
    'không ModalBarrier: chạm nút bên dưới vừa đóng màn gộp vừa kích hoạt nút',
    (tester) async {
      final h = await _pump(tester);
      await h.emit(
        _batch(achievements: <AchievementEarned>[_achievement('a', 'A')]),
      );
      expect(h.overlayShown, isTrue);
      expect(
        find.descendant(
          of: find.byKey(const Key('celebration-overlay')),
          matching: find.byType(ModalBarrier),
        ),
        findsNothing,
      );

      await tester.tap(find.byKey(const Key('underlying')));
      await tester.pump();
      expect(h.underlyingTaps, 1, reason: 'sự kiện vẫn tới nút bên dưới');
      expect(
        h.overlayShown,
        isFalse,
        reason: 'PointerDown đóng toàn bộ màn gộp',
      );
    },
  );

  testWidgets(
    'đổi tuyến đóng toàn bộ màn gộp; thông báo mà tuyến không đổi thì không đóng',
    (tester) async {
      final h = await _pump(tester);
      await h.emit(
        _batch(
          day: true,
          achievements: <AchievementEarned>[_achievement('a', 'A')],
        ),
      );

      h.routeChanges.value++;
      await tester.pump();
      expect(h.overlayShown, isTrue, reason: 'cùng vị trí thì giữ nguyên');

      h.location = '/today';
      h.routeChanges.value++;
      await tester.pump();
      expect(h.overlayShown, isFalse);
    },
  );

  testWidgets('nút ✕ có nhãn trợ năng và đóng toàn bộ màn gộp', (tester) async {
    final semantics = tester.ensureSemantics();
    final h = await _pump(tester);
    await h.emit(
      _batch(achievements: <AchievementEarned>[_achievement('a', 'A')]),
    );

    final close = find.byKey(const Key('celebration-close'));
    expect(
      tester.getSemantics(close),
      matchesSemantics(
        label: 'Đóng lời chúc mừng',
        isButton: true,
        hasTapAction: true,
        hasFocusAction: true,
        isFocusable: true,
      ),
    );
    await tester.tap(close);
    await tester.pump();
    expect(h.overlayShown, isFalse);
    semantics.dispose();
  });

  testWidgets(
    'thẻ là vùng trực tiếp (liveRegion) và KHÔNG cướp tiêu điểm bàn phím',
    (tester) async {
      final semantics = tester.ensureSemantics();
      final h = await _pump(tester);
      final focusBefore = FocusManager.instance.primaryFocus;

      await h.emit(
        _batch(
          achievements: <AchievementEarned>[
            _achievement('streak_7', 'Chuỗi 7 ngày'),
          ],
        ),
      );
      final node = tester.getSemantics(
        find.bySemanticsLabel(RegExp('Chuỗi 7 ngày')),
      );
      // ignore: deprecated_member_use
      expect(node.hasFlag(SemanticsFlag.isLiveRegion), isTrue);
      expect(FocusManager.instance.primaryFocus, focusBefore);
      semantics.dispose();
    },
  );

  testWidgets('âm thanh tắt: không phát cue nào nhưng thẻ vẫn hiện', (
    tester,
  ) async {
    final h = await _pump(
      tester,
      settings: const EffectsSettings(soundEnabled: false),
    );
    await h.emit(
      _batch(
        day: true,
        achievements: <AchievementEarned>[_achievement('a', 'A')],
      ),
    );
    await h.advance(celebrationCardDuration);
    expect(find.text('A'), findsOneWidget);
    expect(h.played, isEmpty);
  });

  group('chế độ hiển thị', () {
    testWidgets('full: confetti ≤ 40 hạt', (tester) async {
      final h = await _pump(tester);
      await h.emit(
        _batch(achievements: <AchievementEarned>[_achievement('a', 'A')]),
      );
      expect(find.byKey(const Key('celebration-confetti')), findsOneWidget);
      expect(find.byKey(const Key('celebration-card-full')), findsOneWidget);
      expect(maxConfettiParticles, lessThanOrEqualTo(40));
      await h.advance(celebrationCardDuration);
    });

    testWidgets('reduced (giảm chuyển động): không confetti, chỉ mờ vào/ra', (
      tester,
    ) async {
      final h = await _pump(tester, disableAnimations: true);
      await h.emit(
        _batch(achievements: <AchievementEarned>[_achievement('a', 'A')]),
      );
      expect(find.byKey(const Key('celebration-confetti')), findsNothing);
      expect(find.byKey(const Key('celebration-card-reduced')), findsOneWidget);
      expect(find.text('A'), findsOneWidget);
      await h.advance(celebrationCardDuration);
    });

    testWidgets(
      'off (tắt hiệu ứng hình ảnh): một dòng thông báo tĩnh, tự biến và đóng được',
      (tester) async {
        final h = await _pump(
          tester,
          settings: const EffectsSettings(visualEnabled: false),
        );
        await h.emit(
          _batch(
            achievements: <AchievementEarned>[
              _achievement('streak_7', 'Chuỗi 7 ngày'),
            ],
          ),
        );
        expect(find.byKey(const Key('celebration-confetti')), findsNothing);
        expect(find.byKey(const Key('celebration-card-off')), findsOneWidget);
        expect(find.text('Thành tựu mới: Chuỗi 7 ngày'), findsOneWidget);

        await h.advance(staticNoticeDuration);
        expect(h.overlayShown, isFalse);
      },
    );
  });

  testWidgets(
    'không lưu hàng đợi: lô phát khi chưa có màn nào lắng nghe bị bỏ, không chúc mừng bù',
    (tester) async {
      final env = TestEnv();
      final container = ProviderContainer(
        overrides: <Override>[
          ...env.overrides,
          effectsControllerProvider.overrideWith(
            () => _FixedEffects(const EffectsSettings()),
          ),
        ],
      );
      addTearDown(container.dispose);
      container
          .read(effectsControllerProvider.notifier)
          .onCelebrations(_batch(day: true));

      tester.view.physicalSize = const Size(1280, 1000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: MaterialApp(
            locale: const Locale('vi'),
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            builder: (context, child) => CelebrationHost(child: child!),
            home: const Scaffold(body: SizedBox()),
          ),
        ),
      );
      await tester.pump();

      expect(find.byKey(const Key('celebration-overlay')), findsNothing);
      expect(env.localStore.snapshot, isEmpty, reason: 'không ghi LocalStore');
    },
  );

  testWidgets(
    'màn hẹp 320 px: thẻ không tràn ngang và nút "Tiếp tục" vẫn bấm được',
    (tester) async {
      final h = await _pump(tester, size: const Size(320, 640));
      await h.emit(
        _batch(
          day: true,
          achievements: <AchievementEarned>[
            _achievement('streak_7', 'Chuỗi 7 ngày rất dài để thử xuống dòng'),
          ],
        ),
      );

      expect(tester.takeException(), isNull);
      final card = tester.getRect(
        find.byKey(const Key('celebration-card-full')),
      );
      expect(card.left, greaterThanOrEqualTo(0));
      expect(card.right, lessThanOrEqualTo(320));
      final button = tester.getRect(find.byKey(const Key('underlying')));
      expect(
        card.overlaps(button),
        isFalse,
        reason: 'không che nút thao tác chính',
      );
    },
  );
}
