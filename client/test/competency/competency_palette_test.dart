import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:japanese_learning_client/presentation/competency/competency_palette.dart';
import 'package:japanese_learning_client/presentation/shared/theme.dart';

// Tương phản của bảng màu năng lực (spec 007, T108, FR-019): chữ/nền của mỗi mức đạt WCAG ≥ 4.5:1
// ở cả giao diện sáng và tối.

void main() {
  test('contrastRatio: đen/trắng = 21, cùng màu = 1', () {
    expect(
      contrastRatio(const Color(0xFF000000), const Color(0xFFFFFFFF)),
      closeTo(21, 0.01),
    );
    expect(
      contrastRatio(const Color(0xFF336699), const Color(0xFF336699)),
      closeTo(1, 0.0001),
    );
  });

  for (final brightness in Brightness.values) {
    group('giao diện ${brightness.name}', () {
      final palette = buildAppTheme(
        brightness: brightness,
      ).extension<CompetencyPalette>();

      test('theme đăng ký CompetencyPalette', () {
        expect(palette, isNotNull);
      });

      final levels = <String, CompetencyColors Function(CompetencyPalette)>{
        'good': (p) => p.good,
        'needs_improvement': (p) => p.needsImprovement,
        'insufficient': (p) => p.insufficient,
      };
      for (final entry in levels.entries) {
        test('${entry.key}: chữ/nền ≥ 4.5:1', () {
          final colors = entry.value(palette!);
          expect(
            contrastRatio(colors.foreground, colors.background),
            greaterThanOrEqualTo(4.5),
          );
        });
      }
    });
  }

  test('ba mức có nền khác nhau (không trộn thành một màu)', () {
    for (final brightness in Brightness.values) {
      final p = buildAppTheme(
        brightness: brightness,
      ).extension<CompetencyPalette>()!;
      expect(<Color>{
        p.good.background,
        p.needsImprovement.background,
        p.insufficient.background,
      }, hasLength(3));
    }
  });
}
