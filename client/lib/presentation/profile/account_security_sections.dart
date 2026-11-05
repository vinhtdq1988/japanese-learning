import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:japanese_api/japanese_api.dart';

import '../../data/account_repository.dart';
import '../../l10n/app_localizations.dart';
import '../auth/auth_support.dart';
import '../shared/confirm_dialog.dart';
import 'profile_support.dart';

// Các mục nhạy cảm của Hồ sơ (T113, FR-002, FR-003): đổi email và đổi mật khẩu (cần mật khẩu hiện tại),
// xóa tài khoản (cần mật khẩu và xác nhận). Kiểm tra phía client chỉ để chặn sớm lỗi hiển nhiên; server
// mới là nơi quyết định.

/// Đổi email: email mới + mật khẩu hiện tại. Thành công gọi [onChanged] với hồ sơ mới.
class ChangeEmailSection extends ConsumerStatefulWidget {
  const ChangeEmailSection({super.key, required this.onChanged});

  final ValueChanged<Me> onChanged;

  @override
  ConsumerState<ChangeEmailSection> createState() => _ChangeEmailSectionState();
}

class _ChangeEmailSectionState extends ConsumerState<ChangeEmailSection> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  AccountFormError? _error;
  bool _done = false;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _error = null;
      _done = false;
    });
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _busy = true);
    try {
      final me = await ref
          .read(accountRepositoryProvider)
          .changeEmail(
            email: _email.text.trim(),
            currentPassword: _password.text,
          );
      if (!mounted) return;
      _email.clear();
      _password.clear();
      setState(() => _done = true);
      widget.onChanged(me);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = mapAccountError(context, e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final fields = _error?.fieldErrors ?? const <String, String>{};
    return ProfileSection(
      title: l10n.profileSectionEmail,
      help: l10n.profileEmailHelp,
      children: <Widget>[
        Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              TextFormField(
                key: const Key('profile-new-email'),
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                autofillHints: const <String>[AutofillHints.email],
                decoration: InputDecoration(
                  labelText: l10n.profileNewEmailLabel,
                  errorText: fields['email'],
                ),
                validator: (v) => AuthValidators.email(l10n, v),
              ),
              const SizedBox(height: 12),
              TextFormField(
                key: const Key('profile-email-password'),
                controller: _password,
                obscureText: true,
                decoration: InputDecoration(
                  labelText: l10n.profileCurrentPasswordLabel,
                  errorText: fields['currentPassword'],
                ),
                validator: (v) => (v ?? '').isEmpty
                    ? l10n.profileCurrentPasswordRequired
                    : null,
                onFieldSubmitted: (_) => _submit(),
              ),
              const SizedBox(height: 16),
              Align(
                alignment: Alignment.centerLeft,
                child: FilledButton(
                  key: const Key('profile-change-email'),
                  onPressed: _busy ? null : _submit,
                  child: Text(l10n.profileEmailAction),
                ),
              ),
              if (_error?.banner != null)
                StatusLine(message: _error!.banner!, isError: true),
              if (_done) StatusLine(message: l10n.profileEmailChanged),
            ],
          ),
        ),
      ],
    );
  }
}

/// Đổi mật khẩu: mật khẩu hiện tại + mật khẩu mới (nhập hai lần). Các phiên khác bị đăng xuất.
class ChangePasswordSection extends ConsumerStatefulWidget {
  const ChangePasswordSection({super.key});

  @override
  ConsumerState<ChangePasswordSection> createState() =>
      _ChangePasswordSectionState();
}

class _ChangePasswordSectionState extends ConsumerState<ChangePasswordSection> {
  final _formKey = GlobalKey<FormState>();
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _repeat = TextEditingController();
  bool _busy = false;
  AccountFormError? _error;
  bool _done = false;

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    _repeat.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _error = null;
      _done = false;
    });
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _busy = true);
    try {
      await ref
          .read(accountRepositoryProvider)
          .changePassword(
            currentPassword: _current.text,
            newPassword: _next.text,
          );
      if (!mounted) return;
      _current.clear();
      _next.clear();
      _repeat.clear();
      setState(() => _done = true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = mapAccountError(context, e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final fields = _error?.fieldErrors ?? const <String, String>{};
    return ProfileSection(
      title: l10n.profileSectionPassword,
      help: l10n.profilePasswordHelp,
      children: <Widget>[
        Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              TextFormField(
                key: const Key('profile-current-password'),
                controller: _current,
                obscureText: true,
                decoration: InputDecoration(
                  labelText: l10n.profileCurrentPasswordLabel,
                  errorText: fields['currentPassword'],
                ),
                validator: (v) => (v ?? '').isEmpty
                    ? l10n.profileCurrentPasswordRequired
                    : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                key: const Key('profile-new-password'),
                controller: _next,
                obscureText: true,
                autofillHints: const <String>[AutofillHints.newPassword],
                decoration: InputDecoration(
                  labelText: l10n.profileNewPasswordLabel,
                  helperText: l10n.authPasswordHelper(
                    AuthValidators.minPasswordLength,
                  ),
                  errorText: fields['newPassword'],
                ),
                validator: (v) => AuthValidators.password(l10n, v),
              ),
              const SizedBox(height: 12),
              TextFormField(
                key: const Key('profile-repeat-password'),
                controller: _repeat,
                obscureText: true,
                decoration: InputDecoration(
                  labelText: l10n.profileConfirmPasswordLabel,
                ),
                validator: (v) =>
                    v == _next.text ? null : l10n.profilePasswordMismatch,
                onFieldSubmitted: (_) => _submit(),
              ),
              const SizedBox(height: 16),
              Align(
                alignment: Alignment.centerLeft,
                child: FilledButton(
                  key: const Key('profile-change-password'),
                  onPressed: _busy ? null : _submit,
                  child: Text(l10n.profilePasswordAction),
                ),
              ),
              if (_error?.banner != null)
                StatusLine(message: _error!.banner!, isError: true),
              if (_done) StatusLine(message: l10n.profilePasswordChanged),
            ],
          ),
        ),
      ],
    );
  }
}

/// Xóa tài khoản: nhập mật khẩu + xác nhận. Thành công thì phiên cục bộ bị xóa và router đưa người dùng
/// về trang công khai; thông báo hiển thị bằng SnackBar của ứng dụng để còn thấy sau khi chuyển trang.
class DeleteAccountSection extends ConsumerStatefulWidget {
  const DeleteAccountSection({super.key});

  @override
  ConsumerState<DeleteAccountSection> createState() =>
      _DeleteAccountSectionState();
}

class _DeleteAccountSectionState extends ConsumerState<DeleteAccountSection> {
  final _formKey = GlobalKey<FormState>();
  final _password = TextEditingController();
  bool _busy = false;
  AccountFormError? _error;

  @override
  void dispose() {
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _error = null);
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final l10n = AppLocalizations.of(context);
    final confirmed = await showConfirmDialog(
      context,
      title: l10n.profileDeleteConfirmTitle,
      message: l10n.profileDeleteConfirmMessage,
      confirmLabel: l10n.profileDeleteAction,
      destructive: true,
    );
    if (!confirmed || !mounted) return;

    final messenger = ScaffoldMessenger.of(context);
    setState(() => _busy = true);
    try {
      await ref.read(accountRepositoryProvider).deleteAccount(_password.text);
      messenger.showSnackBar(SnackBar(content: Text(l10n.profileDeleteDone)));
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = mapAccountError(context, e);
        _busy = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final scheme = Theme.of(context).colorScheme;
    final fields = _error?.fieldErrors ?? const <String, String>{};
    return ProfileSection(
      title: l10n.profileSectionDelete,
      help: l10n.profileDeleteHelp,
      destructive: true,
      children: <Widget>[
        Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              TextFormField(
                key: const Key('profile-delete-password'),
                controller: _password,
                obscureText: true,
                decoration: InputDecoration(
                  labelText: l10n.authPasswordLabel,
                  errorText: fields['currentPassword'],
                ),
                validator: (v) =>
                    (v ?? '').isEmpty ? l10n.authPasswordRequired : null,
                onFieldSubmitted: (_) => _submit(),
              ),
              const SizedBox(height: 16),
              Align(
                alignment: Alignment.centerLeft,
                child: FilledButton(
                  key: const Key('profile-delete'),
                  style: FilledButton.styleFrom(
                    backgroundColor: scheme.error,
                    foregroundColor: scheme.onError,
                  ),
                  onPressed: _busy ? null : _submit,
                  child: Text(l10n.profileDeleteAction),
                ),
              ),
              if (_error?.banner != null)
                StatusLine(message: _error!.banner!, isError: true),
            ],
          ),
        ),
      ],
    );
  }
}
