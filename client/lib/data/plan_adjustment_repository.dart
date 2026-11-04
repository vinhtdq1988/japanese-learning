import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:japanese_api/japanese_api.dart';

import 'api_providers.dart';
import 'session_controller.dart';

/// Các thay đổi hồ sơ người học có thể gửi lên `PATCH /me` từ màn hình điều chỉnh kế hoạch.
///
/// Chỉ những trường được đặt mới được gửi. Riêng [prioritizedSkill] và [targetDate] có thể đặt về
/// `null` (bỏ ưu tiên / bỏ mốc) nên dùng cờ `clear…` thay cho `null` để phân biệt "không đổi".
class ProfileChange {
  const ProfileChange({
    this.dailyMinutes,
    this.goalType,
    this.targetLevel,
    this.targetDate,
    this.clearTargetDate = false,
    this.currentLevel,
    this.prioritizedSkill,
    this.clearPrioritizedSkill = false,
  });

  final int? dailyMinutes;
  final String? goalType;
  final String? targetLevel;
  final DateTime? targetDate;
  final bool clearTargetDate;
  final String? currentLevel;
  final String? prioritizedSkill;
  final bool clearPrioritizedSkill;

  static final DateFormat _date = DateFormat('yyyy-MM-dd');

  /// Thân JSON của `PATCH /me`. Gửi JSON thủ công: mô hình sinh ra tuần tự hóa `targetDate` thành
  /// date-time ISO (hợp đồng quy định `format: date`), không gửi được `null` tường minh và mã hóa
  /// `dailyMinutes` theo kiểu enum chuỗi.
  Map<String, Object?> toJson() {
    final json = <String, Object?>{};
    if (dailyMinutes != null) json['dailyMinutes'] = dailyMinutes;
    if (goalType != null) json['goalType'] = goalType;
    if (targetLevel != null) json['targetLevel'] = targetLevel;
    if (clearTargetDate) {
      json['targetDate'] = null;
    } else if (targetDate != null) {
      json['targetDate'] = _date.format(targetDate!);
    }
    if (currentLevel != null) json['currentLevel'] = currentLevel;
    if (clearPrioritizedSkill) {
      json['prioritizedSkill'] = null;
    } else if (prioritizedSkill != null) {
      json['prioritizedSkill'] = prioritizedSkill;
    }
    return json;
  }
}

/// Truy cập các thao tác ghi đè của người học (T094, FR-016, Nguyên tắc III): đổi mục tiêu/thời gian,
/// ưu tiên kỹ năng, tạm dừng/tiếp tục, đánh dấu đã thành thạo và xây dựng lại lộ trình.
class PlanAdjustmentRepository {
  PlanAdjustmentRepository({required JapaneseApi api, required Dio dio})
    : _api = api,
      _dio = dio;

  final JapaneseApi _api;
  final Dio _dio;

  /// Hồ sơ học tập hiện tại.
  Future<Profile> profile() {
    return guardApi(() async {
      final me = (await _api.getAccountApi().getMe()).data!;
      return me.profile!;
    });
  }

  /// Lưu thay đổi hồ sơ; trả hồ sơ mới. Đổi mục tiêu/trình độ khiến server sinh lộ trình mới.
  Future<Profile> update(ProfileChange change) {
    return guardApi(() async {
      final response = await _dio.patch<Map<String, dynamic>>(
        '/me',
        data: change.toJson(),
      );
      return Me.fromJson(response.data!).profile!;
    });
  }

  Future<void> pause() {
    return guardApi(() async {
      await _api.getPathApi().pausePath();
    });
  }

  Future<void> resume() {
    return guardApi(() async {
      await _api.getPathApi().resumePath();
    });
  }

  /// Đánh dấu / bỏ đánh dấu đơn vị đã thành thạo; kết quả cho biết còn bao nhiêu đơn vị và gợi ý khi hết.
  Future<MasterResult> setMastered(String unitId, {required bool mastered}) {
    return guardApi(() async {
      final response = await _api.getPathApi().setUnitMastered(
        unitId: unitId,
        setUnitMasteredRequest: SetUnitMasteredRequest(mastered: mastered),
      );
      return response.data!;
    });
  }

  /// Xây dựng lại toàn bộ lộ trình theo hồ sơ hiện tại; lịch sử học và lịch ôn giữ nguyên.
  Future<PathSummary> rebuild() {
    return guardApi(() async => (await _api.getPathApi().rebuildPath()).data!);
  }
}

final planAdjustmentRepositoryProvider = Provider<PlanAdjustmentRepository>((
  ref,
) {
  return PlanAdjustmentRepository(
    api: ref.watch(japaneseApiProvider),
    dio: ref.watch(dioProvider),
  );
});

/// Hồ sơ học tập hiện tại; tự hủy khi rời màn hình.
final profileProvider = FutureProvider.autoDispose<Profile>((ref) {
  return ref.watch(planAdjustmentRepositoryProvider).profile();
});
