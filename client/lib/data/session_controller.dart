import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/auth_session.dart';
import '../platform/platform.dart';
import '../platform/platform_providers.dart';
import 'api/dio_client.dart';

/// Trạng thái đăng nhập của ứng dụng, đầu vào của router (guard) và các màn hình.
class SessionState {
  const SessionState._({required this.isLoading, this.session});

  /// Đang đọc token đã lưu khi khởi động.
  const SessionState.loading() : this._(isLoading: true);

  const SessionState.signedOut() : this._(isLoading: false);

  const SessionState.signedIn(AuthSession session)
    : this._(isLoading: false, session: session);

  final bool isLoading;
  final AuthSession? session;

  bool get isSignedIn => session != null;
}

/// Nắm giữ phiên đăng nhập: khôi phục từ [TokenStore] khi khởi động, cập nhật khi đăng nhập/đăng xuất
/// hoặc khi token được làm mới.
class SessionController extends Notifier<SessionState> {
  @override
  SessionState build() {
    Future<void>(_restore);
    return const SessionState.loading();
  }

  TokenStore get _tokenStore => ref.read(tokenStoreProvider);

  Future<void> _restore() async {
    final tokens = await _tokenStore.read();
    state = _stateFor(tokens);
  }

  /// Lưu token sau khi đăng ký/đăng nhập/khôi phục tài khoản và cập nhật phiên.
  Future<void> signIn({
    required String accessToken,
    required String refreshToken,
  }) async {
    final tokens = StoredTokens(
      accessToken: accessToken,
      refreshToken: refreshToken,
    );
    await _tokenStore.write(tokens);
    state = _stateFor(tokens);
  }

  /// Đọc lại token đã lưu (sau khi interceptor làm mới token) để vai trò/trạng thái luôn mới.
  Future<void> refreshFromStore() async {
    state = _stateFor(await _tokenStore.read());
  }

  /// Xóa token và về trạng thái chưa đăng nhập.
  Future<void> signOut() async {
    await _tokenStore.clear();
    state = const SessionState.signedOut();
  }

  SessionState _stateFor(StoredTokens? tokens) {
    if (tokens == null) return const SessionState.signedOut();
    final session = AuthSession.fromAccessToken(tokens.accessToken);
    return session == null
        ? const SessionState.signedOut()
        : SessionState.signedIn(session);
  }
}

final sessionProvider = NotifierProvider<SessionController, SessionState>(
  SessionController.new,
);

/// [Dio] dùng chung cho toàn ứng dụng; hết phiên (không làm mới được token) tự đăng xuất.
final dioProvider = Provider<Dio>((ref) {
  return createDio(
    tokenStore: ref.watch(tokenStoreProvider),
    onSessionExpired: () => ref.read(sessionProvider.notifier).signOut(),
  );
});
