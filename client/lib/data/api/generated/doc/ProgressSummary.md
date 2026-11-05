# japanese_api.model.ProgressSummary

## Load the model package
```dart
import 'package:japanese_api/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**isEmpty** | **bool** | true khi chưa có lịch sử (trạng thái trống thân thiện) | [optional] 
**totalMinutes** | **num** |  | [optional] 
**lessonsCompleted** | **int** |  | [optional] 
**reviewAccuracy** | **num** |  | [optional] 
**currentStreakDays** | **int** |  | [optional] 
**goal** | [**ProgressSummaryGoal**](ProgressSummaryGoal.md) |  | [optional] 
**kanji** | [**ProgressSummaryKanji**](ProgressSummaryKanji.md) |  | [optional] 
**weakTopics** | [**List&lt;ProgressSummaryWeakTopicsInner&gt;**](ProgressSummaryWeakTopicsInner.md) |  | [optional] 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


