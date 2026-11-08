import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'celebration_card.dart';
import 'effect_mode.dart';
import 'effect_specs.dart';
import 'effects_controller.dart';

/// Màn chúc mừng gộp ở gốc ứng dụng (spec 005, US2, contracts/client-effects.md §5).
///
/// Bọc nội dung ứng dụng thành `Stack[ child, thẻ ]` và KHÔNG có `ModalBarrier`: màn chỉ là lớp phủ, mọi nút
/// bên dưới (đặc biệt "Tiếp tục") dùng được ngay (Làm rõ Q4, FR-013). Mọi `PointerDown` trên ứng dụng hoặc đổi
/// tuyến đóng TOÀN BỘ màn gộp nhưng sự kiện vẫn tới nút bên dưới (`HitTestBehavior.translucent`). Hàng đợi
/// "ngày trước, rồi từng thành tựu theo thứ tự" chỉ sống trong bộ nhớ của widget này — không lưu ở đâu cả,
/// nên không bao giờ chúc mừng bù (FR-016). Mỗi thẻ tự chuyển/đóng sau [celebrationCardDuration].
class CelebrationHost extends ConsumerStatefulWidget {
  const CelebrationHost({
    super.key,
    required this.child,
    this.routeChanges,
    this.currentLocation,
  });

  final Widget child;

  /// Phát thông báo mỗi khi tuyến đổi (ví dụ `GoRouter.routerDelegate`); `null` → không theo dõi tuyến.
  final Listenable? routeChanges;

  /// Vị trí tuyến hiện tại. Có thì chỉ đóng khi vị trí KHÁC lúc màn hiện; không có thì mọi thông báo đều đóng.
  final String Function()? currentLocation;

  @override
  ConsumerState<CelebrationHost> createState() => _CelebrationHostState();
}

class _CelebrationHostState extends ConsumerState<CelebrationHost>
    with SingleTickerProviderStateMixin {
  late final AnimationController _progress = AnimationController(vsync: this)
    ..addStatusListener(_onStatus);
  StreamSubscription<List<CelebrationEntry>>? _subscription;
  List<CelebrationEntry> _entries = const <CelebrationEntry>[];
  int _index = 0;
  String? _baseLocation;
  bool _reduceMotion = false;

  bool get _active => _entries.isNotEmpty;

  @override
  void initState() {
    super.initState();
    _subscription = ref
        .read(effectsControllerProvider.notifier)
        .celebrationBatches
        .listen(_onBatch);
    widget.routeChanges?.addListener(_onRouteChanged);
  }

  @override
  void didUpdateWidget(CelebrationHost old) {
    super.didUpdateWidget(old);
    if (old.routeChanges != widget.routeChanges) {
      old.routeChanges?.removeListener(_onRouteChanged);
      widget.routeChanges?.addListener(_onRouteChanged);
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _reduceMotion = MediaQuery.disableAnimationsOf(context);
  }

  @override
  void dispose() {
    widget.routeChanges?.removeListener(_onRouteChanged);
    _subscription?.cancel();
    _progress.dispose();
    super.dispose();
  }

  EffectMode get _mode => resolveEffectMode(
    visualEnabled: ref.read(effectsControllerProvider).visualEnabled,
    reduceMotion: _reduceMotion,
  );

  void _onBatch(List<CelebrationEntry> batch) {
    if (!mounted || batch.isEmpty) return;
    setState(() {
      _entries = batch;
      _index = 0;
      _baseLocation = widget.currentLocation?.call();
    });
    _showCurrent();
  }

  void _showCurrent() {
    _progress.duration = _mode == EffectMode.off
        ? staticNoticeDuration
        : celebrationCardDuration;
    _progress.forward(from: 0);
    ref
        .read(effectsControllerProvider.notifier)
        .onCelebrationShown(_entries[_index]);
  }

  void _onStatus(AnimationStatus status) {
    if (status != AnimationStatus.completed || !mounted || !_active) return;
    if (_index + 1 < _entries.length) {
      setState(() => _index += 1);
      _showCurrent();
    } else {
      _dismissAll();
    }
  }

  void _onRouteChanged() {
    if (!_active) return;
    final location = widget.currentLocation;
    if (location == null || location() != _baseLocation) _dismissAll();
  }

  void _dismissAll() {
    if (!mounted || !_active) return;
    _progress.stop();
    setState(() {
      _entries = const <CelebrationEntry>[];
      _index = 0;
    });
  }

  @override
  Widget build(BuildContext context) {
    // Theo dõi tùy chọn hình ảnh để đổi chế độ khi người học bật/tắt giữa chừng.
    ref.watch(effectsControllerProvider.select((s) => s.visualEnabled));
    final padding = MediaQuery.paddingOf(context);
    return Listener(
      behavior: HitTestBehavior.translucent,
      onPointerDown: (_) => _dismissAll(),
      child: Stack(
        children: <Widget>[
          Positioned.fill(child: widget.child),
          if (_active)
            Positioned(
              key: const Key('celebration-overlay'),
              top: padding.top + kToolbarHeight + 8,
              left: 16,
              right: 16,
              child: Align(
                alignment: Alignment.topCenter,
                child: CelebrationCard(
                  key: ValueKey<int>(_index),
                  entry: _entries[_index],
                  mode: _mode,
                  progress: _progress,
                  onClose: _dismissAll,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
