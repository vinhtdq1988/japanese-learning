import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:japanese_api/japanese_api.dart';

import '../../data/account_repository.dart';
import '../../l10n/app_localizations.dart';

final DateFormat _dateFormat = DateFormat('yyyy-MM-dd');

/// Dải cảnh báo giấy phép dành cho giáo viên và chủ tổ chức (spec 004, US6, FR-006, FR-038): đọc từ
/// `Me.organization.license` nên giáo viên — không gọi được `GET /org` — cũng thấy sắp hết hạn/ân hạn/hết hạn;
/// khi tổ chức mất quyền xem dữ liệu học (`dataAccess == false`) nói rõ chỉ còn xem được cấu trúc lớp. Lỗi hoặc
/// đang tải thì không hiện gì (cảnh báo chỉ là thông tin phụ, bảo vệ thật ở máy chủ).
class OrgLicenseBanner extends ConsumerWidget {
  const OrgLicenseBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final org = ref.watch(meProvider).valueOrNull?.organization;
    if (org == null) return const SizedBox.shrink();
    final l10n = AppLocalizations.of(context);
    final license = org.license;
    final lines = <Widget>[
      if (license != null)
        switch (license.state) {
          LicenseState.expiring => _line(
            const Key('staff-license-expiring'),
            l10n.orgLicenseExpiring(_dateFormat.format(license.endsOn)),
          ),
          LicenseState.inGrace => _line(
            const Key('staff-license-in-grace'),
            l10n.orgLicenseInGrace(_dateFormat.format(license.graceEndsOn)),
          ),
          LicenseState.lapsed => _line(
            const Key('staff-license-lapsed'),
            l10n.orgLicenseLapsed,
          ),
          _ => const SizedBox.shrink(),
        },
      if (!org.dataAccess)
        _line(const Key('staff-data-access-off'), l10n.orgDataAccessOff),
    ];
    if (lines.every((w) => w is SizedBox)) return const SizedBox.shrink();
    return Column(
      key: const Key('staff-license-banner'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: lines,
    );
  }

  Widget _line(Key key, String text) => _StaffBanner(key: key, text: text);
}

class _StaffBanner extends StatelessWidget {
  const _StaffBanner({super.key, required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: scheme.errorContainer,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: <Widget>[
          Icon(Icons.warning_amber_rounded, color: scheme.onErrorContainer),
          const SizedBox(width: 12),
          Expanded(
            child: Text(text, style: TextStyle(color: scheme.onErrorContainer)),
          ),
        ],
      ),
    );
  }
}
