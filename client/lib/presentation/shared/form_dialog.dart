import 'package:flutter/material.dart';

import '../../l10n/app_localizations.dart';

/// Mô tả một ô nhập trong [showFormDialog].
class FormFieldSpec {
  const FormFieldSpec({
    required this.name,
    required this.label,
    this.initial = '',
    this.required = false,
    this.number = false,
  });

  /// Khóa của giá trị trong kết quả trả về (cũng dùng làm `Key('form-<name>')` cho kiểm thử).
  final String name;
  final String label;
  final String initial;

  /// Bắt buộc nhập: để trống thì hộp thoại không đóng.
  final bool required;

  /// Bàn phím số.
  final bool number;
}

/// Hộp thoại nhập nhanh vài trường văn bản (tạo tổ chức, mời bằng email, chỉnh giấy phép…). Trả về
/// giá trị đã cắt khoảng trắng theo `name`, hoặc `null` nếu hủy.
Future<Map<String, String>?> showFormDialog(
  BuildContext context, {
  required String title,
  required List<FormFieldSpec> fields,
  String? message,
  String? submitLabel,
}) {
  final l10n = AppLocalizations.of(context);
  final controllers = <String, TextEditingController>{
    for (final f in fields) f.name: TextEditingController(text: f.initial),
  };
  final formKey = GlobalKey<FormState>();
  return showDialog<Map<String, String>>(
    context: context,
    builder: (BuildContext dialogContext) => AlertDialog(
      key: const Key('form-dialog'),
      title: Text(title),
      content: SizedBox(
        width: 440,
        child: Form(
          key: formKey,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                if (message != null) ...<Widget>[
                  Text(message),
                  const SizedBox(height: 12),
                ],
                for (final f in fields)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: TextFormField(
                      key: Key('form-${f.name}'),
                      controller: controllers[f.name],
                      keyboardType: f.number ? TextInputType.number : null,
                      decoration: InputDecoration(
                        labelText: f.label,
                        isDense: true,
                      ),
                      validator: (v) => f.required && (v ?? '').trim().isEmpty
                          ? l10n.fieldRequired
                          : null,
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
      actions: <Widget>[
        TextButton(
          onPressed: () => Navigator.of(dialogContext).pop(),
          child: Text(l10n.actionCancel),
        ),
        FilledButton(
          key: const Key('form-submit'),
          onPressed: () {
            if (!(formKey.currentState?.validate() ?? false)) return;
            Navigator.of(dialogContext).pop(<String, String>{
              for (final e in controllers.entries) e.key: e.value.text.trim(),
            });
          },
          child: Text(submitLabel ?? l10n.actionConfirm),
        ),
      ],
    ),
  ).whenComplete(() {
    // Giải phóng sau khi hộp thoại đã đóng hẳn (hoạt ảnh đóng còn dùng controller).
    Future<void>.delayed(const Duration(milliseconds: 400), () {
      for (final c in controllers.values) {
        c.dispose();
      }
    });
  });
}
