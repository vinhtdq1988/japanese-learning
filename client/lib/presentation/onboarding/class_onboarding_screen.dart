import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:japanese_api/japanese_api.dart';

import '../../data/account_repository.dart';
import '../../data/api/api_error.dart';
import '../../data/locale_provider.dart';
import '../../l10n/app_localizations.dart';
import '../../router_paths.dart';
import '../shared/error_messages.dart';
import '../shared/page_frame.dart';

/// Onboarding RÚT GỌN cho học viên thuộc lớp (spec 004, US3, FR-021): lộ trình do lớp quyết định nên KHÔNG
/// hỏi mục tiêu, trình độ, thời gian, kỹ năng — chỉ tên hiển thị, ngôn ngữ và múi giờ qua `PATCH /me` (các trường
/// vẫn được phép khi thuộc lớp). `onboarding_state` cá nhân không đổi, nên khi rời lớp học viên chưa từng
/// onboarding sẽ đi qua onboarding cá nhân đầy đủ (FR-037).
class ClassOnboardingScreen extends ConsumerStatefulWidget {
  const ClassOnboardingScreen({super.key, required this.me});

  final Me me;

  @override
  ConsumerState<ClassOnboardingScreen> createState() =>
      _ClassOnboardingScreenState();
}

class _ClassOnboardingScreenState extends ConsumerState<ClassOnboardingScreen> {
  late final TextEditingController _name;
  late final TextEditingController _timezone;
  late String _language;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final profile = widget.me.profile;
    _name = TextEditingController(text: profile?.displayName ?? '');
    _timezone = TextEditingController(text: profile?.timezone ?? '');
    _language =
        profile?.language?.value ?? ref.read(localeProvider).languageCode;
  }

  @override
  void dispose() {
    _name.dispose();
    _timezone.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final name = _name.text.trim();
    final timezone = _timezone.text.trim();
    if (name.isEmpty) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    final locale = ref.read(localeProvider.notifier);
    final previous = ref.read(localeProvider).languageCode;
    locale.setLanguage(_language);
    try {
      await ref
          .read(accountRepositoryProvider)
          .updateProfile(
            displayName: name,
            language: _language,
            timezone: timezone.isEmpty ? null : timezone,
          );
      ref.invalidate(meProvider);
      if (mounted) context.go(AppRoutes.myClass);
    } on ApiError catch (e) {
      locale.setLanguage(previous);
      if (mounted) setState(() => _error = describeError(context, e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return PageFrame(
      title: l10n.classOnboardingTitle,
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 520),
          child: Card(
            key: const Key('class-onboarding'),
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(l10n.classOnboardingIntro),
                  const SizedBox(height: 16),
                  TextField(
                    key: const Key('class-onboarding-name'),
                    controller: _name,
                    decoration: InputDecoration(
                      labelText: l10n.classOnboardingName,
                      border: const OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(l10n.classOnboardingLanguage),
                  const SizedBox(height: 4),
                  SegmentedButton<String>(
                    key: const Key('class-onboarding-language'),
                    showSelectedIcon: false,
                    segments: <ButtonSegment<String>>[
                      ButtonSegment<String>(
                        value: 'vi',
                        label: Text(l10n.profileLanguageVi),
                      ),
                      ButtonSegment<String>(
                        value: 'en',
                        label: Text(l10n.profileLanguageEn),
                      ),
                    ],
                    selected: <String>{_language},
                    onSelectionChanged: (s) =>
                        setState(() => _language = s.first),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    key: const Key('class-onboarding-timezone'),
                    controller: _timezone,
                    decoration: InputDecoration(
                      labelText: l10n.classOnboardingTimezone,
                      border: const OutlineInputBorder(),
                    ),
                  ),
                  if (_error != null) ...<Widget>[
                    const SizedBox(height: 8),
                    Text(
                      _error!,
                      key: const Key('class-onboarding-error'),
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.error,
                      ),
                    ),
                  ],
                  const SizedBox(height: 16),
                  FilledButton(
                    key: const Key('class-onboarding-save'),
                    onPressed: _busy ? null : _save,
                    child: Text(l10n.classOnboardingSave),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
