import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../data/api/api_error.dart';
import '../../domain/admin_unit_draft.dart';
import '../../l10n/app_localizations.dart';
import '../../router_paths.dart';
import '../shared/error_messages.dart';
import '../shared/page_frame.dart';

/// Các mục của khu vực quản trị (T108).
enum AdminSection {
  units(AppRoutes.adminUnits),
  placement(AppRoutes.adminPlacement),
  users(AppRoutes.adminUsers),
  orgs(AppRoutes.adminOrganizations),
  logs(AppRoutes.adminLogs);

  const AdminSection(this.route);

  final String route;

  String label(AppLocalizations l10n) => switch (this) {
    AdminSection.units => l10n.adminNavUnits,
    AdminSection.placement => l10n.adminNavPlacement,
    AdminSection.users => l10n.adminNavUsers,
    AdminSection.orgs => l10n.adminNavOrgs,
    AdminSection.logs => l10n.adminNavLogs,
  };
}

/// Khung các màn hình quản trị: thanh điều hướng giữa các mục rồi tới nội dung. Việc ẩn UI theo vai trò chỉ
/// là tiện lợi – quyền thật được server kiểm tra ở mọi `/admin/*` (FR-004).
class AdminFrame extends StatelessWidget {
  const AdminFrame({
    super.key,
    required this.section,
    required this.child,
    this.title,
  });

  final AdminSection section;
  final Widget child;

  /// Tiêu đề trang; mặc định là tên mục.
  final String? title;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return PageFrame(
      title: title ?? '${l10n.navAdmin} · ${section.label(l10n)}',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          // Chip gọn để năm mục vẫn nằm trên một hàng: thêm mục điều hướng không được làm đổi chiều cao khung
          // nội dung. KHÔNG dùng khung cuộn ngang (các màn hình con cuộn nội dung theo `Scrollable` đầu tiên).
          Wrap(
            spacing: 6,
            runSpacing: 8,
            children: <Widget>[
              for (final s in AdminSection.values)
                ChoiceChip(
                  key: Key('admin-nav-${s.name}'),
                  label: Text(s.label(l10n)),
                  selected: s == section,
                  visualDensity: VisualDensity.compact,
                  materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  onSelected: (_) => context.go(s.route),
                ),
            ],
          ),
          const Divider(height: 24),
          Expanded(child: child),
        ],
      ),
    );
  }
}

/// Bản dịch hiển thị đúng ngôn ngữ giao diện, lùi về ngôn ngữ còn lại nếu thiếu.
String pickText(BuildContext context, I18nDraft text) {
  final vi = Localizations.localeOf(context).languageCode != 'en';
  final primary = vi ? text.vi : text.en;
  return primary.trim().isNotEmpty ? primary : (vi ? text.en : text.vi);
}

String unitKindLabel(AppLocalizations l10n, String kind) => switch (kind) {
  'grammar' => l10n.adminKindGrammar,
  'kanji' => l10n.adminKindKanji,
  _ => l10n.adminKindVocabulary,
};

/// Nhãn khía cạnh ôn tập của bài tập gắn chữ Kanji.
String facetLabel(AppLocalizations l10n, String facet) => switch (facet) {
  'reading' => l10n.adminFacetReading,
  'word' => l10n.adminFacetWord,
  _ => l10n.adminFacetMeaning,
};

String tierLabel(AppLocalizations l10n, String tier) =>
    tier == 'foundation' ? l10n.adminTierFoundation : l10n.adminTierCore;

String unitStatusLabel(AppLocalizations l10n, String status) =>
    switch (status) {
      'active' => l10n.adminStatusActive,
      'inactive' => l10n.adminStatusInactive,
      _ => l10n.adminStatusDraft,
    };

String userStatusLabel(AppLocalizations l10n, String status) =>
    switch (status) {
      'disabled' => l10n.adminStatusDisabled,
      'pending_deletion' => l10n.adminStatusPendingDeletion,
      _ => l10n.adminStatusActiveUser,
    };

String goalTagLabel(AppLocalizations l10n, String tag) => switch (tag) {
  'work' => l10n.adminGoalWork,
  'jlpt' => l10n.adminGoalJlpt,
  _ => l10n.adminGoalDailyConversation,
};

String exerciseTypeLabel(AppLocalizations l10n, String type) => switch (type) {
  'matching' => l10n.adminExerciseTypeMatching,
  'fill_blank' => l10n.adminExerciseTypeFill,
  _ => l10n.adminExerciseTypeMultipleChoice,
};

/// `yyyy-MM-dd HH:mm` theo giờ địa phương của trình duyệt.
String formatDateTime(DateTime value) =>
    DateFormat('yyyy-MM-dd HH:mm').format(value.toLocal());

/// Hộp thoại báo lỗi một thao tác quản trị: thông báo chung và, với lỗi 422, từng lỗi theo vị trí
/// (`fields` do server trả, ví dụ `items[0].reading`) để admin biết chính xác chỗ cần sửa.
Future<void> showAdminErrorDialog(BuildContext context, Object error) {
  final l10n = AppLocalizations.of(context);
  final fields = error is ApiError ? error.fields : const <String, String>{};
  final serverMessage = error is ApiError && fields.isEmpty
      ? error.message
      : '';
  return showDialog<void>(
    context: context,
    builder: (BuildContext dialogContext) => AlertDialog(
      key: const Key('admin-error-dialog'),
      title: Text(l10n.adminActionFailedTitle),
      content: SizedBox(
        width: 480,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(describeError(dialogContext, error)),
              if (serverMessage.isNotEmpty) ...<Widget>[
                const SizedBox(height: 8),
                Text(serverMessage),
              ],
              if (fields.isNotEmpty) ...<Widget>[
                const SizedBox(height: 12),
                Text(
                  l10n.adminValidationDetails,
                  style: Theme.of(dialogContext).textTheme.titleSmall,
                ),
                for (final entry in fields.entries)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: SelectableText('• ${entry.key}: ${entry.value}'),
                  ),
              ],
            ],
          ),
        ),
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

/// Ô nhập văn bản giữ giá trị trong mô hình soạn thảo: `key` gắn với đối tượng mô hình nên khi thêm/bớt
/// phần tử khác trong danh sách, ô này không bị dựng lại hay mất nội dung đang gõ.
class DraftTextField extends StatelessWidget {
  const DraftTextField({
    super.key,
    required this.label,
    required this.value,
    required this.onChanged,
    this.maxLines = 1,
    this.errorText,
  });

  final String label;
  final String value;
  final ValueChanged<String> onChanged;
  final int maxLines;
  final String? errorText;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      initialValue: value,
      onChanged: onChanged,
      minLines: 1,
      maxLines: maxLines,
      decoration: InputDecoration(
        labelText: label,
        errorText: errorText,
        isDense: true,
      ),
    );
  }
}
