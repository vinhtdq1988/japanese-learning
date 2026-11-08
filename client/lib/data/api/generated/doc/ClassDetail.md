# japanese_api.model.ClassDetail

## Load the model package
```dart
import 'package:japanese_api/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **String** |  | 
**name** | **String** |  | 
**status** | **String** |  | 
**memberCount** | **int** |  | 
**hasPath** | **bool** |  | 
**teachers** | [**List&lt;ClassRowTeachersInner&gt;**](ClassRowTeachersInner.md) |  | 
**needAttentionCount** | **int** | Chỉ có khi người gọi có quyền xem dữ liệu học viên | [optional] 
**teacherless** | **bool** |  | 
**description** | **String** |  | [optional] 
**absenceThresholdDays** | **int** |  | [optional] 
**archivedAt** | [**DateTime**](DateTime.md) |  | [optional] 
**createdAt** | [**DateTime**](DateTime.md) |  | [optional] 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


