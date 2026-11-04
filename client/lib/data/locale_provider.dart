import 'dart:ui';

import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Ngôn ngữ giao diện hiện tại (mặc định tiếng Việt, FR-019a). Đổi ngôn ngữ trong Hồ sơ (T113)
/// gọi [LocaleController.setLanguage] để áp dụng ngay.
class LocaleController extends Notifier<Locale> {
  static const List<String> supportedLanguageCodes = <String>['vi', 'en'];

  @override
  Locale build() => const Locale('vi');

  /// Đặt ngôn ngữ theo mã (`vi`/`en`); mã lạ bị bỏ qua.
  void setLanguage(String code) {
    if (supportedLanguageCodes.contains(code)) state = Locale(code);
  }
}

final localeProvider = NotifierProvider<LocaleController, Locale>(
  LocaleController.new,
);
