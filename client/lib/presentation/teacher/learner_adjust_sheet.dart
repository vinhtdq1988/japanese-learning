import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:japanese_api/japanese_api.dart';

import '../../data/api/api_error.dart';
import '../../data/api_providers.dart';
import '../../data/class_repository.dart';
import '../../l10n/app_localizations.dart';
import '../shared/error_messages.dart';

const List<int> _minuteOptions = <int>[5, 10, 15, 30];
const int _maxShiftDays = 60;

/// Mở bảng điều chỉnh riêng cho một học viên (spec 004, US5, FR-026) từ chi tiết học viên. Trả `true` khi đã lưu
/// để màn hình gọi nạp lại chi tiết.
Future<bool> showLearnerAdjustSheet(
  BuildContext context, {
  required String classId,
  required ClassLearnerDetail detail,
}) async {
  final saved = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    builder: (_) => LearnerAdjustSheet(classId: classId, detail: detail),
  );
  return saved ?? false;
}

/// Miễn bài, phút mỗi ngày riêng và dời mốc cho MỘT học viên. Chỉ ảnh hưởng người đó, gắn với giai đoạn thành
/// viên hiện tại (rời rồi vào lại bắt đầu sạch) và có hiệu lực từ kế hoạch sinh kế tiếp.
class LearnerAdjustSheet extends ConsumerStatefulWidget {
  const LearnerAdjustSheet({
    super.key,
    required this.classId,
    required this.detail,
  });

  final String classId;
  final ClassLearnerDetail detail;

  @override
  ConsumerState<LearnerAdjustSheet> createState() => _LearnerAdjustSheetState();
}

class _LearnerAdjustSheetState extends ConsumerState<LearnerAdjustSheet> {
  int? _minutes;
  int _shiftDays = 0;
  late Set<String> _exempt;
  late Set<String> _initialExempt;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final overrides = widget.detail.row.overrides;
    _minutes = int.tryParse(overrides?.dailyMinutes?.value ?? '');
    _shiftDays = overrides?.shiftDays ?? 0;
    _initialExempt = <String>{
      for (final u in widget.detail.units)
        if (u.status == ClassLearnerDetailUnitsInnerStatusEnum.exempt) u.unitId,
    };
    _exempt = <String>{..._initialExempt};
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    final repo = ref.read(classRepositoryProvider);
    final userId = widget.detail.userId;
    try {
      await repo.putOverride(
        widget.classId,
        userId,
        dailyMinutes: _minutes,
        shiftDays: _shiftDays,
      );
      for (final id in _exempt.difference(_initialExempt)) {
        await repo.setExemption(widget.classId, userId, id, exempt: true);
      }
      for (final id in _initialExempt.difference(_exempt)) {
        await repo.setExemption(widget.classId, userId, id, exempt: false);
      }
      if (mounted) Navigator.of(context).pop(true);
    } on ApiError catch (e) {
      if (mounted) setState(() => _error = describeError(context, e));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Padding(
      padding: EdgeInsets.only(
        left: 24,
        right: 24,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
      ),
      child: SingleChildScrollView(
        child: Column(
          key: const Key('learner-adjust-sheet'),
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Text(l10n.learnerAdjustTitle, style: theme.textTheme.titleLarge),
            Text(widget.detail.displayName),
            const SizedBox(height: 16),
            DropdownButtonFormField<int?>(
              key: const Key('adjust-minutes'),
              initialValue: _minutes,
              decoration: InputDecoration(
                labelText: l10n.learnerAdjustMinutes,
                border: const OutlineInputBorder(),
              ),
              items: <DropdownMenuItem<int?>>[
                DropdownMenuItem<int?>(
                  value: null,
                  child: Text(l10n.learnerAdjustMinutesClass),
                ),
                for (final m in _minuteOptions)
                  DropdownMenuItem<int?>(
                    value: m,
                    child: Text(l10n.classPathMinutesValue(m)),
                  ),
              ],
              onChanged: (v) => setState(() => _minutes = v),
            ),
            const SizedBox(height: 16),
            Row(
              children: <Widget>[
                IconButton(
                  key: const Key('adjust-shift-less'),
                  tooltip: l10n.learnerAdjustShiftLess,
                  icon: const Icon(Icons.remove_circle_outline),
                  onPressed: _shiftDays <= -_maxShiftDays
                      ? null
                      : () => setState(() => _shiftDays -= 1),
                ),
                Expanded(
                  child: Text(
                    l10n.learnerAdjustShift(_shiftDays),
                    key: const Key('adjust-shift'),
                    textAlign: TextAlign.center,
                  ),
                ),
                IconButton(
                  key: const Key('adjust-shift-more'),
                  tooltip: l10n.learnerAdjustShiftMore,
                  icon: const Icon(Icons.add_circle_outline),
                  onPressed: _shiftDays >= _maxShiftDays
                      ? null
                      : () => setState(() => _shiftDays += 1),
                ),
              ],
            ),
            Text(l10n.learnerAdjustShiftHelp, style: theme.textTheme.bodySmall),
            const SizedBox(height: 16),
            Text(l10n.learnerAdjustExempt, style: theme.textTheme.titleSmall),
            for (final u in widget.detail.units)
              CheckboxListTile(
                key: Key('adjust-exempt-${u.unitId}'),
                dense: true,
                contentPadding: EdgeInsets.zero,
                title: Text(u.title),
                value: _exempt.contains(u.unitId),
                onChanged: (on) => setState(() {
                  if (on ?? false) {
                    _exempt.add(u.unitId);
                  } else {
                    _exempt.remove(u.unitId);
                  }
                }),
              ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  _error!,
                  key: const Key('adjust-error'),
                  style: TextStyle(color: theme.colorScheme.error),
                ),
              ),
            const SizedBox(height: 12),
            FilledButton(
              key: const Key('adjust-save'),
              onPressed: _saving ? null : _save,
              child: Text(l10n.learnerAdjustSave),
            ),
          ],
        ),
      ),
    );
  }
}
