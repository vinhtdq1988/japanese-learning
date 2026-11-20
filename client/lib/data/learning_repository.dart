import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:japanese_api/japanese_api.dart';

import 'api_providers.dart';
import 'session_controller.dart';

/// Truy cập lộ trình và kế hoạch hôm nay (T055).
class LearningRepository {
  LearningRepository(this._api);

  final JapaneseApi _api;

  /// Kế hoạch của ngày địa phương hiện tại (server sinh một lần rồi lưu).
  Future<DailyPlan> today() {
    return guardApi(() async => (await _api.getDailyApi().getToday()).data!);
  }

  /// Lộ trình hiện tại; thứ tự đơn vị do server tính động. Thư viện N4–N3 có ≈ 600 đơn vị nên màn Lộ trình lấy
  /// từng trang bằng `limit`/`offset` và lọc theo `kind`/`level` (OpenAPI 1.15.0); không tham số = toàn bộ như cũ.
  Future<PathDetail> path({
    Skill? kind,
    ContentLevel? level,
    int? limit,
    int offset = 0,
  }) {
    return guardApi(
      () async => (await _api.getPathApi().getPath(
        kind: kind,
        level: level,
        limit: limit,
        offset: offset,
      )).data!,
    );
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

/// Kế hoạch của tài khoản hiện tại. Khi đổi tài khoản, bỏ kết quả yêu cầu của người cũ.
final todayProvider = FutureProvider.autoDispose<DailyPlan>((ref) {
  final userId = ref.watch(
    sessionProvider.select((state) => state.activeUserId),
  );
  if (userId == null) {
    throw StateError('Cần phiên đăng nhập để tải kế hoạch hôm nay.');
  }
  return ref.watch(learningRepositoryProvider).today();
});

/// Số đơn vị mỗi trang của danh sách lộ trình (≤ 500 theo hợp đồng).
const int pathPageSize = 50;

/// Bộ lọc danh sách lộ trình (null = tất cả).
typedef PathFilter = ({Skill? kind, ContentLevel? level});

/// Không lọc.
const PathFilter noPathFilter = (kind: null, level: null);

/// Lộ trình hiện tại (trang đầu, không lọc): dùng cho thông báo phạm vi, tiến độ tổng quát… — không cần toàn bộ
/// ≈ 600 đơn vị nên chỉ lấy một trang.
final pathProvider = FutureProvider.autoDispose<PathDetail>((ref) {
  final userId = ref.watch(
    sessionProvider.select((state) => state.activeUserId),
  );
  if (userId == null) {
    throw StateError('Cần phiên đăng nhập để tải lộ trình.');
  }
  return ref.watch(learningRepositoryProvider).path(limit: pathPageSize);
});

/// Trang đầu của danh sách lộ trình theo bộ lọc (màn Lộ trình); các trang sau lấy bằng `offset`.
final pathListProvider = FutureProvider.autoDispose
    .family<PathDetail, PathFilter>((ref, filter) {
      return ref
          .watch(learningRepositoryProvider)
          .path(kind: filter.kind, level: filter.level, limit: pathPageSize);
    });
