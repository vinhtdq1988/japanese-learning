import 'package:flutter/material.dart';

import '../../data/api/api_error.dart';
import '../../l10n/app_localizations.dart';
import '../shared/error_messages.dart';

/// Lỗi API đã được dịch thành thông báo cho các biểu mẫu Hồ sơ (đổi email/mật khẩu, xóa tài khoản).
class AccountFormError {
  const AccountFormError({
    this.banner,
    this.fieldErrors = const <String, String>{},
  });

  /// Thông báo chung đặt cạnh nút gửi.
  final String? banner;

  /// Thông báo theo trường (`email`, `currentPassword`, `newPassword`, `displayName`).
  final Map<String, String> fieldErrors;
}

/// Dịch lỗi API theo mã của hợp đồng. 401 ở các thao tác này nghĩa là mật khẩu hiện tại sai (token hết
/// hạn đã được interceptor tự làm mới trước đó), không phải hết phiên.
AccountFormError mapAccountError(BuildContext context, Object error) {
  final l10n = AppLocalizations.of(context);
  if (error is ApiError) {
    switch (error.code) {
      case 'EMAIL_TAKEN':
        return AccountFormError(
          fieldErrors: <String, String>{'email': l10n.authErrorEmailTaken},
        );
      case 'EMAIL_PENDING_DELETION':
        return AccountFormError(
          fieldErrors: <String, String>{
            'email': l10n.authErrorEmailPendingDeletion,
          },
        );
      case 'VALIDATION_FAILED':
        const known = <String>{
          'email',
          'currentPassword',
          'newPassword',
          'displayName',
        };
        final fields = <String, String>{
          for (final entry in error.fields.entries)
            if (known.contains(entry.key)) entry.key: entry.value,
        };
        if (fields.isNotEmpty) return AccountFormError(fieldErrors: fields);
      case 'UNAUTHORIZED':
        if (error.statusCode == 401) {
          return AccountFormError(
            fieldErrors: <String, String>{
              'currentPassword': l10n.profileErrorWrongPassword,
            },
          );
        }
    }
  }
  return AccountFormError(banner: describeError(context, error));
}

/// Khối của một mục trong Hồ sơ: tiêu đề, mô tả ngắn và nội dung.
class ProfileSection extends StatelessWidget {
  const ProfileSection({
    super.key,
    required this.title,
    this.help,
    required this.children,
    this.destructive = false,
  });

  final String title;
  final String? help;
  final List<Widget> children;

  /// Tô màu cảnh báo cho khu vực nguy hiểm (xóa tài khoản).
  final bool destructive;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      shape: destructive
          ? RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: BorderSide(color: theme.colorScheme.error),
            )
          : null,
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Semantics(
              header: true,
              child: Text(
                title,
                style: theme.textTheme.titleMedium?.copyWith(
                  color: destructive ? theme.colorScheme.error : null,
                ),
              ),
            ),
            if (help != null) ...<Widget>[
              const SizedBox(height: 4),
              Text(help!, style: theme.textTheme.bodySmall),
            ],
            const SizedBox(height: 16),
            ...children,
          ],
        ),
      ),
    );
  }
}

/// Dòng kết quả của một biểu mẫu (thành công hoặc lỗi chung), đọc được bằng trình đọc màn hình.
class StatusLine extends StatelessWidget {
  const StatusLine({super.key, required this.message, this.isError = false});

  final String message;
  final bool isError;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Semantics(
      liveRegion: true,
      child: Padding(
        padding: const EdgeInsets.only(top: 12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Icon(
              isError ? Icons.error_outline : Icons.check_circle_outline,
              size: 18,
              color: isError ? scheme.error : scheme.primary,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                message,
                style: TextStyle(color: isError ? scheme.error : null),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
