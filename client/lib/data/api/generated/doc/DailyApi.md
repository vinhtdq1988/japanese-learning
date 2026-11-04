# japanese_api.api.DailyApi

## Load the API package
```dart
import 'package:japanese_api/api.dart';
```

All URIs are relative to */api/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**completeSession**](DailyApi.md#completesession) | **POST** /sessions/{sessionId}/complete | Hoàn thành phiên – cập nhật trạng thái mục kế hoạch/ngày và trả tóm tắt
[**getExtraUnit**](DailyApi.md#getextraunit) | **POST** /today/extra | Học thêm sau khi xong kế hoạch (US2.5) – không đổi kế hoạch mặc định
[**getToday**](DailyApi.md#gettoday) | **GET** /today | Kế hoạch hôm nay (sinh một lần theo ngày địa phương)
[**recordStudyInterval**](DailyApi.md#recordstudyinterval) | **POST** /sessions/{sessionId}/intervals | Ghi khoảng thời gian học (idempotent)
[**startSession**](DailyApi.md#startsession) | **POST** /sessions | Bắt đầu hoặc tiếp tục một phiên học cho mục kế hoạch
[**submitAnswer**](DailyApi.md#submitanswer) | **POST** /sessions/{sessionId}/answers | Ghi câu trả lời – chấm tự động, idempotent (FR-025, FR-041)


# **completeSession**
> SessionSummary completeSession(sessionId)

Hoàn thành phiên – cập nhật trạng thái mục kế hoạch/ngày và trả tóm tắt

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getDailyApi();
final String sessionId = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 

try {
    final response = api.completeSession(sessionId);
    print(response);
} on DioException catch (e) {
    print('Exception when calling DailyApi->completeSession: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **sessionId** | **String**|  | 

### Return type

[**SessionSummary**](SessionSummary.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getExtraUnit**
> PlanItem getExtraUnit()

Học thêm sau khi xong kế hoạch (US2.5) – không đổi kế hoạch mặc định

`PlanItem.id` trả về là id của đơn vị học; client bắt đầu học bằng `POST /sessions` với `planItemId` bằng giá trị đó (phiên `kind=extra`).

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getDailyApi();

try {
    final response = api.getExtraUnit();
    print(response);
} on DioException catch (e) {
    print('Exception when calling DailyApi->getExtraUnit: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**PlanItem**](PlanItem.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getToday**
> DailyPlan getToday()

Kế hoạch hôm nay (sinh một lần theo ngày địa phương)

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getDailyApi();

try {
    final response = api.getToday();
    print(response);
} on DioException catch (e) {
    print('Exception when calling DailyApi->getToday: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**DailyPlan**](DailyPlan.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **recordStudyInterval**
> recordStudyInterval(sessionId, recordStudyIntervalRequest)

Ghi khoảng thời gian học (idempotent)

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getDailyApi();
final String sessionId = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 
final RecordStudyIntervalRequest recordStudyIntervalRequest = ; // RecordStudyIntervalRequest | 

try {
    api.recordStudyInterval(sessionId, recordStudyIntervalRequest);
} on DioException catch (e) {
    print('Exception when calling DailyApi->recordStudyInterval: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **sessionId** | **String**|  | 
 **recordStudyIntervalRequest** | [**RecordStudyIntervalRequest**](RecordStudyIntervalRequest.md)|  | 

### Return type

void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **startSession**
> LessonSession startSession(startSessionRequest)

Bắt đầu hoặc tiếp tục một phiên học cho mục kế hoạch

`planItemId` là id mục kế hoạch của người học, hoặc id đơn vị do `POST /today/extra` trả về (học thêm). Đã có phiên cho mục đó thì trả lại phiên ấy (tiếp tục, đúng snapshot cũ).

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getDailyApi();
final StartSessionRequest startSessionRequest = ; // StartSessionRequest | 

try {
    final response = api.startSession(startSessionRequest);
    print(response);
} on DioException catch (e) {
    print('Exception when calling DailyApi->startSession: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **startSessionRequest** | [**StartSessionRequest**](StartSessionRequest.md)|  | 

### Return type

[**LessonSession**](LessonSession.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **submitAnswer**
> AnswerResult submitAnswer(sessionId, answerSubmission)

Ghi câu trả lời – chấm tự động, idempotent (FR-025, FR-041)

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getDailyApi();
final String sessionId = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 
final AnswerSubmission answerSubmission = ; // AnswerSubmission | 

try {
    final response = api.submitAnswer(sessionId, answerSubmission);
    print(response);
} on DioException catch (e) {
    print('Exception when calling DailyApi->submitAnswer: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **sessionId** | **String**|  | 
 **answerSubmission** | [**AnswerSubmission**](AnswerSubmission.md)|  | 

### Return type

[**AnswerResult**](AnswerResult.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

