import '../../l10n/app_localizations.dart';

// Nhãn hiển thị cho các giá trị khai báo trong onboarding, theo ngôn ngữ giao diện.

String levelLabel(AppLocalizations l10n, String level) {
  switch (level) {
    case 'none':
      return l10n.onboardingLevelNone;
    case 'N5':
      return l10n.onboardingLevelN5;
    case 'N4':
      return l10n.onboardingLevelN4;
    case 'N3':
      return l10n.onboardingLevelN3;
    case 'N2':
      return l10n.onboardingLevelN2;
    case 'N1':
      return l10n.onboardingLevelN1;
  }
  return level;
}

String goalLabel(AppLocalizations l10n, String goal) {
  switch (goal) {
    case 'daily_conversation':
      return l10n.onboardingGoalDailyConversation;
    case 'work':
      return l10n.onboardingGoalWork;
    case 'jlpt':
      return l10n.onboardingGoalJlpt;
  }
  return goal;
}

String skillLabel(AppLocalizations l10n, String skill) {
  switch (skill) {
    case 'vocabulary':
      return l10n.onboardingSkillVocabulary;
    case 'grammar':
      return l10n.onboardingSkillGrammar;
    case 'listening':
      return l10n.onboardingSkillListening;
    case 'reading':
      return l10n.onboardingSkillReading;
    case 'kanji':
      return l10n.onboardingSkillKanji;
  }
  return skill;
}
