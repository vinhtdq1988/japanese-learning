import 'admin_unit_draft.dart';

/// Mô hình đọc cho các màn hình quản trị (T108). Khớp các schema `Admin*` của hợp đồng; không phụ thuộc
/// Flutter. Phần soạn đơn vị học (có thể sửa) nằm ở `admin_unit_draft.dart`.

/// Một trang kết quả phân trang theo con trỏ.
class CursorPage<T> {
  const CursorPage({required this.items, this.nextCursor});

  final List<T> items;

  /// `null` khi đã hết trang.
  final String? nextCursor;
}

class AdminTopic {
  const AdminTopic({
    required this.id,
    required this.skill,
    required this.level,
    required this.name,
  });

  final String id;
  final String skill;
  final String level;
  final I18nDraft name;

  factory AdminTopic.fromJson(Map<String, Object?> json) => AdminTopic(
    id: json['id']! as String,
    skill: json['skill']! as String,
    level: json['level']! as String,
    name: I18nDraft.fromJson(json['name']),
  );
}

/// Dòng trong danh sách đơn vị (không kèm mục/bài tập).
class AdminUnitSummary {
  const AdminUnitSummary({
    required this.id,
    required this.kind,
    required this.level,
    required this.tier,
    required this.estMinutes,
    required this.status,
    required this.isTrial,
    required this.title,
    required this.sequence,
  });

  final String id;
  final String kind;
  final String level;
  final String tier;
  final int estMinutes;
  final String status;
  final bool isTrial;
  final I18nDraft title;
  final int sequence;

  factory AdminUnitSummary.fromJson(Map<String, Object?> json) =>
      AdminUnitSummary(
        id: json['id']! as String,
        kind: json['kind']! as String,
        level: json['level']! as String,
        tier: (json['tier'] as String?) ?? 'core',
        estMinutes: json['estMinutes']! as int,
        status: json['status']! as String,
        isTrial: (json['isTrial'] as bool?) ?? false,
        title: I18nDraft.fromJson(json['title']),
        sequence: (json['sequence'] as int?) ?? 0,
      );
}

/// Câu hỏi kiểm tra trình độ (có đáp án – chỉ admin thấy).
class AdminPlacementQuestion {
  const AdminPlacementQuestion({
    required this.id,
    required this.level,
    required this.skill,
    required this.topicId,
    required this.prompt,
    required this.choices,
    required this.correctChoice,
    required this.position,
    required this.isActive,
    this.hint,
  });

  final String id;
  final String level;
  final String skill;
  final String topicId;
  final String prompt;
  final I18nDraft? hint;
  final List<String> choices;
  final int correctChoice;
  final int position;
  final bool isActive;

  factory AdminPlacementQuestion.fromJson(Map<String, Object?> json) =>
      AdminPlacementQuestion(
        id: json['id']! as String,
        level: json['level']! as String,
        skill: json['skill']! as String,
        topicId: json['topicId']! as String,
        prompt: json['prompt']! as String,
        hint: json['hint'] == null ? null : I18nDraft.fromJson(json['hint']),
        choices: (json['choices']! as List).cast<String>(),
        correctChoice: json['correctChoice']! as int,
        position: (json['position'] as int?) ?? 0,
        isActive: (json['isActive'] as bool?) ?? false,
      );
}

/// Dữ liệu ghi một câu hỏi kiểm tra trình độ (`AdminPlacementQuestion` khi ghi).
class PlacementQuestionInput {
  const PlacementQuestionInput({
    required this.level,
    required this.skill,
    required this.topicId,
    required this.prompt,
    required this.choices,
    required this.correctChoice,
    this.hint,
    this.position,
  });

  final String level;
  final String skill;
  final String topicId;
  final String prompt;
  final I18nDraft? hint;
  final List<String> choices;
  final int correctChoice;
  final int? position;

  Map<String, Object?> toJson() => <String, Object?>{
    'level': level,
    'skill': skill,
    'topicId': topicId,
    'prompt': prompt,
    if (hint != null && !hint!.isEmpty) 'hint': hint!.toJson(),
    'choices': choices,
    'correctChoice': correctChoice,
    if (position != null) 'position': position,
  };
}

class AdminUserRow {
  const AdminUserRow({
    required this.id,
    required this.email,
    required this.displayName,
    required this.role,
    required this.status,
    required this.createdAt,
  });

  final String id;
  final String email;
  final String displayName;
  final String role;
  final String status;
  final DateTime createdAt;

  bool get isLearner => role == 'learner';

  factory AdminUserRow.fromJson(Map<String, Object?> json) => AdminUserRow(
    id: json['id']! as String,
    email: json['email']! as String,
    displayName: (json['displayName'] as String?) ?? '',
    role: (json['role'] as String?) ?? 'learner',
    status: json['status']! as String,
    createdAt: DateTime.parse(json['createdAt']! as String),
  );
}

class AdminLogEntry {
  const AdminLogEntry({
    required this.id,
    required this.action,
    required this.targetType,
    required this.occurredAt,
    this.actorId,
    this.targetId,
    this.diff,
  });

  final String id;
  final String? actorId;
  final String action;
  final String targetType;
  final String? targetId;
  final Map<String, Object?>? diff;
  final DateTime occurredAt;

  factory AdminLogEntry.fromJson(Map<String, Object?> json) => AdminLogEntry(
    id: json['id']! as String,
    actorId: json['actorId'] as String?,
    action: json['action']! as String,
    targetType: json['targetType']! as String,
    targetId: json['targetId'] as String?,
    diff: json['diff'] is Map
        ? Map<String, Object?>.from(json['diff']! as Map)
        : null,
    occurredAt: DateTime.parse(json['occurredAt']! as String),
  );
}
