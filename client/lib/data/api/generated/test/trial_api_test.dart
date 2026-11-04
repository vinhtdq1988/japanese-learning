import 'package:test/test.dart';
import 'package:japanese_api/japanese_api.dart';

/// tests for TrialApi
void main() {
  final instance = JapaneseApi().getTrialApi();

  group(TrialApi, () {
    // Nội dung dùng thử cố định (công khai) – FR-036/037
    //
    // Trả tập đơn vị học đánh dấu `is_trial`. Bài tập trong payload có kèm đáp án để client chấm cục bộ (nội dung công khai). Không tạo bản ghi định danh nào trên máy chủ; chỉ tăng bộ đếm tổng hợp ẩn danh theo ngày (FR-038). Giới hạn tần suất (FR-040).
    //
    //Future<TrialContent> getTrialContent({ String lang }) async
    test('test getTrialContent', () async {
      // TODO
    });

    // Chấm bài kiểm tra trình độ cho khách – không lưu gì
    //
    //Future<PlacementResult> gradeTrialPlacement(PlacementAnswers placementAnswers) async
    test('test gradeTrialPlacement', () async {
      // TODO
    });

    // Bộ câu hỏi kiểm tra trình độ (công khai, KHÔNG kèm đáp án)
    //
    //Future<PlacementQuestionSet> listPlacementQuestions({ String lang }) async
    test('test listPlacementQuestions', () async {
      // TODO
    });

    // Ghi nhận sự kiện dùng thử ẩn danh (chỉ tăng bộ đếm tổng hợp theo ngày, FR-038)
    //
    // Không nhận và không lưu bất kỳ dữ liệu nào khác ngoài tên sự kiện; không gắn với IP hay trình duyệt. Giới hạn tần suất (FR-040).
    //
    //Future recordTrialEvent(RecordTrialEventRequest recordTrialEventRequest) async
    test('test recordTrialEvent', () async {
      // TODO
    });
  });
}
