import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../l10n/app_localizations.dart';
import 'error_messages.dart';

/// Trạng thái đang tải. `message` mặc định là "Đang tải…".
class LoadingView extends StatelessWidget {
  const LoadingView({super.key, this.message});

  final String? message;

  @override
  Widget build(BuildContext context) {
    final text = message ?? AppLocalizations.of(context).stateLoading;
    return Center(
      child: Semantics(
        liveRegion: true,
        label: text,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            const CircularProgressIndicator(),
            const SizedBox(height: 16),
            Text(text),
          ],
        ),
      ),
    );
  }
}

/// Trạng thái lỗi kèm nút thử lại (nếu có `onRetry`). `error` được dịch sang thông báo thân thiện.
class ErrorView extends StatelessWidget {
  const ErrorView({super.key, this.error, this.message, this.onRetry});

  /// Lỗi gốc (ApiError/DioException/…); dùng để chọn thông báo.
  final Object? error;

  /// Thông báo tùy chọn, ưu tiên hơn `error`.
  final String? message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final text = message ?? describeError(context, error);
    final theme = Theme.of(context);
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 420),
        child: Semantics(
          liveRegion: true,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Icon(
                Icons.error_outline,
                size: 48,
                color: theme.colorScheme.error,
              ),
              const SizedBox(height: 12),
              Text(l10n.stateErrorTitle, style: theme.textTheme.titleMedium),
              const SizedBox(height: 8),
              Text(text, textAlign: TextAlign.center),
              if (onRetry != null) ...<Widget>[
                const SizedBox(height: 16),
                FilledButton(onPressed: onRetry, child: Text(l10n.actionRetry)),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Trạng thái trống thân thiện (ví dụ người học mới chưa có tiến độ).
class EmptyView extends StatelessWidget {
  const EmptyView({
    super.key,
    this.icon = Icons.inbox_outlined,
    this.title,
    this.message,
    this.action,
  });

  final IconData icon;
  final String? title;
  final String? message;

  /// Hành động gợi ý (ví dụ nút "Bắt đầu học").
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 420),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Icon(icon, size: 48, color: theme.colorScheme.outline),
            const SizedBox(height: 12),
            Text(
              title ?? AppLocalizations.of(context).stateEmptyTitle,
              style: theme.textTheme.titleMedium,
              textAlign: TextAlign.center,
            ),
            if (message != null) ...<Widget>[
              const SizedBox(height: 8),
              Text(message!, textAlign: TextAlign.center),
            ],
            if (action != null) ...<Widget>[
              const SizedBox(height: 16),
              action!,
            ],
          ],
        ),
      ),
    );
  }
}

/// Hiển thị `AsyncValue` của Riverpod với ba trạng thái tải/lỗi/dữ liệu thống nhất.
class AsyncValueView<T> extends StatelessWidget {
  const AsyncValueView({
    super.key,
    required this.value,
    required this.data,
    this.onRetry,
  });

  final AsyncValue<T> value;
  final Widget Function(T data) data;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return value.when(
      data: data,
      loading: () => const LoadingView(),
      error: (Object error, StackTrace _) =>
          ErrorView(error: error, onRetry: onRetry),
    );
  }
}
