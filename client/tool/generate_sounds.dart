// Sinh 5 tệp âm thanh phản hồi cho `client/assets/sounds/` (spec 005, contracts/client-effects.md §1).
//
// Chạy từ thư mục `client/`:  dart run tool/generate_sounds.dart
//
// Thuần Dart, không phụ thuộc gói ngoài, XÁC ĐỊNH (cùng đầu vào → cùng tệp từng byte): không dùng mẫu âm thanh
// bên thứ ba nên không có rủi ro giấy phép. Mọi tệp là WAV PCM 16-bit mono 22,05 kHz, chuẩn hóa về cùng mức
// RMS (FR-023: âm lượng đồng đều), đỉnh ≤ −3 dBFS, có fade-in/out ngắn để không bị tiếng "tách".
import 'dart:io';
import 'dart:math' as math;
import 'dart:typed_data';

const int sampleRate = 22050;

/// Mức RMS đích của mọi tệp, tính trên toàn tệp (≈ −20 dBFS).
const double targetRms = 0.1;

/// Giới hạn đỉnh (−3 dBFS). Tệp vượt giới hạn là lỗi thiết kế cue, không tự cắt xén.
final double peakLimit = math.pow(10, -3 / 20).toDouble();

/// Fade-in/out toàn tệp (giây) để mẫu đầu và cuối bằng 0.
const double fadeInSeconds = 0.008;
const double fadeOutSeconds = 0.02;

/// Một nốt: tần số, thời điểm bắt đầu, độ dài, hằng số tắt dần và các họa âm (biên độ tương đối theo bậc 1, 2, 3…).
class Note {
  const Note(
    this.frequency,
    this.start,
    this.length, {
    this.decay = 0.15,
    this.partials = const <double>[1, 0.3, 0.1],
    this.gain = 1,
  });

  final double frequency;
  final double start;
  final double length;
  final double decay;
  final List<double> partials;
  final double gain;
}

/// Một cue: các nốt và độ dài tệp (giây). `maxSeconds` là ngưỡng thời lượng tài liệu hợp đồng.
class Cue {
  const Cue(this.file, this.seconds, this.maxSeconds, this.notes);

  final String file;
  final double seconds;
  final double maxSeconds;
  final List<Note> notes;
}

// Tần số theo cung Đô trưởng (Hz).
const double c4 = 261.63;
const double e4 = 329.63;
const double g4 = 392.0;
const double c5 = 523.25;
const double d5 = 587.33;
const double e5 = 659.25;
const double g5 = 783.99;
const double a5 = 880.0;
const double c6 = 1046.5;
const double e6 = 1318.51;

const List<Cue> cues = <Cue>[
  // Đúng: hai nốt đi lên, sáng, vui tai.
  Cue('correct.wav', 0.55, 0.6, <Note>[
    Note(e5, 0.0, 0.26, decay: 0.12),
    Note(a5, 0.13, 0.42, decay: 0.16),
  ]),
  // Sai: một nốt trầm mềm, tắt nhanh, trung tính (không trừng phạt, không đi xuống kiểu "thua cuộc").
  Cue('incorrect.wav', 0.34, 0.4, <Note>[
    Note(c4, 0.0, 0.34, decay: 0.07, partials: <double>[1, 0.12]),
  ]),
  // Chuỗi đúng: ba nốt đi lên nhanh.
  Cue('streak.wav', 0.62, 0.7, <Note>[
    Note(c5, 0.0, 0.2, decay: 0.08),
    Note(e5, 0.13, 0.2, decay: 0.08),
    Note(g5, 0.26, 0.36, decay: 0.13),
  ]),
  // Thành tựu: hợp âm rải đi lên, nổi bật hơn cue trả lời.
  Cue('achievement.wav', 1.15, 1.2, <Note>[
    Note(c5, 0.0, 1.15, decay: 0.32),
    Note(e5, 0.1, 1.05, decay: 0.3),
    Note(g5, 0.2, 0.95, decay: 0.28),
    Note(c6, 0.3, 0.85, decay: 0.26),
    Note(e6, 0.42, 0.7, decay: 0.2, gain: 0.7),
  ]),
  // Hoàn thành ngày: giai điệu ngắn khép lại, ấm (ít họa âm cao, kết ở chủ âm).
  Cue('day_complete.wav', 1.15, 1.2, <Note>[
    Note(g4, 0.0, 0.3, decay: 0.12, partials: <double>[1, 0.2]),
    Note(e5, 0.2, 0.3, decay: 0.12, partials: <double>[1, 0.2]),
    Note(d5, 0.4, 0.3, decay: 0.12, partials: <double>[1, 0.2]),
    Note(c5, 0.6, 0.55, decay: 0.3, partials: <double>[1, 0.25, 0.05]),
    Note(c4, 0.6, 0.55, decay: 0.3, partials: <double>[1, 0.2], gain: 0.8),
  ]),
];

/// Tổng hợp các nốt thành chuỗi mẫu thực (chưa chuẩn hóa).
Float64List synthesize(Cue cue) {
  final total = (cue.seconds * sampleRate).round();
  final out = Float64List(total);
  for (final note in cue.notes) {
    final first = (note.start * sampleRate).round();
    final count = (note.length * sampleRate).round();
    const attack = 0.006;
    for (var i = 0; i < count && first + i < total; i++) {
      final t = i / sampleRate;
      // Bao biên độ: lên nhanh (cosine) rồi tắt theo hàm mũ.
      final rise = t < attack
          ? 0.5 - 0.5 * math.cos(math.pi * t / attack)
          : 1.0;
      final envelope = rise * math.exp(-t / note.decay);
      var wave = 0.0;
      for (var p = 0; p < note.partials.length; p++) {
        wave +=
            note.partials[p] *
            math.sin(2 * math.pi * note.frequency * (p + 1) * t);
      }
      out[first + i] += wave * envelope * note.gain;
    }
  }
  // Fade toàn tệp để mẫu đầu và cuối bằng 0.
  final fadeIn = (fadeInSeconds * sampleRate).round();
  final fadeOut = (fadeOutSeconds * sampleRate).round();
  for (var i = 0; i < fadeIn && i < total; i++) {
    out[i] *= 0.5 - 0.5 * math.cos(math.pi * i / fadeIn);
  }
  for (var i = 0; i < fadeOut && i < total; i++) {
    out[total - 1 - i] *= 0.5 - 0.5 * math.cos(math.pi * i / fadeOut);
  }
  return out;
}

double rms(Float64List samples) {
  var sum = 0.0;
  for (final s in samples) {
    sum += s * s;
  }
  return math.sqrt(sum / samples.length);
}

double peak(Float64List samples) {
  var p = 0.0;
  for (final s in samples) {
    p = math.max(p, s.abs());
  }
  return p;
}

/// Đóng gói thành WAV PCM 16-bit mono.
Uint8List encodeWav(Float64List samples) {
  final dataBytes = samples.length * 2;
  final bytes = ByteData(44 + dataBytes);
  void tag(int offset, String text) {
    for (var i = 0; i < text.length; i++) {
      bytes.setUint8(offset + i, text.codeUnitAt(i));
    }
  }

  tag(0, 'RIFF');
  bytes.setUint32(4, 36 + dataBytes, Endian.little);
  tag(8, 'WAVE');
  tag(12, 'fmt ');
  bytes.setUint32(16, 16, Endian.little); // kích thước khối fmt
  bytes.setUint16(20, 1, Endian.little); // PCM
  bytes.setUint16(22, 1, Endian.little); // mono
  bytes.setUint32(24, sampleRate, Endian.little);
  bytes.setUint32(28, sampleRate * 2, Endian.little); // byte/giây
  bytes.setUint16(32, 2, Endian.little); // block align
  bytes.setUint16(34, 16, Endian.little); // bit/mẫu
  tag(36, 'data');
  bytes.setUint32(40, dataBytes, Endian.little);
  for (var i = 0; i < samples.length; i++) {
    final value = (samples[i] * 32767).round().clamp(-32768, 32767);
    bytes.setInt16(44 + i * 2, value, Endian.little);
  }
  return bytes.buffer.asUint8List();
}

void main() {
  // `Platform.script` = client/tool/generate_sounds.dart → thư mục đích client/assets/sounds.
  final clientDir = File.fromUri(Platform.script).parent.parent;
  final outDir = Directory(
    '${clientDir.path}${Platform.pathSeparator}assets${Platform.pathSeparator}sounds',
  );
  outDir.createSync(recursive: true);

  var failed = false;
  var totalBytes = 0;
  for (final cue in cues) {
    final samples = synthesize(cue);
    final gain = targetRms / rms(samples);
    for (var i = 0; i < samples.length; i++) {
      samples[i] *= gain;
    }
    final p = peak(samples);
    final wav = encodeWav(samples);
    File(
      '${outDir.path}${Platform.pathSeparator}${cue.file}',
    ).writeAsBytesSync(wav);
    totalBytes += wav.length;

    final peakDb = 20 * math.log(p) / math.ln10;
    final rmsDb = 20 * math.log(rms(samples)) / math.ln10;
    stdout.writeln(
      '${cue.file.padRight(18)} ${cue.seconds.toStringAsFixed(2)} s '
      '(≤ ${cue.maxSeconds}) RMS ${rmsDb.toStringAsFixed(1)} dBFS, đỉnh ${peakDb.toStringAsFixed(1)} dBFS, '
      '${wav.length} byte',
    );
    if (cue.seconds > cue.maxSeconds) {
      stderr.writeln('  LỖI: vượt thời lượng tối đa ${cue.maxSeconds} s');
      failed = true;
    }
    if (p > peakLimit) {
      stderr.writeln(
        '  LỖI: đỉnh vượt −3 dBFS, hãy giảm họa âm/xếp chồng nốt của cue này',
      );
      failed = true;
    }
  }
  stdout.writeln('Tổng dung lượng: $totalBytes byte');
  if (totalBytes > 200 * 1024) {
    stderr.writeln('LỖI: tổng dung lượng vượt 200 KB');
    failed = true;
  }
  if (failed) exit(1);
}
