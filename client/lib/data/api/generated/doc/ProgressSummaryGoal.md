# japanese_api.model.ProgressSummaryGoal

## Load the model package
```dart
import 'package:japanese_api/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**completionRatio** | **num** | Tỷ lệ PHÚT của các đơn vị đã xong (hoàn thành hoặc thành thạo) trên tổng phút của các đơn vị `active` trong phạm vi lộ trình, làm tròn 3 chữ số; cùng nguồn với thành tựu `goal_*` (spec 008) | [optional] 
**onTrack** | **bool** |  | [optional] 
**targetDate** | [**DateTime**](DateTime.md) |  | [optional] 
**scopeNotice** | [**ScopeNotice**](ScopeNotice.md) |  | [optional] 
**notices** | [**List&lt;ScopeNoticeCode&gt;**](ScopeNoticeCode.md) | Cùng quy tắc với `PathSummary.notices` (tính khi đọc): `content_ceiling_n3` rồi `listening_not_available` khi mục tiêu là JLPT | [optional] 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


