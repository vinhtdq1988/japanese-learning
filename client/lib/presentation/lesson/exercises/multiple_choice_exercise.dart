import 'package:flutter/material.dart';
import 'package:japanese_api/japanese_api.dart';

import 'exercise_view.dart';

/// Bài trắc nghiệm: chạm một lựa chọn là chốt đáp án (chấm tức thì ở server). Sau khi có kết quả,
/// lựa chọn đã chọn được tô đúng/sai và đáp án đúng được tô khi trả lời sai.
class MultipleChoiceExercise extends StatefulWidget {
  const MultipleChoiceExercise({
    super.key,
    required this.choices,
    required this.onSubmit,
    required this.enabled,
    this.result,
  });

  final List<String> choices;
  final AnswerCallback onSubmit;
  final bool enabled;
  final AnswerResult? result;

  @override
  State<MultipleChoiceExercise> createState() => _MultipleChoiceExerciseState();
}

class _MultipleChoiceExerciseState extends State<MultipleChoiceExercise> {
  int? _selected;

  @override
  Widget build(BuildContext context) {
    final result = widget.result;
    final correctIndex = result?.correctAnswer is int
        ? result!.correctAnswer! as int
        : null;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        for (var i = 0; i < widget.choices.length; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: OutlinedButton(
              key: Key('choice-$i'),
              style: OutlinedButton.styleFrom(
                alignment: Alignment.centerLeft,
                padding: const EdgeInsets.all(16),
                backgroundColor: _background(context, i, correctIndex),
              ),
              onPressed: widget.enabled && result == null
                  ? () {
                      setState(() => _selected = i);
                      widget.onSubmit(i);
                    }
                  : null,
              child: Text(widget.choices[i]),
            ),
          ),
      ],
    );
  }

  Color? _background(BuildContext context, int index, int? correctIndex) {
    final result = widget.result;
    if (result == null) return null;
    if (index == _selected) {
      return resultColor(context, correct: result.isCorrect ?? false);
    }
    if (index == correctIndex) return resultColor(context, correct: true);
    return null;
  }
}
