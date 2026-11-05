# japanese_api.model.AdminUnitWriteExercisesInner

## Load the model package
```dart
import 'package:japanese_api/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **String** | Có khi sửa bài tập đã tồn tại | [optional] 
**status** | **String** |  | [optional] [default to 'active']
**itemIndex** | **int** | Chỉ số (từ 0) của mục trong `items` cùng payload mà bài tập kiểm tra; null/vắng = không gắn mục (không vào lịch ôn tập). Khi đọc, tính theo thứ tự `items` trả về | [optional] 
**facet** | [**ReviewFacet**](ReviewFacet.md) | Bài tập gắn chữ Kanji (`itemIndex` khác null trong đơn vị Kanji) PHẢI có meaning | reading | word; bài tập khác PHẢI là item | [optional] [default to ReviewFacet.item]
**type** | **String** |  | 
**prompt** | [**I18nText**](I18nText.md) |  | 
**payload** | **Object** | Gồm đáp án cố định (xem data-model.md §2.10) | 
**feedbackCorrect** | [**I18nText**](I18nText.md) |  | 
**feedbackIncorrect** | [**I18nText**](I18nText.md) |  | 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


