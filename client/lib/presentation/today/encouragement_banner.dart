import 'package:flutter/material.dart';
import 'package:japanese_api/japanese_api.dart';

/// Dải lời khích lệ ở màn hình "Hôm nay" (spec 007, FR-026…FR-030): một dải chữ tĩnh với biểu tượng nhẹ theo
/// trạng thái. Thông điệp đã được máy chủ bản địa hóa nên không cần chuỗi l10n.
///
/// Cố ý KHÔNG có lớp phủ, âm thanh hay hoạt ảnh để không trùng với hiệu ứng chúc mừng của spec 005, và hiện cả khi
/// người học tắt hiệu ứng/âm thanh (đây là chữ, không phải hiệu ứng). `encouragement = null` (máy chủ cũ) ⇒ không
/// hiện gì.
class EncouragementBanner extends StatelessWidget {
  const EncouragementBanner({super.key, required this.encouragement});

  final DailyPlanEncouragement? encouragement;

  static IconData _iconFor(DailyPlanEncouragementStateEnum state) =>
      switch (state) {
        DailyPlanEncouragementStateEnum.dayCompleted ||
        DailyPlanEncouragementStateEnum.streak => Icons.emoji_events_outlined,
        _ => Icons.favorite_border,
      };

  @override
  Widget build(BuildContext context) {
    final data = encouragement;
    if (data == null || data.message.isEmpty) return const SizedBox.shrink();
    final scheme = Theme.of(context).colorScheme;
    return Semantics(
      liveRegion: false,
      container: true,
      child: Container(
        key: const Key('encouragement-banner'),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: scheme.primaryContainer,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Icon(
              _iconFor(data.state),
              key: Key('encouragement-icon-${data.state.value}'),
              color: scheme.onPrimaryContainer,
              size: 20,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                data.message,
                key: const Key('encouragement-message'),
                style: TextStyle(color: scheme.onPrimaryContainer),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
