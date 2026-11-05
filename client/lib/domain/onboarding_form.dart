// Dữ liệu người học khai báo trong onboarding (FR-005). Thuần Dart, không phụ thuộc Flutter hay mã sinh;
// dạng JSON khớp schema `OnboardingDraft` của hợp đồng OpenAPI.

/// Các lựa chọn hợp lệ ở Giai đoạn 1.
abstract final class OnboardingOptions {
  static const List<String> levels = <String>[
    'none',
    'N5',
    'N4',
    'N3',
    'N2',
    'N1',
  ];
  static const List<String> goals = <String>[
    'daily_conversation',
    'work',
    'jlpt',
  ];
  static const List<String> targetLevels = <String>[
    'N5',
    'N4',
    'N3',
    'N2',
    'N1',
  ];
  static const List<int> dailyMinutes = <int>[5, 10, 15, 30];

  /// Kỹ năng có trong phiên bản này (Kanji chọn được từ spec 003).
  static const List<String> skills = <String>['vocabulary', 'grammar', 'kanji'];

  /// Kỹ năng hiển thị nhưng bị khóa kèm ghi chú "chưa có trong phiên bản này".
  static const List<String> lockedSkills = <String>['listening', 'reading'];
}

/// Các bước của trình hướng dẫn onboarding, theo thứ tự.
enum OnboardingStep { level, goal, time, deadline, skills, placement }

class OnboardingForm {
  const OnboardingForm({
    this.currentLevel,
    this.goalType,
    this.targetLevel,
    this.dailyMinutes,
    this.targetDate,
    this.skills = const <String>[],
    this.placementResultId,
  });

  final String? currentLevel;
  final String? goalType;
  final String? targetLevel;
  final int? dailyMinutes;

  /// Ngày địa phương `YYYY-MM-DD` (không kèm giờ); null = không đặt mốc.
  final String? targetDate;
  final List<String> skills;

  /// Kết quả kiểm tra trình độ được chọn dùng cho lộ trình; null = bỏ qua.
  final String? placementResultId;

  static const OnboardingForm empty = OnboardingForm();

  OnboardingForm copyWith({
    String? currentLevel,
    String? goalType,
    String? targetLevel,
    bool clearTargetLevel = false,
    int? dailyMinutes,
    String? targetDate,
    bool clearTargetDate = false,
    List<String>? skills,
    String? placementResultId,
    bool clearPlacementResultId = false,
  }) {
    return OnboardingForm(
      currentLevel: currentLevel ?? this.currentLevel,
      goalType: goalType ?? this.goalType,
      targetLevel: clearTargetLevel ? null : (targetLevel ?? this.targetLevel),
      dailyMinutes: dailyMinutes ?? this.dailyMinutes,
      targetDate: clearTargetDate ? null : (targetDate ?? this.targetDate),
      skills: skills ?? this.skills,
      placementResultId: clearPlacementResultId
          ? null
          : (placementResultId ?? this.placementResultId),
    );
  }

  /// Trình độ hoặc mục tiêu JLPT là N2/N1: nội dung Giai đoạn 1 chỉ đến N3 (cùng quy tắc `scopeNotice`
  /// của server), cần báo trước khi hoàn tất.
  bool get exceedsContentScope =>
      currentLevel == 'N2' ||
      currentLevel == 'N1' ||
      (goalType == 'jlpt' && (targetLevel == 'N2' || targetLevel == 'N1'));

  /// Mục tiêu JLPT bắt buộc chọn cấp độ muốn đạt.
  bool get needsTargetLevel => goalType == 'jlpt';

  /// Bước đã nhập đủ để đi tiếp.
  bool isStepComplete(OnboardingStep step) {
    switch (step) {
      case OnboardingStep.level:
        return currentLevel != null;
      case OnboardingStep.goal:
        return goalType != null && (!needsTargetLevel || targetLevel != null);
      case OnboardingStep.time:
        return dailyMinutes != null;
      case OnboardingStep.deadline:
        return true; // mốc thời gian là tùy chọn
      case OnboardingStep.skills:
        return skills.isNotEmpty;
      case OnboardingStep.placement:
        return true; // làm hay bỏ qua kiểm tra đều hợp lệ (FR-008)
    }
  }

  /// Đã đủ để hoàn tất onboarding.
  bool get isComplete => OnboardingStep.values.every(isStepComplete);

  /// Dạng JSON theo schema `OnboardingDraft`; trường chưa có giá trị bị bỏ.
  Map<String, Object?> toJson({String? timezone}) {
    return <String, Object?>{
      if (currentLevel != null) 'currentLevel': currentLevel,
      if (goalType != null) 'goalType': goalType,
      if (goalType == 'jlpt' && targetLevel != null) 'targetLevel': targetLevel,
      if (dailyMinutes != null) 'dailyMinutes': dailyMinutes,
      if (targetDate != null) 'targetDate': targetDate,
      if (skills.isNotEmpty) 'skills': skills,
      if (placementResultId != null) 'placementResultId': placementResultId,
      if (timezone != null) 'timezone': timezone,
    };
  }

  factory OnboardingForm.fromJson(Map<String, Object?> json) {
    final skills = json['skills'];
    final minutes = json['dailyMinutes'];
    final date = json['targetDate'];
    return OnboardingForm(
      currentLevel: json['currentLevel'] as String?,
      goalType: json['goalType'] as String?,
      targetLevel: json['targetLevel'] as String?,
      dailyMinutes: minutes is int ? minutes : null,
      // Chỉ lấy phần ngày: server luôn trả `YYYY-MM-DD`, nhưng chịu được cả dạng có giờ.
      targetDate: date is String && date.length >= 10
          ? date.substring(0, 10)
          : null,
      skills: skills is List
          ? skills
                .whereType<String>()
                .where(OnboardingOptions.skills.contains)
                .toList()
          : const <String>[],
      placementResultId: json['placementResultId'] as String?,
    );
  }

  @override
  bool operator ==(Object other) =>
      other is OnboardingForm &&
      other.currentLevel == currentLevel &&
      other.goalType == goalType &&
      other.targetLevel == targetLevel &&
      other.dailyMinutes == dailyMinutes &&
      other.targetDate == targetDate &&
      other.placementResultId == placementResultId &&
      _sameList(other.skills, skills);

  @override
  int get hashCode => Object.hash(
    currentLevel,
    goalType,
    targetLevel,
    dailyMinutes,
    targetDate,
    placementResultId,
    Object.hashAll(skills),
  );

  static bool _sameList(List<String> a, List<String> b) {
    if (a.length != b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (a[i] != b[i]) return false;
    }
    return true;
  }
}
