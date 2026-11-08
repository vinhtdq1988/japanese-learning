import 'dart:async';
import 'dart:js_interop';
import 'dart:typed_data';

import 'package:flutter/services.dart' show rootBundle;
import 'package:web/web.dart' as web;

import '../platform.dart';

/// `SoundPlayer` trên Web Audio (spec 005, FR-024/FR-025).
///
/// Tệp WAV lấy từ `assets/sounds/` qua `rootBundle` (cùng origin nên không đổi CSP) và được giải mã MỘT lần,
/// giữ `AudioBuffer` cho các lần phát sau. `prime()` tạo/`resume()` ngữ cảnh âm thanh ngay trong thao tác
/// người học để vượt chính sách tự phát của trình duyệt (Safari chặt nhất). MỌI lỗi (bị chặn, giải mã hỏng,
/// thiết bị tắt tiếng) được nuốt êm, không hiện cho người học.
class WebSoundPlayer implements SoundPlayer {
  static const Map<SoundCue, String> _assets = <SoundCue, String>{
    SoundCue.correct: 'assets/sounds/correct.wav',
    SoundCue.incorrect: 'assets/sounds/incorrect.wav',
    SoundCue.streak: 'assets/sounds/streak.wav',
    SoundCue.achievement: 'assets/sounds/achievement.wav',
    SoundCue.dayComplete: 'assets/sounds/day_complete.wav',
  };

  web.AudioContext? _context;
  web.AudioBufferSourceNode? _current;
  final Map<SoundCue, Future<web.AudioBuffer?>> _buffers =
      <SoundCue, Future<web.AudioBuffer?>>{};

  /// Tăng mỗi lần `play`/`stopAll`; lần `play` đến sau thay thế lần trước ngay cả khi lần trước còn đang
  /// chờ giải mã (FR-005: trả lời dồn dập thì cue sau thay cue trước).
  int _token = 0;

  web.AudioContext _ensureContext() => _context ??= web.AudioContext();

  Future<void> _resume(web.AudioContext context) async {
    if (context.state == 'suspended') await context.resume().toDart;
  }

  @override
  Future<void> prime() async {
    try {
      final context = _ensureContext();
      await _resume(context);
      // Giải mã trước các cue để lần phát đầu tiên không bị trễ.
      for (final cue in SoundCue.values) {
        unawaited(_bufferFor(context, cue));
      }
    } catch (_) {
      // Nuốt êm: âm thanh chỉ là phần thưởng thêm (FR-024).
    }
  }

  Future<web.AudioBuffer?> _bufferFor(web.AudioContext context, SoundCue cue) {
    return _buffers.putIfAbsent(cue, () async {
      try {
        final data = await rootBundle.load(_assets[cue]!);
        // Sao chép đúng đoạn dữ liệu: `decodeAudioData` lấy quyền sở hữu (làm rỗng) bộ đệm truyền vào.
        final bytes = Uint8List.fromList(
          data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes),
        );
        return await context.decodeAudioData(bytes.buffer.toJS).toDart;
      } catch (_) {
        _buffers.remove(cue); // Cho phép thử lại ở lần sau.
        return null;
      }
    });
  }

  @override
  Future<void> play(SoundCue cue) async {
    final token = ++_token;
    try {
      _stopCurrent();
      final context = _ensureContext();
      await _resume(context);
      final buffer = await _bufferFor(context, cue);
      // Đã có lần phát/dừng mới hơn trong lúc chờ: bỏ lần này.
      if (buffer == null || token != _token) return;
      final source = context.createBufferSource()
        ..buffer = buffer
        ..connect(context.destination);
      source.start();
      _current = source;
    } catch (_) {
      // Nuốt êm (FR-024).
    }
  }

  @override
  Future<void> stopAll() async {
    _token++;
    _stopCurrent();
  }

  void _stopCurrent() {
    final source = _current;
    _current = null;
    if (source == null) return;
    try {
      source.stop();
    } catch (_) {}
  }
}
