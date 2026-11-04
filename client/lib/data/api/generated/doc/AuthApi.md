# japanese_api.api.AuthApi

## Load the API package
```dart
import 'package:japanese_api/api.dart';
```

All URIs are relative to */api/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**confirmPasswordReset**](AuthApi.md#confirmpasswordreset) | **POST** /auth/password-reset/confirm | Đặt mật khẩu mới bằng token một lần
[**login**](AuthApi.md#login) | **POST** /auth/login | Đăng nhập
[**logout**](AuthApi.md#logout) | **POST** /auth/logout | Đăng xuất (thu hồi phiên hiện tại)
[**refreshToken**](AuthApi.md#refreshtoken) | **POST** /auth/refresh | Làm mới access token (xoay vòng refresh token)
[**register**](AuthApi.md#register) | **POST** /auth/register | Đăng ký (FR-001) – không yêu cầu xác minh email
[**requestPasswordReset**](AuthApi.md#requestpasswordreset) | **POST** /auth/password-reset/request | Yêu cầu liên kết đặt lại mật khẩu (FR-001)


# **confirmPasswordReset**
> confirmPasswordReset(confirmPasswordResetRequest)

Đặt mật khẩu mới bằng token một lần

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getAuthApi();
final ConfirmPasswordResetRequest confirmPasswordResetRequest = ; // ConfirmPasswordResetRequest | 

try {
    api.confirmPasswordReset(confirmPasswordResetRequest);
} on DioException catch (e) {
    print('Exception when calling AuthApi->confirmPasswordReset: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **confirmPasswordResetRequest** | [**ConfirmPasswordResetRequest**](ConfirmPasswordResetRequest.md)|  | 

### Return type

void (empty response body)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **login**
> Login200Response login(loginRequest)

Đăng nhập

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getAuthApi();
final LoginRequest loginRequest = ; // LoginRequest | 

try {
    final response = api.login(loginRequest);
    print(response);
} on DioException catch (e) {
    print('Exception when calling AuthApi->login: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **loginRequest** | [**LoginRequest**](LoginRequest.md)|  | 

### Return type

[**Login200Response**](Login200Response.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **logout**
> logout()

Đăng xuất (thu hồi phiên hiện tại)

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getAuthApi();

try {
    api.logout();
} on DioException catch (e) {
    print('Exception when calling AuthApi->logout: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **refreshToken**
> AuthTokens refreshToken(refreshTokenRequest)

Làm mới access token (xoay vòng refresh token)

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getAuthApi();
final RefreshTokenRequest refreshTokenRequest = ; // RefreshTokenRequest | 

try {
    final response = api.refreshToken(refreshTokenRequest);
    print(response);
} on DioException catch (e) {
    print('Exception when calling AuthApi->refreshToken: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **refreshTokenRequest** | [**RefreshTokenRequest**](RefreshTokenRequest.md)|  | 

### Return type

[**AuthTokens**](AuthTokens.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **register**
> AuthTokens register(registerRequest)

Đăng ký (FR-001) – không yêu cầu xác minh email

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getAuthApi();
final RegisterRequest registerRequest = ; // RegisterRequest | 

try {
    final response = api.register(registerRequest);
    print(response);
} on DioException catch (e) {
    print('Exception when calling AuthApi->register: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **registerRequest** | [**RegisterRequest**](RegisterRequest.md)|  | 

### Return type

[**AuthTokens**](AuthTokens.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **requestPasswordReset**
> requestPasswordReset(requestPasswordResetRequest)

Yêu cầu liên kết đặt lại mật khẩu (FR-001)

Luôn trả 202 dù email có tồn tại hay không (chống dò tài khoản).

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getAuthApi();
final RequestPasswordResetRequest requestPasswordResetRequest = ; // RequestPasswordResetRequest | 

try {
    api.requestPasswordReset(requestPasswordResetRequest);
} on DioException catch (e) {
    print('Exception when calling AuthApi->requestPasswordReset: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **requestPasswordResetRequest** | [**RequestPasswordResetRequest**](RequestPasswordResetRequest.md)|  | 

### Return type

void (empty response body)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

