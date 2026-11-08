# japanese_api.api.ClassroomApi

## Load the API package
```dart
import 'package:japanese_api/api.dart';
```

All URIs are relative to */api/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**getInvitation**](ClassroomApi.md#getinvitation) | **GET** /invitations/{token} | Xem trước lời mời (kèm danh sách dữ liệu chia sẻ khi mời học viên)
[**getMyClass**](ClassroomApi.md#getmyclass) | **GET** /me/class | Lớp của tôi (lộ trình lớp, bài giao, tiến độ trong lớp, dữ liệu chia sẻ)
[**joinClassByCode**](ClassroomApi.md#joinclassbycode) | **POST** /me/class/join | Nhập mã tham gia lớp (hai bước không trạng thái - xem trước rồi xác nhận)
[**leaveMyClass**](ClassroomApi.md#leavemyclass) | **POST** /me/class/leave | Chuyển sang lộ trình cá nhân (rời lớp bất cứ lúc nào)
[**respondInvitation**](ClassroomApi.md#respondinvitation) | **POST** /invitations/{token}/respond | Trả lời lời mời (học viên - hai lựa chọn ngang nhau; giáo viên/chủ tổ chức - chấp nhận/từ chối)


# **getInvitation**
> InvitationPreview getInvitation(token)

Xem trước lời mời (kèm danh sách dữ liệu chia sẻ khi mời học viên)

Người gọi PHẢI có email trùng email lời mời. Token sai/hết hạn/đã dùng/email không khớp → 404 chung (không lộ lời mời).

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getClassroomApi();
final String token = token_example; // String | GET: token trong email. DELETE: id (uuid) của lời mời cần thu hồi (cùng vị trí đường dẫn).

try {
    final response = api.getInvitation(token);
    print(response);
} on DioException catch (e) {
    print('Exception when calling ClassroomApi->getInvitation: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **token** | **String**| GET: token trong email. DELETE: id (uuid) của lời mời cần thu hồi (cùng vị trí đường dẫn). | 

### Return type

[**InvitationPreview**](InvitationPreview.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getMyClass**
> MyClass getMyClass()

Lớp của tôi (lộ trình lớp, bài giao, tiến độ trong lớp, dữ liệu chia sẻ)

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getClassroomApi();

try {
    final response = api.getMyClass();
    print(response);
} on DioException catch (e) {
    print('Exception when calling ClassroomApi->getMyClass: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**MyClass**](MyClass.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **joinClassByCode**
> JoinByCodeResult joinClassByCode(joinByCode)

Nhập mã tham gia lớp (hai bước không trạng thái - xem trước rồi xác nhận)

Không `decision` → 200 xem trước `{class, disclosure}`. `decision=join_class` + `confirmed:true` → tham gia. `decision=stay_personal` → 204, không đổi gì. Sai mã/đã tắt/hết hạn/lớp lưu trữ/lớp chưa lộ trình → cùng một 404 chung; sai liên tiếp → 429 (khóa theo tài khoản).

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getClassroomApi();
final JoinByCode joinByCode = ; // JoinByCode | 

try {
    final response = api.joinClassByCode(joinByCode);
    print(response);
} on DioException catch (e) {
    print('Exception when calling ClassroomApi->joinClassByCode: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **joinByCode** | [**JoinByCode**](JoinByCode.md)|  | 

### Return type

[**JoinByCodeResult**](JoinByCodeResult.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **leaveMyClass**
> leaveMyClass(leaveMyClassRequest)

Chuyển sang lộ trình cá nhân (rời lớp bất cứ lúc nào)

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getClassroomApi();
final LeaveMyClassRequest leaveMyClassRequest = ; // LeaveMyClassRequest | 

try {
    api.leaveMyClass(leaveMyClassRequest);
} on DioException catch (e) {
    print('Exception when calling ClassroomApi->leaveMyClass: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **leaveMyClassRequest** | [**LeaveMyClassRequest**](LeaveMyClassRequest.md)|  | 

### Return type

void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **respondInvitation**
> InvitationRespondResult respondInvitation(token, invitationRespond)

Trả lời lời mời (học viên - hai lựa chọn ngang nhau; giáo viên/chủ tổ chức - chấp nhận/từ chối)

Học viên `join_class` PHẢI kèm `confirmed:true`; `stay_personal` đóng lời mời, không tốn seat, không đổi hồ sơ. Mất seat khi chấp nhận: 409 `SEAT_UNAVAILABLE`/422 `SEAT_REASSIGN_LIMIT`, lời mời giữ `pending`.

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getClassroomApi();
final String token = token_example; // String | 
final InvitationRespond invitationRespond = ; // InvitationRespond | 

try {
    final response = api.respondInvitation(token, invitationRespond);
    print(response);
} on DioException catch (e) {
    print('Exception when calling ClassroomApi->respondInvitation: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **token** | **String**|  | 
 **invitationRespond** | [**InvitationRespond**](InvitationRespond.md)|  | 

### Return type

[**InvitationRespondResult**](InvitationRespondResult.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

