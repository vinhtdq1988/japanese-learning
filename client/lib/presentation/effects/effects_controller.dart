import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:japanese_api/japanese_api.dart';

import '../../data/account_repository.dart';
import '../../data/session_controller.dart';
import '../../platform/platform_providers.dart';
import '../../platform/sound_player.dart';

// Cổng vào duy nhất của hiệu ứng phản hồi (spec 005, contracts/client-effects.md §2). Mọi nơi có phản hồi
// đúng/sai tức thì (bài học, ôn tập, bài học mẫu) gọi `onAnswer`; bài kiểm tra trình độ KHÔNG dùng lớp này (FR-007).

/// Tùy chọn hiệu ứng của người học. Hai tùy chọn độc lập, mặc định cùng bật.
class EffectsSettings {
  const EffectsSettings({this.soundEnabled = true, this.visualEnabled = true});

  final bool soundEnabled;
  final bool visualEnabled;

  EffectsSettings copyWith({bool? soundEnabled, bool? visualEnabled}) =>
      EffectsSettings(
        soundEnabled: soundEnabled ?? this.soundEnabled,
        visualEnabled: visualEnabled ?? this.visualEnabled,
      );
}

/// Một lần phản hồi trả lời. `id` tăng dần để widget hiệu ứng phân biệt sự kiện mới với sự kiện cũ.
class AnswerEffectEvent {
  const AnswerEffectEvent({
    required this.id,
    required this.correct,
    this.streakMilestone,
  });

  final int id;
  final bool correct;

  /// 3 | 5 | 10 khi vừa chạm ngưỡng chuỗi đúng liên tiếp; ngược lại `null`.
  final int? streakMilestone;
}

/// Một thẻ trong màn chúc mừng gộp: lời chúc mừng hoàn thành ngày hoặc một thành tựu (spec 005, US2).
class CelebrationEntry {
  const CelebrationEntry.day() : achievement = null;
  const CelebrationEntry.achievement(AchievementEarned this.achievement);

  /// `null` nghĩa là thẻ "hoàn thành ngày".
  final AchievementEarned? achievement;

  bool get isDay => achievement == null;
}

/// Điều phối cue âm thanh và sự kiện hiệu ứng hình ảnh; giữ tùy chọn hiện hành.
///
/// Người học đã đăng nhập: tùy chọn lấy từ hồ sơ (`GET /me`). Khách: chỉ trong bộ nhớ, KHÔNG ghi `LocalStore`
/// hay nơi nào khác (E9) — tải lại trang thì về mặc định.
class EffectsController extends Notifier<EffectsSettings> {
  final StreamController<AnswerEffectEvent> _events =
      StreamController<AnswerEffectEvent>.broadcast(sync: true);
  final StreamController<List<CelebrationEntry>> _celebrations =
      StreamController<List<CelebrationEntry>>.broadcast(sync: true);
  int _lastId = 0;

  /// Các cue được xếp nối đuôi để `stopAll` → `play` của cue sau luôn chạy SAU cue trước (FR-005).
  Future<void> _soundTail = Future<void>.value();

  @override
  EffectsSettings build() {
    ref.onDispose(_events.close);
    ref.onDispose(_celebrations.close);
    ref.listen<bool>(sessionProvider.select((s) => s.isSignedIn), (
      _,
      signedIn,
    ) {
      if (signedIn) {
        unawaited(_loadProfile());
      } else {
        state = const EffectsSettings();
      }
    });
    // Đã đăng nhập sẵn khi controller được tạo: tải hồ sơ sau khi `build` xong (không đặt state trong build).
    if (ref.read(sessionProvider).isSignedIn) {
      scheduleMicrotask(_loadProfile);
    }
    return const EffectsSettings();
  }

  EffectsSettings get settings => state;

  /// Sự kiện hiệu ứng trả lời; sự kiện mới thay sự kiện đang chạy, không xếp hàng (FR-005).
  Stream<AnswerEffectEvent> get answerEvents => _events.stream;

  /// Các lô thẻ chúc mừng cho `CelebrationHost`. Chỉ tồn tại trong bộ nhớ: không có người nghe thì lô bị bỏ,
  /// KHÔNG lưu để chúc mừng bù ở lần sau (spec 005, Q1).
  Stream<List<CelebrationEntry>> get celebrationBatches => _celebrations.stream;

  Future<void> _loadProfile() async {
    try {
      final me = await ref.read(accountRepositoryProvider).me();
      final profile = me.profile;
      if (profile == null) return;
      state = EffectsSettings(
        soundEnabled: profile.soundEnabled ?? true,
        visualEnabled: profile.visualEffectsEnabled ?? true,
      );
    } on Object {
      // Không tải được hồ sơ: giữ mặc định (cả hai bật); hiệu ứng không bao giờ làm hỏng luồng học.
    }
  }

  /// Bật/tắt âm thanh (US3). Người học đăng ký: cập nhật lạc quan rồi `PATCH /me`; thất bại thì hoàn lại giá trị
  /// cũ và ném lại lỗi để nơi gọi báo lỗi chung. Khách: chỉ đổi trong bộ nhớ, KHÔNG gọi mạng, KHÔNG ghi
  /// `LocalStore` (tải lại trang về mặc định, E9).
  Future<void> setSound(bool enabled) => _update(
    state.copyWith(soundEnabled: enabled),
    (repo) => repo.updateProfile(soundEnabled: enabled),
    () => state.soundEnabled,
    (settings, previous) => settings.copyWith(soundEnabled: previous),
  );

  /// Bật/tắt hiệu ứng hình ảnh; quy tắc giống [setSound].
  Future<void> setVisual(bool enabled) => _update(
    state.copyWith(visualEnabled: enabled),
    (repo) => repo.updateProfile(visualEffectsEnabled: enabled),
    () => state.visualEnabled,
    (settings, previous) => settings.copyWith(visualEnabled: previous),
  );

  Future<void> _update(
    EffectsSettings next,
    Future<Object?> Function(AccountRepository repository) save,
    bool Function() read,
    EffectsSettings Function(EffectsSettings current, bool previous) revert,
  ) async {
    final previous = read();
    state = next;
    if (!ref.read(sessionProvider).isSignedIn) return;
    try {
      await save(ref.read(accountRepositoryProvider));
    } on Object {
      state = revert(state, previous);
      rethrow;
    }
  }

  /// Gọi TRONG thao tác nộp đáp án để mở khóa âm thanh trên nền tảng có chính sách tự phát (FR-025).
  void prime() {
    if (!state.soundEnabled) return;
    unawaited(_guarded((player) => player.prime()));
  }

  /// Phản hồi một câu trả lời MỚI: phát cue (nếu bật âm thanh) và luôn phát sự kiện hình ảnh. Không bao giờ ném lỗi.
  void onAnswer({required bool correct, int? streakMilestone}) {
    if (state.soundEnabled) {
      _play(
        streakMilestone != null
            ? SoundCue.streak
            : (correct ? SoundCue.correct : SoundCue.incorrect),
      );
    }
    if (_events.isClosed) return;
    _events.add(
      AnswerEffectEvent(
        id: ++_lastId,
        correct: correct,
        streakMilestone: streakMilestone,
      ),
    );
  }

  /// Chúc mừng sau một lần hoàn thành phiên MỚI: ngày hoàn thành (nếu có) trước, rồi từng thành tựu theo thứ
  /// tự server trả — gộp vào MỘT màn (FR-014). Client không tự tính mốc nào. Không bao giờ ném lỗi.
  void onCelebrations(Celebrations celebrations) {
    final entries = <CelebrationEntry>[
      if (celebrations.dayCompleted) const CelebrationEntry.day(),
      for (final a in celebrations.achievements)
        CelebrationEntry.achievement(a),
    ];
    if (entries.isEmpty || _celebrations.isClosed) return;
    _celebrations.add(entries);
  }

  /// Báo một thẻ chúc mừng vừa hiện: phát đúng một cue của thẻ đó (nếu bật âm thanh).
  void onCelebrationShown(CelebrationEntry entry) {
    if (!state.soundEnabled) return;
    _play(entry.isDay ? SoundCue.dayComplete : SoundCue.achievement);
  }

  void _play(SoundCue cue) {
    _soundTail = _soundTail.then(
      (_) => _guarded((player) async {
        await player.stopAll();
        await player.play(cue);
      }),
    );
  }

  /// Chạy [action] với trình phát; mọi lỗi (chưa cấu hình, bị chặn, tệp hỏng…) bị nuốt êm (FR-024).
  Future<void> _guarded(
    Future<void> Function(SoundPlayer player) action,
  ) async {
    try {
      await action(ref.read(soundPlayerProvider));
    } on Object {
      // Âm thanh chỉ là phần thưởng thêm: lỗi không được hiện cho người học.
    }
  }
}

final effectsControllerProvider =
    NotifierProvider<EffectsController, EffectsSettings>(EffectsController.new);
