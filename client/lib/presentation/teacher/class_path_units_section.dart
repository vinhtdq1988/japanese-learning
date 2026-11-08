import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:japanese_api/japanese_api.dart';

import '../../data/api/api_error.dart';
import '../../data/api_providers.dart';
import '../../data/class_repository.dart';
import '../../l10n/app_localizations.dart';
import '../shared/error_messages.dart';

final DateFormat _dateFormat = DateFormat('yyyy-MM-dd');

/// Số bài tối đa mỗi lần giao (khớp hợp đồng `POST /classes/{id}/assignments`).
const int maxAssignmentUnits = 20;

class _Pick {
  _Pick(this.unit, this.opensOn);

  final ClassPathUnit unit;
  DateTime? opensOn;
}

/// Tinh chỉnh lộ trình lớp (spec 004, US5, FR-022 → FR-025): chọn bài/thứ tự/ngày mở thay cho mẫu, giao bài kèm
/// hạn và cảnh báo khả thi (không chặn), thông báo đơn vị đã bị ngừng. Thư viện bài lấy từ danh sách mẫu của lộ
/// trình (hợp đồng không có API liệt kê thư viện riêng): khi đang ở chế độ liệt kê, "Quay lại chế độ mẫu" để nạp lại
/// đầy đủ. Thay đổi có hiệu lực từ kế hoạch được sinh kế tiếp.
class ClassPathUnitsSection extends ConsumerStatefulWidget {
  const ClassPathUnitsSection({
    super.key,
    required this.classId,
    required this.path,
    required this.onChanged,
  });

  final String classId;
  final ClassPath path;
  final ValueChanged<ClassPath> onChanged;

  @override
  ConsumerState<ClassPathUnitsSection> createState() =>
      _ClassPathUnitsSectionState();
}

class _ClassPathUnitsSectionState extends ConsumerState<ClassPathUnitsSection> {
  final Map<String, ClassPathUnit> _pool = <String, ClassPathUnit>{};
  List<_Pick> _picks = <_Pick>[];
  final Set<String> _assignPicks = <String>{};
  DateTime _dueOn = DateTime.now().add(const Duration(days: 7));

  bool _busy = false;
  String? _message;
  String? _error;
  List<PathWarning> _warnings = const <PathWarning>[];

  @override
  void initState() {
    super.initState();
    _sync(widget.path);
  }

  @override
  void didUpdateWidget(covariant ClassPathUnitsSection oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!identical(oldWidget.path, widget.path)) _sync(widget.path);
  }

  /// Nạp trạng thái từ lộ trình máy chủ trả về: thư viện khi ở chế độ mẫu, danh sách chọn khi ở chế độ liệt kê.
  void _sync(ClassPath path) {
    if (path.mode == ClassPathModeEnum.template) {
      _pool
        ..clear()
        ..addEntries(path.units.map((u) => MapEntry(u.unitId, u)));
      _picks = <_Pick>[];
    } else {
      for (final u in path.units) {
        _pool.putIfAbsent(u.unitId, () => u);
      }
      _picks = <_Pick>[for (final u in path.units) _Pick(u, u.opensOn)];
    }
  }

  Future<void> _run(Future<void> Function() action) async {
    setState(() {
      _busy = true;
      _error = null;
      _message = null;
    });
    try {
      await action();
    } on ApiError catch (e) {
      if (mounted) setState(() => _error = describeError(context, e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _saveUnits({bool reset = false}) => _run(() async {
    final l10n = AppLocalizations.of(context);
    final saved = await ref
        .read(classRepositoryProvider)
        .putPathUnits(widget.classId, <PathUnitChoice>[
          if (!reset)
            for (final p in _picks)
              PathUnitChoice(unitId: p.unit.unitId, opensOn: p.opensOn),
        ]);
    if (!mounted) return;
    setState(() => _message = l10n.classUnitsSaved);
    widget.onChanged(saved);
  });

  Future<void> _reloadPath() async {
    final path = await ref
        .read(classRepositoryProvider)
        .classPath(widget.classId);
    if (mounted && path != null) widget.onChanged(path);
  }

  Future<void> _assign() => _run(() async {
    final l10n = AppLocalizations.of(context);
    if (_assignPicks.isEmpty) {
      setState(() => _error = l10n.classAssignPickFirst);
      return;
    }
    if (_assignPicks.length > maxAssignmentUnits) {
      setState(() => _error = l10n.classAssignTooMany);
      return;
    }
    final created = await ref
        .read(classRepositoryProvider)
        .createAssignments(widget.classId, _assignPicks.toList(), _dueOn);
    if (!mounted) return;
    setState(() {
      _warnings = created.warnings ?? const <PathWarning>[];
      _message = l10n.classAssignDone(created.assignments.length);
      _assignPicks.clear();
    });
    await _reloadPath();
  });

  Future<void> _cancel(String assignmentId) => _run(() async {
    await ref
        .read(classRepositoryProvider)
        .cancelAssignment(widget.classId, assignmentId);
    if (mounted) setState(() => _warnings = const <PathWarning>[]);
    await _reloadPath();
  });

  Future<DateTime?> _pickDate(DateTime initial) => showDatePicker(
    context: context,
    initialDate: initial,
    firstDate: DateTime(2024),
    lastDate: DateTime(2100),
  );

  void _move(int index, int delta) {
    final target = index + delta;
    if (target < 0 || target >= _picks.length) return;
    setState(() {
      final item = _picks.removeAt(index);
      _picks.insert(target, item);
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        const SizedBox(height: 24),
        for (final notice in widget.path.contentNotices)
          Card(
            key: Key('class-content-notice-${notice.unitId}'),
            color: theme.colorScheme.errorContainer,
            child: ListTile(
              leading: const Icon(Icons.report_problem_outlined),
              title: Text(
                notice.source_ == ContentNoticeSource_Enum.path
                    ? l10n.classContentNoticePath(notice.title)
                    : l10n.classContentNoticeAssignment(notice.title),
              ),
            ),
          ),
        _unitsCard(l10n, theme),
        _assignCard(l10n, theme),
        if (_message != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(_message!, key: const Key('class-adjust-message')),
          ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              _error!,
              key: const Key('class-adjust-error'),
              style: TextStyle(color: theme.colorScheme.error),
            ),
          ),
      ],
    );
  }

  Widget _unitsCard(AppLocalizations l10n, ThemeData theme) {
    final chosen = _picks.map((p) => p.unit.unitId).toSet();
    final addable = _pool.values.where((u) => !chosen.contains(u.unitId));
    final explicit = widget.path.mode == ClassPathModeEnum.explicit;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(l10n.classUnitsTitle, style: theme.textTheme.titleMedium),
            const SizedBox(height: 4),
            Text(l10n.classUnitsIntro),
            const SizedBox(height: 8),
            Text(
              explicit
                  ? l10n.classUnitsModeExplicit(widget.path.units.length)
                  : l10n.classUnitsModeTemplate,
              key: const Key('class-units-mode'),
              style: theme.textTheme.labelLarge,
            ),
            const SizedBox(height: 8),
            if (_picks.isEmpty)
              Text(l10n.classUnitsEmpty, key: const Key('class-units-empty')),
            for (var i = 0; i < _picks.length; i++) _pickRow(l10n, i),
            const SizedBox(height: 8),
            DropdownButton<String>(
              key: const Key('class-units-add'),
              hint: Text(l10n.classUnitsAdd),
              isExpanded: true,
              value: null,
              items: <DropdownMenuItem<String>>[
                for (final u in addable)
                  DropdownMenuItem<String>(
                    value: u.unitId,
                    child: Text('${u.title} · ${u.level} · ${u.estMinutes}′'),
                  ),
              ],
              onChanged: _busy
                  ? null
                  : (id) {
                      final unit = _pool[id];
                      if (unit != null) {
                        setState(() => _picks.add(_Pick(unit, null)));
                      }
                    },
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 12,
              children: <Widget>[
                FilledButton(
                  key: const Key('class-units-save'),
                  onPressed: _busy || _picks.isEmpty ? null : _saveUnits,
                  child: Text(l10n.classUnitsSave),
                ),
                if (explicit)
                  OutlinedButton(
                    key: const Key('class-units-reset'),
                    onPressed: _busy ? null : () => _saveUnits(reset: true),
                    child: Text(l10n.classUnitsReset),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _pickRow(AppLocalizations l10n, int index) {
    final pick = _picks[index];
    final id = pick.unit.unitId;
    return ListTile(
      key: Key('class-unit-$id'),
      dense: true,
      contentPadding: EdgeInsets.zero,
      title: Text('${index + 1}. ${pick.unit.title}'),
      subtitle: Text(
        pick.opensOn == null
            ? l10n.classUnitsOpensNow
            : l10n.classUnitsOpensOn(_dateFormat.format(pick.opensOn!)),
      ),
      trailing: Wrap(
        children: <Widget>[
          IconButton(
            key: Key('class-unit-opens-$id'),
            tooltip: l10n.classUnitsOpensNow,
            icon: const Icon(Icons.event),
            onPressed: () async {
              final picked = await _pickDate(pick.opensOn ?? DateTime.now());
              if (picked != null) setState(() => pick.opensOn = picked);
            },
          ),
          IconButton(
            key: Key('class-unit-up-$id'),
            tooltip: l10n.classUnitsUp,
            icon: const Icon(Icons.arrow_upward),
            onPressed: index == 0 ? null : () => _move(index, -1),
          ),
          IconButton(
            key: Key('class-unit-down-$id'),
            tooltip: l10n.classUnitsDown,
            icon: const Icon(Icons.arrow_downward),
            onPressed: index == _picks.length - 1
                ? null
                : () => _move(index, 1),
          ),
          IconButton(
            key: Key('class-unit-remove-$id'),
            tooltip: l10n.classUnitsRemove,
            icon: const Icon(Icons.close),
            onPressed: () => setState(() => _picks.removeAt(index)),
          ),
        ],
      ),
    );
  }

  Widget _assignCard(AppLocalizations l10n, ThemeData theme) {
    final assignments = widget.path.assignments;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(l10n.classAssignTitle, style: theme.textTheme.titleMedium),
            const SizedBox(height: 4),
            Text(l10n.classAssignIntro),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 4,
              children: <Widget>[
                for (final u in _pool.values)
                  FilterChip(
                    key: Key('assign-unit-${u.unitId}'),
                    label: Text(u.title),
                    selected: _assignPicks.contains(u.unitId),
                    onSelected: (on) => setState(() {
                      if (on) {
                        _assignPicks.add(u.unitId);
                      } else {
                        _assignPicks.remove(u.unitId);
                      }
                    }),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 12,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: <Widget>[
                OutlinedButton.icon(
                  key: const Key('assign-due'),
                  icon: const Icon(Icons.event),
                  label: Text(l10n.classAssignDue(_dateFormat.format(_dueOn))),
                  onPressed: () async {
                    final picked = await _pickDate(_dueOn);
                    if (picked != null) setState(() => _dueOn = picked);
                  },
                ),
                FilledButton(
                  key: const Key('assign-submit'),
                  onPressed: _busy ? null : _assign,
                  child: Text(l10n.classAssignSubmit),
                ),
              ],
            ),
            for (final w in _warnings)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Card(
                  key: const Key('assign-warning'),
                  color: theme.colorScheme.tertiaryContainer,
                  child: ListTile(
                    leading: const Icon(Icons.warning_amber_outlined),
                    title: Text(
                      l10n.classAssignWarning(
                        w.requiredMinutes,
                        w.capacityMinutes,
                      ),
                    ),
                  ),
                ),
              ),
            const SizedBox(height: 8),
            if (assignments.isEmpty)
              Text(l10n.classAssignNone, key: const Key('assign-none')),
            for (final a in assignments)
              ListTile(
                key: Key('assignment-${a.id}'),
                dense: true,
                contentPadding: EdgeInsets.zero,
                title: Text(
                  l10n.classAssignItem(a.title, _dateFormat.format(a.dueOn)),
                ),
                trailing: IconButton(
                  key: Key('assign-cancel-${a.id}'),
                  tooltip: l10n.classAssignCancel,
                  icon: const Icon(Icons.delete_outline),
                  onPressed: _busy ? null : () => _cancel(a.id),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
