# japanese_api.model.AchievementEarned

## Load the model package
```dart
import 'package:japanese_api/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**code** | **String** | Mã ổn định trong danh mục cố định (xem specs/005-reward-feedback-effects/contracts/achievement-catalog.md), ví dụ `streak_7`, `items_100`, `goal_50`, `first_lesson`, `perfect_lesson`. | 
**kind** | [**AchievementKind**](AchievementKind.md) |  | 
**threshold** | **int** | Ngưỡng của mốc (ngày, số mục hoặc phần trăm). Vắng với `first_lesson` và `perfect_lesson`. | [optional] 
**name** | **String** | Văn bản đã được bản địa hóa theo ngôn ngữ yêu cầu | 
**description** | **String** | Văn bản đã được bản địa hóa theo ngôn ngữ yêu cầu | 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


