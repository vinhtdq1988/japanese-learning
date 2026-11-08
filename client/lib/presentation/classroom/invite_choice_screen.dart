import 'package:flutter/material.dart';
import 'package:japanese_api/japanese_api.dart';

import '../../l10n/app_localizations.dart';
import '../shared/confirm_dialog.dart';

/// Màn hình HAI LỰA CHỌN NGANG NHAU khi được mời vào lớp hoặc nhập mã (spec 004, US2, FR-016, Nguyên tắc III):
/// "Vào lớp và theo lộ trình lớp" hoặc "Tiếp tục theo lộ trình cá nhân", kèm thông báo dữ liệu chia sẻ, các
/// điều khiển bị khóa, quyền rời lớp bất cứ lúc nào và việc trung tâm chỉ MỜI (không tự) chuyển lớp. Chỉ lựa chọn vào
/// lớp mới qua bước xác nhận; chọn cá nhân không gọi tạo thành viên (seat không bị tính).
///
/// Dùng chung cho liên kết lời mời (`/invite/<token>`) và nhập mã (`/join`) nên thông báo ở hai nơi là một.
class InviteChoiceView extends StatelessWidget {
  const InviteChoiceView({
    super.key,
    required this.classBrief,
    required this.disclosure,
    required this.onJoin,
    required this.onStay,
    this.inviter,
    this.currentClassName,
    this.busy = false,
  });

  final ClassBrief classBrief;
  final SharedDataDisclosure disclosure;

  /// Tên người mời; `null` khi vào lớp bằng mã.
  final String? inviter;

  /// Lớp học viên đang ở: có ⇒ đây là lời mời CHUYỂN lớp (US8). Lựa chọn thành "Chuyển sang lớp này" /
  /// "Ở lại lớp hiện tại" (vẫn ngang nhau, cần xác nhận mới chuyển); từ chối không đổi gì.
  final String? currentClassName;

  /// Đang gửi yêu cầu: vô hiệu hóa cả hai lựa chọn.
  final bool busy;

  /// Gọi SAU khi người học đã xác nhận.
  final Future<void> Function() onJoin;
  final Future<void> Function() onStay;

  Future<void> _confirmAndJoin(BuildContext context) async {
    final l10n = AppLocalizations.of(context);
    final transfer = currentClassName != null;
    final ok = await showConfirmDialog(
      context,
      title: transfer
          ? l10n.classChoiceTransferConfirmTitle
          : l10n.classChoiceConfirmTitle,
      message: transfer
          ? l10n.classChoiceTransferConfirmMessage
          : l10n.classChoiceConfirmMessage,
      confirmLabel: transfer
          ? l10n.classChoiceTransferJoin
          : l10n.classChoiceConfirmJoin,
    );
    if (ok) await onJoin();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final teacherNames = classBrief.teachers
        .map((t) => t.displayName)
        .where((n) => n.isNotEmpty)
        .join(', ');
    final intro = inviter == null
        ? l10n.classChoiceIntroCode(
            classBrief.name,
            classBrief.organizationName,
          )
        : l10n.classChoiceIntroInvite(
            inviter!,
            classBrief.name,
            classBrief.organizationName,
          );
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 640),
        child: SingleChildScrollView(
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    classBrief.name,
                    key: const Key('choice-class'),
                    style: theme.textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 8),
                  Text(intro, key: const Key('choice-intro')),
                  if (teacherNames.isNotEmpty) ...<Widget>[
                    const SizedBox(height: 4),
                    Text(l10n.classChoiceTeachers(teacherNames)),
                  ],
                  if (currentClassName != null) ...<Widget>[
                    const SizedBox(height: 12),
                    _Note(
                      key: const Key('choice-transfer-note'),
                      text: l10n.classChoiceTransferNote(currentClassName!),
                    ),
                  ],
                  const SizedBox(height: 20),
                  _Section(
                    key: const Key('choice-visible'),
                    title: l10n.classChoiceVisibleTitle,
                    icon: Icons.visibility_outlined,
                    lines: disclosure.visible.map((i) => i.label).toList(),
                  ),
                  _Section(
                    key: const Key('choice-not-visible'),
                    title: l10n.classChoiceNotVisibleTitle,
                    icon: Icons.visibility_off_outlined,
                    lines: disclosure.notVisible,
                  ),
                  _Section(
                    key: const Key('choice-locked'),
                    title: l10n.classChoiceLockedTitle,
                    icon: Icons.lock_outline,
                    lines: disclosure.lockedControls,
                  ),
                  const SizedBox(height: 4),
                  if (disclosure.canLeaveAnytime)
                    _Note(
                      key: const Key('choice-leave-note'),
                      text: l10n.classChoiceLeaveNote,
                    ),
                  if (!disclosure.mayBeMovedWithinOrganization)
                    _Note(
                      key: const Key('choice-move-note'),
                      text: l10n.classChoiceMoveNote,
                    ),
                  const SizedBox(height: 20),
                  // Hai lựa chọn có cùng kiểu và kích thước: không có lựa chọn nào được nhấn mạnh hơn.
                  Wrap(
                    spacing: 12,
                    runSpacing: 12,
                    children: <Widget>[
                      OutlinedButton(
                        key: const Key('choice-join'),
                        onPressed: busy ? null : () => _confirmAndJoin(context),
                        child: Text(
                          currentClassName == null
                              ? l10n.classChoiceJoin
                              : l10n.classChoiceTransferJoin,
                        ),
                      ),
                      OutlinedButton(
                        key: const Key('choice-stay'),
                        onPressed: busy ? null : onStay,
                        child: Text(
                          currentClassName == null
                              ? l10n.classChoiceStay
                              : l10n.classChoiceTransferStay,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    currentClassName == null
                        ? l10n.classChoiceStayHint
                        : l10n.classChoiceTransferStayHint,
                    style: theme.textTheme.bodySmall,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({
    super.key,
    required this.title,
    required this.icon,
    required this.lines,
  });

  final String title;
  final IconData icon;
  final List<String> lines;

  @override
  Widget build(BuildContext context) {
    if (lines.isEmpty) return const SizedBox.shrink();
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Icon(icon, size: 18),
              const SizedBox(width: 8),
              Expanded(child: Text(title, style: theme.textTheme.titleSmall)),
            ],
          ),
          const SizedBox(height: 4),
          for (final line in lines)
            Padding(
              padding: const EdgeInsets.only(left: 26, top: 2),
              child: Text('• $line'),
            ),
        ],
      ),
    );
  }
}

class _Note extends StatelessWidget {
  const _Note({super.key, required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          const Icon(Icons.info_outline, size: 18),
          const SizedBox(width: 8),
          Expanded(child: Text(text)),
        ],
      ),
    );
  }
}
