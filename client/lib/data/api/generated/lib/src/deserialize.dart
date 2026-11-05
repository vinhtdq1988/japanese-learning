import 'package:japanese_api/src/model/admin_action_log.dart';
import 'package:japanese_api/src/model/admin_placement_question.dart';
import 'package:japanese_api/src/model/admin_set_active_placement_set_request.dart';
import 'package:japanese_api/src/model/admin_set_unit_status_request.dart';
import 'package:japanese_api/src/model/admin_set_user_status_request.dart';
import 'package:japanese_api/src/model/admin_topic.dart';
import 'package:japanese_api/src/model/admin_unit.dart';
import 'package:japanese_api/src/model/admin_unit_write.dart';
import 'package:japanese_api/src/model/admin_unit_write_exercises_inner.dart';
import 'package:japanese_api/src/model/admin_unit_write_items_inner.dart';
import 'package:japanese_api/src/model/admin_user_page.dart';
import 'package:japanese_api/src/model/admin_user_page_items_inner.dart';
import 'package:japanese_api/src/model/answer_result.dart';
import 'package:japanese_api/src/model/answer_submission.dart';
import 'package:japanese_api/src/model/auth_tokens.dart';
import 'package:japanese_api/src/model/change_password_request.dart';
import 'package:japanese_api/src/model/complete_onboarding200_response.dart';
import 'package:japanese_api/src/model/confirm_password_reset_request.dart';
import 'package:japanese_api/src/model/content_item.dart';
import 'package:japanese_api/src/model/content_item_examples_inner.dart';
import 'package:japanese_api/src/model/daily_plan.dart';
import 'package:japanese_api/src/model/daily_plan_kanji_notice.dart';
import 'package:japanese_api/src/model/delete_account200_response.dart';
import 'package:japanese_api/src/model/delete_account_request.dart';
import 'package:japanese_api/src/model/error.dart';
import 'package:japanese_api/src/model/exercise.dart';
import 'package:japanese_api/src/model/i18n_text.dart';
import 'package:japanese_api/src/model/kanji_details.dart';
import 'package:japanese_api/src/model/kanji_details_write.dart';
import 'package:japanese_api/src/model/lesson_session.dart';
import 'package:japanese_api/src/model/lesson_session_answered_inner.dart';
import 'package:japanese_api/src/model/login200_response.dart';
import 'package:japanese_api/src/model/login_request.dart';
import 'package:japanese_api/src/model/master_result.dart';
import 'package:japanese_api/src/model/me.dart';
import 'package:japanese_api/src/model/onboarding_draft.dart';
import 'package:japanese_api/src/model/onboarding_state.dart';
import 'package:japanese_api/src/model/path_detail.dart';
import 'package:japanese_api/src/model/path_detail_all_of_items.dart';
import 'package:japanese_api/src/model/path_summary.dart';
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
import 'package:japanese_api/src/model/rebuild_path_request.dart';
import 'package:japanese_api/src/model/record_study_interval_request.dart';
import 'package:japanese_api/src/model/record_trial_event_request.dart';
import 'package:japanese_api/src/model/refresh_token_request.dart';
import 'package:japanese_api/src/model/register_request.dart';
import 'package:japanese_api/src/model/request_password_reset_request.dart';
import 'package:japanese_api/src/model/session_summary.dart';
import 'package:japanese_api/src/model/session_summary_attention_items_inner.dart';
import 'package:japanese_api/src/model/set_item_mastered200_response.dart';
import 'package:japanese_api/src/model/set_unit_mastered_request.dart';
import 'package:japanese_api/src/model/start_session_request.dart';
import 'package:japanese_api/src/model/trial_content.dart';
import 'package:japanese_api/src/model/trial_content_units_inner.dart';
import 'package:japanese_api/src/model/trial_content_units_inner_exercises_inner.dart';
import 'package:japanese_api/src/model/trial_content_units_inner_exercises_inner_all_of_answer_key.dart';

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
    case 'AdminActionLog':
      return AdminActionLog.fromJson(value as Map<String, dynamic>)
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
    case 'AuthTokens':
      return AuthTokens.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'ChangePasswordRequest':
      return ChangePasswordRequest.fromJson(value as Map<String, dynamic>)
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
    case 'Error':
      return Error.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'Exercise':
      return Exercise.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'GoalType':
    case 'I18nText':
      return I18nText.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'KanjiDetails':
      return KanjiDetails.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'KanjiDetailsWrite':
      return KanjiDetailsWrite.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'Lang':
    case 'LessonSession':
      return LessonSession.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'LessonSessionAnsweredInner':
      return LessonSessionAnsweredInner.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'Level':
    case 'Login200Response':
      return Login200Response.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'LoginRequest':
      return LoginRequest.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'MasterResult':
      return MasterResult.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'Me':
      return Me.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'OnboardingDraft':
      return OnboardingDraft.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'OnboardingState':
      return OnboardingState.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'PathDetail':
      return PathDetail.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'PathDetailAllOfItems':
      return PathDetailAllOfItems.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'PathSummary':
      return PathSummary.fromJson(value as Map<String, dynamic>) as ReturnType;
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
    case 'ScopeNotice':
    case 'SessionSummary':
      return SessionSummary.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'SessionSummaryAttentionItemsInner':
      return SessionSummaryAttentionItemsInner.fromJson(
            value as Map<String, dynamic>,
          )
          as ReturnType;
    case 'SetItemMastered200Response':
      return SetItemMastered200Response.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'SetUnitMasteredRequest':
      return SetUnitMasteredRequest.fromJson(value as Map<String, dynamic>)
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
