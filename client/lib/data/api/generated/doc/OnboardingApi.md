# japanese_api.api.OnboardingApi

## Load the API package
```dart
import 'package:japanese_api/api.dart';
```

All URIs are relative to */api/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**completeOnboarding**](OnboardingApi.md#completeonboarding) | **POST** /onboarding/complete | Hoàn tất onboarding – sinh lộ trình và bài học hôm nay (FR-008, FR-010)
[**getOnboarding**](OnboardingApi.md#getonboarding) | **GET** /onboarding | Trạng thái và bản nháp onboarding (tiếp tục khi bỏ dở)
[**listPlacementQuestions**](OnboardingApi.md#listplacementquestions) | **GET** /placement/questions | Bộ câu hỏi kiểm tra trình độ (công khai, KHÔNG kèm đáp án)
[**saveOnboarding**](OnboardingApi.md#saveonboarding) | **PUT** /onboarding | Lưu nháp các bước đã nhập (FR-005)
[**submitPlacement**](OnboardingApi.md#submitplacement) | **POST** /placement/submit | Nộp bài kiểm tra trình độ (cũng dùng để mang kết quả dùng thử sang – FR-039; làm lại – FR-009)


# **completeOnboarding**
> CompleteOnboarding200Response completeOnboarding(onboardingDraft)

Hoàn tất onboarding – sinh lộ trình và bài học hôm nay (FR-008, FR-010)

Có thể không kèm kết quả kiểm tra (bỏ qua) – lộ trình sinh từ hồ sơ khai báo.

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getOnboardingApi();
final OnboardingDraft onboardingDraft = ; // OnboardingDraft | 

try {
    final response = api.completeOnboarding(onboardingDraft);
    print(response);
} on DioException catch (e) {
    print('Exception when calling OnboardingApi->completeOnboarding: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **onboardingDraft** | [**OnboardingDraft**](OnboardingDraft.md)|  | 

### Return type

[**CompleteOnboarding200Response**](CompleteOnboarding200Response.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getOnboarding**
> OnboardingState getOnboarding()

Trạng thái và bản nháp onboarding (tiếp tục khi bỏ dở)

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getOnboardingApi();

try {
    final response = api.getOnboarding();
    print(response);
} on DioException catch (e) {
    print('Exception when calling OnboardingApi->getOnboarding: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**OnboardingState**](OnboardingState.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listPlacementQuestions**
> PlacementQuestionSet listPlacementQuestions(lang)

Bộ câu hỏi kiểm tra trình độ (công khai, KHÔNG kèm đáp án)

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getOnboardingApi();
final String lang = lang_example; // String | 

try {
    final response = api.listPlacementQuestions(lang);
    print(response);
} on DioException catch (e) {
    print('Exception when calling OnboardingApi->listPlacementQuestions: $e\n');
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

# **saveOnboarding**
> OnboardingState saveOnboarding(onboardingDraft)

Lưu nháp các bước đã nhập (FR-005)

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getOnboardingApi();
final OnboardingDraft onboardingDraft = ; // OnboardingDraft | 

try {
    final response = api.saveOnboarding(onboardingDraft);
    print(response);
} on DioException catch (e) {
    print('Exception when calling OnboardingApi->saveOnboarding: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **onboardingDraft** | [**OnboardingDraft**](OnboardingDraft.md)|  | 

### Return type

[**OnboardingState**](OnboardingState.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **submitPlacement**
> PlacementResult submitPlacement(placementAnswers)

Nộp bài kiểm tra trình độ (cũng dùng để mang kết quả dùng thử sang – FR-039; làm lại – FR-009)

Server chấm lại từ các câu trả lời và lưu `placement_results`.

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getOnboardingApi();
final PlacementAnswers placementAnswers = ; // PlacementAnswers | 

try {
    final response = api.submitPlacement(placementAnswers);
    print(response);
} on DioException catch (e) {
    print('Exception when calling OnboardingApi->submitPlacement: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **placementAnswers** | [**PlacementAnswers**](PlacementAnswers.md)|  | 

### Return type

[**PlacementResult**](PlacementResult.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

