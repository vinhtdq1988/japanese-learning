// Gợi ý kỹ năng theo quỹ thời gian mỗi ngày (spec 007, US1, FR-021…025, research.md §P11). Thuần Dart,
// không phụ thuộc Flutter hay mã sinh. Bảng gợi ý do máy chủ trả (`GET /study-defaults`); client chỉ so
// sánh để quyết định "điền sẵn" hay "chỉ mời", không bao giờ ghi đè ngầm lựa chọn người học đã chỉnh.

/// Kết quả đối chiếu lựa chọn hiện tại với gợi ý của quỹ thời gian mới.
class SuggestionResult {
  const SuggestionResult({
    required this.skills,
    required this.filled,
    this.invite,
  });

  /// Kỹ năng sau khi xử lý: gợi ý mới nếu [filled], ngược lại là lựa chọn hiện tại (giữ nguyên).
  final List<String> skills;

  /// `true` khi lựa chọn "chưa chỉnh" nên đã được điền gợi ý của quỹ thời gian mới.
  final bool filled;

  /// Gợi ý mới để mời người học "Áp dụng / Giữ nguyên" khi họ đã chỉnh riêng; `null` nếu không cần mời.
  final List<String>? invite;
}

/// Đối chiếu [currentSkills] với gợi ý khi quỹ thời gian đổi từ [oldMinutes] sang [newMinutes].
///
/// - Lựa chọn rỗng hoặc bằng gợi ý của phút cũ (không phân biệt thứ tự) ⇒ "chưa chỉnh": điền gợi ý mới.
/// - Ngược lại ⇒ giữ nguyên; trả lời mời nếu gợi ý mới khác lựa chọn hiện tại.
///
/// Mọi so sánh chỉ xét kỹ năng nằm trong [availableSkills] (màn hình chưa cho chọn kỹ năng khác).
SuggestionResult reconcileSuggestion({
  required Set<String> currentSkills,
  required int? oldMinutes,
  required int newMinutes,
  required Map<int, List<String>> table,
  required List<String> availableSkills,
}) {
  final current = <String>[
    for (final skill in availableSkills)
      if (currentSkills.contains(skill)) skill,
  ];
  List<String> filtered(int? minutes) => <String>[
    for (final skill in table[minutes] ?? const <String>[])
      if (availableSkills.contains(skill)) skill,
  ];

  final suggestion = filtered(newMinutes);
  SuggestionResult keep() => SuggestionResult(skills: current, filled: false);
  if (suggestion.isEmpty || oldMinutes == newMinutes) return keep();

  final untouched = current.isEmpty || _sameSet(current, filtered(oldMinutes));
  if (untouched) return SuggestionResult(skills: suggestion, filled: true);
  if (_sameSet(current, suggestion)) return keep();
  return SuggestionResult(skills: current, filled: false, invite: suggestion);
}

/// Luyện đọc/viết bị khóa khi quỹ thời gian chưa đạt ngưỡng (hoặc chưa chọn).
bool isPracticeLockedFor(int? minutes, int threshold) =>
    (minutes ?? 0) < threshold;

bool _sameSet(List<String> a, List<String> b) =>
    a.length == b.length && a.toSet().containsAll(b);
