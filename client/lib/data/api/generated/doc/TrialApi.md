# japanese_api.api.TrialApi

## Load the API package
```dart
import 'package:japanese_api/api.dart';
```

All URIs are relative to */api/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**getTrialContent**](TrialApi.md#gettrialcontent) | **GET** /trial/content | Nội dung dùng thử cố định (công khai) – FR-036/037
[**gradeTrialPlacement**](TrialApi.md#gradetrialplacement) | **POST** /trial/placement/grade | Chấm bài kiểm tra trình độ cho khách – không lưu gì
[**listPlacementQuestions**](TrialApi.md#listplacementquestions) | **GET** /placement/questions | Bộ câu hỏi kiểm tra trình độ (công khai, KHÔNG kèm đáp án)
[**recordTrialEvent**](TrialApi.md#recordtrialevent) | **POST** /trial/events | Ghi nhận sự kiện dùng thử ẩn danh (chỉ tăng bộ đếm tổng hợp theo ngày, FR-038)


# **getTrialContent**
> TrialContent getTrialContent(lang)

Nội dung dùng thử cố định (công khai) – FR-036/037

Trả tập đơn vị học đánh dấu `is_trial`. Bài tập trong payload có kèm đáp án để client chấm cục bộ (nội dung công khai). Không tạo bản ghi định danh nào trên máy chủ; chỉ tăng bộ đếm tổng hợp ẩn danh theo ngày (FR-038). Giới hạn tần suất (FR-040). 

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getTrialApi();
final String lang = lang_example; // String | 

try {
    final response = api.getTrialContent(lang);
    print(response);
} on DioException catch (e) {
    print('Exception when calling TrialApi->getTrialContent: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **lang** | **String**|  | [optional] [default to 'vi']

### Return type

[**TrialContent**](TrialContent.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **gradeTrialPlacement**
> PlacementResult gradeTrialPlacement(placementAnswers)

Chấm bài kiểm tra trình độ cho khách – không lưu gì

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getTrialApi();
final PlacementAnswers placementAnswers = ; // PlacementAnswers | 

try {
    final response = api.gradeTrialPlacement(placementAnswers);
    print(response);
} on DioException catch (e) {
    print('Exception when calling TrialApi->gradeTrialPlacement: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **placementAnswers** | [**PlacementAnswers**](PlacementAnswers.md)|  | 

### Return type

[**PlacementResult**](PlacementResult.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listPlacementQuestions**
> PlacementQuestionSet listPlacementQuestions(lang)

Bộ câu hỏi kiểm tra trình độ (công khai, KHÔNG kèm đáp án)

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getTrialApi();
final String lang = lang_example; // String | 

try {
    final response = api.listPlacementQuestions(lang);
    print(response);
} on DioException catch (e) {
    print('Exception when calling TrialApi->listPlacementQuestions: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **lang** | **String**|  | [optional] [default to 'vi']

### Return type

[**PlacementQuestionSet**](PlacementQuestionSet.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **recordTrialEvent**
> recordTrialEvent(recordTrialEventRequest)

Ghi nhận sự kiện dùng thử ẩn danh (chỉ tăng bộ đếm tổng hợp theo ngày, FR-038)

Không nhận và không lưu bất kỳ dữ liệu nào khác ngoài tên sự kiện; không gắn với IP hay trình duyệt. Giới hạn tần suất (FR-040). 

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getTrialApi();
final RecordTrialEventRequest recordTrialEventRequest = ; // RecordTrialEventRequest | 

try {
    api.recordTrialEvent(recordTrialEventRequest);
} on DioException catch (e) {
    print('Exception when calling TrialApi->recordTrialEvent: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **recordTrialEventRequest** | [**RecordTrialEventRequest**](RecordTrialEventRequest.md)|  | 

### Return type

void (empty response body)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

