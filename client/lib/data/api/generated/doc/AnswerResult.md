# japanese_api.model.AnswerResult

## Load the model package
```dart
import 'package:japanese_api/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**isCorrect** | **bool** |  | [optional] 
**feedback** | **String** | Văn bản đã được bản địa hóa theo ngôn ngữ yêu cầu | [optional] 
**correctAnswer** | **Object** | Đáp án đúng khi trả lời sai | [optional] 
**nextReviewDate** | [**DateTime**](DateTime.md) |  | [optional] 
**duplicate** | **bool** | true nếu clientEventId đã được ghi, hoặc bài tập này đã có câu trả lời lượt chính trong phiên (FR-041); khi đó trả lại kết quả đã có | [optional] 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


