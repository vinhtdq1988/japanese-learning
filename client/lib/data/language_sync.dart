import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'account_repository.dart';
import 'locale_provider.dart';
import 'session_controller.dart';

/// Đồng bộ ngôn ngữ giao diện với ngôn ngữ đã lưu trong hồ sơ (FR-019a): khi đăng nhập, mở lại ứng dụng
/// với token đã lưu, hoặc vừa khôi phục tài khoản, giao diện chuyển sang `profile.language` để khớp với
/// nội dung server trả về. Làm mới token không kích hoạt lại. Lỗi (mất mạng…) được bỏ qua: giao diện giữ
/// ngôn ngữ hiện tại.
final languageSyncProvider = Provider<void>((ref) {
  ref.listen<SessionState>(sessionProvider, (previous, next) async {
    final session = next.session;
    if (session == null || session.isPendingDeletion) return;
    final before = previous?.session;
    if (before != null &&
        before.userId == session.userId &&
        before.status == session.status) {
      return;
    }
    try {
      final me = await ref.read(accountRepositoryProvider).me();
      final language = me.profile?.language?.value;
      if (language != null) {
        ref.read(localeProvider.notifier).setLanguage(language);
      }
    } catch (_) {
      // Giữ ngôn ngữ giao diện hiện tại.
    }
  });
});
