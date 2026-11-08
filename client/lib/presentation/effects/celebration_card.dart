import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../l10n/app_localizations.dart';
import 'effect_mode.dart';
import 'effect_specs.dart';
import 'effects_controller.dart';

/// Màu confetti: tươi nhưng không gắt, không có màu nào chớp (FR-023).
const List<Color> _confettiColors = <Color>[
  Color(0xFF2E9E6B),
  Color(0xFFF2A93B),
  Color(0xFF4F8EF7),
  Color(0xFFE56B9A),
  Color(0xFFFFD166),
  Color(0xFF8E7CF3),
];

/// Thẻ chúc mừng (spec 005, US2): một thành tựu hoặc lời chúc mừng hoàn thành ngày.
///
/// Theo [EffectMode]: `full` — confetti thả chậm (≤ [maxConfettiParticles] hạt, ≤ [confettiDuration], không
/// chớp) và mờ vào/ra; `reduced` — không confetti, chỉ mờ vào/ra; `off` — một dòng thông báo tĩnh ngắn. Thân
/// thẻ KHÔNG nhận thao tác (chạm xuyên xuống nút bên dưới, Làm rõ Q4); chỉ nút ✕ nhận chạm. Phần chữ nằm trong
/// `Semantics(liveRegion: true)`, hiệu ứng trang trí nằm trong `ExcludeSemantics`.
///
/// [progress] chạy 0 → 1 trong [celebrationCardDuration] và do `CelebrationHost` điều khiển.
class CelebrationCard extends StatelessWidget {
  const CelebrationCard({
    super.key,
    required this.entry,
    required this.mode,
    required this.progress,
    required this.onClose,
  });

  final CelebrationEntry entry;
  final EffectMode mode;
  final Animation<double> progress;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final achievement = entry.achievement;
    final title = achievement?.name ?? l10n.celebrationDayTitle;
    final description =
        achievement?.description ?? l10n.celebrationDayDescription;
    final semanticsLabel = mode == EffectMode.off
        ? _noticeText(l10n)
        : l10n.celebrationCardSemantics(title, description);

    final body = mode == EffectMode.off
        ? _StaticNotice(text: _noticeText(l10n))
        : _CardBody(
            entry: entry,
            eyebrow: achievement == null
                ? null
                : l10n.celebrationAchievementEyebrow,
            title: title,
            description: description,
          );

    final card = Semantics(
      liveRegion: true,
      container: true,
      label: semanticsLabel,
      child: ExcludeSemantics(child: IgnorePointer(child: body)),
    );

    final closeButton = Semantics(
      button: true,
      label: l10n.celebrationCloseLabel,
      child: InkWell(
        key: const Key('celebration-close'),
        customBorder: const CircleBorder(),
        onTap: onClose,
        child: const SizedBox(
          width: 40,
          height: 40,
          child: Icon(Icons.close, size: 20),
        ),
      ),
    );

    final stack = Stack(
      clipBehavior: Clip.none,
      children: <Widget>[
        Padding(
          padding: const EdgeInsetsDirectional.only(end: 36),
          child: card,
        ),
        if (mode == EffectMode.full)
          Positioned.fill(
            child: IgnorePointer(
              child: ExcludeSemantics(
                child: RepaintBoundary(
                  child: CustomPaint(
                    key: const Key('celebration-confetti'),
                    painter: _ConfettiPainter(progress),
                  ),
                ),
              ),
            ),
          ),
        PositionedDirectional(top: -6, end: -6, child: closeButton),
      ],
    );

    return AnimatedBuilder(
      animation: progress,
      builder: (context, child) => Opacity(
        opacity: mode == EffectMode.off ? 1 : _fade(progress.value),
        child: child,
      ),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 420),
        child: Material(
          key: Key('celebration-card-${mode.name}'),
          elevation: 6,
          color: Theme.of(context).colorScheme.surfaceContainerHigh,
          borderRadius: BorderRadius.circular(16),
          child: Padding(padding: const EdgeInsets.all(16), child: stack),
        ),
      ),
    );
  }

  String _noticeText(AppLocalizations l10n) {
    final achievement = entry.achievement;
    return achievement == null
        ? l10n.celebrationDayTitle
        : l10n.celebrationAchievementNotice(achievement.name);
  }
}

/// Mờ vào ở 7% đầu và mờ ra ở 7% cuối thời lượng; giữa chừng rõ hẳn.
double _fade(double t) =>
    math.min(1.0, math.min(t / 0.07, (1 - t) / 0.07)).clamp(0.0, 1.0);

class _CardBody extends StatelessWidget {
  const _CardBody({
    required this.entry,
    required this.eyebrow,
    required this.title,
    required this.description,
  });

  final CelebrationEntry entry;
  final String? eyebrow;
  final String title;
  final String description;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        CircleAvatar(
          radius: 22,
          backgroundColor: theme.colorScheme.primaryContainer,
          child: Icon(
            entry.isDay ? Icons.celebration : Icons.emoji_events,
            color: theme.colorScheme.onPrimaryContainer,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              if (eyebrow != null)
                Text(
                  eyebrow!,
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: theme.colorScheme.primary,
                  ),
                ),
              Text(
                title,
                key: const Key('celebration-title'),
                style: theme.textTheme.titleMedium,
              ),
              const SizedBox(height: 2),
              Text(description, style: theme.textTheme.bodyMedium),
            ],
          ),
        ),
      ],
    );
  }
}

/// Thông báo tĩnh một dòng khi tắt hiệu ứng hình ảnh (US3.4).
class _StaticNotice extends StatelessWidget {
  const _StaticNotice({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      key: const Key('celebration-notice'),
      style: Theme.of(context).textTheme.titleSmall,
    );
  }
}

/// Confetti thả chậm: vị trí và pha của mỗi hạt suy ra từ chỉ số nên xác định (kiểm thử lặp lại được).
class _ConfettiPainter extends CustomPainter {
  _ConfettiPainter(this.progress) : super(repaint: progress);

  final Animation<double> progress;

  @override
  void paint(Canvas canvas, Size size) {
    if (size.isEmpty) return;
    final seconds =
        progress.value * celebrationCardDuration.inMilliseconds / 1000;
    final t = (seconds / confettiDuration.inMilliseconds * 1000).clamp(
      0.0,
      1.0,
    );
    if (t >= 1) return;
    final alpha = (1 - t).clamp(0.0, 1.0);
    for (var i = 0; i < maxConfettiParticles; i++) {
      final x = ((i * 0.6180339887) % 1.0) * size.width;
      final speed = 0.7 + ((i * 37) % 10) / 20;
      final y = -12 + (size.height + 56) * t * speed;
      final sway = math.sin(t * math.pi * 2 + i) * 8;
      final paint = Paint()
        ..color = _confettiColors[i % _confettiColors.length].withValues(
          alpha: alpha,
        );
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromCenter(
            center: Offset(x + sway, y),
            width: 6 + (i % 3),
            height: 9 + (i % 4),
          ),
          const Radius.circular(1.5),
        ),
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(_ConfettiPainter old) => old.progress != progress;
}
