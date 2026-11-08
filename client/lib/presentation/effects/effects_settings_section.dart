import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../l10n/app_localizations.dart';
import '../profile/profile_support.dart';
import 'effects_controller.dart';

/// Mục "Hiệu ứng" ở Hồ sơ (spec 005, US3): hai công tắc độc lập "Âm thanh" và "Hiệu ứng hình ảnh", mặc định
/// bật. Hai tùy chọn KHÔNG bị khóa khi học viên thuộc lớp nên không bọc trong `LockedControl`. Lưu lạc quan;
/// thất bại thì controller hoàn lại giá trị cũ và mục này báo lỗi chung.
class EffectsSettingsSection extends ConsumerStatefulWidget {
  const EffectsSettingsSection({super.key});

  @override
  ConsumerState<EffectsSettingsSection> createState() =>
      _EffectsSettingsSectionState();
}

class _EffectsSettingsSectionState
    extends ConsumerState<EffectsSettingsSection> {
  bool _failed = false;

  Future<void> _change(Future<void> Function() save) async {
    setState(() => _failed = false);
    try {
      await save();
    } on Object {
      if (mounted) setState(() => _failed = true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final settings = ref.watch(effectsControllerProvider);
    final controller = ref.read(effectsControllerProvider.notifier);
    return ProfileSection(
      title: l10n.effectsSettingsTitle,
      help: l10n.effectsSettingsHelp,
      children: <Widget>[
        SwitchListTile(
          key: const Key('effects-sound-switch'),
          contentPadding: EdgeInsets.zero,
          secondary: const Icon(Icons.volume_up_outlined),
          title: Text(l10n.effectsSoundLabel),
          subtitle: Text(l10n.effectsSoundHelp),
          value: settings.soundEnabled,
          onChanged: (value) => _change(() => controller.setSound(value)),
        ),
        SwitchListTile(
          key: const Key('effects-visual-switch'),
          contentPadding: EdgeInsets.zero,
          secondary: const Icon(Icons.auto_awesome_outlined),
          title: Text(l10n.effectsVisualLabel),
          subtitle: Text(l10n.effectsVisualHelp),
          value: settings.visualEnabled,
          onChanged: (value) => _change(() => controller.setVisual(value)),
        ),
        if (_failed)
          StatusLine(
            key: const Key('effects-settings-error'),
            message: l10n.effectsSaveFailed,
            isError: true,
          ),
      ],
    );
  }
}
