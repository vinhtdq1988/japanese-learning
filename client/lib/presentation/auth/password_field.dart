import 'package:flutter/material.dart';

import '../../l10n/app_localizations.dart';

/// Ô nhập mật khẩu dùng chung (T146, FR-001…FR-004): mặc định che, có nút mắt để xem tạm.
///
/// Trạng thái "đang hiện" chỉ nằm trong [State] của widget — KHÔNG lưu bền — nên rời màn rồi quay lại
/// luôn trở về che. Bật/tắt dùng cùng [controller] nên nội dung đã gõ không bị mất. Thay thế trực tiếp
/// `TextFormField(obscureText: true)` mật khẩu hiện có (cùng `key`, `controller`, `validator`…).
class PasswordField extends StatefulWidget {
  const PasswordField({
    super.key,
    this.controller,
    this.decoration = const InputDecoration(),
    this.validator,
    this.textInputAction,
    this.onFieldSubmitted,
    this.autofillHints,
  });

  final TextEditingController? controller;

  /// Nhãn/gợi ý của ô; `suffixIcon` luôn bị thay bằng nút xem mật khẩu.
  final InputDecoration decoration;
  final FormFieldValidator<String>? validator;
  final TextInputAction? textInputAction;
  final ValueChanged<String>? onFieldSubmitted;
  final Iterable<String>? autofillHints;

  @override
  State<PasswordField> createState() => _PasswordFieldState();
}

class _PasswordFieldState extends State<PasswordField> {
  bool _visible = false;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final label = _visible ? l10n.authHidePassword : l10n.authShowPassword;
    return TextFormField(
      controller: widget.controller,
      obscureText: !_visible,
      // Khi hiện rõ, tránh gợi ý/tự sửa để mật khẩu không lọt vào từ điển của bàn phím.
      enableSuggestions: !_visible,
      autocorrect: !_visible,
      autofillHints: widget.autofillHints,
      textInputAction: widget.textInputAction,
      onFieldSubmitted: widget.onFieldSubmitted,
      validator: widget.validator,
      decoration: widget.decoration.copyWith(
        suffixIcon: Semantics(
          label: label,
          button: true,
          excludeSemantics: true,
          child: IconButton(
            key: const Key('password-visibility-toggle'),
            tooltip: label,
            icon: Icon(_visible ? Icons.visibility_off : Icons.visibility),
            onPressed: () => setState(() => _visible = !_visible),
          ),
        ),
      ),
    );
  }
}
