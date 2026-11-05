import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:japanese_api/japanese_api.dart';

import '../../data/account_repository.dart';
import '../../data/auth_repository.dart';
import '../../data/locale_provider.dart';
import '../../l10n/app_localizations.dart';
import '../../router_paths.dart';
import '../auth/auth_support.dart' show AuthValidators;
import '../path/plan_adjust_screen.dart' show invalidatePlanViews;
import '../shared/page_frame.dart';
import '../shared/state_views.dart';
import 'account_security_sections.dart';
import 'profile_support.dart';

/// Màn hình Hồ sơ (T113, FR-002, FR-003, FR-019a): sửa tên hiển thị, chọn ngôn ngữ vi/en (áp dụng ngay
/// cho giao diện), đổi email và mật khẩu (cần mật khẩu hiện tại), đăng xuất và xóa tài khoản. Mục tiêu,
/// thời gian mỗi ngày và kỹ năng ưu tiên nằm ở màn hình "Điều chỉnh kế hoạch" (T094) và được dẫn liên kết tới.
class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final me = ref.watch(meProvider);
    return PageFrame(
      title: l10n.navProfile,
      child: me.when(
        loading: () => const LoadingView(),
        error: (Object error, StackTrace _) =>
            ErrorView(error: error, onRetry: () => ref.invalidate(meProvider)),
        data: (Me data) => _ProfileBody(initial: data),
      ),
    );
  }
}

class _ProfileBody extends StatefulWidget {
  const _ProfileBody({required this.initial});

  final Me initial;

  @override
  State<_ProfileBody> createState() => _ProfileBodyState();
}

class _ProfileBodyState extends State<_ProfileBody> {
  late Me _me = widget.initial;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          _InfoSection(me: _me, onChanged: (me) => setState(() => _me = me)),
          _LanguageSection(
            current: _me.profile?.language?.value,
            onChanged: (me) => setState(() => _me = me),
          ),
          const _PlanSection(),
          ChangeEmailSection(onChanged: (me) => setState(() => _me = me)),
          const ChangePasswordSection(),
          const _SignOutSection(),
          const DeleteAccountSection(),
        ],
      ),
    );
  }
}

/// Email hiện tại và tên hiển thị.
class _InfoSection extends ConsumerStatefulWidget {
  const _InfoSection({required this.me, required this.onChanged});

  final Me me;
  final ValueChanged<Me> onChanged;

  @override
  ConsumerState<_InfoSection> createState() => _InfoSectionState();
}

class _InfoSectionState extends ConsumerState<_InfoSection> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name = TextEditingController(
    text: widget.me.profile?.displayName ?? '',
  );
  bool _busy = false;
  AccountFormError? _error;
  bool _done = false;

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _error = null;
      _done = false;
    });
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _busy = true);
    try {
      final me = await ref
          .read(accountRepositoryProvider)
          .updateProfile(displayName: _name.text.trim());
      if (!mounted) return;
      setState(() => _done = true);
      widget.onChanged(me);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = mapAccountError(context, e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final fields = _error?.fieldErrors ?? const <String, String>{};
    return ProfileSection(
      title: l10n.profileSectionInfo,
      help: l10n.profileEmailCurrent(widget.me.email ?? ''),
      children: <Widget>[
        Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              TextFormField(
                key: const Key('profile-display-name'),
                controller: _name,
                decoration: InputDecoration(
                  labelText: l10n.profileDisplayNameLabel,
                  errorText: fields['displayName'],
                ),
                validator: (v) => AuthValidators.displayName(l10n, v),
                onFieldSubmitted: (_) => _submit(),
              ),
              const SizedBox(height: 16),
              Align(
                alignment: Alignment.centerLeft,
                child: FilledButton(
                  key: const Key('profile-save-info'),
                  onPressed: _busy ? null : _submit,
                  child: Text(l10n.actionSave),
                ),
              ),
              if (_error?.banner != null)
                StatusLine(message: _error!.banner!, isError: true),
              if (_done) StatusLine(message: l10n.profileSaved),
            ],
          ),
        ),
      ],
    );
  }
}

/// Chọn ngôn ngữ vi/en: giao diện đổi NGAY, rồi lưu vào hồ sơ; lưu lỗi thì trả về ngôn ngữ cũ.
class _LanguageSection extends ConsumerStatefulWidget {
  const _LanguageSection({required this.current, required this.onChanged});

  final String? current;
  final ValueChanged<Me> onChanged;

  @override
  ConsumerState<_LanguageSection> createState() => _LanguageSectionState();
}

class _LanguageSectionState extends ConsumerState<_LanguageSection> {
  bool _busy = false;
  AccountFormError? _error;
  bool _done = false;

  Future<void> _select(String code) async {
    final locale = ref.read(localeProvider.notifier);
    final previous = ref.read(localeProvider).languageCode;
    if (code == previous) return;
    locale.setLanguage(code);
    setState(() {
      _busy = true;
      _error = null;
      _done = false;
    });
    try {
      final me = await ref
          .read(accountRepositoryProvider)
          .updateProfile(language: code);
      if (!mounted) return;
      // Nội dung bản địa hóa (kế hoạch, lộ trình, tiến độ) phải được tải lại bằng ngôn ngữ mới.
      invalidatePlanViews(ref);
      setState(() => _done = true);
      widget.onChanged(me);
    } catch (e) {
      locale.setLanguage(previous);
      if (!mounted) return;
      setState(() => _error = mapAccountError(context, e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final selected = ref.watch(localeProvider).languageCode;
    return ProfileSection(
      title: l10n.profileSectionLanguage,
      help: l10n.profileLanguageHelp,
      children: <Widget>[
        Align(
          alignment: Alignment.centerLeft,
          child: SegmentedButton<String>(
            key: const Key('profile-language'),
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
            selected: <String>{selected},
            onSelectionChanged: _busy
                ? null
                : (Set<String> value) => _select(value.first),
          ),
        ),
        if (_error?.banner != null)
          StatusLine(message: _error!.banner!, isError: true),
        if (_done) StatusLine(message: l10n.profileLanguageSaved),
      ],
    );
  }
}

/// Lối tắt tới màn hình điều chỉnh kế hoạch (mục tiêu, thời gian mỗi ngày, kỹ năng ưu tiên).
class _PlanSection extends StatelessWidget {
  const _PlanSection();

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return ProfileSection(
      title: l10n.profileSectionPlan,
      help: l10n.profilePlanHelp,
      children: <Widget>[
        Align(
          alignment: Alignment.centerLeft,
          child: OutlinedButton(
            key: const Key('profile-open-plan'),
            onPressed: () => context.go(AppRoutes.pathAdjust),
            child: Text(l10n.profilePlanAction),
          ),
        ),
      ],
    );
  }
}

class _SignOutSection extends ConsumerWidget {
  const _SignOutSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Align(
        alignment: Alignment.centerLeft,
        child: OutlinedButton.icon(
          key: const Key('profile-sign-out'),
          icon: const Icon(Icons.logout),
          onPressed: () => ref.read(authRepositoryProvider).signOut(),
          label: Text(l10n.actionSignOut),
        ),
      ),
    );
  }
}
