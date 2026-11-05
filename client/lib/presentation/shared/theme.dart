import 'package:flutter/material.dart';

/// Chủ đề giao diện Material 3, tối ưu cho trình duyệt desktop (Giai đoạn 1).
ThemeData buildAppTheme({Brightness brightness = Brightness.light}) {
  final scheme = ColorScheme.fromSeed(
    seedColor: const Color(
      0xFFB7282E,
    ), // đỏ Nhật Bản (đỏ son), dùng làm màu nhấn
    brightness: brightness,
  );
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    visualDensity: VisualDensity.standard,
    // Chữ Nhật cần phông có glyph CJK. Flutter web (CanvasKit) không dùng phông hệ thống nên
    // 'Noto Sans JP' là phông đóng gói trong assets/fonts (khai báo ở pubspec.yaml); các phông còn lại
    // chỉ có tác dụng ở nền tảng gốc/trình kết xuất khác.
    fontFamilyFallback: const <String>[
      'Noto Sans JP',
      'Hiragino Sans',
      'Yu Gothic UI',
      'Meiryo',
      'sans-serif',
    ],
    appBarTheme: AppBarTheme(
      backgroundColor: scheme.surface,
      foregroundColor: scheme.onSurface,
      elevation: 0,
      scrolledUnderElevation: 1,
    ),
    inputDecorationTheme: const InputDecorationTheme(
      border: OutlineInputBorder(),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(minimumSize: const Size(0, 44)),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(minimumSize: const Size(0, 44)),
    ),
  );
}

/// Chiều rộng tối đa của vùng nội dung trên màn hình rộng.
const double kContentMaxWidth = 960;

/// Khoảng đệm tiêu chuẩn quanh nội dung trang.
const EdgeInsets kPagePadding = EdgeInsets.symmetric(
  horizontal: 24,
  vertical: 24,
);
