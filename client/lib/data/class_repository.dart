import 'package:dio/dio.dart';
import 'package:intl/intl.dart';
import 'package:japanese_api/japanese_api.dart';

import 'api/api_error.dart';

/// Truy cập lớp học cho giáo viên và chủ tổ chức (spec 004, US2): danh sách/chi tiết lớp, danh sách học viên
/// theo trạng thái, mời bằng email, nhập CSV, mã tham gia, gỡ học viên và lưu trữ lớp. Quyền thật do server
/// kiểm (404 chung cho lớp ngoài phạm vi); client chỉ ẩn/hiện UI. Đọc dùng API client sinh từ OpenAPI; ghi có
/// thân JSON dùng `dio` trực tiếp để chỉ gửi đúng các trường đã đặt.
class ClassRepository {
  ClassRepository(this._api, this._dio);

  final JapaneseApi _api;
  final Dio _dio;

  Future<T> _call<T>(Future<T> Function() call) async {
    try {
      return await call();
    } on DioException catch (e) {
      throw ApiError.fromDio(e);
    }
  }

  Map<String, dynamic> _json(Object? data) =>
      Map<String, dynamic>.from(data! as Map<dynamic, dynamic>);

  // --- Lớp ---

  Future<List<ClassRow>> classes() =>
      _call(() async => (await _api.getClassesApi().listClasses()).data!);

  Future<ClassDetail> classDetail(String id) =>
      _call(() async => (await _api.getClassesApi().getClass(id: id)).data!);

  Future<ClassDetail> createClass({
    required String name,
    String? description,
  }) => _call(() async {
    final response = await _dio.post<Object?>(
      '/classes',
      data: <String, Object?>{
        'name': name,
        if ((description ?? '').isNotEmpty) 'description': description,
      },
    );
    return ClassDetail.fromJson(_json(response.data));
  });

  /// Lưu trữ lớp (một chiều); trả số học viên bị đóng thành viên.
  Future<int> archiveClass(String id) => _call(() async {
    final response = await _dio.post<Object?>(
      '/classes/$id/archive',
      data: <String, Object?>{'confirm': true},
    );
    return (_json(response.data)['learnersMoved'] as num?)?.toInt() ?? 0;
  });

  // --- Học viên ---

  Future<List<RosterRow>> roster(String id) => _call(
    () async => (await _api.getClassesApi().getClassRoster(id: id)).data!,
  );

  Future<void> removeMember(String classId, String userId) => _call(
    () async =>
        _api.getClassesApi().removeClassMember(id: classId, userId: userId),
  );

  /// Thu hồi lời mời (id của lời mời, không phải token) — trả lại chỗ giữ.
  Future<void> revokeInvitation(String invitationId) =>
      _call(() async => _api.getOrgApi().revokeInvitation(token: invitationId));

  /// Mời nhiều email một lần (≤ 50); trả kết quả từng email.
  Future<ImportResults> invite(String id, List<String> emails) =>
      _call(() async {
        final response = await _dio.post<Object?>(
          '/classes/$id/invitations',
          data: <String, Object?>{
            'invitees': <Map<String, Object?>>[
              for (final email in emails) <String, Object?>{'email': email},
            ],
          },
        );
        return ImportResults.fromJson(_json(response.data));
      });

  /// Nhập CSV: gửi nguyên văn nội dung tệp dạng `text/csv` (không phân tích ở client).
  Future<ImportResults> importCsv(String id, String csv) => _call(() async {
    final response = await _dio.post<Object?>(
      '/classes/$id/invitations/import',
      data: csv,
      options: Options(contentType: 'text/csv; charset=utf-8'),
    );
    return ImportResults.fromJson(_json(response.data));
  });

  // --- Mã tham gia ---

  Future<JoinCode> joinCode(String id) =>
      _call(() async => (await _api.getClassesApi().getJoinCode(id: id)).data!);

  /// Bật/tắt mã; `expiresAt` chỉ gửi khi [setExpiry] (để xóa hạn thì truyền `null` và `setExpiry: true`).
  Future<JoinCode> setJoinCode(
    String id, {
    required bool enabled,
    DateTime? expiresAt,
    bool setExpiry = false,
  }) => _call(() async {
    final response = await _dio.put<Object?>(
      '/classes/$id/join-code',
      data: <String, Object?>{
        'enabled': enabled,
        if (setExpiry) 'expiresAt': expiresAt?.toUtc().toIso8601String(),
      },
    );
    return JoinCode.fromJson(_json(response.data));
  });

  Future<JoinCode> rotateJoinCode(String id) => _call(
    () async => (await _api.getClassesApi().rotateJoinCode(id: id)).data!,
  );
}

/// Mẫu lộ trình lớp cần ghi (`PUT /classes/{id}/path`). Ngày gửi dạng `yyyy-MM-dd` đúng hợp đồng
/// (`format: date`); mô hình sinh ra tuần tự hóa `DateTime` thành date-time nên gửi JSON thủ công.
class ClassPathDraft {
  const ClassPathDraft({
    required this.startLevel,
    required this.targetLevel,
    required this.skills,
    required this.startsOn,
    required this.endsOn,
    required this.dailyMinutes,
  });

  final String startLevel;
  final String targetLevel;
  final List<String> skills;
  final DateTime startsOn;
  final DateTime endsOn;
  final int dailyMinutes;

  static final DateFormat _date = DateFormat('yyyy-MM-dd');

  Map<String, Object?> toJson() => <String, Object?>{
    'startLevel': startLevel,
    'targetLevel': targetLevel,
    'skills': skills,
    'startsOn': _date.format(startsOn),
    'endsOn': _date.format(endsOn),
    'dailyMinutes': dailyMinutes,
  };
}

/// Bảng điều khiển lớp (spec 004, US4): số liệu từng học viên kể từ lúc vào lớp và chi tiết một học viên.
/// Server trả đúng danh sách trắng FR-035; client chỉ hiển thị. Học viên đã rời lớp ⇒ 404 chung.
extension ClassReportsRepository on ClassRepository {
  Future<ClassDashboard> dashboard(String id) => _call(
    () async => (await _api.getClassesApi().getClassDashboard(id: id)).data!,
  );

  Future<ClassLearnerDetail> learnerDetail(String classId, String userId) =>
      _call(
        () async => (await _api.getClassesApi().getClassLearnerDetail(
          id: classId,
          userId: userId,
        )).data!,
      );
}

/// Tệp CSV tải từ máy chủ: byte nguyên vẹn (giữ BOM UTF-8 để Excel hiển thị đúng) và tên tệp gợi ý.
class CsvDownload {
  const CsvDownload({required this.filename, required this.bytes});

  final String filename;
  final List<int> bytes;
}

/// Cảnh báo, chủ đề yếu và xuất CSV của lớp (spec 004, US7, FR-031 → FR-033). Báo cáo CSV tải dạng byte để
/// không làm mất BOM; tên tệp lấy từ `Content-Disposition: attachment; filename*=UTF-8''…`.
extension ClassInsightsRepository on ClassRepository {
  Future<List<ClassWeakTopic>> weakTopics(String id) => _call(
    () async => (await _api.getClassesApi().getClassWeakTopics(id: id)).data!,
  );

  /// Đổi ngưỡng vắng mặt (1–14 ngày); ngoài khoảng ⇒ máy chủ trả 422.
  Future<ClassDetail> setAbsenceThreshold(String id, int days) =>
      _call(() async {
        final response = await _dio.patch<Object?>(
          '/classes/$id',
          data: <String, Object?>{'absenceThresholdDays': days},
        );
        return ClassDetail.fromJson(_json(response.data));
      });

  Future<CsvDownload> exportClassCsv(String id) =>
      _download('/classes/$id/export.csv', 'class-$id.csv');

  Future<CsvDownload> exportLearnerCsv(String classId, String userId) =>
      _download(
        '/classes/$classId/members/$userId/export.csv',
        'learner-$userId.csv',
      );

  Future<CsvDownload> _download(String path, String fallbackName) =>
      _call(() async {
        final response = await _dio.get<List<int>>(
          path,
          options: Options(responseType: ResponseType.bytes),
        );
        return CsvDownload(
          filename:
              _filenameOf(response.headers.value('content-disposition')) ??
              fallbackName,
          bytes: response.data ?? const <int>[],
        );
      });

  /// Tách `filename*=UTF-8''<tên mã hóa phần trăm>` từ header `Content-Disposition`.
  static String? _filenameOf(String? header) {
    if (header == null) return null;
    final match = RegExp(r"filename\*=UTF-8''([^;]+)").firstMatch(header);
    if (match == null) return null;
    try {
      return Uri.decodeComponent(match.group(1)!);
    } on ArgumentError {
      return null;
    }
  }
}

/// Kiểm tra trình độ cho cả lớp và mời chuyển lớp (spec 004, US8, FR-034, FR-014). Kết quả kiểm tra KHÔNG tự đổi
/// lộ trình lớp; mời chuyển lớp KHÔNG chuyển ngay — học viên phải đồng ý lại (Hiến pháp III).
extension ClassPlacementRepository on ClassRepository {
  /// Kết quả của yêu cầu đang mở; `null` khi lớp chưa có yêu cầu mở (404 chung).
  Future<ClassPlacementResults?> placementResults(String id) async {
    try {
      return await _call(
        () async =>
            (await _api.getClassesApi().getClassPlacementRequest(id: id)).data!,
      );
    } on ApiError catch (e) {
      if (e.statusCode == 404) return null;
      rethrow;
    }
  }

  Future<ClassPlacementRequest> createPlacementRequest(String id) =>
      _call(() async {
        final response = await _dio.post<Object?>(
          '/classes/$id/placement-requests',
        );
        return ClassPlacementRequest.fromJson(_json(response.data));
      });

  Future<void> closePlacementRequest(String id) => _call(
    () async =>
        _dio.post<Object?>('/classes/$id/placement-requests/current/close'),
  );

  /// Mời học viên chuyển sang [toClassId] (202): học viên vẫn ở lớp cũ cho tới khi họ chấp nhận.
  Future<void> inviteMove(String classId, String userId, String toClassId) =>
      _call(
        () async => _dio.post<Object?>(
          '/classes/$classId/members/$userId/move',
          data: <String, Object?>{'toClassId': toClassId},
        ),
      );
}

/// Lộ trình lớp (spec 004, US3): đọc `ClassPath?` (null khi chưa đặt) và lưu mẫu.
extension ClassPathRepository on ClassRepository {
  Future<ClassPath?> classPath(String id) => _call(
    () async => (await _api.getClassesApi().getClassPath(id: id)).data!.path,
  );

  Future<ClassPath> saveClassPath(String id, ClassPathDraft draft) =>
      _call(() async {
        final response = await _dio.put<Object?>(
          '/classes/$id/path',
          data: draft.toJson(),
        );
        return ClassPath.fromJson(_json(response.data));
      });
}

/// Một đơn vị trong danh sách giáo viên chọn (`PUT /classes/{id}/path/units`); ngày mở `null` = mở ngay.
class PathUnitChoice {
  const PathUnitChoice({required this.unitId, this.opensOn});

  final String unitId;
  final DateTime? opensOn;

  static final DateFormat _date = DateFormat('yyyy-MM-dd');

  Map<String, Object?> toJson() => <String, Object?>{
    'unitId': unitId,
    if (opensOn != null) 'opensOn': _date.format(opensOn!),
  };
}

/// Tinh chỉnh lộ trình lớp (spec 004, US5): chọn bài/thứ tự/ngày mở, bài giao, ghi đè riêng một học viên, miễn
/// bài và tạm dừng. Ngày gửi dạng `yyyy-MM-dd` (`format: date`); thân JSON gửi thủ công qua `dio`. Thay đổi có
/// hiệu lực từ kế hoạch được sinh kế tiếp.
extension ClassAdjustRepository on ClassRepository {
  static final DateFormat _date = DateFormat('yyyy-MM-dd');

  /// Thay toàn bộ danh sách đơn vị; danh sách rỗng quay lại chế độ mẫu.
  Future<ClassPath> putPathUnits(String id, List<PathUnitChoice> units) =>
      _call(() async {
        final response = await _dio.put<Object?>(
          '/classes/$id/path/units',
          data: <String, Object?>{
            'units': <Map<String, Object?>>[for (final u in units) u.toJson()],
          },
        );
        return ClassPath.fromJson(_json(response.data));
      });

  /// Giao 1–20 đơn vị với một hạn; trả kèm `warnings` khi khối lượng vượt quỹ (không chặn).
  Future<CreateClassAssignments201Response> createAssignments(
    String id,
    List<String> unitIds,
    DateTime dueOn,
  ) => _call(() async {
    final response = await _dio.post<Object?>(
      '/classes/$id/assignments',
      data: <String, Object?>{'unitIds': unitIds, 'dueOn': _date.format(dueOn)},
    );
    return CreateClassAssignments201Response.fromJson(_json(response.data));
  });

  Future<void> cancelAssignment(String id, String assignmentId) => _call(
    () async => _dio.delete<Object?>('/classes/$id/assignments/$assignmentId'),
  );

  /// Ghi đè riêng: `dailyMinutes` `null` = theo lớp; `shiftDays` ∈ [−60, 60].
  Future<LearnerOverride> putOverride(
    String id,
    String userId, {
    int? dailyMinutes,
    required int shiftDays,
  }) => _call(() async {
    final response = await _dio.put<Object?>(
      '/classes/$id/members/$userId/override',
      data: <String, Object?>{
        'dailyMinutes': dailyMinutes,
        'shiftDays': shiftDays,
      },
    );
    return LearnerOverride.fromJson(_json(response.data));
  });

  /// Miễn (`exempt: true`) hoặc bỏ miễn một đơn vị cho học viên.
  Future<void> setExemption(
    String id,
    String userId,
    String unitId, {
    required bool exempt,
  }) => _call(() async {
    final path = '/classes/$id/members/$userId/exemptions/$unitId';
    if (exempt) {
      await _dio.put<Object?>(path);
    } else {
      await _dio.delete<Object?>(path);
    }
  });

  Future<List<ClassPause>> pauses(String id) => _call(
    () async => (await _api.getClassesApi().listClassPauses(id: id)).data!,
  );

  /// Tạm dừng cả lớp (`userId` null) hoặc một học viên; `endedOn` null = khoảng mở.
  Future<ClassPause> createPause(
    String id, {
    String? userId,
    required DateTime startedOn,
    DateTime? endedOn,
  }) => _call(() async {
    final response = await _dio.post<Object?>(
      '/classes/$id/pauses',
      data: <String, Object?>{
        'userId': ?userId,
        'startedOn': _date.format(startedOn),
        if (endedOn != null) 'endedOn': _date.format(endedOn),
      },
    );
    return ClassPause.fromJson(_json(response.data));
  });

  /// Kết thúc một khoảng tạm dừng; `endedOn` bỏ trống ⇒ hôm nay (máy chủ quyết định).
  Future<ClassPause> endPause(String id, String pauseId, {DateTime? endedOn}) =>
      _call(() async {
        final response = await _dio.post<Object?>(
          '/classes/$id/pauses/$pauseId/end',
          data: endedOn == null
              ? null
              : <String, Object?>{'endedOn': _date.format(endedOn)},
        );
        return ClassPause.fromJson(_json(response.data));
      });
}
