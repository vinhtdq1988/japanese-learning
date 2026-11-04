# japanese_api.api.ProgressApi

## Load the API package
```dart
import 'package:japanese_api/api.dart';
```

All URIs are relative to */api/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**getProgress**](ProgressApi.md#getprogress) | **GET** /progress | Tóm tắt tiến độ (FR-026 → FR-029)


# **getProgress**
> ProgressSummary getProgress()

Tóm tắt tiến độ (FR-026 → FR-029)

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getProgressApi();

try {
    final response = api.getProgress();
    print(response);
} on DioException catch (e) {
    print('Exception when calling ProgressApi->getProgress: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**ProgressSummary**](ProgressSummary.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

