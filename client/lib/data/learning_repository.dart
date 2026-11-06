import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:japanese_api/japanese_api.dart';

import 'api_providers.dart';

/// Truy cập lộ trình và kế hoạch hôm nay (T055).
class LearningRepository {
  LearningRepository(this._api);

  final JapaneseApi _api;

  /// Kế hoạch của ngày địa phương hiện tại (server sinh một lần rồi lưu).
  Future<DailyPlan> today() {
    return guardApi(() async => (await _api.getDailyApi().getToday()).data!);
  }

  /// Lộ trình hiện tại; thứ tự đơn vị do server tính động.
  Future<PathDetail> path() {
    return guardApi(() async => (await _api.getPathApi().getPath()).data!);
  }

  /// Đánh dấu / bỏ đánh dấu một chữ Kanji đã thành thạo (dừng / tiếp tục ôn mọi khía cạnh của chữ).
  /// Trả trạng thái `mastered` server đã lưu.
  Future<bool> setItemMastered(String itemId, {required bool mastered}) {
    return guardApi(() async {
      final response = await _api.getPathApi().setItemMastered(
        itemId: itemId,
        setUnitMasteredRequest: SetUnitMasteredRequest(mastered: mastered),
      );
      return response.data!.mastered;
    });
  }

  /// Xây dựng lại lộ trình theo kết quả kiểm tra trình độ mới (lịch sử học và lịch ôn giữ nguyên).
  Future<PathSummary> rebuildWithPlacement(String placementResultId) {
    return guardApi(() async {
      final response = await _api.getPathApi().rebuildPath(
        rebuildPathRequest: RebuildPathRequest(
          usePlacementResultId: placementResultId,
        ),
      );
      return response.data!;
    });
  }
}

final learningRepositoryProvider = Provider<LearningRepository>((ref) {
  return LearningRepository(ref.watch(japaneseApiProvider));
});

/// Kế hoạch hôm nay; tự hủy khi rời màn hình để lần mở sau luôn lấy bản mới.
final todayProvider = FutureProvider.autoDispose<DailyPlan>((ref) {
  return ref.watch(learningRepositoryProvider).today();
});

/// Lộ trình hiện tại.
final pathProvider = FutureProvider.autoDispose<PathDetail>((ref) {
  return ref.watch(learningRepositoryProvider).path();
});
