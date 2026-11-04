import 'fake_backend.dart';

/// Máy chủ giả cho luồng dùng thử (US8): nội dung công khai kèm đáp án, chấm kiểm tra trình độ không
/// lưu và sự kiện ẩn danh. Chỉ mô phỏng phần hợp đồng client dùng; logic thật được kiểm thử ở backend.
class TrialScenario {
  TrialScenario(this.backend) {
    _install();
  }

  final FakeBackend backend;

  /// Đơn vị từ vựng: 1 trắc nghiệm (đúng = chỉ số 1) + 1 điền từ (đáp án `は`).
  static Map<String, Object?> get vocabularyUnit => <String, Object?>{
    'id': 'unit-vocab',
    'kind': 'vocabulary',
    'title': 'Chào hỏi',
    'estMinutes': 5,
    'items': <Map<String, Object?>>[
      <String, Object?>{
        'id': 'item-1',
        'kind': 'vocabulary',
        'japanese': 'こんにちは',
        'reading': 'こんにちは',
        'meaning': 'Xin chào',
        'examples': <Map<String, Object?>>[],
      },
    ],
    'exercises': <Map<String, Object?>>[
      <String, Object?>{
        'id': 'ex-1',
        'type': 'multiple_choice',
        'prompt': 'こんにちは nghĩa là gì?',
        'payload': <String, Object?>{
          'choices': <String>['Tạm biệt', 'Xin chào'],
        },
        'answerKey': <String, Object?>{'correctIndex': 1},
        'feedbackCorrect': 'Chính xác!',
        'feedbackIncorrect': 'Chưa đúng.',
      },
      <String, Object?>{
        'id': 'ex-2',
        'type': 'fill_blank',
        'prompt': 'わたし＿がくせいです。',
        'payload': <String, Object?>{},
        'answerKey': <String, Object?>{
          'acceptedAnswers': <String>['は'],
        },
        'feedbackCorrect': 'Đúng rồi.',
        'feedbackIncorrect': 'Sai rồi.',
      },
    ],
  };

  /// Đơn vị ngữ pháp: 1 bài ghép cặp (水→nước, お茶→trà; vế phải hiển thị [trà, nước]).
  static Map<String, Object?> get grammarUnit => <String, Object?>{
    'id': 'unit-grammar',
    'kind': 'grammar',
    'title': 'Câu với です',
    'estMinutes': 5,
    'items': <Map<String, Object?>>[
      <String, Object?>{
        'id': 'item-2',
        'kind': 'grammar',
        'japanese': 'AはBです',
        'meaning': 'A là B',
        'explanation': 'Câu khẳng định danh từ.',
        'examples': <Map<String, Object?>>[],
      },
    ],
    'exercises': <Map<String, Object?>>[
      <String, Object?>{
        'id': 'ex-3',
        'type': 'matching',
        'prompt': 'Ghép từ với nghĩa',
        'payload': <String, Object?>{
          'left': <String>['水', 'お茶'],
          'right': <String>['trà', 'nước'],
        },
        'answerKey': <String, Object?>{
          'pairs': <List<String>>[
            <String>['水', 'nước'],
            <String>['お茶', 'trà'],
          ],
        },
        'feedbackCorrect': 'Chuẩn.',
        'feedbackIncorrect': 'Chưa khớp.',
      },
    ],
  };

  static Map<String, Object?> get placementResult => <String, Object?>{
    'id': null,
    'estimatedLevel': 'N4',
    'score': 12,
    'total': 3,
    'strongTopics': <String>['Trợ từ'],
    'weakTopics': <String>['Số đếm'],
    'guessSuspected': false,
  };

  static List<Map<String, Object?>> get questions =>
      List<Map<String, Object?>>.generate(
        3,
        (i) => <String, Object?>{
          'id': 'q${i + 1}',
          'skill': i.isEven ? 'vocabulary' : 'grammar',
          'prompt': '問題${i + 1}',
          'choices': <String>['あ', 'い', 'う', 'え'],
        },
      );

  void _install() {
    backend.on(
      'GET /trial/content',
      (_) => FakeResponse(200, <String, Object?>{
        'units': <Map<String, Object?>>[vocabularyUnit, grammarUnit],
      }),
    );
    backend.on(
      'GET /placement/questions',
      (_) => FakeResponse(200, <String, Object?>{
        'timeLimitSeconds': 600,
        'questions': questions,
      }),
    );
    backend.on(
      'POST /trial/placement/grade',
      (_) => FakeResponse(200, placementResult),
    );
    backend.on('POST /trial/events', (_) => const FakeResponse(204));
  }
}
