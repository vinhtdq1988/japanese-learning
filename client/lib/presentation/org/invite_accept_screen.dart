import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:japanese_api/japanese_api.dart';

import '../../data/api/api_error.dart';
import '../../data/api_providers.dart';
import '../../l10n/app_localizations.dart';
import '../../router_paths.dart';
import '../shared/error_messages.dart';
import '../shared/page_frame.dart';
import '../classroom/invite_choice_screen.dart';
import '../shared/state_views.dart';

/// Nhận lời mời chủ tổ chức / giáo viên từ liên kết trong email (`/invite/<token>`, spec 004, US1, FR-003).
/// Người nhận PHẢI đăng nhập bằng đúng email được mời: token sai/hết hạn/đã dùng/email không khớp đều nhận
/// cùng một 404 từ server nên màn hình chỉ báo "không hợp lệ", không lộ lời mời nào tồn tại. Lời mời vào lớp
/// (học viên) hiện HAI LỰA CHỌN NGANG NHAU kèm thông báo dữ liệu chia sẻ (US2, FR-016).
class InviteAcceptScreen extends ConsumerStatefulWidget {
  const InviteAcceptScreen({super.key, required this.token});

  final String token;

  @override
  ConsumerState<InviteAcceptScreen> createState() => _InviteAcceptScreenState();
}

class _InviteAcceptScreenState extends ConsumerState<InviteAcceptScreen> {
  InvitationPreview? _preview;

  /// Lớp học viên đang ở khi lời mời là vào một lớp KHÁC (chuyển lớp, US8); `null` nếu chưa thuộc lớp nào.
  String? _currentClassName;
  Object? _error;
  bool _loading = true;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final preview = await ref
          .read(orgRepositoryProvider)
          .previewInvitation(widget.token);
      if (mounted) setState(() => _preview = preview);
      if (preview.kind == InvitationPreviewKindEnum.student) {
        await _detectTransfer(preview);
      }
    } on ApiError catch (e) {
      if (mounted) setState(() => _error = e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Học viên đang ở lớp khác ⇒ chấp nhận lời mời nghĩa là CHUYỂN lớp, cần nêu rõ (US8). Không thuộc lớp nào
  /// (404 chung) hoặc lỗi khác ⇒ coi là lời mời vào lớp thông thường.
  Future<void> _detectTransfer(InvitationPreview preview) async {
    try {
      final mine = await ref.read(classroomRepositoryProvider).myClass();
      if (mounted && mine.class_.id != preview.class_?.id) {
        setState(() => _currentClassName = mine.class_.name);
      }
    } on ApiError {
      // Không thuộc lớp nào.
    }
  }

  Future<void> _respond({required bool accept}) async {
    final l10n = AppLocalizations.of(context);
    final preview = _preview!;
    setState(() => _submitting = true);
    try {
      await ref
          .read(orgRepositoryProvider)
          .respondInvitation(widget.token, accept: accept);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(accept ? l10n.inviteAccepted : l10n.inviteDeclined),
        ),
      );
      // Chủ tổ chức vào thẳng trang tổ chức; các trường hợp còn lại về "Hôm nay".
      context.go(
        accept && preview.kind == InvitationPreviewKindEnum.owner
            ? AppRoutes.org
            : AppRoutes.today,
      );
    } on ApiError catch (e) {
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (BuildContext dialogContext) => AlertDialog(
          key: const Key('invite-error-dialog'),
          content: Text(describeError(dialogContext, e)),
          actions: <Widget>[
            FilledButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: Text(l10n.actionClose),
            ),
          ],
        ),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  /// Lỗi khi chấp nhận lời mời: hiện hộp thoại; lời mời còn hiệu lực thì nói rõ để học viên học cá nhân tiếp.
  Future<void> _showError(ApiError e, {bool keepsInvitation = false}) async {
    final l10n = AppLocalizations.of(context);
    await showDialog<void>(
      context: context,
      builder: (BuildContext dialogContext) => AlertDialog(
        key: const Key('invite-error-dialog'),
        content: Text(
          keepsInvitation
              ? '${describeError(dialogContext, e)}\n\n${l10n.classChoiceJoinFailedKeep}'
              : describeError(dialogContext, e),
        ),
        actions: <Widget>[
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: Text(l10n.actionClose),
          ),
        ],
      ),
    );
  }

  /// Học viên đã đọc thông báo và xác nhận: vào lớp rồi sang "Lớp của tôi".
  Future<void> _joinClass() async {
    final l10n = AppLocalizations.of(context);
    setState(() => _submitting = true);
    try {
      final result = await ref
          .read(classroomRepositoryProvider)
          .joinViaInvitation(widget.token);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            l10n.classChoiceJoined(
              result.class_?.name ?? _preview?.class_?.name ?? '',
            ),
          ),
        ),
      );
      context.go(AppRoutes.myClass);
    } on ApiError catch (e) {
      if (mounted) {
        await _showError(
          e,
          keepsInvitation: e.statusCode == 409 || e.statusCode == 422,
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  /// Học viên chọn ở lại lộ trình cá nhân: không tốn seat, hồ sơ không đổi.
  Future<void> _stayPersonal() async {
    final l10n = AppLocalizations.of(context);
    setState(() => _submitting = true);
    try {
      await ref
          .read(classroomRepositoryProvider)
          .stayPersonalViaInvitation(widget.token);
      if (!mounted) return;
      final transfer = _currentClassName != null;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            transfer ? l10n.classChoiceTransferStayed : l10n.classChoiceStayed,
          ),
        ),
      );
      context.go(transfer ? AppRoutes.myClass : AppRoutes.today);
    } on ApiError catch (e) {
      if (mounted) await _showError(e);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return PageFrame(
      title: l10n.inviteTitle,
      child: _loading
          ? const LoadingView()
          : _error != null
          ? _errorView(l10n)
          : _body(l10n, _preview!),
    );
  }

  Widget _errorView(AppLocalizations l10n) {
    final api = _error;
    // 404 chung = không dùng được lời mời (sai token, hết hạn, đã dùng, khác email).
    if (api is ApiError && api.statusCode == 404) {
      return EmptyView(
        key: const Key('invite-invalid'),
        icon: Icons.mail_lock_outlined,
        title: l10n.inviteInvalid,
      );
    }
    return ErrorView(error: _error, onRetry: _load);
  }

  Widget _body(AppLocalizations l10n, InvitationPreview preview) {
    if (preview.kind == InvitationPreviewKindEnum.student) {
      final brief = preview.class_;
      final disclosure = preview.disclosure;
      if (brief == null || disclosure == null) {
        return EmptyView(
          key: const Key('invite-invalid'),
          icon: Icons.mail_lock_outlined,
          title: l10n.inviteInvalid,
        );
      }
      return InviteChoiceView(
        classBrief: brief,
        disclosure: disclosure,
        inviter: (preview.invitedBy ?? '').isEmpty
            ? l10n.inviteUnknownInviter
            : preview.invitedBy,
        currentClassName: _currentClassName,
        busy: _submitting,
        onJoin: _joinClass,
        onStay: _stayPersonal,
      );
    }
    final inviter = (preview.invitedBy ?? '').isEmpty
        ? l10n.inviteUnknownInviter
        : preview.invitedBy!;
    final body = preview.kind == InvitationPreviewKindEnum.owner
        ? l10n.inviteOwnerBody(inviter, preview.organizationName)
        : l10n.inviteTeacherBody(inviter, preview.organizationName);
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 560),
        child: Card(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  preview.organizationName,
                  key: const Key('invite-org'),
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 12),
                Text(body, key: const Key('invite-body')),
                const SizedBox(height: 8),
                Text(
                  l10n.inviteExpires(
                    DateFormat(
                      'yyyy-MM-dd',
                    ).format(preview.expiresAt.toLocal()),
                  ),
                ),
                const SizedBox(height: 20),
                Row(
                  children: <Widget>[
                    FilledButton(
                      key: const Key('invite-accept'),
                      onPressed: _submitting
                          ? null
                          : () => _respond(accept: true),
                      child: Text(l10n.inviteAccept),
                    ),
                    const SizedBox(width: 12),
                    OutlinedButton(
                      key: const Key('invite-decline'),
                      onPressed: _submitting
                          ? null
                          : () => _respond(accept: false),
                      child: Text(l10n.inviteDecline),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
