# japanese_api.model.AdminActionLog

## Load the model package
```dart
import 'package:japanese_api/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **String** |  | [optional] 
**actorId** | **String** |  | [optional] 
**action** | **String** |  | [optional] 
**targetType** | **String** |  | [optional] 
**targetId** | **String** |  | [optional] 
**diff** | **Map&lt;String, Object&gt;** | Thay đổi trước/sau, đã loại thông tin nhạy cảm (mật khẩu, token, email) | [optional] 
**occurredAt** | [**DateTime**](DateTime.md) |  | [optional] 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


