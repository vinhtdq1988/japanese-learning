import 'package:test/test.dart';
import 'package:japanese_api/japanese_api.dart';

/// tests for PathApi
void main() {
  final instance = JapaneseApi().getPathApi();

  group(PathApi, () {
    // Lộ trình hiện tại
    //
    //Future<PathDetail> getPath() async
    test('test getPath', () async {
      // TODO
    });

    // Tạm dừng lộ trình
    //
    //Future pausePath() async
    test('test pausePath', () async {
      // TODO
    });

    // Xây dựng lại lộ trình (FR-016) – giữ lịch sử và lịch ôn
    //
    // Có `usePlacementResultId` (làm lại placement rồi chọn xây dựng lại, US1.6) → lộ trình mới lưu `reason='placement_retake'`; bỏ trống → `reason='rebuild_request'`.
    //
    //Future<PathSummary> rebuildPath({ RebuildPathRequest rebuildPathRequest }) async
    test('test rebuildPath', () async {
      // TODO
    });

    // Tiếp tục lộ trình
    //
    //Future resumePath() async
    test('test resumePath', () async {
      // TODO
    });

    // Đánh dấu / bỏ đánh dấu đã thành thạo
    //
    //Future<MasterResult> setUnitMastered(String unitId, SetUnitMasteredRequest setUnitMasteredRequest) async
    test('test setUnitMastered', () async {
      // TODO
    });
  });
}
