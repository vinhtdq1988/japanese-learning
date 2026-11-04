import 'package:flutter/material.dart';
import 'package:japanese_api/japanese_api.dart';

import '../../../l10n/app_localizations.dart';
import 'exercise_view.dart';

/// Bài điền từ: nhập chuỗi rồi chốt bằng nút "Kiểm tra" (hoặc Enter). Server chấm theo tập đáp án cố định,
/// chuẩn hóa khi so khớp.
class FillBlankExercise extends StatefulWidget {
  const FillBlankExercise({
    super.key,
    required this.onSubmit,
    required this.enabled,
    this.hint,
    this.result,
  });

  final String? hint;
  final AnswerCallback onSubmit;
  final bool enabled;
  final AnswerResult? result;

  @override
  State<FillBlankExercise> createState() => _FillBlankExerciseState();
}

class _FillBlankExerciseState extends State<FillBlankExercise> {
  final TextEditingController _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  bool get _canSubmit =>
      widget.enabled &&
      widget.result == null &&
      _controller.text.trim().isNotEmpty;

  void _submit() {
    if (_canSubmit) widget.onSubmit(_controller.text.trim());
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final result = widget.result;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        TextField(
          key: const Key('fill-blank-input'),
          controller: _controller,
          enabled: widget.enabled && result == null,
          autofocus: true,
          onChanged: (_) => setState(() {}),
          onSubmitted: (_) => _submit(),
          decoration: InputDecoration(
            labelText: l10n.lessonFillBlankLabel,
            helperText: widget.hint,
            filled: result != null,
            fillColor: result == null
                ? null
                : resultColor(context, correct: result.isCorrect ?? false),
            border: const OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 12),
        Align(
          alignment: Alignment.centerLeft,
          child: FilledButton(
            key: const Key('submit-answer'),
            onPressed: _canSubmit ? _submit : null,
            child: Text(l10n.lessonCheck),
          ),
        ),
      ],
    );
  }
}
