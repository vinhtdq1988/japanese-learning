# japanese_api.model.AdminPlacementQuestion

## Load the model package
```dart
import 'package:japanese_api/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **String** |  | [optional] 
**level** | [**ContentLevel**](ContentLevel.md) |  | [optional] 
**skill** | [**Skill**](Skill.md) |  | [optional] 
**topicId** | **String** |  | [optional] 
**prompt** | **String** |  | [optional] 
**choices** | **List&lt;String&gt;** |  | [optional] 
**correctChoice** | **int** |  | [optional] 
**position** | **int** |  | [optional] 
**isActive** | **bool** | Chỉ đổi qua PUT /admin/placement-questions/active-set | [optional] 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


