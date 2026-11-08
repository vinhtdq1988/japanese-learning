import 'package:flutter_test/flutter_test.dart';
import 'package:japanese_learning_client/presentation/effects/effect_specs.dart';

void main() {
  // Ngân sách an toàn FR-023: không chớp quá 3 lần/giây, không đổi độ sáng toàn màn hình.
  test('mỗi hiệu ứng có tối đa một đỉnh và đỉnh nối tiếp không quá 3 lần/giây', () {
    for (final spec in answerEffectSpecs) {
      expect(spec.peaks, lessThanOrEqualTo(1));
      expect(spec.peaks, greaterThanOrEqualTo(1));
      // Hiệu ứng mới thay hiệu ứng cũ (FR-005) nên các đỉnh nối tiếp cách nhau tối thiểu một cửa sổ chớp
      // khi thời lượng ≥ cửa sổ; ngay cả trả lời dồn dập, tần suất đỉnh ≤ 1 trên mỗi 333 ms ⇒ ≤ 3 lần/giây.
      final maxPerSecond =
          Duration.millisecondsPerSecond ~/ flashWindow.inMilliseconds;
      expect(maxPerSecond, lessThanOrEqualTo(3));
      expect(spec.duration, greaterThanOrEqualTo(flashWindow));
    }
  });

  test('không hiệu ứng nào đổi độ sáng toàn màn hình', () {
    for (final spec in answerEffectSpecs) {
      expect(spec.changesFullScreenBrightness, isFalse);
    }
  });

  test('thời lượng không vượt bảng thông số', () {
    expect(correctEffect.duration, const Duration(milliseconds: 600));
    expect(incorrectEffect.duration, const Duration(milliseconds: 400));
    expect(streakEffect.duration, const Duration(milliseconds: 700));
    expect(celebrationCardDuration, const Duration(milliseconds: 3500));
    expect(confettiDuration, lessThanOrEqualTo(const Duration(seconds: 3)));
    expect(confettiDuration, lessThan(celebrationCardDuration));
  });

  test('số hạt không vượt ngân sách', () {
    expect(maxConfettiParticles, lessThanOrEqualTo(40));
    expect(maxAnswerParticles, lessThanOrEqualTo(maxConfettiParticles));
  });

  test('thông báo tĩnh tự đóng không quá lâu', () {
    expect(staticNoticeDuration, lessThanOrEqualTo(celebrationCardDuration));
  });
}
