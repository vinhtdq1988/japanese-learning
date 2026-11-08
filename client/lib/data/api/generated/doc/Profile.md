# japanese_api.model.Profile

## Load the model package
```dart
import 'package:japanese_api/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**displayName** | **String** |  | [optional] 
**currentLevel** | [**Level**](Level.md) |  | [optional] 
**goalType** | [**GoalType**](GoalType.md) |  | [optional] 
**targetLevel** | [**TargetLevel**](TargetLevel.md) |  | [optional] 
**dailyMinutes** | **int** |  | [optional] 
**targetDate** | [**DateTime**](DateTime.md) |  | [optional] 
**skills** | [**List&lt;Skill&gt;**](Skill.md) |  | [optional] 
**prioritizedSkill** | [**Skill**](Skill.md) |  | [optional] 
**language** | [**Lang**](Lang.md) |  | [optional] 
**timezone** | **String** |  | [optional] 
**paused** | **bool** |  | [optional] 
**onboardingState** | **String** |  | [optional] 
**soundEnabled** | **bool** | Bật/tắt âm thanh phản hồi và chúc mừng (spec 005). Mặc định true. | [optional] [default to true]
**visualEffectsEnabled** | **bool** | Bật/tắt hiệu ứng hình ảnh (hoạt ảnh, màn chúc mừng động). Khi tắt, kết quả đúng/sai và thành tựu vẫn được thể hiện bằng dạng tĩnh. Mặc định true. | [optional] [default to true]

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


