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
    // Tổ chức, seat và lời mời (spec 004).
    case 'SEAT_UNAVAILABLE':
      return l10n.errorSeatUnavailable;
    case 'SEAT_REASSIGN_LIMIT':
      return l10n.errorSeatReassignLimit;
    case 'SEAT_BELOW_USAGE':
      return l10n.errorSeatBelowUsage;
    case 'INVITEE_UNAVAILABLE':
      return l10n.errorInviteeUnavailable;
    // Thao tác bị khóa khi thuộc lớp (spec 004, US3, FR-018).
    case 'CLASS_MANAGED':
      return l10n.errorClassManaged;
    // Lớp học (spec 004, US2).
    case 'CLASS_NOT_READY':
      return l10n.errorClassNotReady;
    case 'CLASS_FULL':
      return l10n.errorClassFull;
    case 'CLASS_ARCHIVED':
      return l10n.errorClassArchived;
    case 'ALREADY_IN_CLASS':
      return l10n.errorAlreadyInClass;
    case 'LAST_TEACHER':
      return l10n.errorLastTeacher;
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
