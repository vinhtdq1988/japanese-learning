import 'package:dio/dio.dart';
import 'package:japanese_api/japanese_api.dart';

import 'api/api_error.dart';

/// Kết quả xem trước lớp qua mã tham gia (bước 1 của nhập mã, không đổi gì ở máy chủ).
class ClassPreview {
  const ClassPreview({required this.classBrief, required this.disclosure});

  final ClassBrief classBrief;
  final SharedDataDisclosure disclosure;
}

/// Phía học viên của lớp học (spec 004, US2, FR-012, FR-016, FR-037): xem trước lời mời/mã, hai lựa chọn ngang
/// nhau (vào lớp hoặc ở lại lộ trình cá nhân), "Lớp của tôi" và chuyển sang lộ trình cá nhân (rời lớp). Chỉ
/// `join_class` kèm `confirmed: true` mới tạo thành viên lớp và tính seat; chọn cá nhân không đổi gì.
class ClassroomRepository {
  ClassroomRepository(this._api, this._dio);

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

  // --- Lời mời vào lớp ---

  /// Học viên chọn vào lớp (đã đọc thông báo dữ liệu chia sẻ và xác nhận).
  Future<InvitationRespondResult> joinViaInvitation(String token) => _respond(
    token,
    <String, Object?>{'decision': 'join_class', 'confirmed': true},
  );

  /// Học viên chọn ở lại lộ trình cá nhân: lời mời đóng, không tốn seat, hồ sơ không đổi.
  Future<void> stayPersonalViaInvitation(String token) async {
    await _respond(token, <String, Object?>{'decision': 'stay_personal'});
  }

  Future<InvitationRespondResult> _respond(
    String token,
    Map<String, Object?> body,
  ) => _call(() async {
    final response = await _dio.post<Object?>(
      '/invitations/${Uri.encodeComponent(token)}/respond',
      data: body,
    );
    return InvitationRespondResult.fromJson(_json(response.data));
  });

  // --- Nhập mã (hai bước không trạng thái) ---

  /// Bước 1: xem trước lớp + dữ liệu chia sẻ. Sai mã/tắt/hết hạn → 404 chung; sai liên tiếp → 429.
  Future<ClassPreview> previewCode(String code) => _call(() async {
    final response = await _dio.post<Object?>(
      '/me/class/join',
      data: <String, Object?>{'code': code},
    );
    final result = JoinByCodeResult.fromJson(_json(response.data));
    return ClassPreview(
      classBrief: result.class_!,
      disclosure: result.disclosure!,
    );
  });

  /// Bước 2a: vào lớp (mã được kiểm lại ở máy chủ).
  Future<JoinByCodeResult> joinWithCode(String code) => _call(() async {
    final response = await _dio.post<Object?>(
      '/me/class/join',
      data: <String, Object?>{
        'code': code,
        'decision': 'join_class',
        'confirmed': true,
      },
    );
    return JoinByCodeResult.fromJson(_json(response.data));
  });

  /// Bước 2b: ở lại lộ trình cá nhân (204, không đổi gì).
  Future<void> stayPersonalWithCode(String code) => _call(() async {
    await _dio.post<Object?>(
      '/me/class/join',
      data: <String, Object?>{'code': code, 'decision': 'stay_personal'},
    );
  });

  // --- Lớp của tôi ---

  Future<MyClass> myClass() =>
      _call(() async => (await _api.getClassroomApi().getMyClass()).data!);

  /// Chuyển sang lộ trình cá nhân (rời lớp); lịch sử học giữ nguyên, tổ chức mất quyền xem ngay.
  Future<void> leave() => _call(() async {
    await _dio.post<Object?>(
      '/me/class/leave',
      data: <String, Object?>{'confirm': true},
    );
  });
}
