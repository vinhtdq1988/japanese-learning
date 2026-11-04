import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:japanese_api/japanese_api.dart';

import '../domain/onboarding_form.dart';
import '../platform/platform.dart';
import '../platform/platform_providers.dart';
import 'api_providers.dart';
import 'session_controller.dart';

/// Trạng thái onboarding đọc từ server: trạng thái, bản nháp đã lưu và kết quả kiểm tra trình độ
/// hiện hành (ví dụ mang từ dùng thử sang) để người học chọn dùng hoặc bỏ.
class OnboardingSnapshot {
  const OnboardingSnapshot({
    required this.completed,
    required this.form,
    this.carriedPlacement,
  });

  final bool completed;
  final OnboardingForm form;
  final PlacementResult? carriedPlacement;
}

/// Truy cập onboarding (T053). Hai thao tác ghi (`saveDraft`, `complete`) gửi JSON thủ công thay vì mô
/// hình sinh ra: mô hình sinh ra tuần tự hóa `targetDate` thành date-time ISO, trong khi hợp đồng quy
/// định `format: date` (`YYYY-MM-DD`).
class OnboardingRepository {
  OnboardingRepository({
    required JapaneseApi api,
    required Dio dio,
    required Timezone timezone,
  }) : _api = api,
       _dio = dio,
       _timezone = timezone;

  final JapaneseApi _api;
  final Dio _dio;
  final Timezone _timezone;

  Future<OnboardingSnapshot> load() {
    return guardApi(() async {
      final state = (await _api.getOnboardingApi().getOnboarding()).data!;
      return OnboardingSnapshot(
        completed: state.state == OnboardingStateStateEnum.completed,
        form: formFromDraft(state.draft),
        carriedPlacement: state.carriedPlacement,
      );
    });
  }

  /// Lưu nháp các bước đã nhập (thay toàn bộ nháp cũ) để bỏ dở rồi tiếp tục được.
  Future<void> saveDraft(OnboardingForm form) {
    return guardApi(() async {
      final tz = await _timezone.currentIanaName();
      await _dio.put<Object?>('/onboarding', data: form.toJson(timezone: tz));
    });
  }

  /// Hoàn tất: server sinh lộ trình và kế hoạch hôm nay.
  Future<CompleteOnboarding200Response> complete(OnboardingForm form) {
    return guardApi(() async {
      final tz = await _timezone.currentIanaName();
      final response = await _dio.post<Map<String, dynamic>>(
        '/onboarding/complete',
        data: form.toJson(timezone: tz),
      );
      return CompleteOnboarding200Response.fromJson(response.data!);
    });
  }

  /// Chuyển bản nháp của server sang biểu mẫu của client.
  static OnboardingForm formFromDraft(OnboardingDraft? draft) {
    if (draft == null) return OnboardingForm.empty;
    final date = draft.targetDate;
    return OnboardingForm(
      currentLevel: draft.currentLevel?.value,
      goalType: draft.goalType?.value,
      targetLevel: draft.targetLevel?.value,
      dailyMinutes: int.tryParse(draft.dailyMinutes?.value ?? ''),
      targetDate: date == null ? null : formatDate(date),
      skills: (draft.skills ?? const <Skill>[]).map((s) => s.value).toList(),
      placementResultId: draft.placementResultId,
    );
  }

  /// `YYYY-MM-DD` theo các thành phần ngày của [date] (ngày địa phương, không đổi múi giờ).
  static String formatDate(DateTime date) {
    String two(int n) => n.toString().padLeft(2, '0');
    return '${date.year.toString().padLeft(4, '0')}-${two(date.month)}-${two(date.day)}';
  }
}

final onboardingRepositoryProvider = Provider<OnboardingRepository>((ref) {
  return OnboardingRepository(
    api: ref.watch(japaneseApiProvider),
    dio: ref.watch(dioProvider),
    timezone: ref.watch(timezoneProvider),
  );
});
