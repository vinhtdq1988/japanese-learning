import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:japanese_api/japanese_api.dart' as gen;

import 'api_providers.dart';

/// Bảng gợi ý kỹ năng theo quỹ thời gian mỗi ngày (spec 007, `GET /study-defaults`). Chỉ đọc, giống nhau
/// cho mọi người học; không lưu vào `LocalStore`.
class StudyDefaults {
  const StudyDefaults({
    required this.practiceMinDailyMinutes,
    required this.bySkills,
  });

  /// Quỹ thời gian tối thiểu (phút/ngày) để dùng luyện đọc/viết.
  final int practiceMinDailyMinutes;

  /// Kỹ năng gợi ý theo phút (5, 10, 15, 30).
  final Map<int, List<String>> bySkills;

  factory StudyDefaults.fromApi(gen.StudyDefaults api) {
    return StudyDefaults(
      practiceMinDailyMinutes: api.practiceMinDailyMinutes,
      bySkills: <int, List<String>>{
        for (final item in api.items)
          int.parse(item.dailyMinutes.value): <String>[
            for (final skill in item.skills) skill.value,
          ],
      },
    );
  }
}

/// Bảng gợi ý, tải một lần và dùng lại (cache theo vòng đời của ứng dụng/phiên). Lỗi tải ⇒ provider ở
/// trạng thái lỗi; màn hình coi như không có gợi ý và vẫn dùng được.
final studyDefaultsProvider = FutureProvider<StudyDefaults>((ref) async {
  final api = ref.watch(japaneseApiProvider);
  final response = await guardApi(
    () => api.getOnboardingApi().getStudyDefaults(),
  );
  return StudyDefaults.fromApi(response.data!);
});
