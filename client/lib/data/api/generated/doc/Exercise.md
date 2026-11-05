# japanese_api.model.Exercise

## Load the model package
```dart
import 'package:japanese_api/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **String** |  | 
**type** | **String** |  | 
**facet** | [**ReviewFacet**](ReviewFacet.md) |  | [optional] 
**prompt** | **String** | Văn bản đã được bản địa hóa theo ngôn ngữ yêu cầu | 
**payload** | **Object** | Dạng theo `type`: `multiple_choice` → `choices[]`; `matching` → `left[]` và `right[]` (vế phải đã xáo; trả lời là danh sách cặp [vế trái, vế phải]); `fill_blank` → `hint` (tùy chọn). KHÔNG chứa đáp án trong luồng người học. | 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


