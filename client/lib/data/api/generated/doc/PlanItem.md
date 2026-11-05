# japanese_api.model.PlanItem

## Load the model package
```dart
import 'package:japanese_api/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **String** |  | [optional] 
**type** | **String** |  | [optional] 
**title** | **String** | Văn bản đã được bản địa hóa theo ngôn ngữ yêu cầu | [optional] 
**estMinutes** | **int** | Ước lượng; review_batch = ceil(itemCount × REVIEW_SECONDS_PER_ITEM / 60) | [optional] 
**status** | **String** |  | [optional] 
**itemCount** | **int** |  | [optional] 
**kind** | [**Skill**](Skill.md) | Kỹ năng của đơn vị với `new_unit` (client hiển thị nhãn Kanji); null với `review_batch` | [optional] 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


