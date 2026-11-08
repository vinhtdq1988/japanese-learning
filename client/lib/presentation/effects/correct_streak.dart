/// Các ngưỡng đúng liên tiếp có phản hồi mạnh hơn (spec 005, US4, FR-010).
const List<int> streakMilestones = <int>[3, 5, 10];

/// Bộ đếm câu đúng liên tiếp trong MỘT phiên (spec 005, US4). Chỉ sống trong bộ nhớ của phiên: không lưu, không
/// gọi mạng, không phải thành tựu và không đọc tốc độ trả lời (FR-009) — khác với "chuỗi ngày" của server.
///
/// Chỉ lượt chính được đếm; câu ở lượt hỏi lại nhận phản hồi đúng/sai thường nhưng không đổi bộ đếm (research E15).
class CorrectStreak {
  const CorrectStreak([this.count = 0]);

  final int count;

  /// Bộ đếm sau một câu trả lời lượt chính: +1 khi đúng, về 0 khi sai. `milestone` là 3 | 5 | 10 CHỈ khi câu
  /// này vừa chạm ngưỡng; sau ngưỡng cuối (10) vẫn đếm tiếp nhưng không thưởng thêm.
  ({CorrectStreak next, int? milestone}) record({required bool correct}) {
    if (!correct) return (next: const CorrectStreak(), milestone: null);
    final next = CorrectStreak(count + 1);
    return (
      next: next,
      milestone: streakMilestones.contains(next.count) ? next.count : null,
    );
  }
}
