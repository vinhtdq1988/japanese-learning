# japanese_api.api.AccountApi

## Load the API package
```dart
import 'package:japanese_api/api.dart';
```

All URIs are relative to */api/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**changePassword**](AccountApi.md#changepassword) | **PUT** /me/password | Đổi mật khẩu
[**deleteAccount**](AccountApi.md#deleteaccount) | **POST** /account/delete | Xóa tài khoản – vô hiệu hóa ngay, xóa vĩnh viễn sau 30 ngày (FR-003)
[**getMe**](AccountApi.md#getme) | **GET** /me | Thông tin tài khoản + hồ sơ học tập
[**restoreAccount**](AccountApi.md#restoreaccount) | **POST** /account/restore | Khôi phục tài khoản trong 30 ngày chờ xóa
[**updateMe**](AccountApi.md#updateme) | **PATCH** /me | Sửa hồ sơ (FR-002)


# **changePassword**
> changePassword(changePasswordRequest)

Đổi mật khẩu

Yêu cầu `currentPassword` đúng. Đổi thành công thu hồi mọi `auth_sessions` khác của người dùng, chỉ giữ phiên hiện tại.

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getAccountApi();
final ChangePasswordRequest changePasswordRequest = ; // ChangePasswordRequest | 

try {
    api.changePassword(changePasswordRequest);
} on DioException catch (e) {
    print('Exception when calling AccountApi->changePassword: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **changePasswordRequest** | [**ChangePasswordRequest**](ChangePasswordRequest.md)|  | 

### Return type

void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **deleteAccount**
> DeleteAccount200Response deleteAccount(deleteAccountRequest)

Xóa tài khoản – vô hiệu hóa ngay, xóa vĩnh viễn sau 30 ngày (FR-003)

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getAccountApi();
final DeleteAccountRequest deleteAccountRequest = ; // DeleteAccountRequest | 

try {
    final response = api.deleteAccount(deleteAccountRequest);
    print(response);
} on DioException catch (e) {
    print('Exception when calling AccountApi->deleteAccount: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **deleteAccountRequest** | [**DeleteAccountRequest**](DeleteAccountRequest.md)|  | 

### Return type

[**DeleteAccount200Response**](DeleteAccount200Response.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getMe**
> Me getMe()

Thông tin tài khoản + hồ sơ học tập

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getAccountApi();

try {
    final response = api.getMe();
    print(response);
} on DioException catch (e) {
    print('Exception when calling AccountApi->getMe: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**Me**](Me.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **restoreAccount**
> Me restoreAccount()

Khôi phục tài khoản trong 30 ngày chờ xóa

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getAccountApi();

try {
    final response = api.restoreAccount();
    print(response);
} on DioException catch (e) {
    print('Exception when calling AccountApi->restoreAccount: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**Me**](Me.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **updateMe**
> Me updateMe(profileUpdate)

Sửa hồ sơ (FR-002)

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getAccountApi();
final ProfileUpdate profileUpdate = ; // ProfileUpdate | 

try {
    final response = api.updateMe(profileUpdate);
    print(response);
} on DioException catch (e) {
    print('Exception when calling AccountApi->updateMe: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **profileUpdate** | [**ProfileUpdate**](ProfileUpdate.md)|  | 

### Return type

[**Me**](Me.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

