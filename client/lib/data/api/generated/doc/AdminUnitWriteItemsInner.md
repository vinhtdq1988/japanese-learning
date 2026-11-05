# japanese_api.model.AdminUnitWriteItemsInner

## Load the model package
```dart
import 'package:japanese_api/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **String** | Có khi sửa mục đã tồn tại | [optional] 
**status** | **String** |  | [optional] [default to 'active']
**japanese** | **String** |  | 
**reading** | **String** |  | [optional] 
**meaning** | [**I18nText**](I18nText.md) |  | 
**explanation** | [**I18nText**](I18nText.md) |  | [optional] 
**topicId** | **String** | Bắt buộc khi kind=kanji lúc kích hoạt (chủ đề skill=kanji); bỏ qua với kind khác. Lưu nháp không bắt buộc | [optional] 
**kanjiDetails** | [**KanjiDetailsWrite**](KanjiDetailsWrite.md) | Bắt buộc đầy đủ khi kích hoạt kind=kanji (lưu nháp chấp nhận null); `reading` khi đó để null | [optional] 
**examples** | **List&lt;Object&gt;** | `[{ja, reading, translation: I18nText, kanjiReading?}]` | [optional] 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


