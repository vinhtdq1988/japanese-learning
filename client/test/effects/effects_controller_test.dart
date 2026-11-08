import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:japanese_learning_client/platform/memory_platform.dart';
import 'package:japanese_learning_client/platform/platform_providers.dart';
import 'package:japanese_learning_client/platform/sound_player.dart';
import 'package:japanese_learning_client/presentation/effects/effects_controller.dart';

import '../support/fake_backend.dart';

// EffectsController (spec 005, US1): điểm vào duy nhất cho phản hồi tức thì — chọn cue âm thanh, phát sự kiện
// hiệu ứng hình ảnh, thay thế khi trả lời dồn dập, nuốt lỗi âm thanh và lấy tùy chọn từ đúng nguồn.

Map<String, Object?> _me({bool sound = true, bool visual = true}) =>
    <String, Object?>{
      'id': 'user-1',
      'email': 'a@example.com',
      'role': 'learner',
      'status': 'active',
      'learningSource': 'personal',
      'profile': <String, Object?>{
        'displayName': 'Học viên',
        'language': 'vi',
        'timezone': 'Asia/Ho_Chi_Minh',
        'paused': false,
        'onboardingState': 'completed',
        'soundEnabled': sound,
        'visualEffectsEnabled': visual,
      },
    };

ProviderContainer _container(TestEnv env) {
  final container = ProviderContainer(overrides: env.overrides);
  addTearDown(container.dispose);
  return container;
}

void main() {
  test('đúng phát cue correct, sai phát cue incorrect', () async {
    final env = TestEnv();
    final controller = _container(env).read(effectsControllerProvider.notifier);

    controller.onAnswer(correct: true);
    controller.onAnswer(correct: false);
    await pumpEventQueue();

    expect(env.soundPlayer.played, <SoundCue>[
      SoundCue.correct,
      SoundCue.incorrect,
    ]);
  });

  test('chạm ngưỡng chuỗi đúng thì phát cue streak thay cho correct', () async {
    final env = TestEnv();
    final controller = _container(env).read(effectsControllerProvider.notifier);

    controller.onAnswer(correct: true, streakMilestone: 3);
    await pumpEventQueue();

    expect(env.soundPlayer.played, <SoundCue>[SoundCue.streak]);
  });

  test('mặc định cả âm thanh và hiệu ứng hình ảnh đều bật', () async {
    final container = _container(TestEnv());
    final settings = container.read(effectsControllerProvider);
    await pumpEventQueue(); // để phiên đăng nhập khôi phục xong trước khi hủy container
    expect(settings.soundEnabled, isTrue);
    expect(settings.visualEnabled, isTrue);
  });

  test(
    'tắt âm thanh: không phát cue nhưng vẫn phát sự kiện hiệu ứng',
    () async {
      final env = TestEnv(tokens: signedInTokens());
      env.backend.reply('GET /me', 200, _me(sound: false));
      final container = _container(env);
      final controller = container.read(effectsControllerProvider.notifier);
      final events = <AnswerEffectEvent>[];
      controller.answerEvents.listen(events.add);
      await pumpEventQueue();
      expect(container.read(effectsControllerProvider).soundEnabled, isFalse);

      controller.onAnswer(correct: true);
      await pumpEventQueue();

      expect(env.soundPlayer.played, isEmpty);
      expect(events, hasLength(1));
      expect(events.single.correct, isTrue);
    },
  );

  test('người học lấy tùy chọn từ hồ sơ GET /me', () async {
    final env = TestEnv(tokens: signedInTokens());
    env.backend.reply('GET /me', 200, _me(visual: false));
    final container = _container(env);
    container.read(effectsControllerProvider);
    await pumpEventQueue();

    final settings = container.read(effectsControllerProvider);
    expect(settings.soundEnabled, isTrue);
    expect(settings.visualEnabled, isFalse);
    expect(env.backend.sent('GET /me'), hasLength(1));
  });

  test('lỗi tải hồ sơ: giữ mặc định (cả hai bật), không ném lỗi', () async {
    final env = TestEnv(
      tokens: signedInTokens(),
    ); // không có route GET /me → 404
    final container = _container(env);
    container.read(effectsControllerProvider);
    await pumpEventQueue();

    final settings = container.read(effectsControllerProvider);
    expect(settings.soundEnabled, isTrue);
    expect(settings.visualEnabled, isTrue);
  });

  test('khách: không gọi mạng và không đụng LocalStore/TokenStore', () async {
    final env = TestEnv();
    final controller = _container(env).read(effectsControllerProvider.notifier);

    controller.onAnswer(correct: true);
    controller.onAnswer(correct: false);
    await pumpEventQueue();

    expect(env.backend.requests, isEmpty);
    expect(env.localStore.snapshot, isEmpty);
  });

  test(
    'trả lời dồn dập: stopAll trước mỗi play, sự kiện mới có id tăng dần',
    () async {
      final env = TestEnv();
      final controller = _container(
        env,
      ).read(effectsControllerProvider.notifier);
      final events = <AnswerEffectEvent>[];
      controller.answerEvents.listen(events.add);

      controller.onAnswer(correct: true);
      controller.onAnswer(correct: false);
      controller.onAnswer(correct: true);
      await pumpEventQueue();

      expect(env.soundPlayer.stopAllCount, 3);
      expect(env.soundPlayer.played, <SoundCue>[
        SoundCue.correct,
        SoundCue.incorrect,
        SoundCue.correct,
      ]);
      expect(events.map((e) => e.id).toList(), <int>[1, 2, 3]);
    },
  );

  test(
    'lỗi của SoundPlayer bị nuốt, không làm onAnswer ném lỗi (FR-024)',
    () async {
      final env = TestEnv();
      env.soundPlayer.throwOnPlay = true;
      final controller = _container(
        env,
      ).read(effectsControllerProvider.notifier);
      final events = <AnswerEffectEvent>[];
      controller.answerEvents.listen(events.add);

      expect(() => controller.onAnswer(correct: true), returnsNormally);
      await pumpEventQueue();

      expect(events, hasLength(1)); // hiệu ứng hình ảnh vẫn phát
      // Cue sau vẫn chạy được khi trình phát hồi phục.
      env.soundPlayer.throwOnPlay = false;
      controller.onAnswer(correct: false);
      await pumpEventQueue();
      expect(env.soundPlayer.played, <SoundCue>[SoundCue.incorrect]);
    },
  );

  test('chưa cấu hình SoundPlayer cũng không ném lỗi', () async {
    // Chỉ cấu hình kho token (phiên đăng nhập cần); SoundPlayer cố ý bỏ trống.
    final container = ProviderContainer(
      overrides: <Override>[
        tokenStoreProvider.overrideWithValue(MemoryTokenStore()),
      ],
    );
    addTearDown(container.dispose);
    expect(
      () => container
          .read(effectsControllerProvider.notifier)
          .onAnswer(correct: true),
      returnsNormally,
    );
    await pumpEventQueue();
  });

  test('prime chỉ mở khóa âm thanh khi âm thanh bật', () async {
    final env = TestEnv();
    final controller = _container(env).read(effectsControllerProvider.notifier);
    controller.prime();
    await pumpEventQueue();
    expect(env.soundPlayer.primeCount, 1);
  });
}
