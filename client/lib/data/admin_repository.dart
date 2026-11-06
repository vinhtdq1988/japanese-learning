import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/admin_models.dart';
import '../domain/admin_unit_draft.dart';
import 'api/api_error.dart';
import 'session_controller.dart';

/// Truy cập `/admin/*` (T108, FR-030 → FR-032). Gọi `dio` trực tiếp với JSON thay vì mô hình sinh ra: thân
/// `AdminUnitWrite` lồng mục/bài tập có `payload` tự do theo loại bài tập nên cần dựng từ bản nháp soạn
/// thảo ([UnitDraft]) và cũng để phân trang nhật ký bằng header `X-Next-Cursor` (không thuộc thân phản hồi).
/// Bảo vệ thực sự ở server (vai trò admin); client chỉ ẩn UI.
class AdminRepository {
  AdminRepository(this._dio);

  final Dio _dio;

  Future<T> _call<T>(Future<T> Function() call) async {
    try {
      return await call();
    } on DioException catch (e) {
      throw ApiError.fromDio(e);
    }
  }

  List<Map<String, Object?>> _list(Object? data) =>
      (data! as List).map((e) => Map<String, Object?>.from(e as Map)).toList();

  Map<String, Object?> _map(Object? data) =>
      Map<String, Object?>.from(data! as Map);

  // --- Mảng nội dung ---

  Future<List<AdminTopic>> topics({String? skill}) => _call(() async {
    final response = await _dio.get<Object?>(
      '/admin/topics',
      queryParameters: <String, Object?>{if (skill != null) 'skill': skill},
    );
    return _list(response.data).map(AdminTopic.fromJson).toList();
  });

  // --- Đơn vị học ---

  Future<List<AdminUnitSummary>> units({
    String? status,
    String? level,
    String? kind,
  }) => _call(() async {
    final response = await _dio.get<Object?>(
      '/admin/units',
      queryParameters: <String, Object?>{
        if (status != null) 'status': status,
        if (level != null) 'level': level,
        if (kind != null) 'kind': kind,
      },
    );
    return _list(response.data).map(AdminUnitSummary.fromJson).toList();
  });

  Future<UnitDraft> unit(String id) => _call(() async {
    final response = await _dio.get<Object?>('/admin/units/$id');
    return UnitDraft.fromJson(_map(response.data));
  });

  /// Tạo (khi [UnitDraft.isNew]) hoặc sửa; trả bản mới nhất từ server.
  Future<UnitDraft> saveUnit(UnitDraft draft) => _call(() async {
    final body = draft.toJson();
    final response = draft.isNew
        ? await _dio.post<Object?>('/admin/units', data: body)
        : await _dio.put<Object?>('/admin/units/${draft.id}', data: body);
    return UnitDraft.fromJson(_map(response.data));
  });

  /// Đổi trạng thái hiển thị và/hoặc cờ dùng thử (FR-037).
  Future<AdminUnitSummary> setUnitStatus(
    String id, {
    String? status,
    bool? isTrial,
  }) => _call(() async {
    final response = await _dio.put<Object?>(
      '/admin/units/$id/status',
      data: <String, Object?>{
        if (status != null) 'status': status,
        if (isTrial != null) 'isTrial': isTrial,
      },
    );
    return AdminUnitSummary.fromJson(_map(response.data));
  });

  // --- Câu hỏi kiểm tra trình độ ---

  Future<List<AdminPlacementQuestion>> placementQuestions() => _call(() async {
    final response = await _dio.get<Object?>('/admin/placement-questions');
    return _list(response.data).map(AdminPlacementQuestion.fromJson).toList();
  });

  Future<AdminPlacementQuestion> savePlacementQuestion(
    PlacementQuestionInput input, {
    String? id,
  }) => _call(() async {
    final response = id == null
        ? await _dio.post<Object?>(
            '/admin/placement-questions',
            data: input.toJson(),
          )
        : await _dio.put<Object?>(
            '/admin/placement-questions/$id',
            data: input.toJson(),
          );
    return AdminPlacementQuestion.fromJson(_map(response.data));
  });

  /// Kích hoạt nguyên tử cả bộ; thứ tự mảng = vị trí câu.
  Future<void> activatePlacementSet(List<String> questionIds) =>
      _call(() async {
        await _dio.put<Object?>(
          '/admin/placement-questions/active-set',
          data: <String, Object?>{'questionIds': questionIds},
        );
      });

  // --- Người dùng và nhật ký ---

  Future<CursorPage<AdminUserRow>> users({String? q, String? cursor}) =>
      _call(() async {
        final response = await _dio.get<Object?>(
          '/admin/users',
          queryParameters: <String, Object?>{
            if (q != null && q.trim().isNotEmpty) 'q': q.trim(),
            if (cursor != null) 'cursor': cursor,
          },
        );
        final body = _map(response.data);
        return CursorPage<AdminUserRow>(
          items: _list(body['items']).map(AdminUserRow.fromJson).toList(),
          nextCursor: body['nextCursor'] as String?,
        );
      });

  Future<void> setUserStatus(String userId, {required bool disabled}) =>
      _call(() async {
        await _dio.put<Object?>(
          '/admin/users/$userId/status',
          data: <String, Object?>{'status': disabled ? 'disabled' : 'active'},
        );
      });

  Future<CursorPage<AdminLogEntry>> actionLogs({String? cursor}) =>
      _call(() async {
        final response = await _dio.get<Object?>(
          '/admin/action-logs',
          queryParameters: <String, Object?>{
            if (cursor != null) 'cursor': cursor,
          },
        );
        return CursorPage<AdminLogEntry>(
          items: _list(response.data).map(AdminLogEntry.fromJson).toList(),
          nextCursor: response.headers.value('x-next-cursor'),
        );
      });
}

final adminRepositoryProvider = Provider<AdminRepository>((ref) {
  return AdminRepository(ref.watch(dioProvider));
});

/// Mảng nội dung để chọn khi soạn (đổi hiếm nên giữ trong phiên làm việc, không tự hủy).
final adminTopicsProvider = FutureProvider<List<AdminTopic>>((ref) {
  return ref.watch(adminRepositoryProvider).topics();
});
