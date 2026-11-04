// Chấm bài tập dùng thử phía client (FR-037). Khách không có phiên trên server nên server gửi kèm đáp án
// của nội dung công khai và client tự chấm để phản hồi tức thì. Kết quả chỉ để hiển thị: không gửi đi đâu.
//
// Quy tắc phải khớp bộ chấm của server (`backend/src/domain/grading.ts`) để người dùng thử thấy cùng
// một kết quả như khi học thật.

/// Đáp án của một bài tập dùng thử, theo loại bài tập.
sealed class TrialAnswerKey {
  const TrialAnswerKey();
}

/// Trắc nghiệm: chỉ số lựa chọn đúng.
class ChoiceAnswerKey extends TrialAnswerKey {
  const ChoiceAnswerKey(this.correctIndex);

  final int correctIndex;
}

/// Ghép cặp: danh sách cặp [vế trái, vế phải đúng].
class MatchingAnswerKey extends TrialAnswerKey {
  const MatchingAnswerKey(this.pairs);

  final List<List<String>> pairs;
}

/// Điền từ: các đáp án được chấp nhận.
class FillBlankAnswerKey extends TrialAnswerKey {
  const FillBlankAnswerKey(this.acceptedAnswers);

  final List<String> acceptedAnswers;
}

/// Kết quả chấm một câu. [correctAnswer] cùng định dạng với `AnswerResult.correctAnswer` của server:
/// `int` (trắc nghiệm), `List<List<String>>` (ghép cặp) hoặc `String` (điền từ).
class TrialGrade {
  const TrialGrade({required this.isCorrect, required this.correctAnswer});

  final bool isCorrect;
  final Object correctAnswer;
}

/// Chuẩn hóa chuỗi trước khi so khớp điền từ: bỏ khoảng trắng thừa, gộp khoảng trắng giữa, đổi chữ
/// thường và đưa ký tự ASCII toàn chiều (Ａ, １, khoảng trắng toàn chiều…) về dạng thường.
///
/// Server dùng NFKC đầy đủ; Dart không có sẵn NFKC nên ở đây chỉ xử lý nhóm ký tự toàn chiều hay gặp nhất.
/// Khác biệt (ví dụ katakana bán chiều) chỉ ảnh hưởng phản hồi của bài mẫu, không lưu dữ liệu nào.
String normalizeTrialAnswer(String value) {
  final buffer = StringBuffer();
  for (final rune in value.runes) {
    if (rune == 0x3000) {
      buffer.write(' ');
    } else if (rune >= 0xFF01 && rune <= 0xFF5E) {
      buffer.writeCharCode(rune - 0xFEE0);
    } else {
      buffer.writeCharCode(rune);
    }
  }
  return buffer.toString().trim().replaceAll(RegExp(r'\s+'), ' ').toLowerCase();
}

/// Chấm [answer] theo [key]. Định dạng câu trả lời khớp `AnswerSubmission.answer`: `int` (trắc nghiệm),
/// `List<List<String>>` cặp [trái, phải] (ghép cặp), `String` (điền từ). Câu trả lời sai kiểu là sai.
TrialGrade gradeTrialAnswer(TrialAnswerKey key, Object? answer) {
  switch (key) {
    case ChoiceAnswerKey():
      return TrialGrade(
        isCorrect: answer is int && answer == key.correctIndex,
        correctAnswer: key.correctIndex,
      );
    case MatchingAnswerKey():
      return TrialGrade(
        isCorrect: _matchesPairs(key.pairs, answer),
        correctAnswer: key.pairs,
      );
    case FillBlankAnswerKey():
      final accepted = key.acceptedAnswers.map(normalizeTrialAnswer).toSet();
      return TrialGrade(
        isCorrect:
            answer is String && accepted.contains(normalizeTrialAnswer(answer)),
        correctAnswer: key.acceptedAnswers.isEmpty
            ? ''
            : key.acceptedAnswers.first,
      );
  }
}

bool _matchesPairs(List<List<String>> expected, Object? answer) {
  if (answer is! List || answer.length != expected.length) return false;
  String keyOf(List<Object?> pair) => '${pair[0]}\u0000${pair[1]}';
  final given = <String>{};
  for (final pair in answer) {
    if (pair is! List || pair.length != 2) return false;
    if (pair[0] is! String || pair[1] is! String) return false;
    given.add(keyOf(pair));
  }
  final want = expected.map(keyOf).toSet();
  // Đủ cặp, không trùng và mọi cặp khớp đáp án (thứ tự tùy ý).
  return given.length == want.length && given.containsAll(want);
}
