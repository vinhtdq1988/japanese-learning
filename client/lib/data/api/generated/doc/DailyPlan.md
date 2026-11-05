# japanese_api.model.DailyPlan

## Load the model package
```dart
import 'package:japanese_api/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **String** |  | [optional] 
**localDate** | [**DateTime**](DateTime.md) |  | [optional] 
**budgetMinutes** | **int** |  | [optional] 
**estimatedMinutes** | **int** | Luôn ≤ budgetMinutes | [optional] 
**status** | **String** |  | [optional] 
**items** | [**List&lt;PlanItem&gt;**](PlanItem.md) |  | [optional] 
**notice** | **String** | Thông báo (đã học hết nội dung phù hợp, kế hoạch đã điều chỉnh sau khoảng nghỉ…) | [optional] 
**kanjiNotice** | [**DailyPlanKanjiNotice**](DailyPlanKanjiNotice.md) |  | [optional] 
**summary** | [**SessionSummary**](SessionSummary.md) |  | [optional] 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


