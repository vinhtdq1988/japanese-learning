import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../l10n/app_localizations.dart';
import 'effect_mode.dart';
import 'effect_specs.dart';
import 'effects_controller.dart';

/// Xanh lục của hiệu ứng trả lời đúng.
const Color answerEffectGreen = Color(0xFF2E9E6B);

/// Hổ phách của hiệu ứng trả lời sai: nhẹ nhàng, KHÔNG phải đỏ gắt (không trừng phạt).
const Color answerEffectAmber = Color(0xFFF2A93B);

/// Vàng của tia lấp lánh.
const Color _sparkleGold = Color(0xFFFFD166);

/// Bọc nội dung màn hình bài tập và vẽ hiệu ứng đúng/sai lên trên khi có `AnswerEffectEvent` (spec 005, US1).
///
/// Lớp hiệu ứng chỉ trang trí: nằm trong `IgnorePointer` (không chặn thao tác, FR-004), `RepaintBoundary`
/// (không làm vẽ lại cả trang) và `ExcludeSemantics` (trình đọc màn hình không thấy), không đổi kích thước bố
/// cục (FR-026). Sự kiện mới thay hiệu ứng đang chạy (FR-005). Hiển thị theo [EffectMode]:
/// `full` hoạt ảnh đầy đủ, `reduced` chỉ mờ dần, `off` không dựng gì.
///
/// Khi sự kiện mang `streakMilestone` (đúng liên tiếp chạm 3/5/10, US4) lớp hiệu ứng có thêm huy hiệu
/// "N liên tiếp": `full` nảy nhẹ một nhịp ≤ 700 ms, `reduced` chỉ hiện/mờ, `off` là dòng chữ tĩnh.
class AnswerEffect extends ConsumerStatefulWidget {
  const AnswerEffect({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<AnswerEffect> createState() => _AnswerEffectState();
}

class _AnswerEffectState extends ConsumerState<AnswerEffect>
    with SingleTickerProviderStateMixin {
  late final AnimationController _animation = AnimationController(vsync: this)
    ..addStatusListener(_onStatus);
  StreamSubscription<AnswerEffectEvent>? _subscription;
  AnswerEffectEvent? _event;
  EffectMode _mode = EffectMode.off;
  bool _reduceMotion = false;

  @override
  void initState() {
    super.initState();
    _subscription = ref
        .read(effectsControllerProvider.notifier)
        .answerEvents
        .listen(_onEvent);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _reduceMotion = MediaQuery.disableAnimationsOf(context);
  }

  void _onEvent(AnswerEffectEvent event) {
    if (!mounted) return;
    final mode = resolveEffectMode(
      visualEnabled: ref.read(effectsControllerProvider).visualEnabled,
      reduceMotion: _reduceMotion,
    );
    final milestone = event.streakMilestone;
    if (mode == EffectMode.off && milestone == null) {
      // Tắt hiệu ứng hình ảnh: hủy hiệu ứng đang chạy; kết quả vẫn hiện bằng biểu tượng + chữ của thẻ phản hồi.
      _animation.stop();
      if (_event != null) setState(() => _event = null);
      return;
    }
    final spec = event.correct ? correctEffect : incorrectEffect;
    _animation.duration = mode == EffectMode.off
        ? staticNoticeDuration // chữ tĩnh: đủ lâu để đọc, không hoạt ảnh
        : (milestone != null ? streakEffect.duration : spec.duration);
    setState(() {
      _event = event;
      _mode = mode;
    });
    _animation.forward(from: 0);
  }

  void _onStatus(AnimationStatus status) {
    if (status == AnimationStatus.completed && mounted && _event != null) {
      setState(() => _event = null);
    }
  }

  @override
  void dispose() {
    _subscription?.cancel();
    _animation.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final event = _event;
    return Stack(
      fit: StackFit.passthrough,
      children: <Widget>[
        widget.child,
        if (event != null)
          Positioned.fill(
            key: const Key('answer-effect-layer'),
            child: IgnorePointer(
              child: RepaintBoundary(
                child: ExcludeSemantics(
                  child: KeyedSubtree(
                    key: Key(
                      'answer-effect-${event.correct ? 'correct' : 'incorrect'}',
                    ),
                    child: Stack(
                      fit: StackFit.expand,
                      children: <Widget>[
                        if (_mode != EffectMode.off)
                          CustomPaint(
                            key: Key('answer-effect-${_mode.name}'),
                            painter: _AnswerEffectPainter(
                              animation: _animation,
                              correct: event.correct,
                              mode: _mode,
                            ),
                          ),
                        if (event.streakMilestone != null)
                          _StreakBadge(
                            count: event.streakMilestone!,
                            mode: _mode,
                            animation: _animation,
                          ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

/// Huy hiệu "N liên tiếp" ở góc trên của vùng nội dung (không che câu hỏi/đáp án/nút chính, FR-026).
class _StreakBadge extends StatelessWidget {
  const _StreakBadge({
    required this.count,
    required this.mode,
    required this.animation,
  });

  final int count;
  final EffectMode mode;
  final Animation<double> animation;

  /// Nảy đúng một nhịp: phóng lên ở 30% đầu rồi trở về, không có đỉnh thứ hai (FR-023).
  static double _bump(double t) =>
      t < 0.3 ? t / 0.3 : math.max(0, (1 - t) / 0.7);

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final label = AppLocalizations.of(context).effectsStreakBadge(count);
    final chip = DecoratedBox(
      decoration: BoxDecoration(
        color: theme.colorScheme.primaryContainer,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Icon(
              Icons.local_fire_department,
              size: 18,
              color: theme.colorScheme.onPrimaryContainer,
            ),
            const SizedBox(width: 6),
            Text(
              label,
              key: const Key('streak-badge-text'),
              style: theme.textTheme.labelLarge?.copyWith(
                color: theme.colorScheme.onPrimaryContainer,
              ),
            ),
          ],
        ),
      ),
    );
    return Align(
      key: const Key('streak-badge'),
      alignment: AlignmentDirectional.topEnd,
      child: Padding(
        padding: const EdgeInsets.only(top: 4),
        child: mode == EffectMode.off
            ? chip // chữ tĩnh: không hoạt ảnh
            : AnimatedBuilder(
                animation: animation,
                child: chip,
                builder: (context, child) {
                  final t = animation.value.clamp(0.0, 1.0);
                  final opacity = math.min(
                    1.0,
                    math.min(t / 0.1, (1 - t) / 0.2),
                  );
                  final scale = mode == EffectMode.full
                      ? 1 + 0.25 * _bump(t)
                      : 1.0;
                  return Opacity(
                    opacity: opacity.clamp(0.0, 1.0),
                    child: Transform.scale(scale: scale, child: child),
                  );
                },
              ),
      ),
    );
  }
}

/// Đường bao biên độ một nhịp: lên nhanh tới đỉnh ở 20% thời lượng rồi tắt dần (không bao giờ có đỉnh thứ hai).
double _envelope(double t) => t < 0.2 ? t / 0.2 : (1 - t) / 0.8;

class _AnswerEffectPainter extends CustomPainter {
  _AnswerEffectPainter({
    required this.animation,
    required this.correct,
    required this.mode,
  }) : super(repaint: animation);

  final Animation<double> animation;
  final bool correct;
  final EffectMode mode;

  @override
  void paint(Canvas canvas, Size size) {
    if (size.isEmpty) return;
    final t = animation.value.clamp(0.0, 1.0);
    final envelope = _envelope(t).clamp(0.0, 1.0);
    if (!correct) {
      _paintGlow(canvas, size, answerEffectAmber, 0.5 * envelope);
    } else if (mode == EffectMode.reduced) {
      // Giảm chuyển động: chỉ vầng sáng xanh mờ dần, không có chuyển động tịnh tiến/xoay.
      _paintGlow(canvas, size, answerEffectGreen, 0.35 * envelope);
    } else {
      _paintBurst(canvas, size, t, envelope);
    }
  }

  /// Vầng sáng mềm ở mép vùng nội dung (không đổi độ sáng cả màn hình, FR-023).
  void _paintGlow(Canvas canvas, Size size, Color color, double alpha) {
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 20
      ..color = color.withValues(alpha: alpha)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 14);
    canvas.drawRect(Offset.zero & size, paint);
  }

  /// Vòng xung xanh lục lan ra kèm cụm tia lấp lánh nhỏ, một nhịp.
  void _paintBurst(Canvas canvas, Size size, double t, double envelope) {
    final center = Offset(size.width / 2, size.height * 0.55);
    final maxRadius = math.min(size.width, size.height) * 0.28;
    final eased = Curves.easeOutCubic.transform(t);
    final radius = 24 + (maxRadius - 24) * eased;

    final ring = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 6 * (1 - t) + 1
      ..color = answerEffectGreen.withValues(alpha: 0.6 * envelope);
    canvas.drawCircle(center, radius, ring);

    // Tia lấp lánh: các hình thoi nhỏ tỏa đều quanh vòng, tối đa [maxAnswerParticles] hạt.
    final sparkle = Paint()..color = _sparkleGold.withValues(alpha: envelope);
    for (var i = 0; i < maxAnswerParticles; i++) {
      final angle = (2 * math.pi / maxAnswerParticles) * i;
      final reach = radius * (i.isEven ? 1.0 : 1.25);
      final p = center + Offset(math.cos(angle), math.sin(angle)) * reach;
      final half = i.isEven ? 4.0 : 2.5;
      final path = Path()
        ..moveTo(p.dx, p.dy - half * 1.6)
        ..lineTo(p.dx + half, p.dy)
        ..lineTo(p.dx, p.dy + half * 1.6)
        ..lineTo(p.dx - half, p.dy)
        ..close();
      canvas.drawPath(path, sparkle);
    }
  }

  @override
  bool shouldRepaint(_AnswerEffectPainter old) =>
      old.correct != correct || old.mode != mode || old.animation != animation;
}
