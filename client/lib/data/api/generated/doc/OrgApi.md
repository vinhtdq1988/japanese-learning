# japanese_api.api.OrgApi

## Load the API package
```dart
import 'package:japanese_api/api.dart';
```

All URIs are relative to */api/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**getOrg**](OrgApi.md#getorg) | **GET** /org | Tổng quan tổ chức - seat, giấy phép, giáo viên, lớp, lời mời chờ
[**grantSeat**](OrgApi.md#grantseat) | **POST** /org/seats/{userId}/grant | Cấp lại seat cho giáo viên đang mất seat
[**inviteTeacher**](OrgApi.md#inviteteacher) | **POST** /org/teachers/invitations | Mời giáo viên (giữ chỗ một seat)
[**removeTeacher**](OrgApi.md#removeteacher) | **DELETE** /org/teachers/{userId} | Gỡ vai trò giáo viên - mất quyền ngay, giải phóng seat
[**revokeInvitation**](OrgApi.md#revokeinvitation) | **DELETE** /invitations/{token} | Thu hồi lời mời (OWN - mọi lời mời của tổ chức; TCH - lời mời học viên của lớp mình)
[**revokeOrgSeat**](OrgApi.md#revokeorgseat) | **POST** /org/seats/{userId}/revoke | Thu hồi seat của giáo viên/học viên trong tổ chức mình


# **getOrg**
> OrgOverview getOrg()

Tổng quan tổ chức - seat, giấy phép, giáo viên, lớp, lời mời chờ

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getOrgApi();

try {
    final response = api.getOrg();
    print(response);
} on DioException catch (e) {
    print('Exception when calling OrgApi->getOrg: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**OrgOverview**](OrgOverview.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **grantSeat**
> grantSeat(userId)

Cấp lại seat cho giáo viên đang mất seat

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getOrgApi();
final String userId = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 

try {
    api.grantSeat(userId);
} on DioException catch (e) {
    print('Exception when calling OrgApi->grantSeat: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **userId** | **String**|  | 

### Return type

void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **inviteTeacher**
> InvitationRow inviteTeacher(requestPasswordResetRequest)

Mời giáo viên (giữ chỗ một seat)

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getOrgApi();
final RequestPasswordResetRequest requestPasswordResetRequest = ; // RequestPasswordResetRequest | 

try {
    final response = api.inviteTeacher(requestPasswordResetRequest);
    print(response);
} on DioException catch (e) {
    print('Exception when calling OrgApi->inviteTeacher: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **requestPasswordResetRequest** | [**RequestPasswordResetRequest**](RequestPasswordResetRequest.md)|  | 

### Return type

[**InvitationRow**](InvitationRow.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **removeTeacher**
> removeTeacher(userId)

Gỡ vai trò giáo viên - mất quyền ngay, giải phóng seat

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getOrgApi();
final String userId = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 

try {
    api.removeTeacher(userId);
} on DioException catch (e) {
    print('Exception when calling OrgApi->removeTeacher: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **userId** | **String**|  | 

### Return type

void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **revokeInvitation**
> revokeInvitation(token)

Thu hồi lời mời (OWN - mọi lời mời của tổ chức; TCH - lời mời học viên của lớp mình)

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getOrgApi();
final String token = token_example; // String | GET: token trong email. DELETE: id (uuid) của lời mời cần thu hồi (cùng vị trí đường dẫn).

try {
    api.revokeInvitation(token);
} on DioException catch (e) {
    print('Exception when calling OrgApi->revokeInvitation: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **token** | **String**| GET: token trong email. DELETE: id (uuid) của lời mời cần thu hồi (cùng vị trí đường dẫn). | 

### Return type

void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **revokeOrgSeat**
> revokeOrgSeat(userId)

Thu hồi seat của giáo viên/học viên trong tổ chức mình

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getOrgApi();
final String userId = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 

try {
    api.revokeOrgSeat(userId);
} on DioException catch (e) {
    print('Exception when calling OrgApi->revokeOrgSeat: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **userId** | **String**|  | 

### Return type

void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

