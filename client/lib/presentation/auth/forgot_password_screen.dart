import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/auth_repository.dart';
import '../../l10n/app_localizations.dart';
import '../../router_paths.dart';
import '../shared/page_frame.dart';
import 'auth_support.dart';

/// Yêu cầu liên kết đặt lại mật khẩu (T052, FR-001). Thông báo sau khi gửi luôn giống nhau dù email
/// có tồn tại hay không (server cũng vậy), nên không lộ tài khoản nào có thật.
class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  ConsumerState<ForgotPasswordScreen> createState() =>
      _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  bool _submitting = false;
  bool _sent = false;
  AuthFormError? _error;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _error = null);
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _submitting = true);
    try {
      await ref
          .read(authRepositoryProvider)
          .requestPasswordReset(_email.text.trim());
      if (mounted) setState(() => _sent = true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = mapAuthError(context, e));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return PageFrame(
      title: l10n.authForgotPasswordTitle,
      child: AuthFormCard(
        title: l10n.authForgotPasswordTitle,
        subtitle: _sent ? null : l10n.authForgotPasswordSubtitle,
        children: <Widget>[
          if (_sent) ...<Widget>[
            Text(l10n.authResetEmailSent, key: const Key('reset-sent')),
            const SizedBox(height: 16),
          ] else ...<Widget>[
            Form(
              key: _formKey,
              child: TextFormField(
                key: const Key('email'),
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                autofillHints: const <String>[AutofillHints.email],
                decoration: InputDecoration(labelText: l10n.authEmailLabel),
                validator: (v) => AuthValidators.email(l10n, v),
                onFieldSubmitted: (_) => _submit(),
              ),
            ),
            if (_error?.banner != null) ...<Widget>[
              const SizedBox(height: 16),
              FormBanner(message: _error!.banner!),
            ],
            const SizedBox(height: 20),
            FilledButton(
              key: const Key('submit'),
              onPressed: _submitting ? null : _submit,
              child: Text(l10n.authSendResetLink),
            ),
          ],
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton(
              key: const Key('back-to-login'),
              onPressed: () => context.go(AppRoutes.login),
              child: Text(l10n.authBackToSignIn),
            ),
          ),
        ],
      ),
    );
  }
}
