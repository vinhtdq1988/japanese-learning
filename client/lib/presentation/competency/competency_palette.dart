import 'dart:math' as math;

import 'package:flutter/material.dart';

/// Màu một mức năng lực: nền, chữ/biểu tượng và viền.
@immutable
class CompetencyColors {
  const CompetencyColors({
    required this.background,
    required this.foreground,
    required this.border,
  });

  final Color background;
  final Color foreground;
  final Color border;

  static CompetencyColors lerp(
    CompetencyColors a,
    CompetencyColors b,
    double t,
  ) {
    return CompetencyColors(
      background: Color.lerp(a.background, b.background, t)!,
      foreground: Color.lerp(a.foreground, b.foreground, t)!,
      border: Color.lerp(a.border, b.border, t)!,
    );
  }
}

/// Token màu của ba mức năng lực (spec 007, FR-019; contracts/competency-rules.md §3), có bản sáng và tối.
/// Màu chỉ là kênh bổ trợ: chip luôn kèm biểu tượng và nhãn chữ. Cặp chữ/nền của mọi mức đạt tương phản
/// WCAG ≥ 4.5:1 ở cả hai giao diện (kiểm bằng `contrastRatio` ở `competency_palette_test.dart`).
@immutable
class CompetencyPalette extends ThemeExtension<CompetencyPalette> {
  const CompetencyPalette({
    required this.good,
    required this.needsImprovement,
    required this.insufficient,
  });

  /// Xanh lục: năng lực tốt.
  final CompetencyColors good;

  /// Vàng nhạt: cần cải thiện.
  final CompetencyColors needsImprovement;

  /// Trung tính: chưa đủ dữ liệu.
  final CompetencyColors insufficient;

  /// Bản sáng; mức trung tính lấy theo bảng màu Material của giao diện.
  factory CompetencyPalette.light(ColorScheme scheme) => CompetencyPalette(
    good: const CompetencyColors(
      background: Color(0xFFE3F4E4),
      foreground: Color(0xFF1B5E20),
      border: Color(0xFF81C784),
    ),
    needsImprovement: const CompetencyColors(
      background: Color(0xFFFFF6CC),
      foreground: Color(0xFF5C4A00),
      border: Color(0xFFE6C84A),
    ),
    insufficient: CompetencyColors(
      background: scheme.surfaceContainer,
      foreground: scheme.onSurfaceVariant,
      border: scheme.outlineVariant,
    ),
  );

  /// Bản tối: nền sẫm cùng tông, chữ sáng để giữ tương phản ≥ 4.5:1.
  factory CompetencyPalette.dark(ColorScheme scheme) => CompetencyPalette(
    good: const CompetencyColors(
      background: Color(0xFF1E3A22),
      foreground: Color(0xFFA5D6A7),
      border: Color(0xFF4C8C50),
    ),
    needsImprovement: const CompetencyColors(
      background: Color(0xFF4A3F10),
      foreground: Color(0xFFFFE58A),
      border: Color(0xFFB39B2E),
    ),
    insufficient: CompetencyColors(
      background: scheme.surfaceContainer,
      foreground: scheme.onSurfaceVariant,
      border: scheme.outlineVariant,
    ),
  );

  /// Bảng màu của giao diện hiện tại; bản sáng/tối theo `ThemeData` khi chưa đăng ký tiện ích mở rộng.
  static CompetencyPalette of(BuildContext context) {
    final theme = Theme.of(context);
    return theme.extension<CompetencyPalette>() ??
        (theme.brightness == Brightness.dark
            ? CompetencyPalette.dark(theme.colorScheme)
            : CompetencyPalette.light(theme.colorScheme));
  }

  @override
  CompetencyPalette copyWith({
    CompetencyColors? good,
    CompetencyColors? needsImprovement,
    CompetencyColors? insufficient,
  }) {
    return CompetencyPalette(
      good: good ?? this.good,
      needsImprovement: needsImprovement ?? this.needsImprovement,
      insufficient: insufficient ?? this.insufficient,
    );
  }

  @override
  CompetencyPalette lerp(ThemeExtension<CompetencyPalette>? other, double t) {
    if (other is! CompetencyPalette) return this;
    return CompetencyPalette(
      good: CompetencyColors.lerp(good, other.good, t),
      needsImprovement: CompetencyColors.lerp(
        needsImprovement,
        other.needsImprovement,
        t,
      ),
      insufficient: CompetencyColors.lerp(insufficient, other.insufficient, t),
    );
  }
}

/// Tỷ lệ tương phản WCAG 2.x giữa hai màu (1..21); dùng cho kiểm thử trợ năng của bảng màu.
double contrastRatio(Color a, Color b) {
  final la = _relativeLuminance(a);
  final lb = _relativeLuminance(b);
  final lighter = math.max(la, lb);
  final darker = math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

double _relativeLuminance(Color color) {
  double channel(double v) =>
      v <= 0.03928 ? v / 12.92 : math.pow((v + 0.055) / 1.055, 2.4).toDouble();
  return 0.2126 * channel(color.r) +
      0.7152 * channel(color.g) +
      0.0722 * channel(color.b);
}
