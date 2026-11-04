import 'package:dio/dio.dart';
import 'package:flutter/widgets.dart';

import '../../data/api/api_error.dart';
import '../../l10n/app_localizations.dart';

/// Thông báo lỗi dễ hiểu cho người dùng, theo ngôn ngữ giao diện hiện tại.
/// Nhận [ApiError], [DioException] hoặc lỗi bất kỳ; không bao giờ lộ chi tiết kỹ thuật.
String describeError(BuildContext context, Object? error) {
  final l10n = AppLocalizations.of(context);
  final ApiError? api = switch (error) {
    ApiError e => e,
    DioException e => ApiError.fromDio(e),
    _ => null,
  };
  if (api == null) return l10n.errorGeneric;
  if (api.isNetwork) return l10n.errorNetwork;

  switch (api.code) {
    case 'ACCOUNT_DISABLED':
      return l10n.errorAccountDisabled;
    case 'ACCOUNT_PENDING_DELETION':
      return l10n.errorAccountPendingDeletion;
    case 'VALIDATION_FAILED':
      return l10n.errorValidation;
  }
  return switch (api.statusCode) {
    401 => l10n.errorSessionExpired,
    403 => l10n.errorForbidden,
    404 => l10n.errorNotFound,
    422 => l10n.errorValidation,
    429 => l10n.errorRateLimited(api.retryAfterSeconds ?? 60),
    _ => l10n.errorGeneric,
  };
}
