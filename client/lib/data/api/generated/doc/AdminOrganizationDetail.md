# japanese_api.model.AdminOrganizationDetail

## Load the model package
```dart
import 'package:japanese_api/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **String** |  | 
**name** | **String** |  | 
**status** | [**OrgStatus**](OrgStatus.md) |  | 
**owners** | [**List&lt;AdminOrganizationRowOwnersInner&gt;**](AdminOrganizationRowOwnersInner.md) |  | [optional] 
**seats** | [**SeatSummary**](SeatSummary.md) |  | 
**license** | [**AdminOrganizationRowLicense**](AdminOrganizationRowLicense.md) |  | [optional] 
**warnings** | **List&lt;String&gt;** |  | [optional] 
**licenses** | [**List&lt;OrgLicense&gt;**](OrgLicense.md) |  | [optional] 
**seatHolders** | [**List&lt;AdminOrganizationDetailAllOfSeatHolders&gt;**](AdminOrganizationDetailAllOfSeatHolders.md) |  | [optional] 
**classCount** | **int** |  | [optional] 
**pendingInvitations** | [**List&lt;InvitationRow&gt;**](InvitationRow.md) |  | [optional] 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


