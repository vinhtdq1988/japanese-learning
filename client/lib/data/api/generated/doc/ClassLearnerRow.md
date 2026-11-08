# japanese_api.model.ClassLearnerRow

## Load the model package
```dart
import 'package:japanese_api/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**userId** | **String** |  | 
**displayName** | **String** |  | 
**email** | **String** |  | 
**joinedAt** | [**DateTime**](DateTime.md) |  | [optional] 
**hasStarted** | **bool** | false - giao diện hiện \"chưa bắt đầu\" thay vì số 0 | 
**pathCompleted** | **bool** |  | 
**completionRatio** | **num** |  | [optional] 
**expectedRatio** | **num** |  | [optional] 
**streakDays** | **int** |  | [optional] 
**minutesLast7Days** | **num** |  | [optional] 
**minutesTotal** | **num** | từ khi vào lớp | [optional] 
**reviewAccuracy** | **num** |  | [optional] 
**lastActiveOn** | [**DateTime**](DateTime.md) |  | [optional] 
**progressStatus** | [**ClassProgressStatus**](ClassProgressStatus.md) |  | 
**alerts** | [**List&lt;ClassAlert&gt;**](ClassAlert.md) |  | 
**absentDays** | **int** |  | [optional] 
**overrides** | [**LearnerOverride**](LearnerOverride.md) |  | [optional] 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


