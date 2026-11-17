# japanese_api.model.PathSummary

## Load the model package
```dart
import 'package:japanese_api/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **String** |  | [optional] 
**totalUnits** | **int** |  | [optional] 
**completedUnits** | **int** |  | [optional] 
**startLevel** | [**Level**](Level.md) |  | [optional] 
**reason** | **String** |  | [optional] 
**scopeNotice** | [**ScopeNotice**](ScopeNotice.md) |  | [optional] 
**notices** | [**List&lt;ScopeNoticeCode&gt;**](ScopeNoticeCode.md) | Tính khi đọc từ hồ sơ và tham số lộ trình, KHÔNG lưu vào lộ trình nên lộ trình đã tồn tại cũng có. Thứ tự: `content_ceiling_n3` (nếu có) rồi `listening_not_available` (nếu `goalType = jlpt`). | [optional] 
**message** | **String** | Ví dụ: kỹ năng chưa hỗ trợ trong phiên bản này | [optional] 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


