# japanese_api.model.KanjiDetails

## Load the model package
```dart
import 'package:japanese_api/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**onReadings** | **List&lt;String&gt;** | Âm On (katakana); có thể rỗng | 
**kunReadings** | **List&lt;String&gt;** | Âm Kun (hiragana, `.` phân cách okurigana); có thể rỗng. onReadings ∪ kunReadings không rỗng | 
**strokeCount** | **int** |  | 
**components** | **String** | Văn bản đã được bản địa hóa theo ngôn ngữ yêu cầu | [optional] 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


