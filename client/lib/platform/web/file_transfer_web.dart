import 'dart:async';
import 'dart:js_interop';
import 'dart:typed_data';

import 'package:web/web.dart' as web;

import '../file_transfer.dart';

/// `FileTransfer` trên API trình duyệt: `<input type="file">` để chọn CSV và thẻ `<a download>` với Blob để
/// tải xuống. Chỉ dùng API trình duyệt trong thư mục `platform/` (Nguyên tắc V).
class WebFileTransfer implements FileTransfer {
  @override
  Future<String?> pickCsv() {
    final completer = Completer<String?>();
    final input = web.HTMLInputElement()
      ..type = 'file'
      ..accept = '.csv,text/csv';

    void finish(String? value) {
      if (!completer.isCompleted) completer.complete(value);
    }

    input.addEventListener(
      'change',
      ((web.Event _) {
        final files = input.files;
        final file = (files != null && files.length > 0) ? files.item(0) : null;
        if (file == null) {
          finish(null);
          return;
        }
        file.text().toDart.then(
          (JSString text) => finish(text.toDart),
          onError: (_) => finish(null),
        );
      }).toJS,
    );
    // Trình duyệt mới phát `cancel` khi người dùng đóng hộp thoại mà không chọn tệp.
    input.addEventListener('cancel', ((web.Event _) => finish(null)).toJS);
    input.click();
    return completer.future;
  }

  @override
  Future<void> saveCsv(String filename, List<int> bytes) async {
    final data = Uint8List.fromList(bytes);
    final blob = web.Blob(
      <JSAny>[data.toJS].toJS,
      web.BlobPropertyBag(type: 'text/csv;charset=utf-8'),
    );
    final url = web.URL.createObjectURL(blob);
    final anchor = web.HTMLAnchorElement()
      ..href = url
      ..download = filename
      ..style.display = 'none';
    web.document.body?.append(anchor);
    anchor.click();
    anchor.remove();
    web.URL.revokeObjectURL(url);
  }
}
