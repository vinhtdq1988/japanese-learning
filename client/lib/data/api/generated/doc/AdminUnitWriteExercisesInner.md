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
**type** | **String** |  | 
**prompt** | [**I18nText**](I18nText.md) |  | 
**payload** | **Object** | Gồm đáp án cố định (xem data-model.md §2.10) | 
**feedbackCorrect** | [**I18nText**](I18nText.md) |  | 
**feedbackIncorrect** | [**I18nText**](I18nText.md) |  | 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


