import 'package:test/test.dart';
import 'package:japanese_api/japanese_api.dart';

/// tests for ProgressApi
void main() {
  final instance = JapaneseApi().getProgressApi();

  group(ProgressApi, () {
    // Tóm tắt tiến độ (FR-026 → FR-029)
    //
    //Future<ProgressSummary> getProgress() async
    test('test getProgress', () async {
      // TODO
    });
  });
}
