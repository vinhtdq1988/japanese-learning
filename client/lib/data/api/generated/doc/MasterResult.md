# japanese_api.model.MasterResult

## Load the model package
```dart
import 'package:japanese_api/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**remainingUnits** | **int** | Số đơn vị còn có thể học (chưa học hoặc đang học dở, chưa thành thạo) trong khoảng trình độ của lộ trình hiện tại | 
**suggestion** | **String** | Chỉ có khi remainingUnits = 0. raise_level: còn nội dung ở trình độ cao hơn (≤ N3) – client mời nâng trình độ (PATCH /me currentLevel → level_change) hoặc làm lại placement; content_exhausted: đã ở trần N3 – dùng chung mã với thông báo hết nội dung | [optional] 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


