# japanese_api.api.AdminApi

## Load the API package
```dart
import 'package:japanese_api/api.dart';
```

All URIs are relative to */api/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**adminCreatePlacementQuestion**](AdminApi.md#admincreateplacementquestion) | **POST** /admin/placement-questions | Tạo câu hỏi kiểm tra trình độ (luôn ở trạng thái chưa kích hoạt; đưa vào bộ hiện hành bằng &#x60;PUT /admin/placement-questions/active-set&#x60;)
[**adminCreateUnit**](AdminApi.md#admincreateunit) | **POST** /admin/units | Tạo đơn vị học (kèm mục nội dung và bài tập) – FR-030
[**adminGetUnit**](AdminApi.md#admingetunit) | **GET** /admin/units/{unitId} | Chi tiết đơn vị học (kèm mọi mục và bài tập, cả &#x60;inactive&#x60;)
[**adminListActionLogs**](AdminApi.md#adminlistactionlogs) | **GET** /admin/action-logs | Nhật ký hành động quản trị (FR-032), mới nhất trước
[**adminListPlacementQuestions**](AdminApi.md#adminlistplacementquestions) | **GET** /admin/placement-questions | Danh sách câu hỏi kiểm tra trình độ
[**adminListTopics**](AdminApi.md#adminlisttopics) | **GET** /admin/topics | Danh sách mảng nội dung (để chọn &#x60;topicId&#x60; khi soạn đơn vị học và câu hỏi kiểm tra trình độ)
[**adminListUnits**](AdminApi.md#adminlistunits) | **GET** /admin/units | Danh sách đơn vị học (lọc theo trạng thái, trình độ, loại); không kèm &#x60;items&#x60;/&#x60;exercises&#x60;
[**adminListUsers**](AdminApi.md#adminlistusers) | **GET** /admin/users | Tìm tài khoản người học (FR-031), mới nhất trước
[**adminSetActivePlacementSet**](AdminApi.md#adminsetactiveplacementset) | **PUT** /admin/placement-questions/active-set | Kích hoạt nguyên tử một bộ câu hỏi (thay thế bộ hiện hành) – PHẢI đúng 20 câu (8 N5, 6 N4, 6 N3) (FR-007, FR-030)
[**adminSetUnitStatus**](AdminApi.md#adminsetunitstatus) | **PUT** /admin/units/{unitId}/status | Kích hoạt / vô hiệu hóa; đánh dấu thuộc tập dùng thử (FR-037)
[**adminSetUserStatus**](AdminApi.md#adminsetuserstatus) | **PUT** /admin/users/{userId}/status | Vô hiệu hóa / kích hoạt lại tài khoản
[**adminUpdatePlacementQuestion**](AdminApi.md#adminupdateplacementquestion) | **PUT** /admin/placement-questions/{questionId} | Sửa câu hỏi kiểm tra trình độ (nội dung, lựa chọn, đáp án, position) – ghi nhật ký quản trị (FR-030, FR-032)
[**adminUpdateUnit**](AdminApi.md#adminupdateunit) | **PUT** /admin/units/{unitId} | Sửa đơn vị học (có hiệu lực với phiên mới; phiên đang học giữ nguyên ảnh chụp). Đơn vị đang &#x60;active&#x60; PHẢI vẫn đạt kiểm tra nội dung sau khi sửa.


# **adminCreatePlacementQuestion**
> AdminPlacementQuestion adminCreatePlacementQuestion(adminPlacementQuestion)

Tạo câu hỏi kiểm tra trình độ (luôn ở trạng thái chưa kích hoạt; đưa vào bộ hiện hành bằng `PUT /admin/placement-questions/active-set`)

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getAdminApi();
final AdminPlacementQuestion adminPlacementQuestion = ; // AdminPlacementQuestion | 

try {
    final response = api.adminCreatePlacementQuestion(adminPlacementQuestion);
    print(response);
} on DioException catch (e) {
    print('Exception when calling AdminApi->adminCreatePlacementQuestion: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **adminPlacementQuestion** | [**AdminPlacementQuestion**](AdminPlacementQuestion.md)|  | 

### Return type

[**AdminPlacementQuestion**](AdminPlacementQuestion.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminCreateUnit**
> AdminUnit adminCreateUnit(adminUnitWrite)

Tạo đơn vị học (kèm mục nội dung và bài tập) – FR-030

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getAdminApi();
final AdminUnitWrite adminUnitWrite = ; // AdminUnitWrite | 

try {
    final response = api.adminCreateUnit(adminUnitWrite);
    print(response);
} on DioException catch (e) {
    print('Exception when calling AdminApi->adminCreateUnit: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **adminUnitWrite** | [**AdminUnitWrite**](AdminUnitWrite.md)|  | 

### Return type

[**AdminUnit**](AdminUnit.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminGetUnit**
> AdminUnit adminGetUnit(unitId)

Chi tiết đơn vị học (kèm mọi mục và bài tập, cả `inactive`)

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getAdminApi();
final String unitId = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 

try {
    final response = api.adminGetUnit(unitId);
    print(response);
} on DioException catch (e) {
    print('Exception when calling AdminApi->adminGetUnit: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **unitId** | **String**|  | 

### Return type

[**AdminUnit**](AdminUnit.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminListActionLogs**
> List<AdminActionLog> adminListActionLogs(cursor)

Nhật ký hành động quản trị (FR-032), mới nhất trước

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getAdminApi();
final String cursor = cursor_example; // String | Giá trị header `X-Next-Cursor` của trang trước

try {
    final response = api.adminListActionLogs(cursor);
    print(response);
} on DioException catch (e) {
    print('Exception when calling AdminApi->adminListActionLogs: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **cursor** | **String**| Giá trị header `X-Next-Cursor` của trang trước | [optional] 

### Return type

[**List&lt;AdminActionLog&gt;**](AdminActionLog.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminListPlacementQuestions**
> List<AdminPlacementQuestion> adminListPlacementQuestions()

Danh sách câu hỏi kiểm tra trình độ

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getAdminApi();

try {
    final response = api.adminListPlacementQuestions();
    print(response);
} on DioException catch (e) {
    print('Exception when calling AdminApi->adminListPlacementQuestions: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**List&lt;AdminPlacementQuestion&gt;**](AdminPlacementQuestion.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminListTopics**
> List<AdminTopic> adminListTopics(skill)

Danh sách mảng nội dung (để chọn `topicId` khi soạn đơn vị học và câu hỏi kiểm tra trình độ)

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getAdminApi();
final Skill skill = ; // Skill | 

try {
    final response = api.adminListTopics(skill);
    print(response);
} on DioException catch (e) {
    print('Exception when calling AdminApi->adminListTopics: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **skill** | [**Skill**](.md)|  | [optional] 

### Return type

[**List&lt;AdminTopic&gt;**](AdminTopic.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminListUnits**
> List<AdminUnit> adminListUnits(status, level, kind)

Danh sách đơn vị học (lọc theo trạng thái, trình độ, loại); không kèm `items`/`exercises`

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getAdminApi();
final String status = status_example; // String | 
final String level = level_example; // String | 
final Skill kind = ; // Skill | 

try {
    final response = api.adminListUnits(status, level, kind);
    print(response);
} on DioException catch (e) {
    print('Exception when calling AdminApi->adminListUnits: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **status** | **String**|  | [optional] 
 **level** | **String**|  | [optional] 
 **kind** | [**Skill**](.md)|  | [optional] 

### Return type

[**List&lt;AdminUnit&gt;**](AdminUnit.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminListUsers**
> AdminUserPage adminListUsers(q, cursor)

Tìm tài khoản người học (FR-031), mới nhất trước

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getAdminApi();
final String q = q_example; // String | Tìm theo email/tên
final String cursor = cursor_example; // String | `nextCursor` của trang trước

try {
    final response = api.adminListUsers(q, cursor);
    print(response);
} on DioException catch (e) {
    print('Exception when calling AdminApi->adminListUsers: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **q** | **String**| Tìm theo email/tên | [optional] 
 **cursor** | **String**| `nextCursor` của trang trước | [optional] 

### Return type

[**AdminUserPage**](AdminUserPage.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminSetActivePlacementSet**
> adminSetActivePlacementSet(adminSetActivePlacementSetRequest)

Kích hoạt nguyên tử một bộ câu hỏi (thay thế bộ hiện hành) – PHẢI đúng 20 câu (8 N5, 6 N4, 6 N3) (FR-007, FR-030)

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getAdminApi();
final AdminSetActivePlacementSetRequest adminSetActivePlacementSetRequest = ; // AdminSetActivePlacementSetRequest | 

try {
    api.adminSetActivePlacementSet(adminSetActivePlacementSetRequest);
} on DioException catch (e) {
    print('Exception when calling AdminApi->adminSetActivePlacementSet: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **adminSetActivePlacementSetRequest** | [**AdminSetActivePlacementSetRequest**](AdminSetActivePlacementSetRequest.md)|  | 

### Return type

void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminSetUnitStatus**
> AdminUnit adminSetUnitStatus(unitId, adminSetUnitStatusRequest)

Kích hoạt / vô hiệu hóa; đánh dấu thuộc tập dùng thử (FR-037)

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getAdminApi();
final String unitId = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 
final AdminSetUnitStatusRequest adminSetUnitStatusRequest = ; // AdminSetUnitStatusRequest | 

try {
    final response = api.adminSetUnitStatus(unitId, adminSetUnitStatusRequest);
    print(response);
} on DioException catch (e) {
    print('Exception when calling AdminApi->adminSetUnitStatus: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **unitId** | **String**|  | 
 **adminSetUnitStatusRequest** | [**AdminSetUnitStatusRequest**](AdminSetUnitStatusRequest.md)|  | 

### Return type

[**AdminUnit**](AdminUnit.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminSetUserStatus**
> adminSetUserStatus(userId, adminSetUserStatusRequest)

Vô hiệu hóa / kích hoạt lại tài khoản

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getAdminApi();
final String userId = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 
final AdminSetUserStatusRequest adminSetUserStatusRequest = ; // AdminSetUserStatusRequest | 

try {
    api.adminSetUserStatus(userId, adminSetUserStatusRequest);
} on DioException catch (e) {
    print('Exception when calling AdminApi->adminSetUserStatus: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **userId** | **String**|  | 
 **adminSetUserStatusRequest** | [**AdminSetUserStatusRequest**](AdminSetUserStatusRequest.md)|  | 

### Return type

void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminUpdatePlacementQuestion**
> AdminPlacementQuestion adminUpdatePlacementQuestion(questionId, adminPlacementQuestion)

Sửa câu hỏi kiểm tra trình độ (nội dung, lựa chọn, đáp án, position) – ghi nhật ký quản trị (FR-030, FR-032)

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getAdminApi();
final String questionId = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 
final AdminPlacementQuestion adminPlacementQuestion = ; // AdminPlacementQuestion | 

try {
    final response = api.adminUpdatePlacementQuestion(questionId, adminPlacementQuestion);
    print(response);
} on DioException catch (e) {
    print('Exception when calling AdminApi->adminUpdatePlacementQuestion: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **questionId** | **String**|  | 
 **adminPlacementQuestion** | [**AdminPlacementQuestion**](AdminPlacementQuestion.md)|  | 

### Return type

[**AdminPlacementQuestion**](AdminPlacementQuestion.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminUpdateUnit**
> AdminUnit adminUpdateUnit(unitId, adminUnitWrite)

Sửa đơn vị học (có hiệu lực với phiên mới; phiên đang học giữ nguyên ảnh chụp). Đơn vị đang `active` PHẢI vẫn đạt kiểm tra nội dung sau khi sửa.

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getAdminApi();
final String unitId = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 
final AdminUnitWrite adminUnitWrite = ; // AdminUnitWrite | 

try {
    final response = api.adminUpdateUnit(unitId, adminUnitWrite);
    print(response);
} on DioException catch (e) {
    print('Exception when calling AdminApi->adminUpdateUnit: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **unitId** | **String**|  | 
 **adminUnitWrite** | [**AdminUnitWrite**](AdminUnitWrite.md)|  | 

### Return type

[**AdminUnit**](AdminUnit.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

