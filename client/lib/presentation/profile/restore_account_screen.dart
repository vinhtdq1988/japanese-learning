import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/account_repository.dart';
import '../../data/api/api_error.dart';
import '../../data/auth_repository.dart';
import '../../l10n/app_localizations.dart';
import '../auth/auth_support.dart';
import '../shared/error_messages.dart';
import '../shared/page_frame.dart';

/// Lời mời khôi phục tài khoản đang chờ xóa (T113, FR-003). Router đưa mọi phiên `pending_deletion` về
/// đây (xem `resolveRedirect`); khôi phục xong phiên đổi sang `active` và router tự chuyển về "Hôm nay".
class RestoreAccountScreen extends ConsumerStatefulWidget {
  const RestoreAccountScreen({super.key});

  @override
  ConsumerState<RestoreAccountScreen> createState() =>
      _RestoreAccountScreenState();
}

class _RestoreAccountScreenState extends ConsumerState<RestoreAccountScreen> {
  bool _busy = false;
  String? _error;
  bool _expired = false;

  Future<void> _restore() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(accountRepositoryProvider).restoreAccount();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        // 410: quá 30 ngày, dữ liệu đã bị xóa; không còn gì để khôi phục.
        _expired = e is ApiError && e.statusCode == 410;
        _error = _expired ? null : describeError(context, e);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return PageFrame(
      title: l10n.restoreTitle,
      showNavigation: false,
      child: AuthFormCard(
        title: l10n.restoreTitle,
        subtitle: _expired ? l10n.restoreExpired : l10n.restoreMessage,
        children: <Widget>[
          if (_error != null) ...<Widget>[
            FormBanner(message: _error!),
            const SizedBox(height: 16),
          ],
          if (!_expired)
            FilledButton(
              key: const Key('restore-account'),
              onPressed: _busy ? null : _restore,
              child: Text(l10n.restoreAction),
            ),
          if (!_expired) const SizedBox(height: 12),
          OutlinedButton(
            key: const Key('restore-sign-out'),
            onPressed: _busy
                ? null
                : () => ref.read(authRepositoryProvider).signOut(),
            child: Text(l10n.actionSignOut),
          ),
        ],
      ),
    );
  }
}
