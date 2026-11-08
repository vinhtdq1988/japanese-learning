import 'dart:io';
import 'dart:math' as math;
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';

// Kiểm thử tài sản âm thanh (spec 005, contracts/client-effects.md §1 "Tài sản âm thanh", FR-023):
// định dạng WAV, thời lượng, mức RMS đồng đều, đỉnh, fade và dung lượng. Chạy từ thư mục `client/`.

class Wav {
  Wav(this.sampleRate, this.channels, this.bitsPerSample, this.samples);

  final int sampleRate;
  final int channels;
  final int bitsPerSample;

  /// Mẫu chuẩn hóa về [-1, 1].
  final Float64List samples;

  double get seconds => samples.length / sampleRate;

  double get rms {
    var sum = 0.0;
    for (final s in samples) {
      sum += s * s;
    }
    return math.sqrt(sum / samples.length);
  }

  double get peak {
    var p = 0.0;
    for (final s in samples) {
      p = math.max(p, s.abs());
    }
    return p;
  }
}

double dbfs(double amplitude) => 20 * math.log(amplitude) / math.ln10;

Wav parseWav(Uint8List bytes) {
  final data = ByteData.sublistView(bytes);
  String tag(int offset) =>
      String.fromCharCodes(bytes.sublist(offset, offset + 4));
  expect(tag(0), 'RIFF');
  expect(tag(8), 'WAVE');
  expect(tag(12), 'fmt ');
  expect(data.getUint16(20, Endian.little), 1, reason: 'định dạng PCM');
  final channels = data.getUint16(22, Endian.little);
  final sampleRate = data.getUint32(24, Endian.little);
  final bits = data.getUint16(34, Endian.little);
  expect(tag(36), 'data');
  final dataBytes = data.getUint32(40, Endian.little);
  expect(44 + dataBytes, bytes.length, reason: 'kích thước khối data khớp tệp');
  final count = dataBytes ~/ 2;
  final samples = Float64List(count);
  for (var i = 0; i < count; i++) {
    samples[i] = data.getInt16(44 + i * 2, Endian.little) / 32768;
  }
  return Wav(sampleRate, channels, bits, samples);
}

void main() {
  // Tệp → thời lượng tối đa (giây) theo bảng hợp đồng.
  const maxSeconds = <String, double>{
    'correct.wav': 0.6,
    'incorrect.wav': 0.4,
    'streak.wav': 0.7,
    'achievement.wav': 1.2,
    'day_complete.wav': 1.2,
  };

  final wavs = <String, Wav>{};
  var totalBytes = 0;

  setUpAll(() {
    for (final name in maxSeconds.keys) {
      final file = File('assets/sounds/$name');
      expect(file.existsSync(), isTrue, reason: 'thiếu tệp $name');
      final bytes = file.readAsBytesSync();
      totalBytes += bytes.length;
      wavs[name] = parseWav(bytes);
    }
  });

  test('có đúng 5 tệp âm thanh trong assets/sounds', () {
    final names =
        Directory('assets/sounds')
            .listSync()
            .whereType<File>()
            .map((f) => f.uri.pathSegments.last)
            .where((n) => n.endsWith('.wav'))
            .toList()
          ..sort();
    expect(names, maxSeconds.keys.toList()..sort());
  });

  test('mọi tệp là WAV PCM 16-bit mono 22.050 Hz', () {
    for (final entry in wavs.entries) {
      expect(entry.value.sampleRate, 22050, reason: entry.key);
      expect(entry.value.channels, 1, reason: entry.key);
      expect(entry.value.bitsPerSample, 16, reason: entry.key);
    }
  });

  test('thời lượng không vượt ngưỡng từng cue', () {
    for (final entry in maxSeconds.entries) {
      final wav = wavs[entry.key]!;
      expect(wav.seconds, lessThanOrEqualTo(entry.value), reason: entry.key);
      expect(wav.seconds, greaterThan(0.1), reason: entry.key);
    }
  });

  test('RMS giữa các tệp chênh nhau không quá 1,5 dB (âm lượng đồng đều)', () {
    final levels = wavs.map((k, v) => MapEntry(k, dbfs(v.rms)));
    final spread =
        levels.values.reduce(math.max) - levels.values.reduce(math.min);
    expect(spread, lessThanOrEqualTo(1.5), reason: '$levels');
    // Mức tuyệt đối quanh −20 dBFS (±1,5 dB).
    for (final entry in levels.entries) {
      expect(entry.value, closeTo(-20, 1.5), reason: entry.key);
    }
  });

  test('đỉnh không vượt −3 dBFS', () {
    for (final entry in wavs.entries) {
      expect(dbfs(entry.value.peak), lessThanOrEqualTo(-3), reason: entry.key);
    }
  });

  test('mẫu đầu và cuối gần 0 (có fade-in/out, không tiếng "tách")', () {
    for (final entry in wavs.entries) {
      final s = entry.value.samples;
      expect(s.first.abs(), lessThan(0.005), reason: '${entry.key} đầu');
      expect(s.last.abs(), lessThan(0.005), reason: '${entry.key} cuối');
    }
  });

  test('tổng dung lượng không quá 200 KB', () {
    expect(totalBytes, lessThanOrEqualTo(200 * 1024));
  });

  test('pubspec.yaml khai báo assets/sounds/', () {
    final pubspec = File('pubspec.yaml').readAsStringSync();
    expect(pubspec, contains('assets/sounds/'));
  });
}
