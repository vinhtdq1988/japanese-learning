import 'package:web/web.dart' as web;

import '../platform.dart';

/// Mở liên kết ngoài trong tab mới; `noopener` để trang đích không truy cập được `window.opener`.
class WebLinks implements Links {
  @override
  Future<void> open(Uri uri) async {
    web.window.open(uri.toString(), '_blank', 'noopener,noreferrer');
  }
}
