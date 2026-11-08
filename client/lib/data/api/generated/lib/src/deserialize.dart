import 'package:japanese_api/src/model/achievement_earned.dart';
import 'package:japanese_api/src/model/admin_action_log.dart';
import 'package:japanese_api/src/model/admin_organization_create.dart';
import 'package:japanese_api/src/model/admin_organization_detail.dart';
import 'package:japanese_api/src/model/admin_organization_detail_all_of_seat_holders.dart';
import 'package:japanese_api/src/model/admin_organization_page.dart';
import 'package:japanese_api/src/model/admin_organization_row.dart';
import 'package:japanese_api/src/model/admin_organization_row_license.dart';
import 'package:japanese_api/src/model/admin_organization_row_owners_inner.dart';
import 'package:japanese_api/src/model/admin_placement_question.dart';
import 'package:japanese_api/src/model/admin_set_active_placement_set_request.dart';
import 'package:japanese_api/src/model/admin_set_unit_status_request.dart';
import 'package:japanese_api/src/model/admin_set_user_status_request.dart';
import 'package:japanese_api/src/model/admin_topic.dart';
import 'package:japanese_api/src/model/admin_unit.dart';
import 'package:japanese_api/src/model/admin_unit_write.dart';
import 'package:japanese_api/src/model/admin_unit_write_exercises_inner.dart';
import 'package:japanese_api/src/model/admin_unit_write_items_inner.dart';
import 'package:japanese_api/src/model/admin_update_organization_request.dart';
import 'package:japanese_api/src/model/admin_user_page.dart';
import 'package:japanese_api/src/model/admin_user_page_items_inner.dart';
import 'package:japanese_api/src/model/answer_result.dart';
import 'package:japanese_api/src/model/answer_submission.dart';
import 'package:japanese_api/src/model/archive_class200_response.dart';
import 'package:japanese_api/src/model/auth_tokens.dart';
import 'package:japanese_api/src/model/celebrations.dart';
import 'package:japanese_api/src/model/change_password_request.dart';
import 'package:japanese_api/src/model/class_assignment.dart';
import 'package:japanese_api/src/model/class_brief.dart';
import 'package:japanese_api/src/model/class_brief_teachers_inner.dart';
import 'package:japanese_api/src/model/class_dashboard.dart';
import 'package:japanese_api/src/model/class_dashboard_summary.dart';
import 'package:japanese_api/src/model/class_detail.dart';
import 'package:japanese_api/src/model/class_learner_detail.dart';
import 'package:japanese_api/src/model/class_learner_detail_assignment_states_inner.dart';
import 'package:japanese_api/src/model/class_learner_detail_daily_minutes30_inner.dart';
import 'package:japanese_api/src/model/class_learner_detail_placement.dart';
import 'package:japanese_api/src/model/class_learner_detail_units_inner.dart';
import 'package:japanese_api/src/model/class_learner_detail_weak_topics_inner.dart';
import 'package:japanese_api/src/model/class_learner_row.dart';
import 'package:japanese_api/src/model/class_path.dart';
import 'package:japanese_api/src/model/class_path_template.dart';
import 'package:japanese_api/src/model/class_path_unit.dart';
import 'package:japanese_api/src/model/class_pause.dart';
import 'package:japanese_api/src/model/class_placement_request.dart';
import 'package:japanese_api/src/model/class_placement_results.dart';
import 'package:japanese_api/src/model/class_placement_results_results_inner.dart';
import 'package:japanese_api/src/model/class_row.dart';
import 'package:japanese_api/src/model/class_row_teachers_inner.dart';
import 'package:japanese_api/src/model/class_weak_topic.dart';
import 'package:japanese_api/src/model/complete_onboarding200_response.dart';
import 'package:japanese_api/src/model/confirm_password_reset_request.dart';
import 'package:japanese_api/src/model/content_item.dart';
import 'package:japanese_api/src/model/content_item_examples_inner.dart';
import 'package:japanese_api/src/model/content_notice.dart';
import 'package:japanese_api/src/model/create_class_assignments201_response.dart';
import 'package:japanese_api/src/model/create_class_assignments_request.dart';
import 'package:japanese_api/src/model/create_class_pause_request.dart';
import 'package:japanese_api/src/model/create_class_request.dart';
import 'package:japanese_api/src/model/daily_plan.dart';
import 'package:japanese_api/src/model/daily_plan_kanji_notice.dart';
import 'package:japanese_api/src/model/delete_account200_response.dart';
import 'package:japanese_api/src/model/delete_account_request.dart';
import 'package:japanese_api/src/model/end_class_pause_request.dart';
import 'package:japanese_api/src/model/error.dart';
import 'package:japanese_api/src/model/exercise.dart';
import 'package:japanese_api/src/model/get_class_path200_response.dart';
import 'package:japanese_api/src/model/i18n_text.dart';
import 'package:japanese_api/src/model/import_results.dart';
import 'package:japanese_api/src/model/import_results_results_inner.dart';
import 'package:japanese_api/src/model/invitation_preview.dart';
import 'package:japanese_api/src/model/invitation_respond.dart';
import 'package:japanese_api/src/model/invitation_respond_result.dart';
import 'package:japanese_api/src/model/invitation_row.dart';
import 'package:japanese_api/src/model/invite_class_learners_request.dart';
import 'package:japanese_api/src/model/invite_class_learners_request_invitees_inner.dart';
import 'package:japanese_api/src/model/join_by_code.dart';
import 'package:japanese_api/src/model/join_by_code_result.dart';
import 'package:japanese_api/src/model/join_code.dart';
import 'package:japanese_api/src/model/kanji_details.dart';
import 'package:japanese_api/src/model/kanji_details_write.dart';
import 'package:japanese_api/src/model/learner_override.dart';
import 'package:japanese_api/src/model/leave_my_class_request.dart';
import 'package:japanese_api/src/model/lesson_session.dart';
import 'package:japanese_api/src/model/lesson_session_answered_inner.dart';
import 'package:japanese_api/src/model/license_update.dart';
import 'package:japanese_api/src/model/license_write.dart';
import 'package:japanese_api/src/model/login200_response.dart';
import 'package:japanese_api/src/model/login_request.dart';
import 'package:japanese_api/src/model/master_result.dart';
import 'package:japanese_api/src/model/me.dart';
import 'package:japanese_api/src/model/me_class_summary.dart';
import 'package:japanese_api/src/model/me_organization.dart';
import 'package:japanese_api/src/model/me_organization_license.dart';
import 'package:japanese_api/src/model/move_class_member_request.dart';
import 'package:japanese_api/src/model/my_class.dart';
import 'package:japanese_api/src/model/my_class_assignments_inner.dart';
import 'package:japanese_api/src/model/my_class_moved_notice.dart';
import 'package:japanese_api/src/model/my_class_placement_request.dart';
import 'package:japanese_api/src/model/my_class_progress.dart';
import 'package:japanese_api/src/model/onboarding_draft.dart';
import 'package:japanese_api/src/model/onboarding_state.dart';
import 'package:japanese_api/src/model/org_license.dart';
import 'package:japanese_api/src/model/org_overview.dart';
import 'package:japanese_api/src/model/org_overview_license.dart';
import 'package:japanese_api/src/model/org_overview_teachers_inner.dart';
import 'package:japanese_api/src/model/path_detail.dart';
import 'package:japanese_api/src/model/path_detail_all_of_items.dart';
import 'package:japanese_api/src/model/path_summary.dart';
import 'package:japanese_api/src/model/path_warning.dart';
import 'package:japanese_api/src/model/placement_answers.dart';
import 'package:japanese_api/src/model/placement_answers_answers_inner.dart';
import 'package:japanese_api/src/model/placement_question_set.dart';
import 'package:japanese_api/src/model/placement_question_set_questions_inner.dart';
import 'package:japanese_api/src/model/placement_result.dart';
import 'package:japanese_api/src/model/plan_item.dart';
import 'package:japanese_api/src/model/profile.dart';
import 'package:japanese_api/src/model/profile_update.dart';
import 'package:japanese_api/src/model/progress_summary.dart';
import 'package:japanese_api/src/model/progress_summary_goal.dart';
import 'package:japanese_api/src/model/progress_summary_kanji.dart';
import 'package:japanese_api/src/model/progress_summary_weak_topics_inner.dart';
import 'package:japanese_api/src/model/put_class_path_units_request.dart';
import 'package:japanese_api/src/model/put_class_path_units_request_units_inner.dart';
import 'package:japanese_api/src/model/put_learner_override_request.dart';
import 'package:japanese_api/src/model/rebuild_path_request.dart';
import 'package:japanese_api/src/model/record_study_interval_request.dart';
import 'package:japanese_api/src/model/record_trial_event_request.dart';
import 'package:japanese_api/src/model/refresh_token_request.dart';
import 'package:japanese_api/src/model/register_request.dart';
import 'package:japanese_api/src/model/request_password_reset_request.dart';
import 'package:japanese_api/src/model/roster_row.dart';
import 'package:japanese_api/src/model/seat_summary.dart';
import 'package:japanese_api/src/model/session_summary.dart';
import 'package:japanese_api/src/model/session_summary_attention_items_inner.dart';
import 'package:japanese_api/src/model/set_class_teachers_request.dart';
import 'package:japanese_api/src/model/set_item_mastered200_response.dart';
import 'package:japanese_api/src/model/set_join_code_request.dart';
import 'package:japanese_api/src/model/set_unit_mastered_request.dart';
import 'package:japanese_api/src/model/shared_data_disclosure.dart';
import 'package:japanese_api/src/model/shared_data_item.dart';
import 'package:japanese_api/src/model/start_session_request.dart';
import 'package:japanese_api/src/model/trial_content.dart';
import 'package:japanese_api/src/model/trial_content_units_inner.dart';
import 'package:japanese_api/src/model/trial_content_units_inner_exercises_inner.dart';
import 'package:japanese_api/src/model/trial_content_units_inner_exercises_inner_all_of_answer_key.dart';
import 'package:japanese_api/src/model/update_class_request.dart';

final _regList = RegExp(r'^List<(.*)>$');
final _regSet = RegExp(r'^Set<(.*)>$');
final _regMap = RegExp(r'^Map<String,(.*)>$');

ReturnType deserialize<ReturnType, BaseType>(
  dynamic value,
  String targetType, {
  bool growable = true,
}) {
  switch (targetType) {
    case 'String':
      return '$value' as ReturnType;
    case 'int':
      return (value is int ? value : int.parse('$value')) as ReturnType;
    case 'bool':
      if (value is bool) {
        return value as ReturnType;
      }
      final valueString = '$value'.toLowerCase();
      return (valueString == 'true' || valueString == '1') as ReturnType;
    case 'double':
      return (value is double ? value : double.parse('$value')) as ReturnType;
    case 'AccountStatus':
    case 'AchievementEarned':
      return AchievementEarned.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'AchievementKind':
    case 'AdminActionLog':
      return AdminActionLog.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'AdminOrganizationCreate':
      return AdminOrganizationCreate.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'AdminOrganizationDetail':
      return AdminOrganizationDetail.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'AdminOrganizationDetailAllOfSeatHolders':
      return AdminOrganizationDetailAllOfSeatHolders.fromJson(
            value as Map<String, dynamic>,
          )
          as ReturnType;
    case 'AdminOrganizationPage':
      return AdminOrganizationPage.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'AdminOrganizationRow':
      return AdminOrganizationRow.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'AdminOrganizationRowLicense':
      return AdminOrganizationRowLicense.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'AdminOrganizationRowOwnersInner':
      return AdminOrganizationRowOwnersInner.fromJson(
            value as Map<String, dynamic>,
          )
          as ReturnType;
    case 'AdminPlacementQuestion':
      return AdminPlacementQuestion.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'AdminSetActivePlacementSetRequest':
      return AdminSetActivePlacementSetRequest.fromJson(
            value as Map<String, dynamic>,
          )
          as ReturnType;
    case 'AdminSetUnitStatusRequest':
      return AdminSetUnitStatusRequest.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'AdminSetUserStatusRequest':
      return AdminSetUserStatusRequest.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'AdminTopic':
      return AdminTopic.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'AdminUnit':
      return AdminUnit.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'AdminUnitWrite':
      return AdminUnitWrite.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'AdminUnitWriteExercisesInner':
      return AdminUnitWriteExercisesInner.fromJson(
            value as Map<String, dynamic>,
          )
          as ReturnType;
    case 'AdminUnitWriteItemsInner':
      return AdminUnitWriteItemsInner.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'AdminUpdateOrganizationRequest':
      return AdminUpdateOrganizationRequest.fromJson(
            value as Map<String, dynamic>,
          )
          as ReturnType;
    case 'AdminUserPage':
      return AdminUserPage.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'AdminUserPageItemsInner':
      return AdminUserPageItemsInner.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'AnswerResult':
      return AnswerResult.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'AnswerSubmission':
      return AnswerSubmission.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ArchiveClass200Response':
      return ArchiveClass200Response.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'AuthTokens':
      return AuthTokens.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'Celebrations':
      return Celebrations.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'ChangePasswordRequest':
      return ChangePasswordRequest.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ClassAlert':
    case 'ClassAssignment':
      return ClassAssignment.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ClassBrief':
      return ClassBrief.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'ClassBriefTeachersInner':
      return ClassBriefTeachersInner.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ClassDashboard':
      return ClassDashboard.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ClassDashboardSummary':
      return ClassDashboardSummary.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ClassDetail':
      return ClassDetail.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'ClassLearnerDetail':
      return ClassLearnerDetail.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ClassLearnerDetailAssignmentStatesInner':
      return ClassLearnerDetailAssignmentStatesInner.fromJson(
            value as Map<String, dynamic>,
          )
          as ReturnType;
    case 'ClassLearnerDetailDailyMinutes30Inner':
      return ClassLearnerDetailDailyMinutes30Inner.fromJson(
            value as Map<String, dynamic>,
          )
          as ReturnType;
    case 'ClassLearnerDetailPlacement':
      return ClassLearnerDetailPlacement.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ClassLearnerDetailUnitsInner':
      return ClassLearnerDetailUnitsInner.fromJson(
            value as Map<String, dynamic>,
          )
          as ReturnType;
    case 'ClassLearnerDetailWeakTopicsInner':
      return ClassLearnerDetailWeakTopicsInner.fromJson(
            value as Map<String, dynamic>,
          )
          as ReturnType;
    case 'ClassLearnerRow':
      return ClassLearnerRow.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ClassPath':
      return ClassPath.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'ClassPathTemplate':
      return ClassPathTemplate.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ClassPathUnit':
      return ClassPathUnit.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ClassPause':
      return ClassPause.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'ClassPlacementRequest':
      return ClassPlacementRequest.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ClassPlacementResults':
      return ClassPlacementResults.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ClassPlacementResultsResultsInner':
      return ClassPlacementResultsResultsInner.fromJson(
            value as Map<String, dynamic>,
          )
          as ReturnType;
    case 'ClassProgressStatus':
    case 'ClassRow':
      return ClassRow.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'ClassRowTeachersInner':
      return ClassRowTeachersInner.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ClassWeakTopic':
      return ClassWeakTopic.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'CompleteOnboarding200Response':
      return CompleteOnboarding200Response.fromJson(
            value as Map<String, dynamic>,
          )
          as ReturnType;
    case 'ConfirmPasswordResetRequest':
      return ConfirmPasswordResetRequest.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ContentItem':
      return ContentItem.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'ContentItemExamplesInner':
      return ContentItemExamplesInner.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ContentLevel':
    case 'ContentNotice':
      return ContentNotice.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'CreateClassAssignments201Response':
      return CreateClassAssignments201Response.fromJson(
            value as Map<String, dynamic>,
          )
          as ReturnType;
    case 'CreateClassAssignmentsRequest':
      return CreateClassAssignmentsRequest.fromJson(
            value as Map<String, dynamic>,
          )
          as ReturnType;
    case 'CreateClassPauseRequest':
      return CreateClassPauseRequest.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'CreateClassRequest':
      return CreateClassRequest.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'DailyPlan':
      return DailyPlan.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'DailyPlanKanjiNotice':
      return DailyPlanKanjiNotice.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'DeleteAccount200Response':
      return DeleteAccount200Response.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'DeleteAccountRequest':
      return DeleteAccountRequest.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'EndClassPauseRequest':
      return EndClassPauseRequest.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'Error':
      return Error.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'Exercise':
      return Exercise.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'GetClassPath200Response':
      return GetClassPath200Response.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'GoalType':
    case 'I18nText':
      return I18nText.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'ImportResults':
      return ImportResults.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ImportResultsResultsInner':
      return ImportResultsResultsInner.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'InvitationPreview':
      return InvitationPreview.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'InvitationRespond':
      return InvitationRespond.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'InvitationRespondResult':
      return InvitationRespondResult.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'InvitationRow':
      return InvitationRow.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'InviteClassLearnersRequest':
      return InviteClassLearnersRequest.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'InviteClassLearnersRequestInviteesInner':
      return InviteClassLearnersRequestInviteesInner.fromJson(
            value as Map<String, dynamic>,
          )
          as ReturnType;
    case 'JoinByCode':
      return JoinByCode.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'JoinByCodeResult':
      return JoinByCodeResult.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'JoinCode':
      return JoinCode.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'KanjiDetails':
      return KanjiDetails.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'KanjiDetailsWrite':
      return KanjiDetailsWrite.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'Lang':
    case 'LearnerOverride':
      return LearnerOverride.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'LeaveMyClassRequest':
      return LeaveMyClassRequest.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'LessonSession':
      return LessonSession.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'LessonSessionAnsweredInner':
      return LessonSessionAnsweredInner.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'Level':
    case 'LicenseState':
    case 'LicenseUpdate':
      return LicenseUpdate.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'LicenseWrite':
      return LicenseWrite.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'Login200Response':
      return Login200Response.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'LoginRequest':
      return LoginRequest.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'MasterResult':
      return MasterResult.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'Me':
      return Me.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'MeClassSummary':
      return MeClassSummary.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'MeOrganization':
      return MeOrganization.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'MeOrganizationLicense':
      return MeOrganizationLicense.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'MoveClassMemberRequest':
      return MoveClassMemberRequest.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'MyClass':
      return MyClass.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'MyClassAssignmentsInner':
      return MyClassAssignmentsInner.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'MyClassMovedNotice':
      return MyClassMovedNotice.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'MyClassPlacementRequest':
      return MyClassPlacementRequest.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'MyClassProgress':
      return MyClassProgress.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'OnboardingDraft':
      return OnboardingDraft.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'OnboardingState':
      return OnboardingState.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'OrgLicense':
      return OrgLicense.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'OrgOverview':
      return OrgOverview.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'OrgOverviewLicense':
      return OrgOverviewLicense.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'OrgOverviewTeachersInner':
      return OrgOverviewTeachersInner.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'OrgStatus':
    case 'PathDetail':
      return PathDetail.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'PathDetailAllOfItems':
      return PathDetailAllOfItems.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'PathSummary':
      return PathSummary.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'PathWarning':
      return PathWarning.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'PlacementAnswers':
      return PlacementAnswers.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'PlacementAnswersAnswersInner':
      return PlacementAnswersAnswersInner.fromJson(
            value as Map<String, dynamic>,
          )
          as ReturnType;
    case 'PlacementQuestionSet':
      return PlacementQuestionSet.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'PlacementQuestionSetQuestionsInner':
      return PlacementQuestionSetQuestionsInner.fromJson(
            value as Map<String, dynamic>,
          )
          as ReturnType;
    case 'PlacementResult':
      return PlacementResult.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'PlanItem':
      return PlanItem.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'Profile':
      return Profile.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'ProfileUpdate':
      return ProfileUpdate.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ProgressSummary':
      return ProgressSummary.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ProgressSummaryGoal':
      return ProgressSummaryGoal.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ProgressSummaryKanji':
      return ProgressSummaryKanji.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ProgressSummaryWeakTopicsInner':
      return ProgressSummaryWeakTopicsInner.fromJson(
            value as Map<String, dynamic>,
          )
          as ReturnType;
    case 'PutClassPathUnitsRequest':
      return PutClassPathUnitsRequest.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'PutClassPathUnitsRequestUnitsInner':
      return PutClassPathUnitsRequestUnitsInner.fromJson(
            value as Map<String, dynamic>,
          )
          as ReturnType;
    case 'PutLearnerOverrideRequest':
      return PutLearnerOverrideRequest.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'RebuildPathRequest':
      return RebuildPathRequest.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'RecordStudyIntervalRequest':
      return RecordStudyIntervalRequest.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'RecordTrialEventRequest':
      return RecordTrialEventRequest.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'RefreshTokenRequest':
      return RefreshTokenRequest.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'RegisterRequest':
      return RegisterRequest.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'RequestPasswordResetRequest':
      return RequestPasswordResetRequest.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ReviewFacet':
    case 'RosterRow':
      return RosterRow.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'ScopeNotice':
    case 'SeatSummary':
      return SeatSummary.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'SessionSummary':
      return SessionSummary.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'SessionSummaryAttentionItemsInner':
      return SessionSummaryAttentionItemsInner.fromJson(
            value as Map<String, dynamic>,
          )
          as ReturnType;
    case 'SetClassTeachersRequest':
      return SetClassTeachersRequest.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'SetItemMastered200Response':
      return SetItemMastered200Response.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'SetJoinCodeRequest':
      return SetJoinCodeRequest.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'SetUnitMasteredRequest':
      return SetUnitMasteredRequest.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'SharedDataDisclosure':
      return SharedDataDisclosure.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'SharedDataItem':
      return SharedDataItem.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'Skill':
    case 'StartSessionRequest':
      return StartSessionRequest.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'TargetLevel':
    case 'TrialContent':
      return TrialContent.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'TrialContentUnitsInner':
      return TrialContentUnitsInner.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'TrialContentUnitsInnerExercisesInner':
      return TrialContentUnitsInnerExercisesInner.fromJson(
            value as Map<String, dynamic>,
          )
          as ReturnType;
    case 'TrialContentUnitsInnerExercisesInnerAllOfAnswerKey':
      return TrialContentUnitsInnerExercisesInnerAllOfAnswerKey.fromJson(
            value as Map<String, dynamic>,
          )
          as ReturnType;
    case 'UpdateClassRequest':
      return UpdateClassRequest.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    default:
      RegExpMatch? match;

      if (value is List && (match = _regList.firstMatch(targetType)) != null) {
        targetType = match![1]!; // ignore: parameter_assignments
        return value
                .map<BaseType>(
                  (dynamic v) => deserialize<BaseType, BaseType>(
                    v,
                    targetType,
                    growable: growable,
                  ),
                )
                .toList(growable: growable)
            as ReturnType;
      }
      if (value is Set && (match = _regSet.firstMatch(targetType)) != null) {
        targetType = match![1]!; // ignore: parameter_assignments
        return value
                .map<BaseType>(
                  (dynamic v) => deserialize<BaseType, BaseType>(
                    v,
                    targetType,
                    growable: growable,
                  ),
                )
                .toSet()
            as ReturnType;
      }
      if (value is Map && (match = _regMap.firstMatch(targetType)) != null) {
        targetType = match![1]!.trim(); // ignore: parameter_assignments
        return Map<String, BaseType>.fromIterables(
              value.keys as Iterable<String>,
              value.values.map(
                (dynamic v) => deserialize<BaseType, BaseType>(
                  v,
                  targetType,
                  growable: growable,
                ),
              ),
            )
            as ReturnType;
      }
      break;
  }
  throw Exception('Cannot deserialize');
}
