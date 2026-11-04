import 'package:flutter/material.dart';
import 'package:japanese_api/japanese_api.dart';

import '../../../l10n/app_localizations.dart';
import 'exercise_view.dart';

/// Bài ghép cặp: chọn một mục bên trái rồi mục tương ứng bên phải (vế phải do server đã xáo). Chạm lại
/// mục đã ghép để bỏ cặp. Đủ cặp thì nút "Kiểm tra" mở; đáp án gửi dạng danh sách [vế trái, vế phải].
class MatchingExercise extends StatefulWidget {
  const MatchingExercise({
    super.key,
    required this.left,
    required this.right,
    required this.onSubmit,
    required this.enabled,
    this.result,
  });

  final List<String> left;
  final List<String> right;
  final AnswerCallback onSubmit;
  final bool enabled;
  final AnswerResult? result;

  @override
  State<MatchingExercise> createState() => _MatchingExerciseState();
}

class _MatchingExerciseState extends State<MatchingExercise> {
  /// Vế trái đang chọn, chờ ghép.
  int? _pendingLeft;

  /// Chỉ số vế trái → chỉ số vế phải đã ghép.
  final Map<int, int> _pairs = <int, int>{};

  bool get _locked => !widget.enabled || widget.result != null;
  bool get _complete =>
      widget.left.isNotEmpty && _pairs.length == widget.left.length;

  void _tapLeft(int i) {
    if (_locked) return;
    setState(() {
      if (_pairs.containsKey(i)) {
        _pairs.remove(i); // chạm lại cặp đã ghép → bỏ cặp
        _pendingLeft = i;
      } else {
        _pendingLeft = _pendingLeft == i ? null : i;
      }
    });
  }

  void _tapRight(int j) {
    if (_locked) return;
    setState(() {
      final taken = _pairs.entries.where((e) => e.value == j).toList();
      if (taken.isNotEmpty) {
        _pairs.remove(taken.first.key); // vế phải đã ghép → bỏ cặp đó
        return;
      }
      final left = _pendingLeft;
      if (left == null) return;
      _pairs[left] = j;
      _pendingLeft = null;
    });
  }

  void _reset() => setState(() {
    _pairs.clear();
    _pendingLeft = null;
  });

  void _submit() {
    if (!_complete || _locked) return;
    widget.onSubmit(<List<String>>[
      for (var i = 0; i < widget.left.length; i++)
        <String>[widget.left[i], widget.right[_pairs[i]!]],
    ]);
  }

  /// Màu theo thứ tự cặp để người học nhìn ra các cặp đã ghép.
  Color _pairColor(BuildContext context, int pairIndex) {
    const hues = <double>[210, 30, 140, 280, 340, 60, 180, 100];
    return HSLColor.fromAHSL(
      1,
      hues[pairIndex % hues.length],
      0.55,
      Theme.of(context).brightness == Brightness.dark ? 0.35 : 0.82,
    ).toColor();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final pairOrder = _pairs.keys.toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Text(l10n.lessonMatchingInstruction),
        const SizedBox(height: 12),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Expanded(
              child: Column(
                children: <Widget>[
                  for (var i = 0; i < widget.left.length; i++)
                    _cell(
                      key: Key('match-left-$i'),
                      label: widget.left[i],
                      color: _pairs.containsKey(i)
                          ? _pairColor(context, pairOrder.indexOf(i))
                          : null,
                      selected: _pendingLeft == i,
                      onTap: () => _tapLeft(i),
                    ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                children: <Widget>[
                  for (var j = 0; j < widget.right.length; j++)
                    _cell(
                      key: Key('match-right-$j'),
                      label: widget.right[j],
                      color: _rightColor(context, j, pairOrder),
                      selected: false,
                      onTap: () => _tapRight(j),
                    ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: <Widget>[
            FilledButton(
              key: const Key('submit-answer'),
              onPressed: _complete && !_locked ? _submit : null,
              child: Text(l10n.lessonCheck),
            ),
            const SizedBox(width: 8),
            TextButton(
              key: const Key('match-reset'),
              onPressed: _locked || _pairs.isEmpty ? null : _reset,
              child: Text(l10n.lessonMatchingReset),
            ),
          ],
        ),
      ],
    );
  }

  Color? _rightColor(BuildContext context, int j, List<int> pairOrder) {
    for (final entry in _pairs.entries) {
      if (entry.value == j) {
        return _pairColor(context, pairOrder.indexOf(entry.key));
      }
    }
    return null;
  }

  Widget _cell({
    required Key key,
    required String label,
    required bool selected,
    required VoidCallback onTap,
    Color? color,
  }) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: OutlinedButton(
        key: key,
        style: OutlinedButton.styleFrom(
          alignment: Alignment.centerLeft,
          padding: const EdgeInsets.all(14),
          backgroundColor: color,
          side: BorderSide(
            color: selected ? scheme.primary : scheme.outline,
            width: selected ? 2.5 : 1,
          ),
        ),
        onPressed: _locked ? null : onTap,
        child: Text(label),
      ),
    );
  }
}
