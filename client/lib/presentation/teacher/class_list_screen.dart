import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:japanese_api/japanese_api.dart';

import '../../data/api/api_error.dart';
import '../../data/api_providers.dart';
import '../../l10n/app_localizations.dart';
import '../../router_paths.dart';
import '../admin/admin_support.dart';
import '../org/org_license_banner.dart';
import '../shared/form_dialog.dart';
import '../shared/page_frame.dart';
import '../shared/state_views.dart';

/// Danh sách lớp của giáo viên (lớp mình phụ trách) hoặc chủ tổ chức (mọi lớp) — spec 004, US2, FR-009.
/// Giáo viên tạo lớp ở đây rồi vào chi tiết để đặt lộ trình và đưa học viên vào. Quyền thật do server kiểm.
class ClassListScreen extends ConsumerStatefulWidget {
  const ClassListScreen({super.key});

  @override
  ConsumerState<ClassListScreen> createState() => _ClassListScreenState();
}

class _ClassListScreenState extends ConsumerState<ClassListScreen> {
  List<ClassRow>? _classes;
  Object? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final classes = await ref.read(classRepositoryProvider).classes();
      if (mounted) setState(() => _classes = classes);
    } on ApiError catch (e) {
      if (mounted) setState(() => _error = e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _create() async {
    final l10n = AppLocalizations.of(context);
    final values = await showFormDialog(
      context,
      title: l10n.classesCreate,
      submitLabel: l10n.classesCreate,
      fields: <FormFieldSpec>[
        FormFieldSpec(
          name: 'name',
          label: l10n.classCreateName,
          required: true,
        ),
        FormFieldSpec(name: 'description', label: l10n.classCreateDescription),
      ],
    );
    if (values == null) return;
    try {
      final created = await ref
          .read(classRepositoryProvider)
          .createClass(
            name: values['name']!,
            description: values['description'],
          );
      if (mounted) context.go('${AppRoutes.classes}/${created.id}');
    } on ApiError catch (e) {
      if (mounted) await showAdminErrorDialog(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return PageFrame(
      title: l10n.classesTitle,
      actions: <Widget>[
        FilledButton.icon(
          key: const Key('class-create'),
          onPressed: _create,
          icon: const Icon(Icons.add),
          label: Text(l10n.classesCreate),
        ),
      ],
      child: Column(
        children: <Widget>[
          // Cảnh báo giấy phép sắp hết/ân hạn/hết hạn cho giáo viên (US6, FR-006).
          const OrgLicenseBanner(),
          Expanded(
            child: _loading && _classes == null
                ? const LoadingView()
                : _error != null && _classes == null
                ? ErrorView(error: _error, onRetry: _load)
                : _list(l10n, _classes!),
          ),
        ],
      ),
    );
  }

  Widget _list(AppLocalizations l10n, List<ClassRow> classes) {
    if (classes.isEmpty) {
      return EmptyView(
        key: const Key('classes-empty'),
        icon: Icons.school_outlined,
        title: l10n.classesEmpty,
      );
    }
    return ListView(
      children: <Widget>[
        for (final c in classes)
          Card(
            child: ListTile(
              key: Key('class-${c.id}'),
              title: Text(c.name),
              subtitle: Text(
                <String>[
                  l10n.classMemberCount(c.memberCount),
                  c.teachers.map((t) => t.displayName).join(', '),
                ].where((s) => s.isNotEmpty).join(' · '),
              ),
              trailing: Wrap(
                spacing: 8,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: <Widget>[
                  if (c.status == ClassRowStatusEnum.archived)
                    Chip(label: Text(l10n.classArchivedChip)),
                  if (c.teacherless && c.status == ClassRowStatusEnum.active)
                    Chip(label: Text(l10n.classTeacherless)),
                  if (!c.hasPath && c.status == ClassRowStatusEnum.active)
                    Chip(label: Text(l10n.classNoPathTitle)),
                ],
              ),
              onTap: () => context.go('${AppRoutes.classes}/${c.id}'),
            ),
          ),
      ],
    );
  }
}
