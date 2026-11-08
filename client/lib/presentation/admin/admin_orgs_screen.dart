import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:japanese_api/japanese_api.dart';

import '../../data/api/api_error.dart';
import '../../data/api_providers.dart';
import '../../data/org_repository.dart';
import '../../l10n/app_localizations.dart';
import '../shared/confirm_dialog.dart';
import '../shared/form_dialog.dart';
import '../shared/state_views.dart';
import 'admin_support.dart';

final DateFormat _dateFormat = DateFormat('yyyy-MM-dd');

/// Nhãn cảnh báo của một tổ chức (quản trị viên thấy ngay tổ chức nào cần xử lý).
String _warningLabel(
  AppLocalizations l10n,
  AdminOrganizationRowWarningsEnum warning,
) => switch (warning) {
  AdminOrganizationRowWarningsEnum.noOwner => l10n.adminOrgWarningNoOwner,
  AdminOrganizationRowWarningsEnum.expiring => l10n.adminOrgWarningExpiring,
  AdminOrganizationRowWarningsEnum.inGrace => l10n.adminOrgWarningInGrace,
  AdminOrganizationRowWarningsEnum.lapsed => l10n.adminOrgWarningLapsed,
};

String _warningLabelDetail(
  AppLocalizations l10n,
  AdminOrganizationDetailWarningsEnum warning,
) => switch (warning) {
  AdminOrganizationDetailWarningsEnum.noOwner => l10n.adminOrgWarningNoOwner,
  AdminOrganizationDetailWarningsEnum.expiring => l10n.adminOrgWarningExpiring,
  AdminOrganizationDetailWarningsEnum.inGrace => l10n.adminOrgWarningInGrace,
  AdminOrganizationDetailWarningsEnum.lapsed => l10n.adminOrgWarningLapsed,
};

String _statusLabel(AppLocalizations l10n, OrgStatus status) =>
    status == OrgStatus.disabled
    ? l10n.orgStatusDisabled
    : l10n.orgStatusActive;

/// Chuyển chuỗi nhập `YYYY-MM-DD` thành ngày; `null` nếu rỗng hoặc sai dạng.
DateTime? _parseDate(String? text) {
  if ((text ?? '').isEmpty) return null;
  try {
    return _dateFormat.parseStrict(text!);
  } on FormatException {
    return null;
  }
}

int? _parseInt(String? text) => int.tryParse((text ?? '').trim());

/// Quản lý tổ chức, giấy phép và seat của quản trị viên hệ thống (spec 004, US1, FR-001 → FR-006): danh sách
/// kèm cảnh báo, tạo tổ chức + chủ tổ chức + giấy phép, chi tiết seat, nâng giới hạn đổi người giữ, thu hồi
/// seat, vô hiệu hóa. Màn hình KHÔNG có dữ liệu học viên (server không trả).
class AdminOrgsScreen extends ConsumerStatefulWidget {
  const AdminOrgsScreen({super.key});

  @override
  ConsumerState<AdminOrgsScreen> createState() => _AdminOrgsScreenState();
}

class _AdminOrgsScreenState extends ConsumerState<AdminOrgsScreen> {
  final TextEditingController _search = TextEditingController();
  List<AdminOrganizationRow> _rows = <AdminOrganizationRow>[];
  String _query = '';
  String? _selectedId;
  bool _loading = true;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final page = await ref
          .read(orgRepositoryProvider)
          .adminOrganizations(query: _query);
      if (mounted) setState(() => _rows = page.items);
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
      title: l10n.adminOrgCreate,
      submitLabel: l10n.adminOrgCreate,
      fields: <FormFieldSpec>[
        FormFieldSpec(name: 'name', label: l10n.adminOrgName, required: true),
        FormFieldSpec(
          name: 'ownerEmail',
          label: l10n.adminOrgOwnerEmail,
          required: true,
        ),
        FormFieldSpec(name: 'seats', label: l10n.adminOrgSeats, number: true),
        FormFieldSpec(name: 'startsOn', label: l10n.adminOrgStartsOn),
        FormFieldSpec(name: 'endsOn', label: l10n.adminOrgEndsOn),
      ],
      message: l10n.adminOrgLicenseOptional,
    );
    if (values == null || !mounted) return;
    final seats = _parseInt(values['seats']);
    final startsOn = _parseDate(values['startsOn']);
    final endsOn = _parseDate(values['endsOn']);
    final license = seats != null && startsOn != null && endsOn != null
        ? LicenseDraft(seats: seats, startsOn: startsOn, endsOn: endsOn)
        : null;
    try {
      final created = await ref
          .read(orgRepositoryProvider)
          .createOrganization(
            name: values['name']!,
            ownerEmail: values['ownerEmail']!,
            license: license,
          );
      if (!mounted) return;
      setState(() => _selectedId = created.id);
      await _load();
    } on ApiError catch (e) {
      if (mounted) await showAdminErrorDialog(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return AdminFrame(
      section: AdminSection.orgs,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Expanded(
                child: TextField(
                  key: const Key('org-search'),
                  controller: _search,
                  textInputAction: TextInputAction.search,
                  decoration: InputDecoration(
                    labelText: l10n.adminOrgsSearchHint,
                    isDense: true,
                    prefixIcon: const Icon(Icons.search),
                  ),
                  onSubmitted: (v) {
                    _query = v.trim();
                    _load();
                  },
                ),
              ),
              const SizedBox(width: 12),
              FilledButton.icon(
                key: const Key('org-create'),
                onPressed: _create,
                icon: const Icon(Icons.add),
                label: Text(l10n.adminOrgCreate),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Expanded(
            child: _loading
                ? const LoadingView()
                : _error != null
                ? ErrorView(error: _error, onRetry: _load)
                : Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Expanded(flex: 2, child: _buildList(l10n)),
                      const SizedBox(width: 16),
                      Expanded(
                        flex: 3,
                        child: _selectedId == null
                            ? EmptyView(
                                icon: Icons.business_outlined,
                                title: l10n.adminOrgsSelectHint,
                              )
                            : _OrgDetailPanel(
                                key: ValueKey<String>(_selectedId!),
                                orgId: _selectedId!,
                                onChanged: _load,
                              ),
                      ),
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildList(AppLocalizations l10n) {
    if (_rows.isEmpty) {
      return EmptyView(
        icon: Icons.business_outlined,
        title: l10n.adminOrgsEmpty,
      );
    }
    return ListView(
      children: <Widget>[
        for (final org in _rows)
          Card(
            key: Key('org-${org.id}'),
            child: ListTile(
              selected: org.id == _selectedId,
              title: Text(org.name),
              subtitle: Wrap(
                spacing: 8,
                runSpacing: 4,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: <Widget>[
                  Text(
                    l10n.adminOrgSeatsSummary(
                      '${org.seats.used}',
                      '${org.seats.total}',
                      '${org.seats.reserved}',
                    ),
                  ),
                  if (org.status == OrgStatus.disabled)
                    Chip(
                      label: Text(l10n.orgStatusDisabled),
                      visualDensity: VisualDensity.compact,
                    ),
                  for (final w
                      in org.warnings ??
                          const <AdminOrganizationRowWarningsEnum>[])
                    Chip(
                      key: Key('org-warning-${org.id}-${w.value}'),
                      label: Text(_warningLabel(l10n, w)),
                      visualDensity: VisualDensity.compact,
                    ),
                ],
              ),
              onTap: () => setState(() => _selectedId = org.id),
            ),
          ),
      ],
    );
  }
}

/// Chi tiết một tổ chức: chủ, giấy phép, người giữ seat, lời mời chờ và các thao tác của quản trị viên.
class _OrgDetailPanel extends ConsumerStatefulWidget {
  const _OrgDetailPanel({
    super.key,
    required this.orgId,
    required this.onChanged,
  });

  final String orgId;

  /// Báo danh sách bên cạnh tải lại (trạng thái/cảnh báo/seat có thể đổi).
  final Future<void> Function() onChanged;

  @override
  ConsumerState<_OrgDetailPanel> createState() => _OrgDetailPanelState();
}

class _OrgDetailPanelState extends ConsumerState<_OrgDetailPanel> {
  AdminOrganizationDetail? _detail;
  Object? _error;
  bool _loading = true;

  OrgRepository get _repo => ref.read(orgRepositoryProvider);

  @override
  void initState() {
    super.initState();
    _reload();
  }

  Future<void> _reload() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final detail = await _repo.adminOrganization(widget.orgId);
      if (mounted) setState(() => _detail = detail);
    } on ApiError catch (e) {
      if (mounted) setState(() => _error = e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Chạy một thao tác ghi; lỗi hiện hộp thoại, thành công tải lại chi tiết và danh sách.
  Future<void> _act(Future<void> Function() action) async {
    try {
      await action();
    } on ApiError catch (e) {
      if (mounted) await showAdminErrorDialog(context, e);
      return;
    }
    if (!mounted) return;
    await _reload();
    await widget.onChanged();
  }

  Future<void> _toggleStatus(AdminOrganizationDetail org) async {
    final l10n = AppLocalizations.of(context);
    final disabling = org.status != OrgStatus.disabled;
    final ok = await showConfirmDialog(
      context,
      title: disabling ? l10n.adminOrgDisable : l10n.adminOrgEnable,
      message: disabling
          ? l10n.adminOrgDisableMessage(org.name)
          : l10n.adminOrgEnableMessage(org.name),
      confirmLabel: disabling ? l10n.adminOrgDisable : l10n.adminOrgEnable,
      destructive: disabling,
    );
    if (!ok) return;
    await _act(() => _repo.setOrganizationStatus(org.id, disabled: disabling));
  }

  Future<void> _inviteOwner(AdminOrganizationDetail org) async {
    final l10n = AppLocalizations.of(context);
    final values = await showFormDialog(
      context,
      title: l10n.adminOrgInviteOwner,
      submitLabel: l10n.adminOrgInviteOwner,
      fields: <FormFieldSpec>[
        FormFieldSpec(
          name: 'email',
          label: l10n.adminOrgOwnerEmail,
          required: true,
        ),
      ],
    );
    if (values == null) return;
    await _act(() async {
      await _repo.inviteOwner(org.id, values['email']!);
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(l10n.adminOrgInviteSent)));
      }
    });
  }

  /// Hộp thoại giấy phép: tạo mới khi [license] null, ngược lại chỉnh số seat/hạn/ân hạn/giới hạn đổi.
  Future<void> _editLicense(String orgId, {OrgLicense? license}) async {
    final l10n = AppLocalizations.of(context);
    final creating = license == null;
    final values = await showFormDialog(
      context,
      title: creating ? l10n.adminOrgAddLicense : l10n.adminOrgEditLicense,
      fields: <FormFieldSpec>[
        FormFieldSpec(
          name: 'seats',
          label: l10n.adminOrgSeats,
          initial: license == null ? '' : '${license.seats.total}',
          required: true,
          number: true,
        ),
        if (creating)
          FormFieldSpec(
            name: 'startsOn',
            label: l10n.adminOrgStartsOn,
            required: true,
          ),
        FormFieldSpec(
          name: 'endsOn',
          label: l10n.adminOrgEndsOn,
          initial: license == null ? '' : _dateFormat.format(license.endsOn),
          required: true,
        ),
        FormFieldSpec(
          name: 'graceDays',
          label: l10n.adminOrgGraceDays,
          initial: license == null ? '' : '${license.graceDays}',
          number: true,
        ),
        FormFieldSpec(
          name: 'maxReassignments',
          label: l10n.adminOrgMaxReassignments,
          initial: license == null ? '' : '${license.maxReassignments}',
          number: true,
        ),
      ],
    );
    if (values == null) return;
    final draft = LicenseDraft(
      seats: _parseInt(values['seats']),
      startsOn: _parseDate(values['startsOn']),
      endsOn: _parseDate(values['endsOn']),
      graceDays: _parseInt(values['graceDays']),
      maxReassignments: _parseInt(values['maxReassignments']),
    );
    await _act(() async {
      if (license == null) {
        await _repo.createLicense(orgId, draft);
      } else {
        await _repo.updateLicense(orgId, license.id, draft);
      }
    });
  }

  Future<void> _revokeLicense(String orgId, OrgLicense license) async {
    final l10n = AppLocalizations.of(context);
    final ok = await showConfirmDialog(
      context,
      title: l10n.adminOrgRevokeLicense,
      message: l10n.adminOrgRevokeLicenseMessage,
      confirmLabel: l10n.adminOrgRevokeLicense,
      destructive: true,
    );
    if (ok) await _act(() => _repo.revokeLicense(orgId, license.id));
  }

  Future<void> _revokeSeat(
    String orgId,
    AdminOrganizationDetailAllOfSeatHolders holder,
  ) async {
    final l10n = AppLocalizations.of(context);
    final ok = await showConfirmDialog(
      context,
      title: l10n.adminOrgRevokeSeat,
      message: l10n.adminOrgRevokeSeatMessage(holder.email),
      confirmLabel: l10n.adminOrgRevokeSeat,
      destructive: true,
    );
    if (ok) await _act(() => _repo.adminRevokeSeat(orgId, holder.userId));
  }

  String _roleLabel(
    AppLocalizations l10n,
    AdminOrganizationDetailAllOfSeatHoldersRolesEnum role,
  ) => role == AdminOrganizationDetailAllOfSeatHoldersRolesEnum.teacher
      ? l10n.adminOrgRoleTeacher
      : l10n.adminOrgRoleLearner;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    if (_loading && _detail == null) return const LoadingView();
    if (_error != null && _detail == null) {
      return ErrorView(error: _error, onRetry: _reload);
    }
    final org = _detail!;
    final textTheme = Theme.of(context).textTheme;
    return ListView(
      key: Key('org-detail-${org.id}'),
      children: <Widget>[
        Row(
          children: <Widget>[
            Expanded(child: Text(org.name, style: textTheme.titleLarge)),
            Chip(
              key: const Key('org-detail-status'),
              label: Text(_statusLabel(l10n, org.status)),
              visualDensity: VisualDensity.compact,
            ),
            const SizedBox(width: 8),
            OutlinedButton(
              key: const Key('org-toggle-status'),
              onPressed: () => _toggleStatus(org),
              child: Text(
                org.status == OrgStatus.disabled
                    ? l10n.adminOrgEnable
                    : l10n.adminOrgDisable,
              ),
            ),
          ],
        ),
        Wrap(
          spacing: 8,
          children: <Widget>[
            Text(
              l10n.adminOrgSeatsSummary(
                '${org.seats.used}',
                '${org.seats.total}',
                '${org.seats.reserved}',
              ),
            ),
            Text(l10n.adminOrgClassCount('${org.classCount ?? 0}')),
            for (final w
                in org.warnings ??
                    const <AdminOrganizationDetailWarningsEnum>[])
              Chip(
                label: Text(_warningLabelDetail(l10n, w)),
                visualDensity: VisualDensity.compact,
              ),
          ],
        ),
        const Divider(height: 24),
        _sectionTitle(
          l10n.adminOrgOwners,
          action: TextButton(
            key: const Key('org-invite-owner'),
            onPressed: () => _inviteOwner(org),
            child: Text(l10n.adminOrgInviteOwner),
          ),
        ),
        for (final owner
            in org.owners ?? const <AdminOrganizationRowOwnersInner>[])
          ListTile(
            dense: true,
            title: Text(owner.email),
            subtitle:
                owner.status ==
                    AdminOrganizationRowOwnersInnerStatusEnum.pending
                ? Text(l10n.adminOrgOwnerPending)
                : null,
          ),
        const Divider(height: 24),
        _sectionTitle(
          l10n.adminOrgLicenses,
          action: TextButton(
            key: const Key('org-add-license'),
            onPressed: () => _editLicense(org.id),
            child: Text(l10n.adminOrgAddLicense),
          ),
        ),
        for (final license in org.licenses ?? const <OrgLicense>[])
          Card(
            key: Key('license-${license.id}'),
            child: ListTile(
              title: Text(
                l10n.adminOrgLicenseLine(
                  _dateFormat.format(license.startsOn),
                  _dateFormat.format(license.endsOn),
                  _dateFormat.format(license.graceEndsOn),
                  '${license.seats.used}',
                  '${license.seats.total}',
                ),
              ),
              subtitle: Text(
                '${l10n.adminOrgMaxReassignments}: ${license.maxReassignments}'
                ' · ${license.state.value}',
              ),
              trailing: Wrap(
                spacing: 4,
                children: <Widget>[
                  TextButton(
                    key: Key('license-edit-${license.id}'),
                    onPressed: () => _editLicense(org.id, license: license),
                    child: Text(l10n.adminOrgEditLicense),
                  ),
                  if (license.revokedAt == null)
                    TextButton(
                      key: Key('license-revoke-${license.id}'),
                      onPressed: () => _revokeLicense(org.id, license),
                      child: Text(l10n.adminOrgRevokeLicense),
                    ),
                ],
              ),
            ),
          ),
        const Divider(height: 24),
        _sectionTitle(l10n.adminOrgSeatHolders),
        if ((org.seatHolders ?? const []).isEmpty)
          Text(l10n.adminOrgNoSeatHolders),
        for (final holder
            in org.seatHolders ??
                const <AdminOrganizationDetailAllOfSeatHolders>[])
          ListTile(
            key: Key('holder-${holder.userId}'),
            dense: true,
            title: Text(holder.email),
            subtitle: Text(
              holder.roles.map((r) => _roleLabel(l10n, r)).join(', '),
            ),
            trailing: TextButton(
              key: Key('holder-revoke-${holder.userId}'),
              onPressed: () => _revokeSeat(org.id, holder),
              child: Text(l10n.adminOrgRevokeSeat),
            ),
          ),
        if ((org.pendingInvitations ?? const []).isNotEmpty) ...<Widget>[
          const Divider(height: 24),
          _sectionTitle(l10n.adminOrgPendingInvitations),
          for (final inv in org.pendingInvitations ?? const <InvitationRow>[])
            ListTile(
              dense: true,
              title: Text(inv.email),
              subtitle: Text(
                '${inv.kind.value} · ${l10n.orgInvitationExpires(_dateFormat.format(inv.expiresAt))}',
              ),
            ),
        ],
      ],
    );
  }

  Widget _sectionTitle(String text, {Widget? action}) => Row(
    children: <Widget>[
      Expanded(
        child: Text(text, style: Theme.of(context).textTheme.titleMedium),
      ),
      ?action,
    ],
  );
}
