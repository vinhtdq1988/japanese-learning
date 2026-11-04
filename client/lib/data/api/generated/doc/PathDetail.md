# japanese_api.model.PathDetail

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
**message** | **String** | Ví dụ: kỹ năng chưa hỗ trợ trong phiên bản này | [optional] 
**items** | [**List&lt;PathDetailAllOfItems&gt;**](PathDetailAllOfItems.md) | Thứ tự đơn vị được tính động tại thời điểm gọi từ tham số lộ trình, nội dung `active` hiện hành và trạng thái học (không lưu sẵn; đơn vị mới kích hoạt xuất hiện ở lần gọi kế tiếp, SC-008) | [optional] 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


