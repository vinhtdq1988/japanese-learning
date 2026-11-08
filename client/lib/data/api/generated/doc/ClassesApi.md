# japanese_api.api.ClassesApi

## Load the API package
```dart
import 'package:japanese_api/api.dart';
```

All URIs are relative to */api/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**archiveClass**](ClassesApi.md#archiveclass) | **POST** /classes/{id}/archive | Lưu trữ lớp (một chiều) - đóng mọi thành viên, vô hiệu mã và lời mời chờ
[**cancelClassAssignment**](ClassesApi.md#cancelclassassignment) | **DELETE** /classes/{id}/assignments/{assignmentId} | Hủy bài giao
[**closeClassPlacementRequest**](ClassesApi.md#closeclassplacementrequest) | **POST** /classes/{id}/placement-requests/current/close | Đóng yêu cầu kiểm tra trình độ
[**createClass**](ClassesApi.md#createclass) | **POST** /classes | Tạo lớp (giáo viên tự là phụ trách; &#x60;teacherIds&#x60; chỉ chủ tổ chức)
[**createClassAssignments**](ClassesApi.md#createclassassignments) | **POST** /classes/{id}/assignments | Giao bài (1-20 đơn vị, một hạn)
[**createClassPause**](ClassesApi.md#createclasspause) | **POST** /classes/{id}/pauses | Tạm dừng cả lớp (vắng &#x60;userId&#x60;) hoặc một học viên
[**createClassPlacementRequest**](ClassesApi.md#createclassplacementrequest) | **POST** /classes/{id}/placement-requests | Yêu cầu cả lớp làm bài kiểm tra trình độ
[**endClassPause**](ClassesApi.md#endclasspause) | **POST** /classes/{id}/pauses/{pauseId}/end | Kết thúc khoảng tạm dừng (mặc định hôm nay)
[**exemptLearnerUnit**](ClassesApi.md#exemptlearnerunit) | **PUT** /classes/{id}/members/{userId}/exemptions/{unitId} | Miễn một đơn vị cho học viên
[**exportClassCsv**](ClassesApi.md#exportclasscsv) | **GET** /classes/{id}/export.csv | Xuất báo cáo lớp (CSV có BOM, chống công thức; ghi nhật ký &#x60;class.export&#x60;)
[**exportClassLearnerCsv**](ClassesApi.md#exportclasslearnercsv) | **GET** /classes/{id}/members/{userId}/export.csv | Xuất CSV chi tiết một học viên
[**getClass**](ClassesApi.md#getclass) | **GET** /classes/{id} | Chi tiết cấu trúc lớp (không có dữ liệu học); lớp lưu trữ vẫn xem được
[**getClassDashboard**](ClassesApi.md#getclassdashboard) | **GET** /classes/{id}/dashboard | Bảng điều khiển lớp (số liệu kể từ ngày vào lớp của từng học viên)
[**getClassLearnerDetail**](ClassesApi.md#getclasslearnerdetail) | **GET** /classes/{id}/members/{userId}/detail | Chi tiết một học viên - KHÔNG có từng câu trả lời
[**getClassPath**](ClassesApi.md#getclasspath) | **GET** /classes/{id}/path | Lộ trình lớp (&#x60;path&#x60; là null khi chưa đặt)
[**getClassPlacementRequest**](ClassesApi.md#getclassplacementrequest) | **GET** /classes/{id}/placement-requests/current | Kết quả kiểm tra trình độ của lớp (không tự đổi lộ trình lớp)
[**getClassRoster**](ClassesApi.md#getclassroster) | **GET** /classes/{id}/roster | Danh sách học viên theo trạng thái (đã vào, chờ, từ chối, tự chuyển cá nhân, bị gỡ)
[**getClassWeakTopics**](ClassesApi.md#getclassweaktopics) | **GET** /classes/{id}/weak-topics | Điểm yếu chung của lớp (mức yếu giảm dần)
[**getJoinCode**](ClassesApi.md#getjoincode) | **GET** /classes/{id}/join-code | Xem mã tham gia (chỉ người quản lý lớp)
[**importClassLearnersCsv**](ClassesApi.md#importclasslearnerscsv) | **POST** /classes/{id}/invitations/import | Nhập danh sách học viên từ CSV - đúng một kết quả cho mỗi dòng dữ liệu
[**inviteClassLearners**](ClassesApi.md#inviteclasslearners) | **POST** /classes/{id}/invitations | Mời học viên bằng email (≤ 50 mỗi lần) - mỗi lời mời giữ chỗ một seat
[**listClassPauses**](ClassesApi.md#listclasspauses) | **GET** /classes/{id}/pauses | Các khoảng tạm dừng (cả lớp và từng học viên)
[**listClasses**](ClassesApi.md#listclasses) | **GET** /classes | Danh sách lớp (giáo viên - lớp mình phụ trách; chủ tổ chức - mọi lớp)
[**moveClassMember**](ClassesApi.md#moveclassmember) | **POST** /classes/{id}/members/{userId}/move | Mời học viên chuyển sang lớp khác trong cùng tổ chức (học viên PHẢI đồng ý lại; khi đồng ý giữ seat, tiến độ, lịch ôn)
[**putClassPath**](ClassesApi.md#putclasspath) | **PUT** /classes/{id}/path | Tạo/sửa lộ trình lớp theo mẫu (không có thao tác xóa)
[**putClassPathUnits**](ClassesApi.md#putclasspathunits) | **PUT** /classes/{id}/path/units | Chọn bài, thứ tự và ngày mở (&#x60;units&#x60; rỗng quay lại chế độ mẫu)
[**putLearnerOverride**](ClassesApi.md#putlearneroverride) | **PUT** /classes/{id}/members/{userId}/override | Ghi đè riêng một học viên (phút mỗi ngày, dời mốc)
[**removeClassMember**](ClassesApi.md#removeclassmember) | **DELETE** /classes/{id}/members/{userId} | Gỡ học viên khỏi lớp, giải phóng seat
[**rotateJoinCode**](ClassesApi.md#rotatejoincode) | **POST** /classes/{id}/join-code/rotate | Đổi mã tham gia (mã cũ vô hiệu ngay)
[**setClassTeachers**](ClassesApi.md#setclassteachers) | **PUT** /classes/{id}/teachers | Đặt danh sách giáo viên phụ trách (chủ tổ chức; luôn ≥ 1)
[**setJoinCode**](ClassesApi.md#setjoincode) | **PUT** /classes/{id}/join-code | Bật/tắt mã tham gia (bật lần đầu sinh mã), đặt hạn tùy chọn
[**unexemptLearnerUnit**](ClassesApi.md#unexemptlearnerunit) | **DELETE** /classes/{id}/members/{userId}/exemptions/{unitId} | Bỏ miễn đơn vị cho học viên
[**updateClass**](ClassesApi.md#updateclass) | **PATCH** /classes/{id} | Sửa tên, mô tả, ngưỡng vắng mặt


# **archiveClass**
> ArchiveClass200Response archiveClass(id, leaveMyClassRequest)

Lưu trữ lớp (một chiều) - đóng mọi thành viên, vô hiệu mã và lời mời chờ

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getClassesApi();
final String id = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 
final LeaveMyClassRequest leaveMyClassRequest = ; // LeaveMyClassRequest | 

try {
    final response = api.archiveClass(id, leaveMyClassRequest);
    print(response);
} on DioException catch (e) {
    print('Exception when calling ClassesApi->archiveClass: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 
 **leaveMyClassRequest** | [**LeaveMyClassRequest**](LeaveMyClassRequest.md)|  | 

### Return type

[**ArchiveClass200Response**](ArchiveClass200Response.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **cancelClassAssignment**
> cancelClassAssignment(id, assignmentId)

Hủy bài giao

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getClassesApi();
final String id = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 
final String assignmentId = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 

try {
    api.cancelClassAssignment(id, assignmentId);
} on DioException catch (e) {
    print('Exception when calling ClassesApi->cancelClassAssignment: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 
 **assignmentId** | **String**|  | 

### Return type

void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **closeClassPlacementRequest**
> closeClassPlacementRequest(id)

Đóng yêu cầu kiểm tra trình độ

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getClassesApi();
final String id = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 

try {
    api.closeClassPlacementRequest(id);
} on DioException catch (e) {
    print('Exception when calling ClassesApi->closeClassPlacementRequest: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 

### Return type

void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **createClass**
> ClassDetail createClass(createClassRequest)

Tạo lớp (giáo viên tự là phụ trách; `teacherIds` chỉ chủ tổ chức)

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getClassesApi();
final CreateClassRequest createClassRequest = ; // CreateClassRequest | 

try {
    final response = api.createClass(createClassRequest);
    print(response);
} on DioException catch (e) {
    print('Exception when calling ClassesApi->createClass: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **createClassRequest** | [**CreateClassRequest**](CreateClassRequest.md)|  | 

### Return type

[**ClassDetail**](ClassDetail.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **createClassAssignments**
> CreateClassAssignments201Response createClassAssignments(id, createClassAssignmentsRequest)

Giao bài (1-20 đơn vị, một hạn)

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getClassesApi();
final String id = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 
final CreateClassAssignmentsRequest createClassAssignmentsRequest = ; // CreateClassAssignmentsRequest | 

try {
    final response = api.createClassAssignments(id, createClassAssignmentsRequest);
    print(response);
} on DioException catch (e) {
    print('Exception when calling ClassesApi->createClassAssignments: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 
 **createClassAssignmentsRequest** | [**CreateClassAssignmentsRequest**](CreateClassAssignmentsRequest.md)|  | 

### Return type

[**CreateClassAssignments201Response**](CreateClassAssignments201Response.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **createClassPause**
> ClassPause createClassPause(id, createClassPauseRequest)

Tạm dừng cả lớp (vắng `userId`) hoặc một học viên

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getClassesApi();
final String id = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 
final CreateClassPauseRequest createClassPauseRequest = ; // CreateClassPauseRequest | 

try {
    final response = api.createClassPause(id, createClassPauseRequest);
    print(response);
} on DioException catch (e) {
    print('Exception when calling ClassesApi->createClassPause: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 
 **createClassPauseRequest** | [**CreateClassPauseRequest**](CreateClassPauseRequest.md)|  | 

### Return type

[**ClassPause**](ClassPause.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **createClassPlacementRequest**
> ClassPlacementRequest createClassPlacementRequest(id)

Yêu cầu cả lớp làm bài kiểm tra trình độ

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getClassesApi();
final String id = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 

try {
    final response = api.createClassPlacementRequest(id);
    print(response);
} on DioException catch (e) {
    print('Exception when calling ClassesApi->createClassPlacementRequest: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 

### Return type

[**ClassPlacementRequest**](ClassPlacementRequest.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **endClassPause**
> ClassPause endClassPause(id, pauseId, endClassPauseRequest)

Kết thúc khoảng tạm dừng (mặc định hôm nay)

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getClassesApi();
final String id = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 
final String pauseId = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 
final EndClassPauseRequest endClassPauseRequest = ; // EndClassPauseRequest | 

try {
    final response = api.endClassPause(id, pauseId, endClassPauseRequest);
    print(response);
} on DioException catch (e) {
    print('Exception when calling ClassesApi->endClassPause: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 
 **pauseId** | **String**|  | 
 **endClassPauseRequest** | [**EndClassPauseRequest**](EndClassPauseRequest.md)|  | [optional] 

### Return type

[**ClassPause**](ClassPause.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **exemptLearnerUnit**
> exemptLearnerUnit(id, userId, unitId)

Miễn một đơn vị cho học viên

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getClassesApi();
final String id = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 
final String userId = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 
final String unitId = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 

try {
    api.exemptLearnerUnit(id, userId, unitId);
} on DioException catch (e) {
    print('Exception when calling ClassesApi->exemptLearnerUnit: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 
 **userId** | **String**|  | 
 **unitId** | **String**|  | 

### Return type

void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **exportClassCsv**
> String exportClassCsv(id)

Xuất báo cáo lớp (CSV có BOM, chống công thức; ghi nhật ký `class.export`)

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getClassesApi();
final String id = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 

try {
    final response = api.exportClassCsv(id);
    print(response);
} on DioException catch (e) {
    print('Exception when calling ClassesApi->exportClassCsv: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 

### Return type

**String**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: text/csv, application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **exportClassLearnerCsv**
> String exportClassLearnerCsv(id, userId)

Xuất CSV chi tiết một học viên

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getClassesApi();
final String id = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 
final String userId = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 

try {
    final response = api.exportClassLearnerCsv(id, userId);
    print(response);
} on DioException catch (e) {
    print('Exception when calling ClassesApi->exportClassLearnerCsv: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 
 **userId** | **String**|  | 

### Return type

**String**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: text/csv, application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getClass**
> ClassDetail getClass(id)

Chi tiết cấu trúc lớp (không có dữ liệu học); lớp lưu trữ vẫn xem được

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getClassesApi();
final String id = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 

try {
    final response = api.getClass(id);
    print(response);
} on DioException catch (e) {
    print('Exception when calling ClassesApi->getClass: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 

### Return type

[**ClassDetail**](ClassDetail.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getClassDashboard**
> ClassDashboard getClassDashboard(id, sort, order, filter)

Bảng điều khiển lớp (số liệu kể từ ngày vào lớp của từng học viên)

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getClassesApi();
final String id = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 
final String sort = sort_example; // String | 
final String order = order_example; // String | 
final String filter = filter_example; // String | 

try {
    final response = api.getClassDashboard(id, sort, order, filter);
    print(response);
} on DioException catch (e) {
    print('Exception when calling ClassesApi->getClassDashboard: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 
 **sort** | **String**|  | [optional] 
 **order** | **String**|  | [optional] 
 **filter** | **String**|  | [optional] 

### Return type

[**ClassDashboard**](ClassDashboard.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getClassLearnerDetail**
> ClassLearnerDetail getClassLearnerDetail(id, userId)

Chi tiết một học viên - KHÔNG có từng câu trả lời

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getClassesApi();
final String id = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 
final String userId = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 

try {
    final response = api.getClassLearnerDetail(id, userId);
    print(response);
} on DioException catch (e) {
    print('Exception when calling ClassesApi->getClassLearnerDetail: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 
 **userId** | **String**|  | 

### Return type

[**ClassLearnerDetail**](ClassLearnerDetail.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getClassPath**
> GetClassPath200Response getClassPath(id)

Lộ trình lớp (`path` là null khi chưa đặt)

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getClassesApi();
final String id = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 

try {
    final response = api.getClassPath(id);
    print(response);
} on DioException catch (e) {
    print('Exception when calling ClassesApi->getClassPath: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 

### Return type

[**GetClassPath200Response**](GetClassPath200Response.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getClassPlacementRequest**
> ClassPlacementResults getClassPlacementRequest(id)

Kết quả kiểm tra trình độ của lớp (không tự đổi lộ trình lớp)

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getClassesApi();
final String id = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 

try {
    final response = api.getClassPlacementRequest(id);
    print(response);
} on DioException catch (e) {
    print('Exception when calling ClassesApi->getClassPlacementRequest: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 

### Return type

[**ClassPlacementResults**](ClassPlacementResults.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getClassRoster**
> List<RosterRow> getClassRoster(id)

Danh sách học viên theo trạng thái (đã vào, chờ, từ chối, tự chuyển cá nhân, bị gỡ)

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getClassesApi();
final String id = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 

try {
    final response = api.getClassRoster(id);
    print(response);
} on DioException catch (e) {
    print('Exception when calling ClassesApi->getClassRoster: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 

### Return type

[**List&lt;RosterRow&gt;**](RosterRow.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getClassWeakTopics**
> List<ClassWeakTopic> getClassWeakTopics(id)

Điểm yếu chung của lớp (mức yếu giảm dần)

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getClassesApi();
final String id = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 

try {
    final response = api.getClassWeakTopics(id);
    print(response);
} on DioException catch (e) {
    print('Exception when calling ClassesApi->getClassWeakTopics: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 

### Return type

[**List&lt;ClassWeakTopic&gt;**](ClassWeakTopic.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getJoinCode**
> JoinCode getJoinCode(id)

Xem mã tham gia (chỉ người quản lý lớp)

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getClassesApi();
final String id = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 

try {
    final response = api.getJoinCode(id);
    print(response);
} on DioException catch (e) {
    print('Exception when calling ClassesApi->getJoinCode: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 

### Return type

[**JoinCode**](JoinCode.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **importClassLearnersCsv**
> ImportResults importClassLearnersCsv(id, body)

Nhập danh sách học viên từ CSV - đúng một kết quả cho mỗi dòng dữ liệu

Thân là nội dung file CSV (`text/csv; charset=utf-8`), ≤ `CSV_IMPORT_MAX_ROWS` dòng và `CSV_IMPORT_MAX_BYTES` byte; sai định dạng/quá cỡ → 422 toàn file. Định dạng: `contracts/csv-formats.md` của spec 004.

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getClassesApi();
final String id = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 
final String body = body_example; // String | 

try {
    final response = api.importClassLearnersCsv(id, body);
    print(response);
} on DioException catch (e) {
    print('Exception when calling ClassesApi->importClassLearnersCsv: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 
 **body** | **String**|  | 

### Return type

[**ImportResults**](ImportResults.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: text/csv
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **inviteClassLearners**
> ImportResults inviteClassLearners(id, inviteClassLearnersRequest)

Mời học viên bằng email (≤ 50 mỗi lần) - mỗi lời mời giữ chỗ một seat

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getClassesApi();
final String id = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 
final InviteClassLearnersRequest inviteClassLearnersRequest = ; // InviteClassLearnersRequest | 

try {
    final response = api.inviteClassLearners(id, inviteClassLearnersRequest);
    print(response);
} on DioException catch (e) {
    print('Exception when calling ClassesApi->inviteClassLearners: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 
 **inviteClassLearnersRequest** | [**InviteClassLearnersRequest**](InviteClassLearnersRequest.md)|  | 

### Return type

[**ImportResults**](ImportResults.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listClassPauses**
> List<ClassPause> listClassPauses(id)

Các khoảng tạm dừng (cả lớp và từng học viên)

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getClassesApi();
final String id = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 

try {
    final response = api.listClassPauses(id);
    print(response);
} on DioException catch (e) {
    print('Exception when calling ClassesApi->listClassPauses: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 

### Return type

[**List&lt;ClassPause&gt;**](ClassPause.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listClasses**
> List<ClassRow> listClasses()

Danh sách lớp (giáo viên - lớp mình phụ trách; chủ tổ chức - mọi lớp)

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getClassesApi();

try {
    final response = api.listClasses();
    print(response);
} on DioException catch (e) {
    print('Exception when calling ClassesApi->listClasses: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**List&lt;ClassRow&gt;**](ClassRow.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **moveClassMember**
> moveClassMember(id, userId, moveClassMemberRequest)

Mời học viên chuyển sang lớp khác trong cùng tổ chức (học viên PHẢI đồng ý lại; khi đồng ý giữ seat, tiến độ, lịch ôn)

Không chuyển ngay (Hiến pháp III): tạo lời mời `student` tới lớp đích gửi cho học viên; chỉ khi học viên chấp nhận qua `POST /invitations/{token}/respond` (`join_class` + `confirmed`) mới đóng thành viên lớp cũ (`moved`) và mở thành viên lớp đích, giữ nguyên seat. Người gọi phải là chủ tổ chức hoặc giáo viên phụ trách cả hai lớp; lớp đích ngoài phạm vi ⇒ 404 chung. 409 `CLASS_FULL`/`CLASS_NOT_READY`/`CLASS_ARCHIVED`.

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getClassesApi();
final String id = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 
final String userId = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 
final MoveClassMemberRequest moveClassMemberRequest = ; // MoveClassMemberRequest | 

try {
    api.moveClassMember(id, userId, moveClassMemberRequest);
} on DioException catch (e) {
    print('Exception when calling ClassesApi->moveClassMember: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 
 **userId** | **String**|  | 
 **moveClassMemberRequest** | [**MoveClassMemberRequest**](MoveClassMemberRequest.md)|  | 

### Return type

void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **putClassPath**
> ClassPath putClassPath(id, classPathTemplate)

Tạo/sửa lộ trình lớp theo mẫu (không có thao tác xóa)

Có hiệu lực từ kế hoạch được sinh kế tiếp; tiến độ và lịch ôn giữ nguyên. Lưu trọn vẹn hoặc không đổi; cảnh báo khả thi không chặn lưu.

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getClassesApi();
final String id = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 
final ClassPathTemplate classPathTemplate = ; // ClassPathTemplate | 

try {
    final response = api.putClassPath(id, classPathTemplate);
    print(response);
} on DioException catch (e) {
    print('Exception when calling ClassesApi->putClassPath: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 
 **classPathTemplate** | [**ClassPathTemplate**](ClassPathTemplate.md)|  | 

### Return type

[**ClassPath**](ClassPath.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **putClassPathUnits**
> ClassPath putClassPathUnits(id, putClassPathUnitsRequest)

Chọn bài, thứ tự và ngày mở (`units` rỗng quay lại chế độ mẫu)

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getClassesApi();
final String id = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 
final PutClassPathUnitsRequest putClassPathUnitsRequest = ; // PutClassPathUnitsRequest | 

try {
    final response = api.putClassPathUnits(id, putClassPathUnitsRequest);
    print(response);
} on DioException catch (e) {
    print('Exception when calling ClassesApi->putClassPathUnits: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 
 **putClassPathUnitsRequest** | [**PutClassPathUnitsRequest**](PutClassPathUnitsRequest.md)|  | 

### Return type

[**ClassPath**](ClassPath.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **putLearnerOverride**
> LearnerOverride putLearnerOverride(id, userId, putLearnerOverrideRequest)

Ghi đè riêng một học viên (phút mỗi ngày, dời mốc)

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getClassesApi();
final String id = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 
final String userId = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 
final PutLearnerOverrideRequest putLearnerOverrideRequest = ; // PutLearnerOverrideRequest | 

try {
    final response = api.putLearnerOverride(id, userId, putLearnerOverrideRequest);
    print(response);
} on DioException catch (e) {
    print('Exception when calling ClassesApi->putLearnerOverride: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 
 **userId** | **String**|  | 
 **putLearnerOverrideRequest** | [**PutLearnerOverrideRequest**](PutLearnerOverrideRequest.md)|  | 

### Return type

[**LearnerOverride**](LearnerOverride.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **removeClassMember**
> removeClassMember(id, userId)

Gỡ học viên khỏi lớp, giải phóng seat

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getClassesApi();
final String id = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 
final String userId = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 

try {
    api.removeClassMember(id, userId);
} on DioException catch (e) {
    print('Exception when calling ClassesApi->removeClassMember: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 
 **userId** | **String**|  | 

### Return type

void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **rotateJoinCode**
> JoinCode rotateJoinCode(id)

Đổi mã tham gia (mã cũ vô hiệu ngay)

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getClassesApi();
final String id = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 

try {
    final response = api.rotateJoinCode(id);
    print(response);
} on DioException catch (e) {
    print('Exception when calling ClassesApi->rotateJoinCode: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 

### Return type

[**JoinCode**](JoinCode.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **setClassTeachers**
> ClassDetail setClassTeachers(id, setClassTeachersRequest)

Đặt danh sách giáo viên phụ trách (chủ tổ chức; luôn ≥ 1)

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getClassesApi();
final String id = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 
final SetClassTeachersRequest setClassTeachersRequest = ; // SetClassTeachersRequest | 

try {
    final response = api.setClassTeachers(id, setClassTeachersRequest);
    print(response);
} on DioException catch (e) {
    print('Exception when calling ClassesApi->setClassTeachers: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 
 **setClassTeachersRequest** | [**SetClassTeachersRequest**](SetClassTeachersRequest.md)|  | 

### Return type

[**ClassDetail**](ClassDetail.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **setJoinCode**
> JoinCode setJoinCode(id, setJoinCodeRequest)

Bật/tắt mã tham gia (bật lần đầu sinh mã), đặt hạn tùy chọn

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getClassesApi();
final String id = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 
final SetJoinCodeRequest setJoinCodeRequest = ; // SetJoinCodeRequest | 

try {
    final response = api.setJoinCode(id, setJoinCodeRequest);
    print(response);
} on DioException catch (e) {
    print('Exception when calling ClassesApi->setJoinCode: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 
 **setJoinCodeRequest** | [**SetJoinCodeRequest**](SetJoinCodeRequest.md)|  | 

### Return type

[**JoinCode**](JoinCode.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **unexemptLearnerUnit**
> unexemptLearnerUnit(id, userId, unitId)

Bỏ miễn đơn vị cho học viên

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getClassesApi();
final String id = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 
final String userId = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 
final String unitId = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 

try {
    api.unexemptLearnerUnit(id, userId, unitId);
} on DioException catch (e) {
    print('Exception when calling ClassesApi->unexemptLearnerUnit: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 
 **userId** | **String**|  | 
 **unitId** | **String**|  | 

### Return type

void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **updateClass**
> ClassDetail updateClass(id, updateClassRequest)

Sửa tên, mô tả, ngưỡng vắng mặt

### Example
```dart
import 'package:japanese_api/api.dart';

final api = JapaneseApi().getClassesApi();
final String id = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 
final UpdateClassRequest updateClassRequest = ; // UpdateClassRequest | 

try {
    final response = api.updateClass(id, updateClassRequest);
    print(response);
} on DioException catch (e) {
    print('Exception when calling ClassesApi->updateClass: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 
 **updateClassRequest** | [**UpdateClassRequest**](UpdateClassRequest.md)|  | 

### Return type

[**ClassDetail**](ClassDetail.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

