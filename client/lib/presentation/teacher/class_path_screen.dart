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
import '../onboarding/onboarding_labels.dart';
import '../path/scope_notice_banner.dart';
import '../shared/error_messages.dart';
import '../shared/page_frame.dart';
import '../shared/state_views.dart';
import 'class_path_units_section.dart';

const List<String> _startLevels = <String>[
  'none',
  'N5',
  'N4',
  'N3',
  'N2',
  'N1',
];
const List<String> _targetLevels = <String>['N5', 'N4', 'N3', 'N2', 'N1'];
const List<String> _skills = <String>['vocabulary', 'grammar', 'kanji'];
const List<int> _minutes = <int>[5, 10, 15, 30];

final DateFormat _dateFormat = DateFormat('yyyy-MM-dd');

/// Lộ trình lớp theo mẫu cho giáo viên (spec 004, US3, FR-017 → FR-025): trình độ xuất phát/đích, kỹ năng, ngày
/// bắt đầu/kết thúc và 5/10/15/30 phút mỗi ngày. Lưu trọn vẹn hoặc không đổi; cảnh báo vượt sức chứa KHÔNG chặn
/// lưu và nêu rõ khối lượng/sức chứa; thay đổi có hiệu lực từ kế hoạch được sinh kế tiếp.
class ClassPathScreen extends ConsumerStatefulWidget {
  const ClassPathScreen({super.key, required this.classId});

  final String classId;

  @override
  ConsumerState<ClassPathScreen> createState() => _ClassPathScreenState();
}

class _ClassPathScreenState extends ConsumerState<ClassPathScreen> {
  String _startLevel = 'N5';
  String _targetLevel = 'N4';
  final Set<String> _selectedSkills = <String>{'vocabulary', 'grammar'};
  DateTime _startsOn = DateTime.now();
  DateTime _endsOn = DateTime.now().add(const Duration(days: 90));
  int _dailyMinutes = 10;

  ClassPath? _saved;
  Object? _loadError;
  bool _loading = true;
  bool _saving = false;
  String? _formError;
  bool _justSaved = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _loadError = null;
    });
    try {
      final path = await ref
          .read(classRepositoryProvider)
          .classPath(widget.classId);
      if (!mounted) return;
      setState(() {
        _saved = path;
        if (path != null) _adopt(path);
      });
    } on ApiError catch (e) {
      if (mounted) setState(() => _loadError = e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _adopt(ClassPath path) {
    _startLevel = path.startLevel.value;
    _targetLevel = path.targetLevel.value;
    _selectedSkills
      ..clear()
      ..addAll(path.skills.map((s) => s.value));
    _startsOn = path.startsOn;
    _endsOn = path.endsOn;
    _dailyMinutes = int.tryParse(path.dailyMinutes.value) ?? 10;
  }

  Future<void> _pickDate({required bool start}) async {
    final initial = start ? _startsOn : _endsOn;
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(2024),
      lastDate: DateTime(2100),
    );
    if (picked == null) return;
    setState(() {
      if (start) {
        _startsOn = picked;
      } else {
        _endsOn = picked;
      }
    });
  }

  Future<void> _save() async {
    final l10n = AppLocalizations.of(context);
    if (_selectedSkills.isEmpty) {
      setState(() => _formError = l10n.classPathSkillsRequired);
      return;
    }
    if (!_endsOn.isAfter(_startsOn)) {
      setState(() => _formError = l10n.classPathEndsBeforeStarts);
      return;
    }
    setState(() {
      _saving = true;
      _formError = null;
      _justSaved = false;
    });
    try {
      final saved = await ref
          .read(classRepositoryProvider)
          .saveClassPath(
            widget.classId,
            ClassPathDraft(
              startLevel: _startLevel,
              targetLevel: _targetLevel,
              skills: _skills.where(_selectedSkills.contains).toList(),
              startsOn: _startsOn,
              endsOn: _endsOn,
              dailyMinutes: _dailyMinutes,
            ),
          );
      if (mounted) {
        setState(() {
          _saved = saved;
          _justSaved = true;
        });
      }
    } on ApiError catch (e) {
      if (mounted) setState(() => _formError = describeError(context, e));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return PageFrame(
      title: l10n.classPathTitle,
      actions: <Widget>[
        TextButton(
          key: const Key('class-path-back'),
          onPressed: () => context.go('${AppRoutes.classes}/${widget.classId}'),
          child: Text(l10n.classPathBack),
        ),
      ],
      child: _loading
          ? const LoadingView()
          : _loadError != null
          ? ErrorView(error: _loadError, onRetry: _load)
          : _form(l10n),
    );
  }

  Widget _form(AppLocalizations l10n) {
    final theme = Theme.of(context);
    final saved = _saved;
    return ListView(
      children: <Widget>[
        Text(l10n.classPathIntro),
        const SizedBox(height: 16),
        Wrap(
          spacing: 24,
          runSpacing: 16,
          children: <Widget>[
            _dropdown(
              key: 'class-path-start-level',
              label: l10n.classPathStartLevel,
              value: _startLevel,
              values: _startLevels,
              display: (v) =>
                  v == 'none' ? l10n.classPathLevelNone : levelLabel(l10n, v),
              onChanged: (v) => setState(() => _startLevel = v),
            ),
            _dropdown(
              key: 'class-path-target-level',
              label: l10n.classPathTargetLevel,
              value: _targetLevel,
              values: _targetLevels,
              display: (v) => levelLabel(l10n, v),
              onChanged: (v) => setState(() => _targetLevel = v),
            ),
          ],
        ),
        const SizedBox(height: 16),
        Text(l10n.classPathSkills, style: theme.textTheme.titleSmall),
        Wrap(
          spacing: 8,
          children: <Widget>[
            for (final skill in _skills)
              FilterChip(
                key: Key('class-path-skill-$skill'),
                label: Text(skillLabel(l10n, skill)),
                selected: _selectedSkills.contains(skill),
                onSelected: (on) => setState(() {
                  if (on) {
                    _selectedSkills.add(skill);
                  } else {
                    _selectedSkills.remove(skill);
                  }
                }),
              ),
          ],
        ),
        const SizedBox(height: 16),
        Wrap(
          spacing: 24,
          runSpacing: 8,
          children: <Widget>[
            _dateButton(
              key: 'class-path-starts-on',
              label: l10n.classPathStartsOn,
              value: _startsOn,
              onPressed: () => _pickDate(start: true),
            ),
            _dateButton(
              key: 'class-path-ends-on',
              label: l10n.classPathEndsOn,
              value: _endsOn,
              onPressed: () => _pickDate(start: false),
            ),
          ],
        ),
        const SizedBox(height: 16),
        Text(l10n.classPathMinutes, style: theme.textTheme.titleSmall),
        const SizedBox(height: 4),
        SegmentedButton<int>(
          key: const Key('class-path-minutes'),
          showSelectedIcon: false,
          segments: <ButtonSegment<int>>[
            for (final m in _minutes)
              ButtonSegment<int>(
                value: m,
                label: Text(l10n.classPathMinutesValue(m)),
              ),
          ],
          selected: <int>{_dailyMinutes},
          onSelectionChanged: (s) => setState(() => _dailyMinutes = s.first),
        ),
        if (_formError != null) ...<Widget>[
          const SizedBox(height: 12),
          Text(
            _formError!,
            key: const Key('class-path-error'),
            style: TextStyle(color: theme.colorScheme.error),
          ),
        ],
        const SizedBox(height: 16),
        FilledButton(
          key: const Key('class-path-save'),
          onPressed: _saving ? null : _save,
          child: Text(l10n.classPathSave),
        ),
        if (_justSaved) ...<Widget>[
          const SizedBox(height: 12),
          Text(l10n.classPathSaved, key: const Key('class-path-saved')),
        ],
        if (saved != null) ..._savedDetails(l10n, saved),
        // Chọn bài/thứ tự/ngày mở, bài giao và thông báo nội dung (US5).
        if (saved != null)
          ClassPathUnitsSection(
            // Khóa cố định: số dòng xem trước đổi theo lộ trình nên vị trí trong ListView dịch chuyển.
            key: const Key('class-path-units-section'),
            classId: widget.classId,
            path: saved,
            onChanged: (path) => setState(() => _saved = path),
          ),
      ],
    );
  }

  /// Cảnh báo, thông báo trần nội dung và thứ tự tham khảo của lộ trình đã lưu (máy chủ tính).
  List<Widget> _savedDetails(AppLocalizations l10n, ClassPath saved) {
    final theme = Theme.of(context);
    return <Widget>[
      if (saved.scopeNotice != null) ...<Widget>[
        const SizedBox(height: 12),
        ScopeNoticeBanner(notice: saved.scopeNotice!),
      ],
      for (final warning in saved.warnings) ...<Widget>[
        const SizedBox(height: 12),
        Card(
          key: const Key('class-path-warning'),
          color: theme.colorScheme.tertiaryContainer,
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: <Widget>[
                const Icon(Icons.warning_amber_outlined),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    l10n.classPathOverCapacity(
                      warning.requiredMinutes,
                      warning.capacityMinutes,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
      const SizedBox(height: 16),
      Text(
        l10n.classPathPreviewTitle(saved.units.length),
        style: theme.textTheme.titleSmall,
      ),
      for (final unit in saved.units.take(30))
        Text(
          '${unit.position}. ${unit.title} · ${unit.level} · ${unit.estMinutes}′',
        ),
    ];
  }

  Widget _dropdown({
    required String key,
    required String label,
    required String value,
    required List<String> values,
    required String Function(String) display,
    required ValueChanged<String> onChanged,
  }) {
    return SizedBox(
      width: 300,
      child: DropdownButtonFormField<String>(
        key: Key(key),
        initialValue: value,
        isExpanded: true,
        decoration: InputDecoration(
          labelText: label,
          border: const OutlineInputBorder(),
        ),
        items: <DropdownMenuItem<String>>[
          for (final v in values)
            DropdownMenuItem<String>(value: v, child: Text(display(v))),
        ],
        onChanged: (v) {
          if (v != null) onChanged(v);
        },
      ),
    );
  }

  Widget _dateButton({
    required String key,
    required String label,
    required DateTime value,
    required VoidCallback onPressed,
  }) {
    return OutlinedButton.icon(
      key: Key(key),
      onPressed: onPressed,
      icon: const Icon(Icons.event),
      label: Text('$label: ${_dateFormat.format(value)}'),
    );
  }
}
