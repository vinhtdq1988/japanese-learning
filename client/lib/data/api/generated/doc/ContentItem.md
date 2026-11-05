# japanese_api.model.ContentItem

## Load the model package
```dart
import 'package:japanese_api/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **String** |  | [optional] 
**kind** | [**Skill**](Skill.md) |  | [optional] 
**japanese** | **String** |  | [optional] 
**reading** | **String** |  | [optional] 
**meaning** | **String** | Văn bản đã được bản địa hóa theo ngôn ngữ yêu cầu | [optional] 
**explanation** | **String** | Văn bản đã được bản địa hóa theo ngôn ngữ yêu cầu | [optional] 
**topicId** | **String** | Chủ đề của chữ (chỉ Kanji) | [optional] 
**kanji** | [**KanjiDetails**](KanjiDetails.md) | Chỉ có khi `kind=kanji`; `reading` khi đó là null | [optional] 
**examples** | [**List&lt;ContentItemExamplesInner&gt;**](ContentItemExamplesInner.md) |  | [optional] 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


