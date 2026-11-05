# japanese_api.model.AdminPlacementQuestion

## Load the model package
```dart
import 'package:japanese_api/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **String** |  | [optional] 
**level** | [**ContentLevel**](ContentLevel.md) |  | 
**skill** | **String** | Placement không có Kanji (422 nếu gửi kanji) | 
**topicId** | **String** |  | 
**prompt** | **String** | Câu hỏi bằng tiếng Nhật | 
**hint** | [**I18nText**](I18nText.md) | Gợi ý song ngữ nối sau câu hỏi (tùy chọn) | [optional] 
**choices** | **List&lt;String&gt;** |  | 
**correctChoice** | **int** | Chỉ số đáp án đúng trong `choices` | 
**position** | **int** |  | [optional] 
**isActive** | **bool** | Chỉ đổi qua PUT /admin/placement-questions/active-set | [optional] 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


