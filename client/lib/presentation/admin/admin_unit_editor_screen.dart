import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/admin_repository.dart';
import '../../data/api/api_error.dart';
import '../../domain/admin_models.dart';
import '../../domain/admin_unit_draft.dart';
import '../../l10n/app_localizations.dart';
import '../../router_paths.dart';
import '../shared/state_views.dart';
import 'admin_support.dart';
import 'admin_unit_elements.dart';
import 'admin_units_screen.dart';

final adminUnitProvider = FutureProvider.autoDispose.family<UnitDraft, String>((
  ref,
  id,
) {
  return ref.watch(adminRepositoryProvider).unit(id);
});

/// Trình soạn đơn vị học (T108, FR-030): thông tin đơn vị, mục nội dung và bài tập trong CÙNG một payload
/// (không có route riêng cho mục/bài tập). Phần tử đã có không bị xóa – chỉ chuyển "ẩn với người học" để
/// lịch sử học và lịch ôn luôn còn hợp lệ. Đơn vị mới luôn ở bản nháp; kích hoạt chạy kiểm tra nội dung.
class AdminUnitEditorScreen extends ConsumerWidget {
  const AdminUnitEditorScreen({super.key, this.unitId});

  /// `null` = tạo đơn vị mới.
  final String? unitId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final id = unitId;
    final title = id == null
        ? l10n.adminEditorNewTitle
        : l10n.adminEditorEditTitle;
    if (id == null) {
      return AdminFrame(
        section: AdminSection.units,
        title: title,
        child: _UnitForm(draft: UnitDraft()),
      );
    }
    final draft = ref.watch(adminUnitProvider(id));
    return AdminFrame(
      section: AdminSection.units,
      title: title,
      child: draft.when(
        loading: () => const LoadingView(),
        error: (Object error, StackTrace _) => ErrorView(
          error: error,
          onRetry: () => ref.invalidate(adminUnitProvider(id)),
        ),
        data: (UnitDraft data) =>
            _UnitForm(key: ValueKey<String>(id), draft: data),
      ),
    );
  }
}

class _UnitForm extends ConsumerStatefulWidget {
  const _UnitForm({super.key, required this.draft});

  final UnitDraft draft;

  @override
  ConsumerState<_UnitForm> createState() => _UnitFormState();
}

class _UnitFormState extends ConsumerState<_UnitForm> {
  late UnitDraft _draft;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _draft = widget.draft;
  }

  void _refresh() => setState(() {});

  Future<void> _save() async {
    final l10n = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    final router = GoRouter.of(context);
    if (_draft.localErrors().isNotEmpty) {
      messenger.showSnackBar(SnackBar(content: Text(l10n.adminLocalErrors)));
      return;
    }
    setState(() => _busy = true);
    try {
      final saved = await ref.read(adminRepositoryProvider).saveUnit(_draft);
      ref.invalidate(adminUnitsProvider);
      if (_draft.isNew) {
        messenger.showSnackBar(SnackBar(content: Text(l10n.adminSaved)));
        router.go('${AppRoutes.adminUnits}/${saved.id}');
        return;
      }
      if (!mounted) return;
      setState(() => _draft = saved);
      messenger.showSnackBar(SnackBar(content: Text(l10n.adminSaved)));
    } on ApiError catch (e) {
      if (mounted) await showAdminErrorDialog(context, e);
    } on FormatException {
      messenger.showSnackBar(
        SnackBar(content: Text(l10n.adminPayloadInvalidJson)),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _changeStatus({String? status, bool? isTrial}) async {
    final l10n = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _busy = true);
    try {
      final result = await ref
          .read(adminRepositoryProvider)
          .setUnitStatus(_draft.id!, status: status, isTrial: isTrial);
      ref.invalidate(adminUnitsProvider);
      if (!mounted) return;
      setState(() {
        _draft.status = result.status;
        _draft.isTrial = result.isTrial;
      });
      messenger.showSnackBar(SnackBar(content: Text(l10n.adminStatusChanged)));
    } on ApiError catch (e) {
      if (mounted) await showAdminErrorDialog(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final draft = _draft;
    final topics = ref.watch(adminTopicsProvider);
    return ListView(
      children: <Widget>[
        if (!draft.isNew)
          _StatusBar(draft: draft, busy: _busy, onChange: _changeStatus),
        _SectionCard(
          title: l10n.adminUnitInfoHeading,
          child: _BasicFields(
            draft: draft,
            topics: topics,
            onChanged: _refresh,
          ),
        ),
        const SizedBox(height: 16),
        _SectionHeading(
          title: l10n.adminItemsHeading,
          addKey: const Key('item-add'),
          addLabel: l10n.adminItemAdd,
          onAdd: () {
            draft.items.add(ItemDraft());
            _refresh();
          },
        ),
        for (var i = 0; i < draft.items.length; i++)
          ItemEditorCard(
            key: ObjectKey(draft.items[i]),
            item: draft.items[i],
            index: i,
            kind: draft.kind,
            onStructureChanged: _refresh,
            onRemove: () {
              final removed = draft.items.removeAt(i);
              for (final ex in draft.exercises) {
                if (ex.item == removed) ex.item = null;
              }
              _refresh();
            },
          ),
        const SizedBox(height: 16),
        _SectionHeading(
          title: l10n.adminExercisesHeading,
          addKey: const Key('exercise-add'),
          addLabel: l10n.adminExerciseAdd,
          onAdd: () {
            draft.exercises.add(ExerciseDraft());
            _refresh();
          },
        ),
        for (var i = 0; i < draft.exercises.length; i++)
          ExerciseEditorCard(
            key: ObjectKey(draft.exercises[i]),
            exercise: draft.exercises[i],
            index: i,
            items: draft.items,
            onStructureChanged: _refresh,
            onRemove: () {
              draft.exercises.removeAt(i);
              _refresh();
            },
          ),
        const SizedBox(height: 24),
        Row(
          children: <Widget>[
            FilledButton.icon(
              key: const Key('unit-save'),
              onPressed: _busy ? null : _save,
              icon: const Icon(Icons.save_outlined),
              label: Text(l10n.adminSave),
            ),
            const SizedBox(width: 12),
            TextButton(
              onPressed: () => context.go(AppRoutes.adminUnits),
              child: Text(l10n.actionBack),
            ),
          ],
        ),
        const SizedBox(height: 32),
      ],
    );
  }
}

class _StatusBar extends StatelessWidget {
  const _StatusBar({
    required this.draft,
    required this.busy,
    required this.onChange,
  });

  final UnitDraft draft;
  final bool busy;
  final Future<void> Function({String? status, bool? isTrial}) onChange;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final isActive = draft.status == 'active';
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Wrap(
          spacing: 12,
          runSpacing: 8,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: <Widget>[
            Chip(
              key: const Key('editor-status'),
              label: Text(unitStatusLabel(l10n, draft.status)),
            ),
            OutlinedButton(
              key: const Key('editor-toggle'),
              onPressed: busy
                  ? null
                  : () => onChange(status: isActive ? 'inactive' : 'active'),
              child: Text(
                isActive ? l10n.adminUnitDeactivate : l10n.adminUnitActivate,
              ),
            ),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                Checkbox(
                  key: const Key('editor-trial'),
                  value: draft.isTrial,
                  onChanged: busy ? null : (v) => onChange(isTrial: v ?? false),
                ),
                Text(l10n.adminUnitTrial),
              ],
            ),
            Text(
              l10n.adminSaveBeforeActivate,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(title, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            child,
          ],
        ),
      ),
    );
  }
}

class _SectionHeading extends StatelessWidget {
  const _SectionHeading({
    required this.title,
    required this.addKey,
    required this.addLabel,
    required this.onAdd,
  });

  final String title;
  final Key addKey;
  final String addLabel;
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        children: <Widget>[
          Expanded(
            child: Text(title, style: Theme.of(context).textTheme.titleMedium),
          ),
          FilledButton.tonalIcon(
            key: addKey,
            onPressed: onAdd,
            icon: const Icon(Icons.add),
            label: Text(addLabel),
          ),
        ],
      ),
    );
  }
}

/// Thông tin chung của đơn vị. Đổi loại/trình độ chỉ có tác dụng với bản nháp (server từ chối đổi loại của
/// đơn vị đã kích hoạt); mảng nội dung được lọc theo loại + trình độ để luôn khớp.
class _BasicFields extends StatelessWidget {
  const _BasicFields({
    required this.draft,
    required this.topics,
    required this.onChanged,
  });

  final UnitDraft draft;
  final AsyncValue<List<AdminTopic>> topics;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final lockKind = !draft.isNew && draft.status != 'draft';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Wrap(
          spacing: 12,
          runSpacing: 12,
          children: <Widget>[
            _Select<String>(
              fieldKey: const Key('field-kind'),
              label: l10n.adminFieldKind,
              value: draft.kind,
              enabled: !lockKind,
              options: <String, String>{
                for (final k in kUnitKinds) k: unitKindLabel(l10n, k),
              },
              onChanged: (v) {
                draft.kind = v;
                draft.topicId = null;
                onChanged();
              },
            ),
            _Select<String>(
              fieldKey: const Key('field-level'),
              label: l10n.adminFieldLevel,
              value: draft.level,
              options: <String, String>{for (final l in kContentLevels) l: l},
              onChanged: (v) {
                draft.level = v;
                if (v != 'N5') draft.tier = 'core';
                draft.topicId = null;
                onChanged();
              },
            ),
            if (draft.level == 'N5')
              _Select<String>(
                fieldKey: const Key('field-tier'),
                label: l10n.adminFieldTier,
                value: draft.tier,
                options: <String, String>{
                  'core': l10n.adminTierCore,
                  'foundation': l10n.adminTierFoundation,
                },
                onChanged: (v) {
                  draft.tier = v;
                  onChanged();
                },
              ),
            _Select<int>(
              fieldKey: const Key('field-minutes'),
              label: l10n.adminFieldMinutes,
              value: draft.estMinutes,
              options: <int, String>{
                for (final m in kEstMinutes) m: l10n.adminUnitMinutes(m),
              },
              onChanged: (v) {
                draft.estMinutes = v;
                onChanged();
              },
            ),
            _Select<int>(
              fieldKey: const Key('field-difficulty'),
              label: l10n.adminFieldDifficulty,
              value: draft.difficulty,
              options: <int, String>{for (var d = 1; d <= 5; d++) d: '$d'},
              onChanged: (v) {
                draft.difficulty = v;
                onChanged();
              },
            ),
            SizedBox(
              width: 160,
              child: DraftTextField(
                key: ValueKey<Object>((draft, 'sequence')),
                label: l10n.adminFieldSequence,
                value: '${draft.sequence}',
                onChanged: (v) =>
                    draft.sequence = int.tryParse(v) ?? draft.sequence,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        topics.when(
          loading: () => const LinearProgressIndicator(),
          error: (Object error, StackTrace _) => Text(
            l10n.errorGeneric,
            style: TextStyle(color: Theme.of(context).colorScheme.error),
          ),
          data: (List<AdminTopic> all) {
            final matching = all
                .where((t) => t.skill == draft.kind && t.level == draft.level)
                .toList();
            final selected = matching.any((t) => t.id == draft.topicId)
                ? draft.topicId
                : null;
            return SizedBox(
              width: 420,
              child: DropdownButtonFormField<String?>(
                key: ValueKey<Object>((
                  draft,
                  'topic',
                  draft.kind,
                  draft.level,
                  matching.length,
                )),
                initialValue: selected,
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
                      child: Text(pickText(context, t.name)),
                    ),
                ],
                onChanged: (v) => draft.topicId = v,
              ),
            );
          },
        ),
        const SizedBox(height: 12),
        Text(
          l10n.adminFieldGoalTags,
          style: Theme.of(context).textTheme.labelLarge,
        ),
        Wrap(
          spacing: 8,
          children: <Widget>[
            for (final tag in kGoalTags)
              FilterChip(
                key: Key('goal-$tag'),
                label: Text(goalTagLabel(l10n, tag)),
                selected: draft.goalTags.contains(tag),
                onSelected: (on) {
                  if (on) {
                    draft.goalTags.add(tag);
                  } else {
                    draft.goalTags.remove(tag);
                  }
                  onChanged();
                },
              ),
          ],
        ),
        const SizedBox(height: 12),
        I18nFields(
          owner: draft,
          slot: 'title',
          value: draft.title,
          labelVi: l10n.adminFieldTitleVi,
          labelEn: l10n.adminFieldTitleEn,
        ),
      ],
    );
  }
}

class _Select<T> extends StatelessWidget {
  const _Select({
    required this.fieldKey,
    required this.label,
    required this.value,
    required this.options,
    required this.onChanged,
    this.enabled = true,
  });

  final Key fieldKey;
  final String label;
  final T value;
  final Map<T, String> options;
  final ValueChanged<T> onChanged;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 180,
      child: DropdownButtonFormField<T>(
        key: fieldKey,
        initialValue: value,
        isDense: true,
        // Chiếm hết bề rộng ô: nội dung dài (nhãn tiếng Anh/Việt) được cắt thay vì tràn khỏi ô.
        isExpanded: true,
        decoration: InputDecoration(labelText: label, isDense: true),
        items: <DropdownMenuItem<T>>[
          for (final entry in options.entries)
            DropdownMenuItem<T>(value: entry.key, child: Text(entry.value)),
        ],
        onChanged: enabled
            ? (T? v) {
                if (v != null) onChanged(v);
              }
            : null,
      ),
    );
  }
}
