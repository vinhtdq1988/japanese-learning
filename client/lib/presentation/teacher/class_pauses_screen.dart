import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:japanese_api/japanese_api.dart';

import '../../data/api/api_error.dart';
import '../../data/api_providers.dart';
import '../../data/class_repository.dart';
import '../../l10n/app_localizations.dart';
import '../../router_paths.dart';
import '../shared/error_messages.dart';
import '../shared/page_frame.dart';
import '../shared/state_views.dart';

final DateFormat _dateFormat = DateFormat('yyyy-MM-dd');

/// Tạm dừng cả lớp hoặc một học viên (spec 004, US5, FR-022, FR-026, FR-031): ngày tạm dừng không bị tính là bỏ
/// lỡ và không sinh cảnh báo. Khoảng mở (chưa có ngày kết thúc) kết thúc thủ công; kỳ nghỉ đặt trước (có ngày
/// kết thúc ở tương lai) cũng hợp lệ. Dời mốc cả lớp sau kỳ nghỉ = chỉnh ngày trong lộ trình lớp.
class ClassPausesScreen extends ConsumerStatefulWidget {
  const ClassPausesScreen({super.key, required this.classId});

  final String classId;

  @override
  ConsumerState<ClassPausesScreen> createState() => _ClassPausesScreenState();
}

class _ClassPausesScreenState extends ConsumerState<ClassPausesScreen> {
  List<ClassPause> _pauses = const <ClassPause>[];
  List<ClassLearnerRow> _learners = const <ClassLearnerRow>[];
  Object? _loadError;
  bool _loading = true;

  String? _scopeUserId;
  DateTime _startedOn = DateTime.now();
  DateTime? _endedOn;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = _pauses.isEmpty;
      _loadError = null;
    });
    try {
      final repo = ref.read(classRepositoryProvider);
      final results = await Future.wait<Object>(<Future<Object>>[
        repo.pauses(widget.classId),
        repo.dashboard(widget.classId),
      ]);
      if (!mounted) return;
      setState(() {
        _pauses = results[0] as List<ClassPause>;
        _learners = (results[1] as ClassDashboard).learners;
      });
    } on ApiError catch (e) {
      if (mounted) setState(() => _loadError = e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _run(Future<void> Function() action) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await action();
      await _load();
    } on ApiError catch (e) {
      if (mounted) setState(() => _error = describeError(context, e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _create() => _run(
    () => ref
        .read(classRepositoryProvider)
        .createPause(
          widget.classId,
          userId: _scopeUserId,
          startedOn: _startedOn,
          endedOn: _endedOn,
        ),
  );

  Future<void> _end(ClassPause pause) => _run(
    () => ref
        .read(classRepositoryProvider)
        .endPause(widget.classId, pause.id)
        .then((_) {}),
  );

  Future<void> _pick({required bool start}) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: (start ? _startedOn : _endedOn) ?? _startedOn,
      firstDate: DateTime(2024),
      lastDate: DateTime(2100),
    );
    if (picked == null) return;
    setState(() {
      if (start) {
        _startedOn = picked;
      } else {
        _endedOn = picked;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return PageFrame(
      title: l10n.classPausesTitle,
      actions: <Widget>[
        TextButton(
          key: const Key('pauses-back'),
          onPressed: () => context.go('${AppRoutes.classes}/${widget.classId}'),
          child: Text(l10n.classPausesBack),
        ),
      ],
      child: _loading
          ? const LoadingView()
          : _loadError != null
          ? ErrorView(error: _loadError, onRetry: _load)
          : _content(l10n),
    );
  }

  String _who(AppLocalizations l10n, ClassPause p) =>
      p.userId == null ? l10n.classPausesScopeClass : (p.displayName ?? '—');

  Widget _content(AppLocalizations l10n) {
    final theme = Theme.of(context);
    return ListView(
      children: <Widget>[
        Text(l10n.classPausesIntro),
        const SizedBox(height: 16),
        Wrap(
          spacing: 16,
          runSpacing: 8,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: <Widget>[
            SizedBox(
              width: 300,
              child: DropdownButtonFormField<String?>(
                key: const Key('pause-scope'),
                initialValue: _scopeUserId,
                isExpanded: true,
                decoration: InputDecoration(
                  labelText: l10n.classPausesScope,
                  border: const OutlineInputBorder(),
                ),
                items: <DropdownMenuItem<String?>>[
                  DropdownMenuItem<String?>(
                    value: null,
                    child: Text(l10n.classPausesScopeClass),
                  ),
                  for (final r in _learners)
                    DropdownMenuItem<String?>(
                      value: r.userId,
                      child: Text(r.displayName),
                    ),
                ],
                onChanged: (v) => setState(() => _scopeUserId = v),
              ),
            ),
            OutlinedButton.icon(
              key: const Key('pause-start'),
              icon: const Icon(Icons.event),
              label: Text(
                l10n.classPausesStart(_dateFormat.format(_startedOn)),
              ),
              onPressed: () => _pick(start: true),
            ),
            OutlinedButton.icon(
              key: const Key('pause-end'),
              icon: const Icon(Icons.event_available),
              label: Text(
                _endedOn == null
                    ? l10n.classPausesEndNone
                    : l10n.classPausesEnd(_dateFormat.format(_endedOn!)),
              ),
              onPressed: () => _pick(start: false),
            ),
            FilledButton(
              key: const Key('pause-create'),
              onPressed: _busy ? null : _create,
              child: Text(l10n.classPausesCreate),
            ),
          ],
        ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              _error!,
              key: const Key('pause-error'),
              style: TextStyle(color: theme.colorScheme.error),
            ),
          ),
        const SizedBox(height: 16),
        if (_pauses.isEmpty)
          Text(l10n.classPausesNone, key: const Key('pauses-none')),
        for (final p in _pauses)
          Card(
            child: ListTile(
              key: Key('pause-${p.id}'),
              title: Text(
                l10n.classPausesItem(
                  _who(l10n, p),
                  _dateFormat.format(p.startedOn),
                  p.endedOn == null
                      ? l10n.classPausesOpenEnded
                      : _dateFormat.format(p.endedOn!),
                ),
              ),
              trailing: p.endedOn == null
                  ? TextButton(
                      key: Key('pause-close-${p.id}'),
                      onPressed: _busy ? null : () => _end(p),
                      child: Text(l10n.classPausesEndAction),
                    )
                  : null,
            ),
          ),
        const SizedBox(height: 16),
        Text(l10n.classPausesShiftHint),
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton(
            key: const Key('pauses-open-path'),
            onPressed: () =>
                context.go('${AppRoutes.classes}/${widget.classId}/path'),
            child: Text(l10n.classPausesOpenPath),
          ),
        ),
      ],
    );
  }
}
