import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/auth_repository.dart';
import '../../l10n/app_localizations.dart';
import '../../router_paths.dart';
import '../shared/page_frame.dart';
import 'auth_support.dart';

/// Màn hình đăng nhập (T052). Đăng nhập thành công cập nhật phiên và router tự chuyển về "Hôm nay"
/// (hoặc màn hình khôi phục nếu tài khoản đang chờ xóa).
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _submitting = false;
  AuthFormError? _error;

  @override
  void dispose() {
    _email.dispose();
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
          .login(email: _email.text.trim(), password: _password.text);
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
      title: l10n.actionSignIn,
      child: AuthFormCard(
        title: l10n.authLoginTitle,
        children: <Widget>[
          Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                TextFormField(
                  key: const Key('email'),
                  controller: _email,
                  keyboardType: TextInputType.emailAddress,
                  autofillHints: const <String>[AutofillHints.email],
                  decoration: InputDecoration(labelText: l10n.authEmailLabel),
                  validator: (v) => AuthValidators.email(l10n, v),
                  textInputAction: TextInputAction.next,
                ),
                const SizedBox(height: 16),
                TextFormField(
                  key: const Key('password'),
                  controller: _password,
                  obscureText: true,
                  autofillHints: const <String>[AutofillHints.password],
                  decoration: InputDecoration(
                    labelText: l10n.authPasswordLabel,
                  ),
                  validator: (v) => (v == null || v.isEmpty)
                      ? l10n.authPasswordRequired
                      : null,
                  onFieldSubmitted: (_) => _submit(),
                ),
              ],
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
            child: _submitting
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Text(l10n.actionSignIn),
          ),
          const SizedBox(height: 12),
          Wrap(
            alignment: WrapAlignment.spaceBetween,
            children: <Widget>[
              TextButton(
                key: const Key('forgot-password-link'),
                onPressed: () => context.go(AppRoutes.forgotPassword),
                child: Text(l10n.authForgotPasswordLink),
              ),
              TextButton(
                key: const Key('register-link'),
                onPressed: () => context.go(AppRoutes.register),
                child: Text(l10n.authNoAccountRegister),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
