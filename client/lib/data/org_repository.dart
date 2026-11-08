import 'package:dio/dio.dart';
import 'package:intl/intl.dart';
import 'package:japanese_api/japanese_api.dart';

import 'api/api_error.dart';

/// Giấy phép cần ghi (tạo hoặc chỉnh). Ngày gửi dạng `yyyy-MM-dd` đúng hợp đồng (`format: date`); mô hình
/// sinh ra tuần tự hóa `DateTime` thành date-time ISO nên các thao tác ghi giấy phép gửi JSON thủ công.
class LicenseDraft {
  const LicenseDraft({
    this.seats,
    this.startsOn,
    this.endsOn,
    this.graceDays,
    this.maxReassignments,
  });

  final int? seats;
  final DateTime? startsOn;
  final DateTime? endsOn;
  final int? graceDays;
  final int? maxReassignments;

  static final DateFormat _date = DateFormat('yyyy-MM-dd');

  /// Chỉ các trường đã đặt mới được gửi.
  Map<String, Object?> toJson() => <String, Object?>{
    if (seats != null) 'seats': seats,
    if (startsOn != null) 'startsOn': _date.format(startsOn!),
    if (endsOn != null) 'endsOn': _date.format(endsOn!),
    if (graceDays != null) 'graceDays': graceDays,
    if (maxReassignments != null) 'maxReassignments': maxReassignments,
  };
}

/// Truy cập tổ chức, giấy phép, seat và lời mời giáo viên/chủ tổ chức (spec 004, US1): quản trị viên hệ thống
/// (`/admin/organizations*`), chủ tổ chức (`/org*`) và người nhận lời mời (`/invitations/*`). Quyền thật nằm
/// ở server (tra CSDL mỗi request); client chỉ ẩn/hiện UI. Đọc dùng API client sinh từ OpenAPI; ghi có thân
/// JSON dùng `dio` trực tiếp (xem [LicenseDraft]).
class OrgRepository {
  OrgRepository(this._api, this._dio);

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

  // --- Quản trị viên hệ thống ---

  Future<AdminOrganizationPage> adminOrganizations({
    String? query,
    int page = 1,
  }) => _call(
    () async => (await _api.getAdminApi().adminListOrganizations(
      q: (query ?? '').isEmpty ? null : query,
      page: page,
    )).data!,
  );

  Future<AdminOrganizationDetail> adminOrganization(String orgId) => _call(
    () async =>
        (await _api.getAdminApi().adminGetOrganization(orgId: orgId)).data!,
  );

  Future<AdminOrganizationDetail> createOrganization({
    required String name,
    required String ownerEmail,
    LicenseDraft? license,
  }) => _call(() async {
    final response = await _dio.post<Object?>(
      '/admin/organizations',
      data: <String, Object?>{
        'name': name,
        'ownerEmail': ownerEmail,
        if (license != null) 'license': license.toJson(),
      },
    );
    return AdminOrganizationDetail.fromJson(_json(response.data));
  });

  Future<AdminOrganizationDetail> setOrganizationStatus(
    String orgId, {
    required bool disabled,
  }) => _call(() async {
    final response = await _dio.patch<Object?>(
      '/admin/organizations/$orgId',
      data: <String, Object?>{'status': disabled ? 'disabled' : 'active'},
    );
    return AdminOrganizationDetail.fromJson(_json(response.data));
  });

  Future<InvitationRow> inviteOwner(String orgId, String email) =>
      _call(() async {
        final response = await _dio.post<Object?>(
          '/admin/organizations/$orgId/owners/invitations',
          data: <String, Object?>{'email': email},
        );
        return InvitationRow.fromJson(_json(response.data));
      });

  Future<OrgLicense> createLicense(String orgId, LicenseDraft license) =>
      _call(() async {
        final response = await _dio.post<Object?>(
          '/admin/organizations/$orgId/licenses',
          data: license.toJson(),
        );
        return OrgLicense.fromJson(_json(response.data));
      });

  Future<OrgLicense> updateLicense(
    String orgId,
    String licenseId,
    LicenseDraft patch,
  ) => _call(() async {
    final response = await _dio.patch<Object?>(
      '/admin/organizations/$orgId/licenses/$licenseId',
      data: patch.toJson(),
    );
    return OrgLicense.fromJson(_json(response.data));
  });

  Future<void> revokeLicense(String orgId, String licenseId) => _call(
    () async => _api.getAdminApi().adminRevokeLicense(
      orgId: orgId,
      licenseId: licenseId,
    ),
  );

  Future<void> adminRevokeSeat(String orgId, String userId) => _call(
    () async =>
        _api.getAdminApi().adminRevokeSeat(orgId: orgId, userId: userId),
  );

  // --- Chủ tổ chức ---

  Future<OrgOverview> overview() =>
      _call(() async => (await _api.getOrgApi().getOrg()).data!);

  Future<InvitationRow> inviteTeacher(String email) => _call(() async {
    final response = await _dio.post<Object?>(
      '/org/teachers/invitations',
      data: <String, Object?>{'email': email},
    );
    return InvitationRow.fromJson(_json(response.data));
  });

  Future<void> removeTeacher(String userId) =>
      _call(() async => _api.getOrgApi().removeTeacher(userId: userId));

  Future<void> grantSeat(String userId) =>
      _call(() async => _api.getOrgApi().grantSeat(userId: userId));

  Future<void> revokeSeat(String userId) =>
      _call(() async => _api.getOrgApi().revokeOrgSeat(userId: userId));

  /// Thu hồi lời mời theo id (uuid) của lời mời — cùng vị trí đường dẫn `/invitations/{token}`.
  Future<void> revokeInvitation(String invitationId) =>
      _call(() async => _api.getOrgApi().revokeInvitation(token: invitationId));

  // --- Người nhận lời mời ---

  Future<InvitationPreview> previewInvitation(String token) => _call(
    () async =>
        (await _api.getClassroomApi().getInvitation(token: token)).data!,
  );

  /// `decision`: `accept` hoặc `decline` cho lời mời chủ tổ chức/giáo viên.
  Future<InvitationRespondResult> respondInvitation(
    String token, {
    required bool accept,
  }) => _call(() async {
    final response = await _dio.post<Object?>(
      '/invitations/${Uri.encodeComponent(token)}/respond',
      data: <String, Object?>{'decision': accept ? 'accept' : 'decline'},
    );
    return InvitationRespondResult.fromJson(_json(response.data));
  });
}
