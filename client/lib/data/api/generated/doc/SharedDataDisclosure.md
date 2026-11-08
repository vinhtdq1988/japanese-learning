# japanese_api.model.SharedDataDisclosure

## Load the model package
```dart
import 'package:japanese_api/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**version** | **int** |  | 
**visible** | [**List&lt;SharedDataItem&gt;**](SharedDataItem.md) |  | 
**notVisible** | **List&lt;String&gt;** | mật khẩu/phiên, hoạt động trước ngày vào lớp, từng câu trả lời, dữ liệu hồ sơ ngoài danh sách | 
**lockedControls** | **List&lt;String&gt;** | các quyền bị khóa khi thuộc lớp | 
**canLeaveAnytime** | **bool** |  | 
**mayBeMovedWithinOrganization** | **bool** | Luôn false: trung tâm KHÔNG tự chuyển học viên sang lớp khác; chỉ mời và học viên phải đồng ý lại | 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


