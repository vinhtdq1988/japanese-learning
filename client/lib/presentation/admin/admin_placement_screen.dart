import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/admin_repository.dart';
import '../../data/api/api_error.dart';
import '../../domain/admin_models.dart';
import '../../domain/admin_unit_draft.dart';
import '../../l10n/app_localizations.dart';
import '../shared/confirm_dialog.dart';
import '../shared/state_views.dart';
import 'admin_support.dart';
import 'admin_unit_elements.dart';

final adminPlacementProvider =
    FutureProvider.autoDispose<List<AdminPlacementQuestion>>((ref) {
      return ref.watch(adminRepositoryProvider).placementQuestions();
    });

/// Số câu theo trình độ của bộ hiện hành (FR-007): 8 N5, 6 N4, 6 N3.
const Map<String, int> kPlacementQuota = <String, int>{
  'N5': 8,
  'N4': 6,
  'N3': 6,
};

/// Câu hỏi kiểm tra trình độ (T108, FR-007, FR-030): thêm/sửa câu hỏi và chọn rồi kích hoạt nguyên tử cả
/// bộ 20 câu. Nút kích hoạt chỉ bật khi đúng 8/6/6 – server vẫn kiểm tra lại và giữ bộ cũ nếu sai.
class AdminPlacementScreen extends ConsumerStatefulWidget {
  const AdminPlacementScreen({super.key});

  @override
  ConsumerState<AdminPlacementScreen> createState() =>
      _AdminPlacementScreenState();
}

class _AdminPlacementScreenState extends ConsumerState<AdminPlacementScreen> {
  /// Tập đã chọn; `null` cho tới khi dữ liệu đầu tiên về (mặc định là bộ hiện hành).
  Set<String>? _selected;
  bool _busy = false;

  Set<String> _selectionFor(List<AdminPlacementQuestion> all) =>
      _selected ??= <String>{
        for (final q in all)
          if (q.isActive) q.id,
      };

  Map<String, int> _counts(
    List<AdminPlacementQuestion> all,
    Set<String> selected,
  ) {
    final counts = <String, int>{for (final l in kPlacementQuota.keys) l: 0};
    for (final q in all) {
      if (selected.contains(q.id)) counts[q.level] = (counts[q.level] ?? 0) + 1;
    }
    return counts;
  }

  /// Thứ tự gửi lên: câu đang thuộc bộ hiện hành giữ vị trí cũ, câu mới chọn nối sau theo thứ tự danh sách.
  List<String> _orderedIds(
    List<AdminPlacementQuestion> all,
    Set<String> selected,
  ) {
    final chosen = all.where((q) => selected.contains(q.id)).toList();
    final current = chosen.where((q) => q.isActive).toList()
      ..sort((a, b) => a.position.compareTo(b.position));
    final added = chosen.where((q) => !q.isActive);
    return <String>[...current.map((q) => q.id), ...added.map((q) => q.id)];
  }

  Future<void> _activate(
    List<AdminPlacementQuestion> all,
    Set<String> selected,
  ) async {
    final l10n = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    final confirmed = await showConfirmDialog(
      context,
      title: l10n.adminPlacementActivateTitle,
      message: l10n.adminPlacementActivateMessage,
      confirmLabel: l10n.adminPlacementActivate,
    );
    if (!confirmed || !mounted) return;
    setState(() => _busy = true);
    try {
      await ref
          .read(adminRepositoryProvider)
          .activatePlacementSet(_orderedIds(all, selected));
      _selected = null;
      ref.invalidate(adminPlacementProvider);
      messenger.showSnackBar(
        SnackBar(content: Text(l10n.adminPlacementActivated)),
      );
    } on ApiError catch (e) {
      if (mounted) await showAdminErrorDialog(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _edit(AdminPlacementQuestion? question) async {
    final saved = await showDialog<bool>(
      context: context,
      builder: (_) => _QuestionDialog(question: question),
    );
    if (saved == true) {
      _selected = null;
      ref.invalidate(adminPlacementProvider);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final questions = ref.watch(adminPlacementProvider);
    return AdminFrame(
      section: AdminSection.placement,
      child: questions.when(
        loading: () => const LoadingView(),
        error: (Object error, StackTrace _) => ErrorView(
          error: error,
          onRetry: () => ref.invalidate(adminPlacementProvider),
        ),
        data: (List<AdminPlacementQuestion> all) {
          final selected = _selectionFor(all);
          final counts = _counts(all, selected);
          final valid = kPlacementQuota.entries.every(
            (e) => counts[e.key] == e.value,
          );
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Wrap(
                spacing: 12,
                runSpacing: 8,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: <Widget>[
                  FilledButton.icon(
                    key: const Key('pq-create'),
                    onPressed: () => _edit(null),
                    icon: const Icon(Icons.add),
                    label: Text(l10n.adminPlacementCreate),
                  ),
                  Text(
                    l10n.adminPlacementCounts(
                      counts['N5']!,
                      counts['N4']!,
                      counts['N3']!,
                    ),
                    key: const Key('pq-counts'),
                  ),
                  FilledButton(
                    key: const Key('pq-activate'),
                    onPressed: valid && !_busy
                        ? () => _activate(all, selected)
                        : null,
                    child: Text(l10n.adminPlacementActivate),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Expanded(
                child: all.isEmpty
                    ? EmptyView(
                        icon: Icons.quiz_outlined,
                        title: l10n.adminPlacementEmpty,
                      )
                    : ListView.separated(
                        itemCount: all.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (BuildContext context, int index) {
                          final q = all[index];
                          return _QuestionTile(
                            question: q,
                            selected: selected.contains(q.id),
                            onSelected: (on) => setState(() {
                              if (on) {
                                selected.add(q.id);
                              } else {
                                selected.remove(q.id);
                              }
                            }),
                            onEdit: () => _edit(q),
                          );
                        },
                      ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _QuestionTile extends StatelessWidget {
  const _QuestionTile({
    required this.question,
    required this.selected,
    required this.onSelected,
    required this.onEdit,
  });

  final AdminPlacementQuestion question;
  final bool selected;
  final ValueChanged<bool> onSelected;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final q = question;
    return Card(
      key: Key('pq-${q.id}'),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        child: Row(
          children: <Widget>[
            Checkbox(
              key: Key('pq-check-${q.id}'),
              value: selected,
              onChanged: (v) => onSelected(v ?? false),
            ),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(q.prompt, style: Theme.of(context).textTheme.titleSmall),
                  Wrap(
                    spacing: 8,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: <Widget>[
                      Text('${q.level} · ${unitKindLabel(l10n, q.skill)}'),
                      Text(
                        l10n.adminPlacementCorrect(q.choices[q.correctChoice]),
                      ),
                      if (q.isActive)
                        Chip(
                          label: Text(l10n.adminPlacementCurrent(q.position)),
                          visualDensity: VisualDensity.compact,
                        ),
                    ],
                  ),
                ],
              ),
            ),
            IconButton(
              key: Key('pq-edit-${q.id}'),
              tooltip: l10n.adminPlacementEdit,
              onPressed: onEdit,
              icon: const Icon(Icons.edit_outlined),
            ),
          ],
        ),
      ),
    );
  }
}

/// Hộp thoại thêm/sửa một câu hỏi. Đóng với `true` khi đã lưu thành công.
class _QuestionDialog extends ConsumerStatefulWidget {
  const _QuestionDialog({this.question});

  final AdminPlacementQuestion? question;

  @override
  ConsumerState<_QuestionDialog> createState() => _QuestionDialogState();
}

class _QuestionDialogState extends ConsumerState<_QuestionDialog> {
  late String _level;
  late String _skill;
  String? _topicId;
  late String _prompt;
  late final I18nDraft _hint;
  late List<String> _choices;
  late int _correct;
  int _revision = 0;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    final q = widget.question;
    _level = q?.level ?? 'N5';
    _skill = q?.skill ?? 'vocabulary';
    _topicId = q?.topicId;
    _prompt = q?.prompt ?? '';
    _hint = q?.hint ?? I18nDraft();
    _choices = q == null ? <String>['', '', '', ''] : q.choices.toList();
    _correct = q?.correctChoice ?? 0;
  }

  Future<void> _save() async {
    final topic = _topicId;
    if (topic == null ||
        _prompt.trim().isEmpty ||
        _choices.any((c) => c.trim().isEmpty)) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(AppLocalizations.of(context).adminPlacementIncomplete),
        ),
      );
      return;
    }
    setState(() => _busy = true);
    try {
      await ref
          .read(adminRepositoryProvider)
          .savePlacementQuestion(
            PlacementQuestionInput(
              level: _level,
              skill: _skill,
              topicId: topic,
              prompt: _prompt.trim(),
              hint: _hint,
              choices: _choices.map((c) => c.trim()).toList(),
              correctChoice: _correct,
            ),
            id: widget.question?.id,
          );
      if (mounted) Navigator.of(context).pop(true);
    } on ApiError catch (e) {
      if (mounted) {
        setState(() => _busy = false);
        await showAdminErrorDialog(context, e);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final topics =
        ref.watch(adminTopicsProvider).asData?.value ?? const <AdminTopic>[];
    final matching = topics.where((t) => t.skill == _skill).toList();
    final isEdit = widget.question != null;
    return AlertDialog(
      key: const Key('pq-dialog'),
      title: Text(isEdit ? l10n.adminPlacementEdit : l10n.adminPlacementCreate),
      content: SizedBox(
        width: 560,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Row(
                children: <Widget>[
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      key: const Key('pq-level'),
                      initialValue: _level,
                      isDense: true,
                      decoration: InputDecoration(
                        labelText: l10n.adminFieldLevel,
                        isDense: true,
                      ),
                      items: <DropdownMenuItem<String>>[
                        for (final l in kContentLevels)
                          DropdownMenuItem<String>(value: l, child: Text(l)),
                      ],
                      onChanged: (v) => setState(() => _level = v ?? _level),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      key: const Key('pq-skill'),
                      initialValue: _skill,
                      isDense: true,
                      decoration: InputDecoration(
                        labelText: l10n.adminFieldKind,
                        isDense: true,
                      ),
                      items: <DropdownMenuItem<String>>[
                        for (final k in kUnitKinds)
                          DropdownMenuItem<String>(
                            value: k,
                            child: Text(unitKindLabel(l10n, k)),
                          ),
                      ],
                      onChanged: (v) => setState(() {
                        _skill = v ?? _skill;
                        _topicId = null;
                      }),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String?>(
                key: ValueKey<Object>(('topic', _skill, matching.length)),
                initialValue: matching.any((t) => t.id == _topicId)
                    ? _topicId
                    : null,
                isExpanded: true,
                isDense: true,
                decoration: InputDecoration(
                  labelText: l10n.adminFieldTopic,
                  isDense: true,
                ),
                items: <DropdownMenuItem<String?>>[
                  for (final t in matching)
                    DropdownMenuItem<String?>(
                      value: t.id,
                      child: Text('${t.level} · ${pickText(context, t.name)}'),
                    ),
                ],
                onChanged: (v) => _topicId = v,
              ),
              const SizedBox(height: 12),
              DraftTextField(
                key: const Key('pq-prompt'),
                label: l10n.adminPlacementPrompt,
                value: _prompt,
                onChanged: (v) => _prompt = v,
              ),
              const SizedBox(height: 12),
              I18nFields(
                owner: this,
                slot: 'hint',
                value: _hint,
                labelVi: l10n.adminPlacementHintVi,
                labelEn: l10n.adminPlacementHintEn,
              ),
              const SizedBox(height: 12),
              for (var i = 0; i < _choices.length; i++)
                Padding(
                  key: ValueKey<Object>(('choice', i, _revision)),
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Row(
                    children: <Widget>[
                      IconButton(
                        key: Key('pq-correct-$i'),
                        tooltip: l10n.adminChoiceCorrect,
                        onPressed: () => setState(() => _correct = i),
                        icon: Icon(
                          _correct == i
                              ? Icons.check_circle
                              : Icons.radio_button_unchecked,
                          color: _correct == i
                              ? Theme.of(context).colorScheme.primary
                              : null,
                        ),
                      ),
                      Expanded(
                        child: DraftTextField(
                          key: Key('pq-choice-$i'),
                          label: l10n.adminChoiceLabel(i + 1),
                          value: _choices[i],
                          onChanged: (v) => _choices[i] = v,
                        ),
                      ),
                      IconButton(
                        onPressed: _choices.length <= 2
                            ? null
                            : () => setState(() {
                                _choices.removeAt(i);
                                if (_correct >= _choices.length) {
                                  _correct = _choices.length - 1;
                                } else if (_correct > i) {
                                  _correct -= 1;
                                }
                                _revision += 1;
                              }),
                        icon: const Icon(Icons.close),
                      ),
                    ],
                  ),
                ),
              TextButton.icon(
                onPressed: _choices.length >= 6
                    ? null
                    : () => setState(() {
                        _choices.add('');
                        _revision += 1;
                      }),
                icon: const Icon(Icons.add),
                label: Text(l10n.adminChoiceAdd),
              ),
            ],
          ),
        ),
      ),
      actions: <Widget>[
        TextButton(
          onPressed: _busy ? null : () => Navigator.of(context).pop(false),
          child: Text(l10n.actionCancel),
        ),
        FilledButton(
          key: const Key('pq-save'),
          onPressed: _busy ? null : _save,
          child: Text(l10n.actionSave),
        ),
      ],
    );
  }
}
