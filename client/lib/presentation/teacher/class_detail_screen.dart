import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:japanese_api/japanese_api.dart';

import '../../data/api/api_error.dart';
import '../../data/api_providers.dart';
import '../../data/class_repository.dart';
import '../../l10n/app_localizations.dart';
import '../../platform/platform_providers.dart';
import '../../router_paths.dart';
import '../admin/admin_support.dart';
import '../org/org_license_banner.dart';
import '../shared/confirm_dialog.dart';
import '../shared/form_dialog.dart';
import '../shared/page_frame.dart';
import '../shared/state_views.dart';

final DateFormat _dateFormat = DateFormat('yyyy-MM-dd');

/// Chi tiết lớp cho người quản lý (spec 004, US2, FR-009 → FR-015): danh sách học viên theo trạng thái, mời
/// bằng email, nhập CSV, mã tham gia (bật/tắt/đổi/hạn), gỡ học viên và lưu trữ lớp. Lớp chưa có lộ trình hiện
/// lời nhắc "đặt lộ trình trước khi mời" (FR-010). Quy tắc thật do server kiểm.
class ClassDetailScreen extends ConsumerStatefulWidget {
  const ClassDetailScreen({super.key, required this.classId});

  final String classId;

  @override
  ConsumerState<ClassDetailScreen> createState() => _ClassDetailScreenState();
}

class _ClassDetailScreenState extends ConsumerState<ClassDetailScreen> {
  ClassDetail? _detail;
  List<RosterRow> _roster = const <RosterRow>[];
  JoinCode? _joinCode;
  ImportResults? _results;
  Object? _error;
  bool _loading = true;

  bool get _archived => _detail?.status == ClassDetailStatusEnum.archived;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = _detail == null;
      _error = null;
    });
    final repo = ref.read(classRepositoryProvider);
    try {
      final detail = await repo.classDetail(widget.classId);
      final roster = await repo.roster(widget.classId);
      final code = await repo.joinCode(widget.classId);
      if (mounted) {
        setState(() {
          _detail = detail;
          _roster = roster;
          _joinCode = code;
        });
      }
    } on ApiError catch (e) {
      if (mounted) setState(() => _error = e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Thao tác ghi: lỗi hiện hộp thoại, thành công tải lại.
  Future<void> _act(Future<void> Function() action) async {
    try {
      await action();
    } on ApiError catch (e) {
      if (mounted) await showAdminErrorDialog(context, e);
      return;
    }
    if (mounted) await _load();
  }

  Future<void> _inviteByEmail() async {
    final l10n = AppLocalizations.of(context);
    final values = await showFormDialog(
      context,
      title: l10n.classInviteByEmail,
      submitLabel: l10n.classInviteByEmail,
      fields: <FormFieldSpec>[
        FormFieldSpec(
          name: 'emails',
          label: l10n.classInviteEmailsLabel,
          required: true,
        ),
      ],
    );
    if (values == null) return;
    final emails = values['emails']!
        .split(RegExp(r'[,;\s]+'))
        .where((e) => e.isNotEmpty)
        .toList();
    await _act(() async {
      final results = await ref
          .read(classRepositoryProvider)
          .invite(widget.classId, emails);
      if (mounted) setState(() => _results = results);
    });
  }

  Future<void> _importCsv() async {
    final l10n = AppLocalizations.of(context);
    final text = await ref.read(fileTransferProvider).pickCsv();
    if (text == null || text.trim().isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(l10n.classImportEmpty)));
      }
      return;
    }
    await _act(() async {
      final results = await ref
          .read(classRepositoryProvider)
          .importCsv(widget.classId, text);
      if (mounted) setState(() => _results = results);
    });
  }

  Future<void> _removeMember(RosterRow row) async {
    final l10n = AppLocalizations.of(context);
    final ok = await showConfirmDialog(
      context,
      title: l10n.classRemoveMember,
      message: l10n.classRemoveMemberMessage(row.displayName),
      confirmLabel: l10n.classRemoveMember,
      destructive: true,
    );
    if (ok && row.userId != null) {
      await _act(
        () => ref
            .read(classRepositoryProvider)
            .removeMember(widget.classId, row.userId!),
      );
    }
  }

  Future<void> _revokeInvitation(RosterRow row) async {
    if (row.invitationId == null) return;
    await _act(
      () =>
          ref.read(classRepositoryProvider).revokeInvitation(row.invitationId!),
    );
  }

  Future<void> _toggleCode(bool enabled) => _act(() async {
    await ref
        .read(classRepositoryProvider)
        .setJoinCode(widget.classId, enabled: enabled);
  });

  Future<void> _setExpiry() async {
    final l10n = AppLocalizations.of(context);
    final values = await showFormDialog(
      context,
      title: l10n.classJoinCodeSetExpiry,
      submitLabel: l10n.classJoinCodeSetExpiry,
      fields: <FormFieldSpec>[
        FormFieldSpec(
          name: 'date',
          label: l10n.classJoinCodeExpiryLabel,
          initial: _joinCode?.expiresAt == null
              ? ''
              : _dateFormat.format(_joinCode!.expiresAt!.toLocal()),
        ),
      ],
    );
    if (values == null) return;
    final raw = values['date']!;
    final parsed = raw.isEmpty ? null : DateTime.tryParse('${raw}T23:59:59');
    if (raw.isNotEmpty && parsed == null) return;
    await _act(() async {
      await ref
          .read(classRepositoryProvider)
          .setJoinCode(
            widget.classId,
            enabled: _joinCode?.enabled ?? false,
            expiresAt: parsed,
            setExpiry: true,
          );
    });
  }

  /// Đổi ngưỡng số ngày vắng để cảnh báo (1–14, FR-031).
  Future<void> _editThreshold(ClassDetail detail) async {
    final l10n = AppLocalizations.of(context);
    final values = await showFormDialog(
      context,
      title: l10n.classAbsenceThresholdEdit,
      submitLabel: l10n.classAbsenceThresholdEdit,
      fields: <FormFieldSpec>[
        FormFieldSpec(
          name: 'days',
          label: l10n.classAbsenceThresholdLabel,
          initial: '${detail.absenceThresholdDays ?? 3}',
          required: true,
          number: true,
        ),
      ],
    );
    if (values == null) return;
    final days = int.tryParse(values['days']!);
    if (days == null || days < 1 || days > 14) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(l10n.classAbsenceThresholdInvalid)),
        );
      }
      return;
    }
    await _act(
      () => ref
          .read(classRepositoryProvider)
          .setAbsenceThreshold(widget.classId, days),
    );
  }

  Future<void> _exportCsv() async {
    final l10n = AppLocalizations.of(context);
    await _act(() async {
      final file = await ref
          .read(classRepositoryProvider)
          .exportClassCsv(widget.classId);
      await ref.read(fileTransferProvider).saveCsv(file.filename, file.bytes);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(l10n.classExportDone(file.filename))),
        );
      }
    });
  }

  Future<void> _archive() async {
    final l10n = AppLocalizations.of(context);
    final ok = await showConfirmDialog(
      context,
      title: l10n.classArchive,
      message: l10n.classArchiveMessage(
        _roster.where((r) => r.status == RosterRowStatusEnum.joined).length,
      ),
      confirmLabel: l10n.classArchive,
      destructive: true,
    );
    if (!ok) return;
    await _act(() async {
      await ref.read(classRepositoryProvider).archiveClass(widget.classId);
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(l10n.classArchived)));
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return PageFrame(
      title: _detail?.name ?? l10n.classesTitle,
      actions: <Widget>[
        TextButton(
          onPressed: () => context.go(AppRoutes.classes),
          child: Text(l10n.classesTitle),
        ),
      ],
      child: _loading
          ? const LoadingView()
          : _error != null && _detail == null
          ? ErrorView(error: _error, onRetry: _load)
          : _content(l10n, _detail!),
    );
  }

  Widget _content(AppLocalizations l10n, ClassDetail detail) {
    final theme = Theme.of(context);
    return ListView(
      children: <Widget>[
        const OrgLicenseBanner(),
        if (_archived)
          Card(
            key: const Key('class-archived-banner'),
            color: theme.colorScheme.secondaryContainer,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Text(l10n.classArchivedBanner),
            ),
          ),
        if (!detail.hasPath && !_archived)
          Card(
            key: const Key('class-no-path'),
            color: theme.colorScheme.tertiaryContainer,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: <Widget>[
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Text(
                          l10n.classNoPathTitle,
                          style: theme.textTheme.titleMedium,
                        ),
                        Text(l10n.classNoPathMessage),
                      ],
                    ),
                  ),
                  FilledButton(
                    key: const Key('class-set-path'),
                    onPressed: () =>
                        context.go('${AppRoutes.classes}/${detail.id}/path'),
                    child: Text(l10n.classSetPath),
                  ),
                ],
              ),
            ),
          ),
        if (detail.hasPath && !_archived)
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              key: const Key('class-edit-path'),
              onPressed: () =>
                  context.go('${AppRoutes.classes}/${detail.id}/path'),
              icon: const Icon(Icons.route_outlined),
              label: Text(l10n.classEditPath),
            ),
          ),
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton.icon(
            key: const Key('class-open-dashboard'),
            onPressed: () =>
                context.go('${AppRoutes.classes}/${detail.id}/dashboard'),
            icon: const Icon(Icons.insights_outlined),
            label: Text(l10n.classDashboardOpen),
          ),
        ),
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton.icon(
            key: const Key('class-open-placement'),
            onPressed: () =>
                context.go('${AppRoutes.classes}/${detail.id}/placement'),
            icon: const Icon(Icons.assignment_outlined),
            label: Text(l10n.classPlacementOpen),
          ),
        ),
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton.icon(
            key: const Key('class-open-weak-topics'),
            onPressed: () =>
                context.go('${AppRoutes.classes}/${detail.id}/weak-topics'),
            icon: const Icon(Icons.trending_down),
            label: Text(l10n.classWeakTopicsOpen),
          ),
        ),
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton.icon(
            key: const Key('class-export-csv'),
            onPressed: _exportCsv,
            icon: const Icon(Icons.download),
            label: Text(l10n.classExportCsv),
          ),
        ),
        if (detail.absenceThresholdDays != null)
          ListTile(
            key: const Key('class-absence-threshold'),
            dense: true,
            contentPadding: EdgeInsets.zero,
            title: Text(
              l10n.classAbsenceThreshold(detail.absenceThresholdDays!),
            ),
            trailing: _archived
                ? null
                : TextButton(
                    key: const Key('class-edit-threshold'),
                    onPressed: () => _editThreshold(detail),
                    child: Text(l10n.classAbsenceThresholdEdit),
                  ),
          ),
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton.icon(
            key: const Key('class-open-pauses'),
            onPressed: () =>
                context.go('${AppRoutes.classes}/${detail.id}/pauses'),
            icon: const Icon(Icons.pause_circle_outline),
            label: Text(l10n.classPausesOpen),
          ),
        ),
        _membersCard(l10n, detail),
        if (_results != null) _resultsCard(l10n, _results!),
        if (!_archived) _joinCodeCard(l10n, detail),
        if (!_archived)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Align(
              alignment: Alignment.centerLeft,
              child: OutlinedButton.icon(
                key: const Key('class-archive'),
                onPressed: _archive,
                icon: const Icon(Icons.archive_outlined),
                label: Text(l10n.classArchive),
              ),
            ),
          ),
      ],
    );
  }

  String _statusLabel(AppLocalizations l10n, RosterRowStatusEnum status) =>
      switch (status) {
        RosterRowStatusEnum.joined => l10n.rosterJoined,
        RosterRowStatusEnum.invited => l10n.rosterInvited,
        RosterRowStatusEnum.declined => l10n.rosterDeclined,
        RosterRowStatusEnum.switchedPersonal => l10n.rosterSwitchedPersonal,
        RosterRowStatusEnum.removed => l10n.rosterRemoved,
        RosterRowStatusEnum.otherEnded => l10n.rosterOtherEnded,
      };

  Widget _membersCard(AppLocalizations l10n, ClassDetail detail) {
    final theme = Theme.of(context);
    final canInvite = detail.hasPath && !_archived;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Row(
              children: <Widget>[
                Expanded(
                  child: Text(
                    '${l10n.classMembersTitle} · ${l10n.classMemberCount(detail.memberCount)}',
                    style: theme.textTheme.titleMedium,
                  ),
                ),
                if (!_archived) ...<Widget>[
                  OutlinedButton.icon(
                    key: const Key('class-invite'),
                    onPressed: canInvite ? _inviteByEmail : null,
                    icon: const Icon(Icons.mail_outline),
                    label: Text(l10n.classInviteByEmail),
                  ),
                  const SizedBox(width: 8),
                  OutlinedButton.icon(
                    key: const Key('class-import'),
                    onPressed: canInvite ? _importCsv : null,
                    icon: const Icon(Icons.upload_file),
                    label: Text(l10n.classImportCsv),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 8),
            if (_roster.isEmpty)
              Text(l10n.classRosterEmpty, key: const Key('class-roster-empty')),
            for (final row in _roster)
              ListTile(
                key: Key('roster-${row.status.value}-${row.displayName}'),
                dense: true,
                contentPadding: EdgeInsets.zero,
                title: Text(row.displayName),
                subtitle: Text(
                  '${_statusLabel(l10n, row.status)} · ${_dateFormat.format(row.at.toLocal())}',
                ),
                trailing: _rowAction(l10n, row),
              ),
          ],
        ),
      ),
    );
  }

  Widget? _rowAction(AppLocalizations l10n, RosterRow row) {
    if (_archived) return null;
    if (row.status == RosterRowStatusEnum.joined && row.userId != null) {
      return TextButton(
        key: Key('remove-${row.userId}'),
        onPressed: () => _removeMember(row),
        child: Text(l10n.classRemoveMember),
      );
    }
    if (row.status == RosterRowStatusEnum.invited && row.invitationId != null) {
      return TextButton(
        key: Key('revoke-${row.invitationId}'),
        onPressed: () => _revokeInvitation(row),
        child: Text(l10n.classRevokeInvitation),
      );
    }
    return null;
  }

  String _outcomeLabel(
    AppLocalizations l10n,
    ImportResultsResultsInnerOutcomeEnum outcome,
  ) => switch (outcome) {
    ImportResultsResultsInnerOutcomeEnum.invited => l10n.outcomeInvited,
    ImportResultsResultsInnerOutcomeEnum.invalidEmail =>
      l10n.outcomeInvalidEmail,
    ImportResultsResultsInnerOutcomeEnum.duplicateInFile =>
      l10n.outcomeDuplicateInFile,
    ImportResultsResultsInnerOutcomeEnum.alreadyInClass =>
      l10n.outcomeAlreadyInClass,
    ImportResultsResultsInnerOutcomeEnum.alreadyInOtherClass =>
      l10n.outcomeAlreadyInOtherClass,
    ImportResultsResultsInnerOutcomeEnum.alreadyInvited =>
      l10n.outcomeAlreadyInvited,
    ImportResultsResultsInnerOutcomeEnum.noSeat => l10n.outcomeNoSeat,
    ImportResultsResultsInnerOutcomeEnum.unavailable => l10n.outcomeUnavailable,
  };

  Widget _resultsCard(AppLocalizations l10n, ImportResults results) {
    final theme = Theme.of(context);
    return Card(
      key: const Key('class-results'),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              l10n.classInviteResultTitle,
              style: theme.textTheme.titleMedium,
            ),
            Text(
              l10n.classImportSummary(
                results.summary['total'] ?? results.results.length,
                results.summary['invited'] ?? 0,
              ),
              key: const Key('class-results-summary'),
            ),
            const SizedBox(height: 8),
            for (final r in results.results)
              Text(
                '${r.row ?? '-'}. ${r.email} — ${_outcomeLabel(l10n, r.outcome)}',
                key: Key('result-${r.row ?? r.email}'),
              ),
          ],
        ),
      ),
    );
  }

  Widget _joinCodeCard(AppLocalizations l10n, ClassDetail detail) {
    final theme = Theme.of(context);
    final code = _joinCode;
    final enabled = code?.enabled ?? false;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(l10n.classJoinCodeTitle, style: theme.textTheme.titleMedium),
            const SizedBox(height: 8),
            if (code?.code != null)
              SelectableText(
                code!.code!,
                key: const Key('class-code'),
                style: theme.textTheme.headlineSmall?.copyWith(
                  letterSpacing: 4,
                  fontFeatures: const <FontFeature>[
                    FontFeature.tabularFigures(),
                  ],
                ),
              ),
            if (!enabled)
              Text(l10n.classJoinCodeOff, key: const Key('class-code-off')),
            if (enabled)
              Text(
                code?.expiresAt == null
                    ? l10n.classJoinCodeNoExpiry
                    : l10n.classJoinCodeExpiresOn(
                        _dateFormat.format(code!.expiresAt!.toLocal()),
                      ),
              ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: <Widget>[
                FilledButton(
                  key: const Key('class-code-toggle'),
                  onPressed: detail.hasPath
                      ? () => _toggleCode(!enabled)
                      : null,
                  child: Text(
                    enabled
                        ? l10n.classJoinCodeDisable
                        : l10n.classJoinCodeEnable,
                  ),
                ),
                if (code?.code != null)
                  OutlinedButton(
                    key: const Key('class-code-rotate'),
                    onPressed: () => _act(() async {
                      await ref
                          .read(classRepositoryProvider)
                          .rotateJoinCode(widget.classId);
                    }),
                    child: Text(l10n.classJoinCodeRotate),
                  ),
                if (enabled)
                  OutlinedButton(
                    key: const Key('class-code-expiry'),
                    onPressed: _setExpiry,
                    child: Text(l10n.classJoinCodeSetExpiry),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
