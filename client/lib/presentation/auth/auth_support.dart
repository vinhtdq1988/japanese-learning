import 'package:flutter/material.dart';

import '../../data/api/api_error.dart';
import '../../l10n/app_localizations.dart';
import '../shared/error_messages.dart';

/// Quy tắc kiểm tra biểu mẫu xác thực phía client (thông báo theo ngôn ngữ giao diện). Server vẫn là
/// nơi kiểm tra chính thức; client chặn sớm các lỗi hiển nhiên để khỏi tốn một lượt gọi.
abstract final class AuthValidators {
  static final RegExp _email = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');

  static const int minPasswordLength = 8;
  static const int maxDisplayNameLength = 60;

  static String? email(AppLocalizations l10n, String? value) {
    final text = value?.trim() ?? '';
    if (text.isEmpty) return l10n.authEmailRequired;
    return _email.hasMatch(text) ? null : l10n.authEmailInvalid;
  }

  static String? password(AppLocalizations l10n, String? value) {
    final text = value ?? '';
    if (text.isEmpty) return l10n.authPasswordRequired;
    return text.length >= minPasswordLength
        ? null
        : l10n.authPasswordTooShort(minPasswordLength);
  }

  static String? displayName(AppLocalizations l10n, String? value) {
    final text = value?.trim() ?? '';
    if (text.isEmpty) return l10n.authDisplayNameRequired;
    return text.length <= maxDisplayNameLength
        ? null
        : l10n.authDisplayNameTooLong(maxDisplayNameLength);
  }
}

/// Lỗi từ API đã được dịch thành thông báo cho biểu mẫu xác thực.
class AuthFormError {
  const AuthFormError({
    this.banner,
    this.fieldErrors = const <String, String>{},
    this.suggestSignIn = false,
    this.suggestNewResetLink = false,
  });

  /// Thông báo chung đặt phía trên nút gửi.
  final String? banner;

  /// Thông báo theo trường (`email`, `password`, `displayName`).
  final Map<String, String> fieldErrors;

  /// Gợi ý chuyển sang đăng nhập để khôi phục (email thuộc tài khoản đang chờ xóa).
  final bool suggestSignIn;

  /// Gợi ý yêu cầu liên kết đặt lại mới (liên kết hết hạn/đã dùng).
  final bool suggestNewResetLink;
}

/// Dịch lỗi API thành [AuthFormError] theo mã lỗi của hợp đồng (EMAIL_TAKEN, EMAIL_PENDING_DELETION…),
/// không bao giờ lộ chi tiết kỹ thuật hay dữ liệu người khác.
AuthFormError mapAuthError(BuildContext context, Object error) {
  final l10n = AppLocalizations.of(context);
  if (error is ApiError) {
    switch (error.code) {
      case 'EMAIL_TAKEN':
        return AuthFormError(
          fieldErrors: <String, String>{'email': l10n.authErrorEmailTaken},
        );
      case 'EMAIL_PENDING_DELETION':
        return AuthFormError(
          fieldErrors: <String, String>{
            'email': l10n.authErrorEmailPendingDeletion,
          },
          suggestSignIn: true,
        );
      case 'RESET_TOKEN_INVALID':
        return AuthFormError(
          banner: l10n.authErrorResetTokenInvalid,
          suggestNewResetLink: true,
        );
      case 'VALIDATION_FAILED':
        final known = <String>{
          'email',
          'password',
          'newPassword',
          'displayName',
        };
        final fields = <String, String>{
          for (final entry in error.fields.entries)
            if (known.contains(entry.key))
              (entry.key == 'newPassword' ? 'password' : entry.key):
                  entry.value,
        };
        if (fields.isNotEmpty) return AuthFormError(fieldErrors: fields);
      case 'UNAUTHORIZED':
        if (error.statusCode == 401) {
          return AuthFormError(banner: l10n.authErrorInvalidCredentials);
        }
    }
  }
  return AuthFormError(banner: describeError(context, error));
}

/// Khung trang xác thực: tiêu đề và biểu mẫu căn giữa, chiều rộng vừa phải.
class AuthFormCard extends StatelessWidget {
  const AuthFormCard({
    super.key,
    required this.title,
    this.subtitle,
    required this.children,
  });

  final String title;
  final String? subtitle;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SingleChildScrollView(
      child: Align(
        alignment: Alignment.topCenter,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 440),
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  Text(title, style: theme.textTheme.headlineSmall),
                  if (subtitle != null) ...<Widget>[
                    const SizedBox(height: 8),
                    Text(subtitle!, style: theme.textTheme.bodyMedium),
                  ],
                  const SizedBox(height: 20),
                  ...children,
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Thông báo lỗi chung trong biểu mẫu (đọc được bằng trình đọc màn hình).
class FormBanner extends StatelessWidget {
  const FormBanner({super.key, required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Semantics(
      liveRegion: true,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: scheme.errorContainer,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Icon(Icons.error_outline, color: scheme.onErrorContainer, size: 20),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                message,
                style: TextStyle(color: scheme.onErrorContainer),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
