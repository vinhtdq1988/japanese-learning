# japanese_api.model.AdminUnit

## Load the model package
```dart
import 'package:japanese_api/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**kind** | [**Skill**](Skill.md) |  | 
**title** | [**I18nText**](I18nText.md) |  | 
**level** | [**ContentLevel**](ContentLevel.md) |  | 
**goalTags** | [**List&lt;GoalType&gt;**](GoalType.md) |  | [optional] 
**topicId** | **String** |  | 
**difficulty** | **int** |  | 
**tier** | **String** | `foundation` = nền tảng người mới, chỉ hợp lệ với level N5 | [optional] [default to 'core']
**estMinutes** | **int** |  | 
**sequence** | **int** |  | [optional] 
**items** | [**List&lt;AdminUnitWriteItemsInner&gt;**](AdminUnitWriteItemsInner.md) | Khi sửa: phần tử có `id` được cập nhật, phần tử không có `id` được tạo mới; mục hiện có vắng mặt trong payload bị chuyển `inactive`, KHÔNG xóa cứng (giữ `study_records`/`review_schedules` – data-model §2.9). | [optional] 
**exercises** | [**List&lt;AdminUnitWriteExercisesInner&gt;**](AdminUnitWriteExercisesInner.md) | Cùng quy tắc với `items` – bài tập vắng mặt trong payload sửa bị chuyển `inactive`, không xóa cứng. | [optional] 
**id** | **String** |  | [optional] 
**status** | **String** |  | [optional] 
**isTrial** | **bool** |  | [optional] 
**updatedAt** | [**DateTime**](DateTime.md) |  | [optional] 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


