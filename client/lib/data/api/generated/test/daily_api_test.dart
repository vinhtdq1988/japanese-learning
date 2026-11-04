import 'package:test/test.dart';
import 'package:japanese_api/japanese_api.dart';

/// tests for DailyApi
void main() {
  final instance = JapaneseApi().getDailyApi();

  group(DailyApi, () {
    // Hoàn thành phiên – cập nhật trạng thái mục kế hoạch/ngày và trả tóm tắt
    //
    //Future<SessionSummary> completeSession(String sessionId) async
    test('test completeSession', () async {
      // TODO
    });

    // Học thêm sau khi xong kế hoạch (US2.5) – không đổi kế hoạch mặc định
    //
    //Future<PlanItem> getExtraUnit() async
    test('test getExtraUnit', () async {
      // TODO
    });

    // Kế hoạch hôm nay (sinh một lần theo ngày địa phương)
    //
    //Future<DailyPlan> getToday() async
    test('test getToday', () async {
      // TODO
    });

    // Ghi khoảng thời gian học (idempotent)
    //
    //Future recordStudyInterval(String sessionId, RecordStudyIntervalRequest recordStudyIntervalRequest) async
    test('test recordStudyInterval', () async {
      // TODO
    });

    // Bắt đầu hoặc tiếp tục một phiên học cho mục kế hoạch
    //
    //Future<LessonSession> startSession(StartSessionRequest startSessionRequest) async
    test('test startSession', () async {
      // TODO
    });

    // Ghi câu trả lời – chấm tự động, idempotent (FR-025, FR-041)
    //
    //Future<AnswerResult> submitAnswer(String sessionId, AnswerSubmission answerSubmission) async
    test('test submitAnswer', () async {
      // TODO
    });
  });
}
