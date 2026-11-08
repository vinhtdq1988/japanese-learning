import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:japanese_api/japanese_api.dart';

import '../../data/api/api_error.dart';
import '../../data/api_providers.dart';
import '../../l10n/app_localizations.dart';
import '../admin/admin_support.dart';
import '../shared/confirm_dialog.dart';
import '../shared/form_dialog.dart';
import '../shared/page_frame.dart';
import '../shared/state_views.dart';

final DateFormat _dateFormat = DateFormat('yyyy-MM-dd');

/// Tổng quan của chủ tổ chức (spec 004, US1, FR-003, FR-006, FR-040): số seat tổng/đã dùng/giữ chỗ/còn trống,
/// kỳ hạn giấy phép kèm cảnh báo sắp hết/ân hạn/hết hạn, giáo viên (mời, gỡ, cấp lại/thu hồi seat), lớp và
/// lời mời đang chờ. Server chỉ trả cho chủ tổ chức (403 với người khác); UI chỉ ẩn/hiện.
class OrgOverviewScreen extends ConsumerStatefulWidget {
  const OrgOverviewScreen({super.key});

  @override
  ConsumerState<OrgOverviewScreen> createState() => _OrgOverviewScreenState();
}

class _OrgOverviewScreenState extends ConsumerState<OrgOverviewScreen> {
  OrgOverview? _overview;
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
      final overview = await ref.read(orgRepositoryProvider).overview();
      if (mounted) setState(() => _overview = overview);
    } on ApiError catch (e) {
      if (mounted) setState(() => _error = e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Thao tác ghi: lỗi hiện hộp thoại, thành công tải lại tổng quan.
  Future<void> _act(Future<void> Function() action) async {
    try {
      await action();
    } on ApiError catch (e) {
      if (mounted) await showAdminErrorDialog(context, e);
      return;
    }
    if (mounted) await _load();
  }

  Future<void> _inviteTeacher() async {
    final l10n = AppLocalizations.of(context);
    final values = await showFormDialog(
      context,
      title: l10n.orgInviteTeacher,
      submitLabel: l10n.orgInviteTeacher,
      fields: <FormFieldSpec>[
        FormFieldSpec(
          name: 'email',
          label: l10n.orgInviteEmail,
          required: true,
        ),
      ],
    );
    if (values == null) return;
    final email = values['email']!;
    await _act(() async {
      await ref.read(orgRepositoryProvider).inviteTeacher(email);
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(l10n.orgInviteSent(email))));
      }
    });
  }

  Future<void> _removeTeacher(OrgOverviewTeachersInner teacher) async {
    final l10n = AppLocalizations.of(context);
    final ok = await showConfirmDialog(
      context,
      title: l10n.orgRemoveTeacher,
      message: l10n.orgRemoveTeacherMessage(teacher.email),
      confirmLabel: l10n.orgRemoveTeacher,
      destructive: true,
    );
    if (ok) {
      await _act(
        () => ref.read(orgRepositoryProvider).removeTeacher(teacher.userId),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return PageFrame(
      title: l10n.navOrg,
      child: _loading && _overview == null
          ? const LoadingView()
          : _error != null && _overview == null
          ? _errorView(l10n)
          : _content(l10n, _overview!),
    );
  }

  Widget _errorView(AppLocalizations l10n) {
    final forbidden =
        _error is ApiError && (_error! as ApiError).statusCode == 403;
    if (forbidden) {
      return EmptyView(
        key: const Key('org-no-access'),
        icon: Icons.lock_outline,
        title: l10n.orgNoAccess,
      );
    }
    return ErrorView(error: _error, onRetry: _load);
  }

  Widget _licenseBanner(AppLocalizations l10n, OrgOverview org) {
    final license = org.license;
    if (license == null) {
      return _Banner(
        key: const Key('org-license-none'),
        text: l10n.orgNoLicense,
        warning: true,
      );
    }
    final graceEnds = license.graceEndsOn == null
        ? ''
        : _dateFormat.format(license.graceEndsOn!);
    final endsOn = license.endsOn == null
        ? ''
        : _dateFormat.format(license.endsOn!);
    return switch (license.state) {
      LicenseState.expiring => _Banner(
        key: const Key('org-license-expiring'),
        text: l10n.orgLicenseExpiring(endsOn),
        warning: true,
      ),
      LicenseState.inGrace => _Banner(
        key: const Key('org-license-in-grace'),
        text: l10n.orgLicenseInGrace(graceEnds),
        warning: true,
      ),
      LicenseState.lapsed => _Banner(
        key: const Key('org-license-lapsed'),
        text: l10n.orgLicenseLapsed,
        warning: true,
      ),
      _ => const SizedBox.shrink(),
    };
  }

  Widget _content(AppLocalizations l10n, OrgOverview org) {
    final textTheme = Theme.of(context).textTheme;
    final license = org.license;
    return ListView(
      children: <Widget>[
        Text(org.name, style: textTheme.headlineSmall),
        const SizedBox(height: 8),
        _licenseBanner(l10n, org),
        Card(
          child: ListTile(
            key: const Key('org-seats'),
            leading: const Icon(Icons.event_seat_outlined),
            title: Text(
              l10n.orgSeatsSummary(
                '${org.seats.used}',
                '${org.seats.total}',
                '${org.seats.reserved}',
                '${org.seats.available ?? 0}',
              ),
            ),
            subtitle: license == null
                ? null
                : Text(
                    l10n.orgLicenseLine(
                      license.startsOn == null
                          ? ''
                          : _dateFormat.format(license.startsOn!),
                      license.endsOn == null
                          ? ''
                          : _dateFormat.format(license.endsOn!),
                      license.graceEndsOn == null
                          ? ''
                          : _dateFormat.format(license.graceEndsOn!),
                    ),
                  ),
          ),
        ),
        const SizedBox(height: 16),
        Row(
          children: <Widget>[
            Expanded(
              child: Text(l10n.orgTeachers, style: textTheme.titleMedium),
            ),
            FilledButton.icon(
              key: const Key('org-invite-teacher'),
              onPressed: _inviteTeacher,
              icon: const Icon(Icons.person_add_alt_1_outlined),
              label: Text(l10n.orgInviteTeacher),
            ),
          ],
        ),
        if (org.teachers.isEmpty) Text(l10n.orgTeachersEmpty),
        for (final t in org.teachers)
          Card(
            key: Key('teacher-${t.userId}'),
            child: ListTile(
              title: Text(
                (t.displayName ?? '').isEmpty
                    ? t.email
                    : '${t.displayName} · ${t.email}',
              ),
              subtitle: t.hasSeat ? null : Text(l10n.orgTeacherNoSeat),
              trailing: Wrap(
                spacing: 4,
                children: <Widget>[
                  if (t.hasSeat)
                    TextButton(
                      key: Key('teacher-revoke-${t.userId}'),
                      onPressed: () => _act(
                        () => ref
                            .read(orgRepositoryProvider)
                            .revokeSeat(t.userId),
                      ),
                      child: Text(l10n.orgRevokeSeat),
                    )
                  else
                    TextButton(
                      key: Key('teacher-grant-${t.userId}'),
                      onPressed: () => _act(
                        () =>
                            ref.read(orgRepositoryProvider).grantSeat(t.userId),
                      ),
                      child: Text(l10n.orgGrantSeat),
                    ),
                  TextButton(
                    key: Key('teacher-remove-${t.userId}'),
                    onPressed: () => _removeTeacher(t),
                    child: Text(l10n.orgRemoveTeacher),
                  ),
                ],
              ),
            ),
          ),
        const SizedBox(height: 16),
        Text(l10n.orgClasses, style: textTheme.titleMedium),
        if (org.classes.isEmpty) Text(l10n.orgClassesEmpty),
        for (final c in org.classes)
          Card(
            key: Key('class-${c.id}'),
            child: ListTile(
              title: Text(c.name),
              subtitle: Wrap(
                spacing: 8,
                children: <Widget>[
                  Text(l10n.orgClassMembers('${c.memberCount}')),
                  if (!c.hasPath) Text(l10n.orgClassNoPath),
                  if (c.teacherless)
                    Text(
                      l10n.orgClassTeacherless,
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.error,
                      ),
                    ),
                ],
              ),
            ),
          ),
        if (org.pendingInvitations.isNotEmpty) ...<Widget>[
          const SizedBox(height: 16),
          Text(l10n.orgPendingInvitations, style: textTheme.titleMedium),
          for (final inv in org.pendingInvitations)
            Card(
              key: Key('invitation-${inv.id}'),
              child: ListTile(
                title: Text(inv.email),
                subtitle: Text(
                  '${inv.kind == InvitationRowKindEnum.owner ? l10n.orgKindOwner : l10n.orgKindTeacher}'
                  ' · ${l10n.orgInvitationExpires(_dateFormat.format(inv.expiresAt))}',
                ),
                trailing: TextButton(
                  key: Key('invitation-revoke-${inv.id}'),
                  onPressed: () => _act(
                    () => ref
                        .read(orgRepositoryProvider)
                        .revokeInvitation(inv.id),
                  ),
                  child: Text(l10n.orgRevokeInvitation),
                ),
              ),
            ),
        ],
      ],
    );
  }
}

/// Dải thông báo trạng thái giấy phép (sắp hết hạn/ân hạn/hết hạn).
class _Banner extends StatelessWidget {
  const _Banner({super.key, required this.text, this.warning = false});

  final String text;
  final bool warning;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: warning ? scheme.errorContainer : scheme.secondaryContainer,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: warning
              ? scheme.onErrorContainer
              : scheme.onSecondaryContainer,
        ),
      ),
    );
  }
}
