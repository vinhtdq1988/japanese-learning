# japanese_api.api.PathApi

## Load the API package
```dart
import 'package:japanese_api/api.dart';
```

All URIs are relative to */api/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**getPath**](PathApi.md#getpath) | **GET** /path | Lộ trình hiện tại
[**pausePath**](PathApi.md#pausepath) | **POST** /path/pause | Tạm dừng lộ trình
[**rebuildPath**](PathApi.md#rebuildpath) | **POST** /path/rebuild | Xây dựng lại lộ trình (FR-016) – giữ lịch sử và lịch ôn
[**resumePath**](PathApi.md#resumepath) | **POST** /path/resume | Tiếp tục lộ trình
[**setItemMastered**](PathApi.md#setitemmastered) | **PUT** /path/items/{itemId}/master | Đánh dấu / bỏ đánh dấu một chữ Kanji đã thành thạo (dừng / tiếp tục ôn mọi khía cạnh)
[**setUnitMastered**](PathApi.md#setunitmastered) | **PUT** /path/units/{unitId}/master | Đánh dấu / bỏ đánh dấu đã thành thạo


# **getPath**
> PathDetail getPath()

Lộ trình hiện tại

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getPathApi();

try {
    final response = api.getPath();
    print(response);
} on DioException catch (e) {
    print('Exception when calling PathApi->getPath: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**PathDetail**](PathDetail.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **pausePath**
> pausePath()

Tạm dừng lộ trình

Mở giai đoạn tạm dừng; khi đang tạm dừng không sinh kế hoạch ngày và không có ngày bỏ lỡ. Gọi lại khi đang tạm dừng không làm gì.

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getPathApi();

try {
    api.pausePath();
} on DioException catch (e) {
    print('Exception when calling PathApi->pausePath: $e\n');
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
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **rebuildPath**
> PathSummary rebuildPath(rebuildPathRequest)

Xây dựng lại lộ trình (FR-016) – giữ lịch sử và lịch ôn

Có `usePlacementResultId` (làm lại placement rồi chọn xây dựng lại, US1.6) → lộ trình mới lưu `reason='placement_retake'`; bỏ trống → `reason='rebuild_request'`.

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getPathApi();
final RebuildPathRequest rebuildPathRequest = ; // RebuildPathRequest | 

try {
    final response = api.rebuildPath(rebuildPathRequest);
    print(response);
} on DioException catch (e) {
    print('Exception when calling PathApi->rebuildPath: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **rebuildPathRequest** | [**RebuildPathRequest**](RebuildPathRequest.md)|  | [optional] 

### Return type

[**PathSummary**](PathSummary.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **resumePath**
> resumePath()

Tiếp tục lộ trình

Đóng giai đoạn tạm dừng; các ngày tạm dừng không tính vào khoảng nghỉ hay chuỗi ngày học. Gọi lại khi không tạm dừng không làm gì.

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getPathApi();

try {
    api.resumePath();
} on DioException catch (e) {
    print('Exception when calling PathApi->resumePath: $e\n');
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
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **setItemMastered**
> SetItemMastered200Response setItemMastered(itemId, setUnitMasteredRequest)

Đánh dấu / bỏ đánh dấu một chữ Kanji đã thành thạo (dừng / tiếp tục ôn mọi khía cạnh)

Idempotent – gửi lại cùng giá trị trả 200 không đổi dữ liệu. Đánh dấu cả bài Kanji dùng `PUT /path/units/{unitId}/master`.

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getPathApi();
final String itemId = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 
final SetUnitMasteredRequest setUnitMasteredRequest = ; // SetUnitMasteredRequest | 

try {
    final response = api.setItemMastered(itemId, setUnitMasteredRequest);
    print(response);
} on DioException catch (e) {
    print('Exception when calling PathApi->setItemMastered: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **itemId** | **String**|  | 
 **setUnitMasteredRequest** | [**SetUnitMasteredRequest**](SetUnitMasteredRequest.md)|  | 

### Return type

[**SetItemMastered200Response**](SetItemMastered200Response.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **setUnitMastered**
> MasterResult setUnitMastered(unitId, setUnitMasteredRequest)

Đánh dấu / bỏ đánh dấu đã thành thạo

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getPathApi();
final String unitId = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 
final SetUnitMasteredRequest setUnitMasteredRequest = ; // SetUnitMasteredRequest | 

try {
    final response = api.setUnitMastered(unitId, setUnitMasteredRequest);
    print(response);
} on DioException catch (e) {
    print('Exception when calling PathApi->setUnitMastered: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **unitId** | **String**|  | 
 **setUnitMasteredRequest** | [**SetUnitMasteredRequest**](SetUnitMasteredRequest.md)|  | 

### Return type

[**MasterResult**](MasterResult.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

