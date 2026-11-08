# japanese_api.model.ClassPath

## Load the model package
```dart
import 'package:japanese_api/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**startLevel** | [**Level**](Level.md) |  | 
**targetLevel** | [**TargetLevel**](TargetLevel.md) |  | 
**skills** | [**Set&lt;Skill&gt;**](Skill.md) |  | 
**startsOn** | [**DateTime**](DateTime.md) |  | 
**endsOn** | [**DateTime**](DateTime.md) | > startsOn | 
**dailyMinutes** | **int** |  | 
**mode** | **String** |  | 
**scopeNotice** | [**ScopeNotice**](ScopeNotice.md) |  | [optional] 
**units** | [**List&lt;ClassPathUnit&gt;**](ClassPathUnit.md) | explicit - đúng danh sách và thứ tự giáo viên chọn; template - thứ tự tham khảo tính động | 
**assignments** | [**List&lt;ClassAssignment&gt;**](ClassAssignment.md) |  | 
**warnings** | [**List&lt;PathWarning&gt;**](PathWarning.md) |  | 
**contentNotices** | [**List&lt;ContentNotice&gt;**](ContentNotice.md) |  | 
**updatedAt** | [**DateTime**](DateTime.md) |  | 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


