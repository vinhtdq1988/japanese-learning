import 'dart:js_interop';
import 'dart:js_interop_unsafe';

import '../platform.dart';

/// Lấy múi giờ IANA từ trình duyệt qua `Intl.DateTimeFormat().resolvedOptions().timeZone`.
class WebTimezone implements Timezone {
  @override
  Future<String?> currentIanaName() async {
    try {
      final intl = globalContext.getProperty<JSObject>('Intl'.toJS);
      final ctor = intl.getProperty<JSFunction>('DateTimeFormat'.toJS);
      final formatter = ctor.callAsConstructor<JSObject>();
      final options = formatter.callMethod<JSObject>('resolvedOptions'.toJS);
      final zone = options.getProperty<JSString?>('timeZone'.toJS)?.toDart;
      return (zone == null || zone.isEmpty) ? null : zone;
    } catch (_) {
      return null;
    }
  }
}
