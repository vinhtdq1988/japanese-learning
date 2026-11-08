import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'file_transfer.dart';
import 'platform.dart';

// Provider cho các giao diện nền tảng. Không có triển khai mặc định: `main.dart` ghi đè bằng
// triển khai web, kiểm thử ghi đè bằng triển khai trong bộ nhớ (`memory_platform.dart`).

UnimplementedError _missing(String name) => UnimplementedError(
  'Chưa cấu hình $name: hãy override trong ProviderScope.',
);

final tokenStoreProvider = Provider<TokenStore>(
  (ref) => throw _missing('TokenStore'),
);
final localStoreProvider = Provider<LocalStore>(
  (ref) => throw _missing('LocalStore'),
);
final timezoneProvider = Provider<Timezone>(
  (ref) => throw _missing('Timezone'),
);
final linksProvider = Provider<Links>((ref) => throw _missing('Links'));
final fileTransferProvider = Provider<FileTransfer>(
  (ref) => throw _missing('FileTransfer'),
);
