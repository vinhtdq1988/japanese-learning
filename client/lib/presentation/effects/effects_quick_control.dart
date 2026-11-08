import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../l10n/app_localizations.dart';
import 'effects_controller.dart';

/// Nút điều khiển nhanh ở thanh tiêu đề bài học (spec 005, US3, FR-020, SC-005): bật/tắt âm thanh bằng MỘT
/// thao tác mà không rời bài. Trạng thái thể hiện bằng biểu tượng (loa bật/tắt), không chỉ bằng màu; có
/// `tooltip` và nhãn trợ năng. Khách không có trang Hồ sơ nên [showVisualToggle] thêm nút hiệu ứng hình ảnh.
class EffectsQuickControl extends ConsumerWidget {
  const EffectsQuickControl({super.key, this.showVisualToggle = false});

  final bool showVisualToggle;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final settings = ref.watch(effectsControllerProvider);
    final controller = ref.read(effectsControllerProvider.notifier);
    final soundLabel = settings.soundEnabled
        ? l10n.effectsQuickSoundMute
        : l10n.effectsQuickSoundUnmute;
    final visualLabel = settings.visualEnabled
        ? l10n.effectsQuickVisualDisable
        : l10n.effectsQuickVisualEnable;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        IconButton(
          key: const Key('effects-sound-toggle'),
          tooltip: soundLabel,
          icon: Icon(
            settings.soundEnabled ? Icons.volume_up : Icons.volume_off,
            semanticLabel: soundLabel,
          ),
          // Lưu thất bại đã được controller hoàn lại; nút nhanh không cần báo thêm.
          onPressed: () =>
              _swallow(controller.setSound(!settings.soundEnabled)),
        ),
        if (showVisualToggle)
          IconButton(
            key: const Key('effects-visual-toggle'),
            tooltip: visualLabel,
            icon: Icon(
              settings.visualEnabled
                  ? Icons.auto_awesome
                  : Icons.auto_awesome_outlined,
              semanticLabel: visualLabel,
            ),
            onPressed: () =>
                _swallow(controller.setVisual(!settings.visualEnabled)),
          ),
      ],
    );
  }

  Future<void> _swallow(Future<void> save) async {
    try {
      await save;
    } on Object {
      // Giá trị cũ đã được hoàn lại; hiệu ứng không bao giờ làm gián đoạn bài học.
    }
  }
}
