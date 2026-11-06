import 'dart:convert';

/// Mô hình soạn thảo đơn vị học của quản trị viên (T108). Là bản nháp CÓ THỂ SỬA tại chỗ (mutable) phản
/// ánh `AdminUnit`/`AdminUnitWrite` của hợp đồng; không phụ thuộc Flutter nên kiểm thử được thuần.
///
/// Quy tắc ghi (data-model §2.10): phần tử có `id` được cập nhật tại chỗ, phần tử mới không có `id`; phần
/// tử đã có KHÔNG bị xóa mà chuyển `inactive` (công tắc [active]). Bài tập tham chiếu mục bằng đối tượng
/// ([ExerciseDraft.item]) và được đổi thành `itemIndex` khi gửi, nên thêm/bớt/sắp xếp lại mục không làm
/// lệch liên kết.

const List<String> kUnitKinds = <String>['vocabulary', 'grammar', 'kanji'];

/// Kỹ năng của câu hỏi kiểm tra trình độ: không có Kanji (research K12).
const List<String> kPlacementSkills = <String>['vocabulary', 'grammar'];
const List<String> kContentLevels = <String>['N5', 'N4', 'N3'];
const List<String> kGoalTags = <String>['daily_conversation', 'work', 'jlpt'];
const List<int> kEstMinutes = <int>[5, 10, 15];

/// Khía cạnh ôn tập của bài tập gắn chữ Kanji (bài tập khác luôn là `item`).
const List<String> kKanjiFacets = <String>['meaning', 'reading', 'word'];
const List<String> kExerciseTypes = <String>[
  'multiple_choice',
  'matching',
  'fill_blank',
];

/// Văn bản dịch vi + en.
class I18nDraft {
  I18nDraft({this.vi = '', this.en = ''});

  String vi;
  String en;

  factory I18nDraft.fromJson(Object? json) {
    if (json is! Map) return I18nDraft();
    return I18nDraft(
      vi: (json['vi'] as String?) ?? '',
      en: (json['en'] as String?) ?? '',
    );
  }

  bool get isEmpty => vi.trim().isEmpty && en.trim().isEmpty;

  Map<String, Object?> toJson() => <String, Object?>{'vi': vi, 'en': en};
}

class ExampleDraft {
  ExampleDraft({
    this.ja = '',
    this.reading = '',
    this.kanjiReading = '',
    I18nDraft? translation,
  }) : translation = translation ?? I18nDraft();

  String ja;
  String reading;

  /// Kanji: cách đọc của chính chữ trong từ ví dụ này (bỏ trống nếu không áp dụng).
  String kanjiReading;
  I18nDraft translation;

  factory ExampleDraft.fromJson(Object? json) {
    final map = json is Map ? json : const <Object?, Object?>{};
    return ExampleDraft(
      ja: (map['ja'] as String?) ?? '',
      reading: (map['reading'] as String?) ?? '',
      kanjiReading: (map['kanjiReading'] as String?) ?? '',
      translation: I18nDraft.fromJson(map['translation']),
    );
  }

  Map<String, Object?> toJson() => <String, Object?>{
    'ja': ja,
    if (reading.trim().isNotEmpty) 'reading': reading,
    if (kanjiReading.trim().isNotEmpty) 'kanjiReading': kanjiReading,
    'translation': translation.toJson(),
  };
}

/// Chi tiết chữ Kanji (`kanjiDetails` của `AdminUnitWrite`): âm On/Kun, số nét, thành phần.
class KanjiDetailsDraft {
  KanjiDetailsDraft({
    List<String>? onReadings,
    List<String>? kunReadings,
    this.strokeCount,
    I18nDraft? components,
  }) : onReadings = onReadings ?? <String>[],
       kunReadings = kunReadings ?? <String>[],
       components = components ?? I18nDraft();

  List<String> onReadings;
  List<String> kunReadings;

  /// `null` khi chưa nhập; server yêu cầu số nguyên 1–30.
  int? strokeCount;
  I18nDraft components;

  factory KanjiDetailsDraft.fromJson(Object? json) {
    if (json is! Map) return KanjiDetailsDraft();
    List<String> readings(Object? raw) =>
        raw is List ? raw.whereType<String>().toList() : <String>[];
    return KanjiDetailsDraft(
      onReadings: readings(json['onReadings']),
      kunReadings: readings(json['kunReadings']),
      strokeCount: json['strokeCount'] as int?,
      components: I18nDraft.fromJson(json['components']),
    );
  }

  /// Tách danh sách cách đọc người dùng gõ (phân cách bằng dấu phẩy, `、` hoặc khoảng trắng).
  static List<String> parseReadings(String text) => text
      .split(RegExp(r'[,，、\s]+'))
      .map((r) => r.trim())
      .where((r) => r.isNotEmpty)
      .toList();

  /// Đã có dữ liệu nào chưa; chưa nhập gì thì không gửi `kanjiDetails` (bản nháp để trống).
  bool get isTouched =>
      onReadings.isNotEmpty ||
      kunReadings.isNotEmpty ||
      strokeCount != null ||
      !components.isEmpty;

  /// Số nét hợp lệ theo hợp đồng (1–30).
  bool get hasValidStrokeCount =>
      strokeCount != null && strokeCount! >= 1 && strokeCount! <= 30;

  Map<String, Object?> toJson() => <String, Object?>{
    'onReadings': onReadings,
    'kunReadings': kunReadings,
    'strokeCount': strokeCount,
    'components': components.isEmpty ? null : components.toJson(),
  };
}

/// Mục nội dung (từ vựng, điểm ngữ pháp hoặc chữ Kanji).
class ItemDraft {
  ItemDraft({
    this.id,
    this.active = true,
    this.japanese = '',
    this.reading = '',
    this.topicId,
    I18nDraft? meaning,
    I18nDraft? explanation,
    KanjiDetailsDraft? kanjiDetails,
    List<ExampleDraft>? examples,
  }) : meaning = meaning ?? I18nDraft(),
       explanation = explanation ?? I18nDraft(),
       kanjiDetails = kanjiDetails ?? KanjiDetailsDraft(),
       examples = examples ?? <ExampleDraft>[];

  /// `null` với mục mới (chưa có trên server).
  final String? id;
  bool active;
  String japanese;
  String reading;

  /// Kanji: chủ đề của chữ (`skill=kanji`); `null` ở bản nháp chưa chọn.
  String? topicId;
  I18nDraft meaning;
  I18nDraft explanation;

  /// Kanji: âm On/Kun, số nét, thành phần (chỉ gửi khi đơn vị là Kanji và đã nhập).
  KanjiDetailsDraft kanjiDetails;
  List<ExampleDraft> examples;

  factory ItemDraft.fromJson(Map<String, Object?> json) => ItemDraft(
    id: json['id'] as String?,
    active: (json['status'] as String?) != 'inactive',
    japanese: (json['japanese'] as String?) ?? '',
    reading: (json['reading'] as String?) ?? '',
    topicId: json['topicId'] as String?,
    meaning: I18nDraft.fromJson(json['meaning']),
    explanation: I18nDraft.fromJson(json['explanation']),
    kanjiDetails: KanjiDetailsDraft.fromJson(json['kanjiDetails']),
    examples: ((json['examples'] as List?) ?? const <Object?>[])
        .map(ExampleDraft.fromJson)
        .toList(),
  );

  /// [kanji]: mục của đơn vị Kanji – gửi thêm `topicId`/`kanjiDetails` và không gửi `reading` (cách đọc nằm
  /// trong `kanjiDetails`). Đơn vị khác không gửi các trường Kanji (server bỏ qua chúng).
  Map<String, Object?> toJson({bool kanji = false}) => <String, Object?>{
    if (id != null) 'id': id,
    'status': active ? 'active' : 'inactive',
    'japanese': japanese,
    if (!kanji && reading.trim().isNotEmpty) 'reading': reading,
    'meaning': meaning.toJson(),
    if (!explanation.isEmpty) 'explanation': explanation.toJson(),
    if (kanji && topicId != null) 'topicId': topicId,
    if (kanji && kanjiDetails.isTouched) 'kanjiDetails': kanjiDetails.toJson(),
    'examples': examples.map((e) => e.toJson()).toList(),
  };
}

/// Cặp ghép của bài tập `matching`.
class PairDraft {
  PairDraft({this.left = '', this.right = ''});

  String left;
  String right;
}

/// Bài tập. Phần đáp án (`payload`) có hai chế độ:
/// - có cấu trúc: lựa chọn + đáp án đúng (trắc nghiệm), cặp ghép, hoặc tập đáp án chấp nhận (điền chỗ trống);
/// - JSON thô ([rawPayload] khác `null`) khi payload hiện có chứa dữ liệu soạn bằng công cụ khác mà form
///   cấu trúc không biểu diễn được (ví dụ lựa chọn song ngữ) – tránh làm mất dữ liệu khi lưu lại.
class ExerciseDraft {
  ExerciseDraft({
    this.id,
    this.active = true,
    this.item,
    this.facet = 'item',
    this.type = 'multiple_choice',
    I18nDraft? prompt,
    I18nDraft? feedbackCorrect,
    I18nDraft? feedbackIncorrect,
    List<String>? choices,
    this.correctIndex = 0,
    List<PairDraft>? pairs,
    List<String>? acceptedAnswers,
    this.rawPayload,
  }) : prompt = prompt ?? I18nDraft(),
       feedbackCorrect = feedbackCorrect ?? I18nDraft(),
       feedbackIncorrect = feedbackIncorrect ?? I18nDraft(),
       choices = choices ?? <String>['', ''],
       pairs = pairs ?? <PairDraft>[PairDraft(), PairDraft()],
       acceptedAnswers = acceptedAnswers ?? <String>[''];

  final String? id;
  bool active;

  /// Mục mà bài tập kiểm tra (đưa mục vào lịch ôn); `null` = không gắn mục.
  ItemDraft? item;

  /// Khía cạnh ôn tập: `item` hoặc (bài tập gắn chữ Kanji) `meaning`/`reading`/`word`.
  String facet;
  String type;
  I18nDraft prompt;
  I18nDraft feedbackCorrect;
  I18nDraft feedbackIncorrect;

  List<String> choices;
  int correctIndex;
  List<PairDraft> pairs;
  List<String> acceptedAnswers;

  /// JSON thô của payload; `null` khi dùng form có cấu trúc.
  String? rawPayload;

  /// Tăng mỗi khi cấu trúc đáp án đổi (thêm/bớt dòng, đổi loại) để giao diện dựng lại các ô theo giá trị mới
  /// (khóa theo chỉ số dòng sẽ giữ chữ cũ sau khi bớt một dòng giữa danh sách).
  int revision = 0;

  factory ExerciseDraft.fromJson(
    Map<String, Object?> json,
    List<ItemDraft> items,
  ) {
    final type = (json['type'] as String?) ?? 'multiple_choice';
    final payload = json['payload'] is Map
        ? Map<String, Object?>.from(json['payload'] as Map)
        : <String, Object?>{};
    final index = json['itemIndex'];
    final draft = ExerciseDraft(
      id: json['id'] as String?,
      active: (json['status'] as String?) != 'inactive',
      item: index is int && index >= 0 && index < items.length
          ? items[index]
          : null,
      facet: (json['facet'] as String?) ?? 'item',
      type: type,
      prompt: I18nDraft.fromJson(json['prompt']),
      feedbackCorrect: I18nDraft.fromJson(json['feedbackCorrect']),
      feedbackIncorrect: I18nDraft.fromJson(json['feedbackIncorrect']),
    );
    if (!draft._loadStructured(payload)) {
      draft.rawPayload = const JsonEncoder.withIndent('  ').convert(payload);
    }
    return draft;
  }

  /// Nạp payload vào form cấu trúc; trả `false` nếu có dữ liệu không phải chuỗi thuần.
  bool _loadStructured(Map<String, Object?> payload) {
    switch (type) {
      case 'multiple_choice':
        final raw = payload['choices'];
        final index = payload['correct_index'];
        if (raw is! List || !raw.every((c) => c is String) || index is! int) {
          return false;
        }
        choices = raw.cast<String>().toList();
        correctIndex = index;
        return true;
      case 'matching':
        final raw = payload['pairs'];
        if (raw is! List ||
            !raw.every(
              (p) => p is List && p.length == 2 && p.every((s) => s is String),
            )) {
          return false;
        }
        pairs = raw
            .map((p) => PairDraft(left: p[0] as String, right: p[1] as String))
            .toList();
        return true;
      case 'fill_blank':
        final raw = payload['accepted_answers'];
        if (raw is! List || !raw.every((a) => a is String)) return false;
        acceptedAnswers = raw.cast<String>().toList();
        return true;
    }
    return false;
  }

  /// Đổi loại bài tập: trả về form cấu trúc trống cho loại mới (đáp án loại cũ không áp dụng được).
  void changeType(String next) {
    if (next == type) return;
    type = next;
    rawPayload = null;
    choices = <String>['', ''];
    correctIndex = 0;
    pairs = <PairDraft>[PairDraft(), PairDraft()];
    acceptedAnswers = <String>[''];
  }

  /// Payload gửi lên server. Ném [FormatException] nếu JSON thô không hợp lệ.
  Map<String, Object?> buildPayload() {
    final raw = rawPayload;
    if (raw != null) {
      final decoded = jsonDecode(raw);
      if (decoded is! Map) {
        throw const FormatException('payload phải là đối tượng JSON');
      }
      return Map<String, Object?>.from(decoded);
    }
    switch (type) {
      case 'multiple_choice':
        return <String, Object?>{
          'choices': choices,
          'correct_index': correctIndex,
        };
      case 'matching':
        return <String, Object?>{
          'pairs': pairs.map((p) => <String>[p.left, p.right]).toList(),
        };
      default:
        return <String, Object?>{'accepted_answers': acceptedAnswers};
    }
  }

  /// Khía cạnh gửi đi cho đơn vị Kanji: bài tập gắn chữ phải là meaning/reading/word (mặc định meaning khi
  /// còn `item`), bài tập không gắn chữ luôn là `item` – khớp quy tắc kích hoạt ở server.
  String effectiveFacet({required bool hasItem}) {
    if (!hasItem) return 'item';
    return kKanjiFacets.contains(facet) ? facet : 'meaning';
  }

  /// [kanji]: bài tập của đơn vị Kanji – gửi `facet`; đơn vị khác để server dùng mặc định `item`.
  Map<String, Object?> toJson(List<ItemDraft> items, {bool kanji = false}) {
    final index = item == null ? -1 : items.indexOf(item!);
    return <String, Object?>{
      if (id != null) 'id': id,
      'status': active ? 'active' : 'inactive',
      if (index >= 0) 'itemIndex': index,
      if (kanji) 'facet': effectiveFacet(hasItem: index >= 0),
      'type': type,
      'prompt': prompt.toJson(),
      'payload': buildPayload(),
      'feedbackCorrect': feedbackCorrect.toJson(),
      'feedbackIncorrect': feedbackIncorrect.toJson(),
    };
  }
}

/// Đơn vị học đang soạn (mới hoặc đã có).
class UnitDraft {
  UnitDraft({
    this.id,
    this.kind = 'vocabulary',
    this.level = 'N5',
    this.tier = 'core',
    this.estMinutes = 5,
    this.difficulty = 1,
    this.sequence = 0,
    this.topicId,
    this.status = 'draft',
    this.isTrial = false,
    I18nDraft? title,
    Set<String>? goalTags,
    List<ItemDraft>? items,
    List<ExerciseDraft>? exercises,
  }) : title = title ?? I18nDraft(),
       goalTags = goalTags ?? <String>{},
       items = items ?? <ItemDraft>[],
       exercises = exercises ?? <ExerciseDraft>[];

  final String? id;
  String kind;
  String level;
  String tier;
  int estMinutes;
  int difficulty;
  int sequence;
  String? topicId;
  String status;
  bool isTrial;
  I18nDraft title;
  Set<String> goalTags;
  List<ItemDraft> items;
  List<ExerciseDraft> exercises;

  bool get isNew => id == null;

  factory UnitDraft.fromJson(Map<String, Object?> json) {
    final items = ((json['items'] as List?) ?? const <Object?>[])
        .map((i) => ItemDraft.fromJson(Map<String, Object?>.from(i as Map)))
        .toList();
    final exercises = ((json['exercises'] as List?) ?? const <Object?>[])
        .map(
          (e) => ExerciseDraft.fromJson(
            Map<String, Object?>.from(e as Map),
            items,
          ),
        )
        .toList();
    return UnitDraft(
      id: json['id'] as String?,
      kind: (json['kind'] as String?) ?? 'vocabulary',
      level: (json['level'] as String?) ?? 'N5',
      tier: (json['tier'] as String?) ?? 'core',
      estMinutes: (json['estMinutes'] as int?) ?? 5,
      difficulty: (json['difficulty'] as int?) ?? 1,
      sequence: (json['sequence'] as int?) ?? 0,
      topicId: json['topicId'] as String?,
      status: (json['status'] as String?) ?? 'draft',
      isTrial: (json['isTrial'] as bool?) ?? false,
      title: I18nDraft.fromJson(json['title']),
      goalTags: ((json['goalTags'] as List?) ?? const <Object?>[])
          .cast<String>()
          .toSet(),
      items: items,
      exercises: exercises,
    );
  }

  bool get isKanji => kind == 'kanji';

  /// Thân `AdminUnitWrite`. Ném [FormatException] nếu JSON thô của một bài tập không hợp lệ.
  Map<String, Object?> toJson() => <String, Object?>{
    'kind': kind,
    'title': title.toJson(),
    'level': level,
    'goalTags': goalTags.toList()..sort(),
    'topicId': topicId,
    'difficulty': difficulty,
    // Bài Kanji không có tầng nền tảng (chỉ `core`).
    'tier': level == 'N5' && !isKanji ? tier : 'core',
    'estMinutes': estMinutes,
    'sequence': sequence,
    'items': items.map((i) => i.toJson(kanji: isKanji)).toList(),
    'exercises': exercises.map((e) => e.toJson(items, kanji: isKanji)).toList(),
  };

  /// Lỗi cục bộ thấy được trước khi gửi (server vẫn kiểm tra lại). Khóa theo vị trí như `fields` của server.
  Map<String, String> localErrors() {
    final errors = <String, String>{};
    if (topicId == null) errors['topicId'] = 'topic';
    // Bản nháp được lưu dở dang (thiếu một ngôn ngữ vẫn lưu được); đủ vi + en chỉ bắt buộc khi kích hoạt.
    if (title.isEmpty) errors['title'] = 'title';
    for (var i = 0; i < items.length; i++) {
      if (items[i].japanese.trim().isEmpty) {
        errors['items[$i].japanese'] = 'japanese';
      }
      // Đã nhập chi tiết Kanji thì số nét phải hợp lệ (hợp đồng yêu cầu số nguyên 1–30 khi gửi `kanjiDetails`).
      final details = items[i].kanjiDetails;
      if (isKanji && details.isTouched && !details.hasValidStrokeCount) {
        errors['items[$i].kanjiDetails.strokeCount'] = 'strokeCount';
      }
    }
    for (var i = 0; i < exercises.length; i++) {
      final ex = exercises[i];
      if (ex.rawPayload != null) {
        try {
          ex.buildPayload();
        } on FormatException {
          errors['exercises[$i].payload'] = 'json';
        }
      }
    }
    return errors;
  }
}
