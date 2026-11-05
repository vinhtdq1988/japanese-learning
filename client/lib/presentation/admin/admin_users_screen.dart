import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/admin_repository.dart';
import '../../data/api/api_error.dart';
import '../../data/session_controller.dart';
import '../../domain/admin_models.dart';
import '../../l10n/app_localizations.dart';
import '../shared/confirm_dialog.dart';
import '../shared/state_views.dart';
import 'admin_support.dart';

/// Quản lý tài khoản người học (T108, FR-031): tìm theo email/tên, vô hiệu hóa hoặc kích hoạt lại. Phân
/// trang theo con trỏ ("Tải thêm"). Chỉ tài khoản người học đang hoạt động/bị vô hiệu hóa mới đổi được
/// trạng thái; server từ chối phần còn lại (kể cả chính mình).
class AdminUsersScreen extends ConsumerStatefulWidget {
  const AdminUsersScreen({super.key});

  @override
  ConsumerState<AdminUsersScreen> createState() => _AdminUsersScreenState();
}

class _AdminUsersScreenState extends ConsumerState<AdminUsersScreen> {
  final TextEditingController _search = TextEditingController();
  final List<AdminUserRow> _rows = <AdminUserRow>[];
  String? _nextCursor;
  String _query = '';
  bool _loading = true;
  bool _loadingMore = false;
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

  Future<void> _load({bool more = false}) async {
    setState(() {
      if (more) {
        _loadingMore = true;
      } else {
        _loading = true;
        _error = null;
      }
    });
    try {
      final page = await ref
          .read(adminRepositoryProvider)
          .users(q: _query, cursor: more ? _nextCursor : null);
      if (!mounted) return;
      setState(() {
        if (!more) _rows.clear();
        _rows.addAll(page.items);
        _nextCursor = page.nextCursor;
      });
    } on ApiError catch (e) {
      if (mounted) setState(() => _error = e);
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
          _loadingMore = false;
        });
      }
    }
  }

  Future<void> _toggle(AdminUserRow user) async {
    final l10n = AppLocalizations.of(context);
    final disabling = user.status != 'disabled';
    final confirmed = await showConfirmDialog(
      context,
      title: disabling ? l10n.adminUserDisableTitle : l10n.adminUserEnableTitle,
      message: disabling
          ? l10n.adminUserDisableMessage(user.email)
          : l10n.adminUserEnableMessage(user.email),
      confirmLabel: disabling ? l10n.adminUserDisable : l10n.adminUserEnable,
      destructive: disabling,
    );
    if (!confirmed || !mounted) return;
    try {
      await ref
          .read(adminRepositoryProvider)
          .setUserStatus(user.id, disabled: disabling);
      if (!mounted) return;
      setState(() {
        final index = _rows.indexWhere((r) => r.id == user.id);
        if (index >= 0) {
          _rows[index] = AdminUserRow(
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            role: user.role,
            status: disabling ? 'disabled' : 'active',
            createdAt: user.createdAt,
          );
        }
      });
    } on ApiError catch (e) {
      if (mounted) await showAdminErrorDialog(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final me = ref.watch(sessionProvider).session;
    return AdminFrame(
      section: AdminSection.users,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Expanded(
                child: TextField(
                  key: const Key('user-search'),
                  controller: _search,
                  textInputAction: TextInputAction.search,
                  decoration: InputDecoration(
                    labelText: l10n.adminUsersSearchHint,
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
              FilledButton(
                key: const Key('user-search-go'),
                onPressed: () {
                  _query = _search.text.trim();
                  _load();
                },
                child: Text(l10n.adminUsersSearch),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Expanded(
            child: _loading
                ? const LoadingView()
                : _error != null
                ? ErrorView(error: _error, onRetry: _load)
                : _rows.isEmpty
                ? EmptyView(
                    icon: Icons.group_outlined,
                    title: l10n.adminUsersEmpty,
                  )
                : ListView(
                    children: <Widget>[
                      for (final user in _rows)
                        _UserTile(
                          user: user,
                          isMe: user.id == me?.userId,
                          onToggle: () => _toggle(user),
                        ),
                      if (_nextCursor != null)
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          child: Center(
                            child: OutlinedButton(
                              key: const Key('user-load-more'),
                              onPressed: _loadingMore
                                  ? null
                                  : () => _load(more: true),
                              child: Text(l10n.adminLoadMore),
                            ),
                          ),
                        ),
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}

class _UserTile extends StatelessWidget {
  const _UserTile({
    required this.user,
    required this.isMe,
    required this.onToggle,
  });

  final AdminUserRow user;
  final bool isMe;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final canToggle =
        user.isLearner && !isMe && user.status != 'pending_deletion';
    final disabled = user.status == 'disabled';
    return Card(
      key: Key('user-${user.id}'),
      child: ListTile(
        title: Text(user.email),
        subtitle: Wrap(
          spacing: 8,
          runSpacing: 4,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: <Widget>[
            if (user.displayName.isNotEmpty) Text(user.displayName),
            Text(l10n.adminUserCreated(formatDateTime(user.createdAt))),
            Chip(
              label: Text(
                user.isLearner ? l10n.adminRoleLearner : l10n.adminRoleAdmin,
              ),
              visualDensity: VisualDensity.compact,
            ),
            Chip(
              key: Key('user-status-${user.id}'),
              label: Text(userStatusLabel(l10n, user.status)),
              visualDensity: VisualDensity.compact,
            ),
          ],
        ),
        trailing: canToggle
            ? OutlinedButton(
                key: Key('user-toggle-${user.id}'),
                onPressed: onToggle,
                child: Text(
                  disabled ? l10n.adminUserEnable : l10n.adminUserDisable,
                ),
              )
            : null,
      ),
    );
  }
}
