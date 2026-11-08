import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/auth_repository.dart';
import '../../l10n/app_localizations.dart';
import '../../router_paths.dart';
import '../shared/page_frame.dart';
import '../trial/trial_state.dart';
import 'auth_support.dart';

/// Màn hình đăng ký (T052): email, mật khẩu, tên hiển thị. Không cần xác minh email (FR-001): đăng ký
/// thành công đăng nhập luôn, router đưa người học vào luồng onboarding qua "Hôm nay".
class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key, this.fromTrial = false});

  /// Đăng ký ngay sau khi dùng thử trên cùng trình duyệt (đo chuyển đổi, SC-011).
  final bool fromTrial;

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _displayName = TextEditingController();
  bool _submitting = false;
  AuthFormError? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _displayName.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _error = null);
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _submitting = true);
    try {
      final fromTrial = await _cameFromTrial();
      await ref
          .read(authRepositoryProvider)
          .register(
            email: _email.text.trim(),
            password: _password.text,
            displayName: _displayName.text.trim(),
            fromTrial: fromTrial,
          );
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = mapAuthError(context, e));
      // Hiển thị lỗi theo trường ngay (validator đọc `_error`).
      _formKey.currentState?.validate();
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  /// Đăng ký ngay sau khi dùng thử trên cùng trình duyệt (đo chuyển đổi, SC-011): có cờ truyền vào hoặc
  /// trình duyệt còn trạng thái dùng thử. Không đọc được trạng thái thì coi như không phải.
  Future<bool> _cameFromTrial() async {
    if (widget.fromTrial) return true;
    try {
      return (await ref.read(trialStateProvider.future)).hasActivity;
    } catch (_) {
      return false;
    }
  }

  /// Ưu tiên lỗi từ server cho trường khi có, ngược lại dùng kiểm tra phía client.
  String? _validate(String field, String? Function() clientCheck) {
    return _error?.fieldErrors[field] ?? clientCheck();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return PageFrame(
      title: l10n.actionRegister,
      child: AuthFormCard(
        title: l10n.authRegisterTitle,
        subtitle: l10n.authRegisterSubtitle,
        children: <Widget>[
          Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                TextFormField(
                  key: const Key('displayName'),
                  controller: _displayName,
                  autofillHints: const <String>[AutofillHints.name],
                  decoration: InputDecoration(
                    labelText: l10n.authDisplayNameLabel,
                  ),
                  validator: (v) => _validate(
                    'displayName',
                    () => AuthValidators.displayName(l10n, v),
                  ),
                  textInputAction: TextInputAction.next,
                ),
                const SizedBox(height: 16),
                TextFormField(
                  key: const Key('email'),
                  controller: _email,
                  keyboardType: TextInputType.emailAddress,
                  autofillHints: const <String>[AutofillHints.email],
                  decoration: InputDecoration(labelText: l10n.authEmailLabel),
                  validator: (v) =>
                      _validate('email', () => AuthValidators.email(l10n, v)),
                  textInputAction: TextInputAction.next,
                ),
                const SizedBox(height: 16),
                TextFormField(
                  key: const Key('password'),
                  controller: _password,
                  obscureText: true,
                  autofillHints: const <String>[AutofillHints.newPassword],
                  decoration: InputDecoration(
                    labelText: l10n.authPasswordLabel,
                    helperText: l10n.authPasswordHelper(
                      AuthValidators.minPasswordLength,
                    ),
                  ),
                  validator: (v) => _validate(
                    'password',
                    () => AuthValidators.password(l10n, v),
                  ),
                  onFieldSubmitted: (_) => _submit(),
                ),
              ],
            ),
          ),
          if (_error?.banner != null) ...<Widget>[
            const SizedBox(height: 16),
            FormBanner(message: _error!.banner!),
          ],
          if (_error?.suggestSignIn ?? false) ...<Widget>[
            const SizedBox(height: 8),
            Text(
              l10n.authPendingDeletionHint,
              key: const Key('pending-deletion-hint'),
            ),
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton(
                key: const Key('sign-in-to-restore'),
                onPressed: () => context.go(AppRoutes.login),
                child: Text(l10n.authSignInToRestore),
              ),
            ),
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
                : Text(l10n.actionRegister),
          ),
          const SizedBox(height: 12),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton(
              key: const Key('login-link'),
              onPressed: () => context.go(
                AppRoutes.withFrom(
                  AppRoutes.login,
                  GoRouterState.of(context).uri.queryParameters['from'],
                ),
              ),
              child: Text(l10n.authHaveAccountSignIn),
            ),
          ),
        ],
      ),
    );
  }
}
