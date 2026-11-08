import 'package:flutter_test/flutter_test.dart';
import 'package:japanese_learning_client/presentation/effects/effect_mode.dart';

void main() {
  // Bảng 2×2 của resolveEffectMode (contracts/client-effects.md §3).
  const cases = <({bool visual, bool reduce, EffectMode expected})>[
    (visual: false, reduce: false, expected: EffectMode.off),
    (visual: false, reduce: true, expected: EffectMode.off),
    (visual: true, reduce: true, expected: EffectMode.reduced),
    (visual: true, reduce: false, expected: EffectMode.full),
  ];

  for (final c in cases) {
    test(
      'visualEnabled=${c.visual}, reduceMotion=${c.reduce} → ${c.expected.name}',
      () {
        expect(
          resolveEffectMode(visualEnabled: c.visual, reduceMotion: c.reduce),
          c.expected,
        );
      },
    );
  }
}
