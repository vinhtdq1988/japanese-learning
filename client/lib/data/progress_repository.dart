import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:japanese_api/japanese_api.dart';

import 'api_providers.dart';

/// Truy cập tóm tắt tiến độ (T087, FR-026 → FR-029). Server tính từ dữ liệu đã ghi nên client chỉ hiển thị.
class ProgressRepository {
  ProgressRepository(this._api);

  final JapaneseApi _api;

  Future<ProgressSummary> progress() {
    return guardApi(
      () async => (await _api.getProgressApi().getProgress()).data!,
    );
  }
}

final progressRepositoryProvider = Provider<ProgressRepository>((ref) {
  return ProgressRepository(ref.watch(japaneseApiProvider));
});

/// Tóm tắt tiến độ; tự hủy khi rời màn hình để lần mở sau luôn lấy số liệu mới.
final progressProvider = FutureProvider.autoDispose<ProgressSummary>((ref) {
  return ref.watch(progressRepositoryProvider).progress();
});
