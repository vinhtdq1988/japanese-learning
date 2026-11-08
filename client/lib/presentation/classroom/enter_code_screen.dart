import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/api/api_error.dart';
import '../../data/api_providers.dart';
import '../../data/classroom_repository.dart';
import '../../l10n/app_localizations.dart';
import '../../router_paths.dart';
import '../shared/error_messages.dart';
import '../shared/page_frame.dart';
import 'invite_choice_screen.dart';

/// Nhập mã tham gia lớp (spec 004, US2, FR-012): bước 1 xem trước lớp + thông báo dữ liệu chia sẻ, bước 2 là
/// cùng màn hình HAI LỰA CHỌN như khi nhận lời mời. Máy chủ không phân biệt mã sai/tắt/hết hạn (cùng một 404)
/// và khóa tài khoản khi nhập sai nhiều lần (429), nên màn hình chỉ báo "mã không hợp lệ" hoặc "thử lại sau".
class EnterCodeScreen extends ConsumerStatefulWidget {
  const EnterCodeScreen({super.key});

  @override
  ConsumerState<EnterCodeScreen> createState() => _EnterCodeScreenState();
}

class _EnterCodeScreenState extends ConsumerState<EnterCodeScreen> {
  final TextEditingController _controller = TextEditingController();
  ClassPreview? _preview;
  String _code = '';
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _lookup() async {
    final l10n = AppLocalizations.of(context);
    final code = _controller.text.trim();
    if (code.isEmpty) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final preview = await ref
          .read(classroomRepositoryProvider)
          .previewCode(code);
      if (mounted) {
        setState(() {
          _preview = preview;
          _code = code;
        });
      }
    } on ApiError catch (e) {
      if (!mounted) return;
      // 404 chung = mã sai/tắt/hết hạn/lớp lưu trữ; các lỗi khác (429, mạng) dùng thông điệp chung.
      setState(
        () => _error = e.statusCode == 404
            ? l10n.joinCodeInvalid
            : describeError(context, e),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _join() async {
    final l10n = AppLocalizations.of(context);
    setState(() => _busy = true);
    try {
      final result = await ref
          .read(classroomRepositoryProvider)
          .joinWithCode(_code);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            l10n.classChoiceJoined(
              result.class_?.name ?? _preview?.classBrief.name ?? '',
            ),
          ),
        ),
      );
      context.go(AppRoutes.myClass);
    } on ApiError catch (e) {
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (BuildContext dialogContext) => AlertDialog(
          key: const Key('join-error-dialog'),
          content: Text(describeError(dialogContext, e)),
          actions: <Widget>[
            FilledButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: Text(l10n.actionClose),
            ),
          ],
        ),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _stay() async {
    final l10n = AppLocalizations.of(context);
    setState(() => _busy = true);
    try {
      await ref.read(classroomRepositoryProvider).stayPersonalWithCode(_code);
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(l10n.classChoiceStayed)));
      context.go(AppRoutes.today);
    } on ApiError catch (e) {
      if (mounted) setState(() => _error = describeError(context, e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final preview = _preview;
    return PageFrame(
      title: l10n.joinTitle,
      child: preview != null
          ? InviteChoiceView(
              classBrief: preview.classBrief,
              disclosure: preview.disclosure,
              busy: _busy,
              onJoin: _join,
              onStay: _stay,
            )
          : Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 480),
                child: Card(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Text(l10n.joinIntro),
                        const SizedBox(height: 16),
                        TextField(
                          key: const Key('code-field'),
                          controller: _controller,
                          enabled: !_busy,
                          textCapitalization: TextCapitalization.characters,
                          decoration: InputDecoration(
                            labelText: l10n.joinCodeLabel,
                            border: const OutlineInputBorder(),
                          ),
                          onSubmitted: (_) => _lookup(),
                        ),
                        if (_error != null) ...<Widget>[
                          const SizedBox(height: 8),
                          Text(
                            _error!,
                            key: const Key('code-error'),
                            style: TextStyle(
                              color: Theme.of(context).colorScheme.error,
                            ),
                          ),
                        ],
                        const SizedBox(height: 16),
                        FilledButton(
                          key: const Key('code-continue'),
                          onPressed: _busy ? null : _lookup,
                          child: Text(l10n.joinCodeContinue),
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
