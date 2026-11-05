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

/// Bộ lọc danh sách đơn vị (record có so sánh theo giá trị nên dùng được làm khóa của provider family).
typedef AdminUnitFilter = ({String? status, String? level, String? kind});

final adminUnitsProvider = FutureProvider.autoDispose
    .family<List<AdminUnitSummary>, AdminUnitFilter>((ref, filter) {
      return ref
          .watch(adminRepositoryProvider)
          .units(status: filter.status, level: filter.level, kind: filter.kind);
    });

/// Danh sách đơn vị học (T108, FR-030): lọc theo trạng thái/trình độ/loại, kích hoạt hoặc vô hiệu hóa,
/// đánh dấu thuộc tập dùng thử và mở trình soạn. Kích hoạt chạy kiểm tra nội dung ở server nên đơn vị
/// thiếu bản dịch hay bài tập sẽ bị từ chối kèm lý do cụ thể.
class AdminUnitsScreen extends ConsumerStatefulWidget {
  const AdminUnitsScreen({super.key});

  @override
  ConsumerState<AdminUnitsScreen> createState() => _AdminUnitsScreenState();
}

class _AdminUnitsScreenState extends ConsumerState<AdminUnitsScreen> {
  String? _status;
  String? _level;
  String? _kind;
  bool _busy = false;

  AdminUnitFilter get _filter => (status: _status, level: _level, kind: _kind);

  Future<void> _change(
    AdminUnitSummary unit, {
    String? status,
    bool? isTrial,
  }) async {
    final l10n = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _busy = true);
    try {
      await ref
          .read(adminRepositoryProvider)
          .setUnitStatus(unit.id, status: status, isTrial: isTrial);
      ref.invalidate(adminUnitsProvider);
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
    final units = ref.watch(adminUnitsProvider(_filter));
    return AdminFrame(
      section: AdminSection.units,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Wrap(
            spacing: 12,
            runSpacing: 12,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: <Widget>[
              _FilterDropdown(
                fieldKey: const Key('filter-status'),
                label: l10n.adminFilterStatus,
                value: _status,
                options: <String, String>{
                  'draft': l10n.adminStatusDraft,
                  'active': l10n.adminStatusActive,
                  'inactive': l10n.adminStatusInactive,
                },
                onChanged: (v) => setState(() => _status = v),
              ),
              _FilterDropdown(
                fieldKey: const Key('filter-level'),
                label: l10n.adminFilterLevel,
                value: _level,
                options: <String, String>{for (final l in kContentLevels) l: l},
                onChanged: (v) => setState(() => _level = v),
              ),
              _FilterDropdown(
                fieldKey: const Key('filter-kind'),
                label: l10n.adminFilterKind,
                value: _kind,
                options: <String, String>{
                  for (final k in kUnitKinds) k: unitKindLabel(l10n, k),
                },
                onChanged: (v) => setState(() => _kind = v),
              ),
              FilledButton.icon(
                key: const Key('unit-create'),
                onPressed: () => context.go(AppRoutes.adminUnitNew),
                icon: const Icon(Icons.add),
                label: Text(l10n.adminUnitsCreate),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Expanded(
            child: units.when(
              loading: () => const LoadingView(),
              error: (Object error, StackTrace _) => ErrorView(
                error: error,
                onRetry: () => ref.invalidate(adminUnitsProvider),
              ),
              data: (List<AdminUnitSummary> data) {
                if (data.isEmpty) {
                  return EmptyView(
                    icon: Icons.menu_book_outlined,
                    title: l10n.adminUnitsEmpty,
                  );
                }
                return ListView.separated(
                  itemCount: data.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (BuildContext context, int index) => _UnitCard(
                    unit: data[index],
                    busy: _busy,
                    onChange: _change,
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _FilterDropdown extends StatelessWidget {
  const _FilterDropdown({
    required this.fieldKey,
    required this.label,
    required this.value,
    required this.options,
    required this.onChanged,
  });

  final Key fieldKey;
  final String label;
  final String? value;
  final Map<String, String> options;
  final ValueChanged<String?> onChanged;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return SizedBox(
      width: 200,
      child: DropdownButtonFormField<String?>(
        key: fieldKey,
        initialValue: value,
        isDense: true,
        isExpanded: true,
        decoration: InputDecoration(labelText: label, isDense: true),
        items: <DropdownMenuItem<String?>>[
          DropdownMenuItem<String?>(
            value: null,
            child: Text(l10n.adminFilterAll),
          ),
          for (final entry in options.entries)
            DropdownMenuItem<String?>(
              value: entry.key,
              child: Text(entry.value),
            ),
        ],
        onChanged: onChanged,
      ),
    );
  }
}

class _UnitCard extends StatelessWidget {
  const _UnitCard({
    required this.unit,
    required this.busy,
    required this.onChange,
  });

  final AdminUnitSummary unit;
  final bool busy;
  final Future<void> Function(
    AdminUnitSummary unit, {
    String? status,
    bool? isTrial,
  })
  onChange;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final isActive = unit.status == 'active';
    return Card(
      key: Key('unit-${unit.id}'),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: <Widget>[
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    pickText(context, unit.title),
                    style: theme.textTheme.titleMedium,
                  ),
                  const SizedBox(height: 4),
                  Wrap(
                    spacing: 8,
                    runSpacing: 4,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: <Widget>[
                      Text(
                        '${unit.level} · ${unitKindLabel(l10n, unit.kind)} · '
                        '${l10n.adminUnitMinutes(unit.estMinutes)} · '
                        '${tierLabel(l10n, unit.tier)}',
                      ),
                      Chip(
                        key: Key('unit-status-${unit.id}'),
                        label: Text(unitStatusLabel(l10n, unit.status)),
                        visualDensity: VisualDensity.compact,
                        backgroundColor: isActive
                            ? theme.colorScheme.primaryContainer
                            : null,
                      ),
                      if (unit.isTrial)
                        Chip(
                          label: Text(l10n.adminUnitTrial),
                          visualDensity: VisualDensity.compact,
                        ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                Tooltip(
                  message: l10n.adminUnitTrial,
                  child: Checkbox(
                    key: Key('unit-trial-${unit.id}'),
                    value: unit.isTrial,
                    onChanged: busy
                        ? null
                        : (v) => onChange(unit, isTrial: v ?? false),
                  ),
                ),
                OutlinedButton(
                  key: Key('unit-toggle-${unit.id}'),
                  onPressed: busy
                      ? null
                      : () => onChange(
                          unit,
                          status: isActive ? 'inactive' : 'active',
                        ),
                  child: Text(
                    isActive
                        ? l10n.adminUnitDeactivate
                        : l10n.adminUnitActivate,
                  ),
                ),
                const SizedBox(width: 8),
                FilledButton.tonal(
                  key: Key('unit-edit-${unit.id}'),
                  onPressed: () =>
                      context.go('${AppRoutes.adminUnits}/${unit.id}'),
                  child: Text(l10n.adminUnitEdit),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
