import 'package:flutter/material.dart';

import '../../l10n/app_localizations.dart';

/// Hộp thoại xác nhận (xóa tài khoản, xây dựng lại lộ trình, …). Trả `true` khi người dùng xác nhận,
/// `false` khi hủy hoặc đóng hộp thoại. `destructive` tô nút xác nhận bằng màu cảnh báo.
Future<bool> showConfirmDialog(
  BuildContext context, {
  required String title,
  required String message,
  String? confirmLabel,
  String? cancelLabel,
  bool destructive = false,
}) async {
  final l10n = AppLocalizations.of(context);
  final result = await showDialog<bool>(
    context: context,
    builder: (BuildContext dialogContext) {
      final scheme = Theme.of(dialogContext).colorScheme;
      return AlertDialog(
        title: Text(title),
        content: Text(message),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text(cancelLabel ?? l10n.actionCancel),
          ),
          FilledButton(
            style: destructive
                ? FilledButton.styleFrom(
                    backgroundColor: scheme.error,
                    foregroundColor: scheme.onError,
                  )
                : null,
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: Text(confirmLabel ?? l10n.actionConfirm),
          ),
        ],
      );
    },
  );
  return result ?? false;
}
