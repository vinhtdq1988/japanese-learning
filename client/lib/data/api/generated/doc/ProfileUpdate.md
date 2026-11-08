# japanese_api.model.ProfileUpdate

## Load the model package
```dart
import 'package:japanese_api/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**displayName** | **String** |  | [optional] 
**email** | **String** |  | [optional] 
**currentPassword** | **String** | Bắt buộc khi có `email` | [optional] 
**currentLevel** | [**Level**](Level.md) |  | [optional] 
**dailyMinutes** | **int** |  | [optional] 
**goalType** | [**GoalType**](GoalType.md) |  | [optional] 
**targetLevel** | [**TargetLevel**](TargetLevel.md) |  | [optional] 
**targetDate** | [**DateTime**](DateTime.md) |  | [optional] 
**prioritizedSkill** | [**Skill**](Skill.md) |  | [optional] 
**skills** | [**Set&lt;Skill&gt;**](Skill.md) | Kỹ năng muốn cải thiện. Đổi giá trị KHÔNG sinh lộ trình mới; có hiệu lực ở kế hoạch sinh kế tiếp (kế hoạch đã sinh hôm nay không đổi). Tiến độ và lịch ôn giữ nguyên. Nếu `prioritizedSkill` hiện tại (hoặc gửi kèm) không thuộc `skills` mới thì được đặt null. | [optional] 
**language** | [**Lang**](Lang.md) |  | [optional] 
**timezone** | **String** |  | [optional] 
**soundEnabled** | **bool** | Chỉ hai trường hiệu ứng: không sinh lại lộ trình, không đụng kế hoạch, không cần `currentPassword`, học viên thuộc lớp vẫn sửa được (spec 005). | [optional] 
**visualEffectsEnabled** | **bool** |  | [optional] 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


