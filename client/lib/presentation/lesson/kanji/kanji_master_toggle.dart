import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/learning_repository.dart';
import '../../../l10n/app_localizations.dart';

/// Nút đánh dấu / bỏ đánh dấu một chữ Kanji đã thành thạo (US3, research K7, FR-010): chữ đã thành thạo
/// không còn xuất hiện trong gói ôn; bỏ đánh dấu thì lịch ôn tiếp tục từ ngày đã lưu. Gọi
/// `PUT /path/items/{itemId}/master`; trạng thái ban đầu là "chưa đánh dấu" (server không trả cờ này).
class KanjiMasterToggle extends ConsumerStatefulWidget {
  const KanjiMasterToggle({super.key, required this.itemId});

  final String itemId;

  @override
  ConsumerState<KanjiMasterToggle> createState() => _KanjiMasterToggleState();
}

class _KanjiMasterToggleState extends ConsumerState<KanjiMasterToggle> {
  bool _mastered = false;
  bool _busy = false;
  bool _failed = false;

  Future<void> _toggle() async {
    setState(() {
      _busy = true;
      _failed = false;
    });
    try {
      final result = await ref
          .read(learningRepositoryProvider)
          .setItemMastered(widget.itemId, mastered: !_mastered);
      if (!mounted) return;
      setState(() {
        _mastered = result;
        _busy = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _failed = true;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        TextButton.icon(
          key: Key('master-toggle-${widget.itemId}'),
          onPressed: _busy ? null : _toggle,
          icon: Icon(
            _mastered ? Icons.undo : Icons.verified_outlined,
            size: 18,
          ),
          label: Text(
            _mastered ? l10n.kanjiUnmasterAction : l10n.kanjiMasterAction,
          ),
        ),
        if (_mastered)
          Text(
            l10n.kanjiMasteredNote,
            key: Key('master-note-${widget.itemId}'),
            style: theme.textTheme.bodySmall,
          ),
        if (_failed)
          Text(
            l10n.kanjiMasterFailed,
            key: Key('master-error-${widget.itemId}'),
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.error,
            ),
          ),
      ],
    );
  }
}
