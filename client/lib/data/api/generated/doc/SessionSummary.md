# japanese_api.model.SessionSummary

## Load the model package
```dart
import 'package:japanese_api/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**correct** | **int** |  | [optional] 
**total** | **int** |  | [optional] 
**minutesSpent** | **num** |  | [optional] 
**dayCompleted** | **bool** |  | [optional] 
**attentionItems** | [**List&lt;SessionSummaryAttentionItemsInner&gt;**](SessionSummaryAttentionItemsInner.md) | Chữ Kanji có ít nhất một câu lượt chính sai trong phiên (US1.4); vắng mặt với phiên không có Kanji | [optional] 
**celebrations** | [**Celebrations**](Celebrations.md) | Có mặt khi và chỉ khi phản hồi này đến từ lần `complete` thực sự hoàn thành phiên VÀ có ít nhất một thứ để chúc mừng (`dayCompleted = true` hoặc `achievements` không rỗng). Vắng khi: không có gì để chúc mừng; gọi lại (idempotent) trên phiên đã hoàn thành. Nếu client không nhận được phản hồi (đóng tab, mất kết nối), thành tựu vẫn được ghi nhận nhưng KHÔNG được chúc mừng bù ở lần sau. `dayCompleted` ở mức `SessionSummary` giữ nguyên ngữ nghĩa cũ; chỉ `celebrations.dayCompleted` là tín hiệu \"chúc mừng một lần\" (spec 005). | [optional] 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


