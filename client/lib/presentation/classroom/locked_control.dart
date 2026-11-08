import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:japanese_api/japanese_api.dart';

import '../../data/account_repository.dart';
import '../../data/api/api_error.dart';
import '../../data/api_providers.dart';
import '../../l10n/app_localizations.dart';
import '../../router_paths.dart';

/// Điều khiển ở dạng KHÓA khi người học thuộc lớp (spec 004, US3, FR-018): hiện nhãn, giá trị hiện tại do lớp
/// đặt, biểu tượng khóa, lý do "do lớp quyết định" và hướng dẫn "muốn tự điều chỉnh thì chuyển sang lộ trình cá
/// nhân (rời lớp)". Máy chủ vẫn từ chối bằng 409 `CLASS_MANAGED`; widget này chỉ làm rõ lý do thay vì ẩn điều
/// khiển (Nguyên tắc III: người học luôn biết vì sao và làm thế nào để lấy lại quyền).
class LockedControl extends StatelessWidget {
  const LockedControl({
    super.key,
    required this.label,
    this.value,
    this.showOpenClass = false,
  });

  final String label;

  /// Giá trị hiện tại do lớp đặt (nếu biết).
  final String? value;

  /// Hiện nút mở "Lớp của tôi" (nơi có nút rời lớp).
  final bool showOpenClass;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Semantics(
      container: true,
      label: '$label. ${l10n.lockedByClassReason}',
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Icon(Icons.lock_outline, color: theme.colorScheme.outline),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(label, style: theme.textTheme.titleSmall),
                    if ((value ?? '').isNotEmpty)
                      Text(value!, key: const Key('locked-value')),
                    const SizedBox(height: 4),
                    Text(
                      l10n.lockedByClassReason,
                      key: const Key('locked-reason'),
                      style: theme.textTheme.bodySmall?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      l10n.lockedByClassHint,
                      key: const Key('locked-hint'),
                      style: theme.textTheme.bodySmall,
                    ),
                    if (showOpenClass)
                      Align(
                        alignment: Alignment.centerLeft,
                        child: TextButton(
                          key: const Key('locked-open-class'),
                          onPressed: () => context.go(AppRoutes.myClass),
                          child: Text(l10n.lockedByClassOpen),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Tên lớp học viên đang thuộc theo lần đọc `Me` gần nhất TRONG PHIÊN (spec 004, US6, FR-037): để nhận ra việc
/// vừa mất tư cách thành viên (bị gỡ, hết seat, tổ chức hết hiệu lực) và nói rõ cho học viên. Máy chủ không đẩy
/// sự kiện, nên đây là thông báo trong phiên; học viên tự chuyển sang cá nhân thì xóa giá trị trước khi rời.
class LastClassNameNotifier extends Notifier<String?> {
  @override
  String? build() => null;

  void set(String? name) => state = name;
}

final lastClassNameProvider = NotifierProvider<LastClassNameNotifier, String?>(
  LastClassNameNotifier.new,
);

/// Nhãn "Đang học theo lộ trình lớp …" ở Hôm nay/Lộ trình (spec 004, US3, FR-021): chỉ hiện khi
/// `Me.learningSource == class`; lỗi/đang tải thì không hiện gì (nhãn chỉ là thông tin phụ).
class ClassSourceBanner extends ConsumerWidget {
  const ClassSourceBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(meProvider).valueOrNull;
    final summary = me?.classSummary;
    if (me?.learningSource != MeLearningSourceEnum.class_ || summary == null) {
      return const SizedBox.shrink();
    }
    // Ghi nhớ lớp đang thuộc để nhận ra việc bị gỡ khỏi lớp sau này (không đổi trạng thái trong lúc build).
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (context.mounted) {
        ref.read(lastClassNameProvider.notifier).set(summary.className);
      }
    });
    final l10n = AppLocalizations.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Card(
        key: const Key('class-source-banner'),
        color: Theme.of(context).colorScheme.secondaryContainer,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            children: <Widget>[
              const Icon(Icons.school_outlined),
              const SizedBox(width: 12),
              Expanded(child: Text(l10n.classSourceBanner(summary.className))),
              TextButton(
                key: const Key('class-source-open'),
                onPressed: () => context.go(AppRoutes.myClass),
                child: Text(l10n.classSourceOpen),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Thông báo "bạn không còn thuộc lớp …" ở Hôm nay (spec 004, US6, FR-037): hiện khi `Me` cho thấy học viên đã
/// về lộ trình cá nhân mà phiên này từng thấy họ trong lớp (bị gỡ, hết seat, tổ chức hết hiệu lực…). Học viên
/// tiếp tục học theo lộ trình cá nhân, lịch sử học nguyên vẹn; bấm "Đã hiểu" để đóng.
class ClassEndedBanner extends ConsumerWidget {
  const ClassEndedBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lastClass = ref.watch(lastClassNameProvider);
    final me = ref.watch(meProvider).valueOrNull;
    if (lastClass == null ||
        me == null ||
        me.learningSource == MeLearningSourceEnum.class_) {
      return const SizedBox.shrink();
    }
    final l10n = AppLocalizations.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Card(
        key: const Key('class-ended-banner'),
        color: Theme.of(context).colorScheme.tertiaryContainer,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            children: <Widget>[
              const Icon(Icons.info_outline),
              const SizedBox(width: 12),
              Expanded(child: Text(l10n.classEndedNotice(lastClass))),
              TextButton(
                key: const Key('class-ended-dismiss'),
                onPressed: () =>
                    ref.read(lastClassNameProvider.notifier).set(null),
                child: Text(l10n.classEndedDismiss),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Bài giao CHƯA XONG của học viên thuộc lớp, khóa theo tiêu đề đơn vị (spec 004, US5, FR-024): dùng để gắn
/// nhãn "Bài giao · hạn …" cho mục bài mới ở "Hôm nay". Người học không thuộc lớp, hoặc lỗi/đang tải ⇒ rỗng
/// (nhãn chỉ là thông tin phụ, không làm hỏng màn hình chính).
final assignedUnitLabelsProvider =
    FutureProvider.autoDispose<Map<String, DateTime>>((ref) async {
      final me = await ref.watch(meProvider.future);
      if (me.learningSource != MeLearningSourceEnum.class_) {
        return const <String, DateTime>{};
      }
      try {
        final mine = await ref.watch(classroomRepositoryProvider).myClass();
        return <String, DateTime>{
          for (final a in mine.assignments)
            if (a.state == MyClassAssignmentsInnerStateEnum.pending ||
                a.state == MyClassAssignmentsInnerStateEnum.overdue)
              a.title: a.dueOn,
        };
      } on ApiError {
        return const <String, DateTime>{};
      }
    });
