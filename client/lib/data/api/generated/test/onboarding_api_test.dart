import 'package:test/test.dart';
import 'package:japanese_api/japanese_api.dart';

/// tests for OnboardingApi
void main() {
  final instance = JapaneseApi().getOnboardingApi();

  group(OnboardingApi, () {
    // Hoàn tất onboarding – sinh lộ trình và bài học hôm nay (FR-008, FR-010)
    //
    // Có thể không kèm kết quả kiểm tra (bỏ qua) – lộ trình sinh từ hồ sơ khai báo.
    //
    //Future<CompleteOnboarding200Response> completeOnboarding(OnboardingDraft onboardingDraft) async
    test('test completeOnboarding', () async {
      // TODO
    });

    // Trạng thái và bản nháp onboarding (tiếp tục khi bỏ dở)
    //
    //Future<OnboardingState> getOnboarding() async
    test('test getOnboarding', () async {
      // TODO
    });

    // Bộ câu hỏi kiểm tra trình độ (công khai, KHÔNG kèm đáp án)
    //
    //Future<PlacementQuestionSet> listPlacementQuestions({ String lang }) async
    test('test listPlacementQuestions', () async {
      // TODO
    });

    // Lưu nháp các bước đã nhập (FR-005)
    //
    //Future<OnboardingState> saveOnboarding(OnboardingDraft onboardingDraft) async
    test('test saveOnboarding', () async {
      // TODO
    });

    // Nộp bài kiểm tra trình độ (cũng dùng để mang kết quả dùng thử sang – FR-039; làm lại – FR-009)
    //
    // Server chấm lại từ các câu trả lời và lưu `placement_results`.
    //
    //Future<PlacementResult> submitPlacement(PlacementAnswers placementAnswers) async
    test('test submitPlacement', () async {
      // TODO
    });
  });
}
