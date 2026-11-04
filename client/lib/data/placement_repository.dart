import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:japanese_api/japanese_api.dart';

import 'api_providers.dart';

/// Truy cập bài kiểm tra trình độ (T054): lấy bộ câu hỏi (không kèm đáp án) và nộp bài để server chấm.
class PlacementRepository {
  PlacementRepository(this._api);

  final JapaneseApi _api;

  /// Bộ câu hỏi đang kích hoạt (20 câu, tối đa 10 phút) theo ngôn ngữ giao diện.
  Future<PlacementQuestionSet> questions(String languageCode) {
    return guardApi(() async {
      final response = await _api.getOnboardingApi().listPlacementQuestions(
        lang: languageCode,
      );
      return response.data!;
    });
  }

  /// Nộp câu trả lời (`choice == null` là bỏ trống). Server chấm lại và lưu kết quả hiện hành.
  Future<PlacementResult> submit({
    required Map<String, int?> choices,
    required int durationSeconds,
  }) {
    return guardApi(() async {
      final response = await _api.getOnboardingApi().submitPlacement(
        placementAnswers: PlacementAnswers(
          durationSeconds: durationSeconds,
          answers: <PlacementAnswersAnswersInner>[
            for (final entry in choices.entries)
              PlacementAnswersAnswersInner(
                questionId: entry.key,
                choice: entry.value,
              ),
          ],
        ),
      );
      return response.data!;
    });
  }
}

final placementRepositoryProvider = Provider<PlacementRepository>((ref) {
  return PlacementRepository(ref.watch(japaneseApiProvider));
});
