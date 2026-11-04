import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';
import 'platform/platform_providers.dart';
import 'platform/web/web_platform.dart';

void main() {
  runApp(
    ProviderScope(
      // Nối triển khai nền tảng web vào các giao diện (Nguyên tắc V); mobile sau này thay ở đây.
      overrides: <Override>[
        tokenStoreProvider.overrideWithValue(WebTokenStore()),
        localStoreProvider.overrideWithValue(WebLocalStore()),
        timezoneProvider.overrideWithValue(WebTimezone()),
        linksProvider.overrideWithValue(WebLinks()),
      ],
      child: const JapaneseLearningApp(),
    ),
  );
}
