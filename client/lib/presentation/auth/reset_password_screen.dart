import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/auth_repository.dart';
import '../../l10n/app_localizations.dart';
import '../../router_paths.dart';
import '../shared/page_frame.dart';
import 'auth_support.dart';

/// Đặt mật khẩu mới từ liên kết trong email (T052). Token một lần lấy từ query `?token=`; liên kết hết
/// hạn hoặc đã dùng bị từ chối kèm gợi ý yêu cầu liên kết mới.
class ResetPasswordScreen extends ConsumerStatefulWidget {
  const ResetPasswordScreen({super.key, required this.token});

  final String? token;

  @override
  ConsumerState<ResetPasswordScreen> createState() =>
      _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends ConsumerState<ResetPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _password = TextEditingController();
  bool _submitting = false;
  bool _done = false;
  AuthFormError? _error;

  @override
  void dispose() {
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _error = null);
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _submitting = true);
    try {
      await ref
          .read(authRepositoryProvider)
          .confirmPasswordReset(
            token: widget.token!,
            newPassword: _password.text,
          );
      if (mounted) setState(() => _done = true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = mapAuthError(context, e));
      _formKey.currentState?.validate();
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final hasToken = widget.token != null && widget.token!.isNotEmpty;

    final Widget body;
    if (_done) {
      body = AuthFormCard(
        title: l10n.authResetDoneTitle,
        children: <Widget>[
          Text(l10n.authResetDoneMessage, key: const Key('reset-done')),
          const SizedBox(height: 16),
          FilledButton(
            key: const Key('go-to-login'),
            onPressed: () => context.go(AppRoutes.login),
            child: Text(l10n.actionSignIn),
          ),
        ],
      );
    } else if (!hasToken) {
      body = AuthFormCard(
        title: l10n.authResetTitle,
        children: <Widget>[
          FormBanner(message: l10n.authErrorResetTokenInvalid),
          const SizedBox(height: 16),
          FilledButton(
            key: const Key('request-new-link'),
            onPressed: () => context.go(AppRoutes.forgotPassword),
            child: Text(l10n.authRequestNewLink),
          ),
        ],
      );
    } else {
      body = AuthFormCard(
        title: l10n.authResetTitle,
        subtitle: l10n.authResetSubtitle,
        children: <Widget>[
          Form(
            key: _formKey,
            child: TextFormField(
              key: const Key('password'),
              controller: _password,
              obscureText: true,
              autofillHints: const <String>[AutofillHints.newPassword],
              decoration: InputDecoration(
                labelText: l10n.authNewPasswordLabel,
                helperText: l10n.authPasswordHelper(
                  AuthValidators.minPasswordLength,
                ),
              ),
              validator: (v) =>
                  _error?.fieldErrors['password'] ??
                  AuthValidators.password(l10n, v),
              onFieldSubmitted: (_) => _submit(),
            ),
          ),
          if (_error?.banner != null) ...<Widget>[
            const SizedBox(height: 16),
            FormBanner(message: _error!.banner!),
          ],
          if (_error?.suggestNewResetLink ?? false)
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton(
                key: const Key('request-new-link'),
                onPressed: () => context.go(AppRoutes.forgotPassword),
                child: Text(l10n.authRequestNewLink),
              ),
            ),
          const SizedBox(height: 20),
          FilledButton(
            key: const Key('submit'),
            onPressed: _submitting ? null : _submit,
            child: Text(l10n.authResetSubmit),
          ),
        ],
      );
    }
    return PageFrame(
      title: l10n.authResetTitle,
      showNavigation: false,
      child: body,
    );
  }
}
