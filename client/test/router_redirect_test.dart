import 'package:flutter_test/flutter_test.dart';
import 'package:japanese_learning_client/data/session_controller.dart';
import 'package:japanese_learning_client/domain/auth_session.dart';
import 'package:japanese_learning_client/router.dart';

const SessionState _loading = SessionState.loading();
const SessionState _signedOut = SessionState.signedOut();
const SessionState _learner = SessionState.signedIn(
  AuthSession(
    userId: 'u',
    role: UserRole.learner,
    status: AccountStatus.active,
  ),
);
const SessionState _admin = SessionState.signedIn(
  AuthSession(userId: 'a', role: UserRole.admin, status: AccountStatus.active),
);
const SessionState _pendingDeletion = SessionState.signedIn(
  AuthSession(
    userId: 'u',
    role: UserRole.learner,
    status: AccountStatus.pendingDeletion,
  ),
);

String? _redirect(SessionState session, String location) =>
    resolveRedirect(session: session, location: location);

void main() {
  group('guard điều hướng (resolveRedirect)', () {
    test(
      'đang đọc token → về màn hình khởi động, rồi chuyển theo trạng thái',
      () {
        expect(_redirect(_loading, '/today'), AppRoutes.splash);
        expect(_redirect(_loading, AppRoutes.splash), isNull);
        expect(_redirect(_signedOut, AppRoutes.splash), AppRoutes.landing);
        expect(_redirect(_learner, AppRoutes.splash), AppRoutes.today);
        expect(
          _redirect(_pendingDeletion, AppRoutes.splash),
          AppRoutes.restoreAccount,
        );
      },
    );

    test('khách vào được route công khai và dùng thử', () {
      for (final path in <String>[
        '/',
        '/login',
        '/register',
        '/forgot-password',
        '/reset-password?token=abc',
        '/trial',
        '/trial/lesson',
        '/trial/placement',
      ]) {
        expect(_redirect(_signedOut, path), isNull, reason: path);
      }
    });

    test(
      'khách vào route cần tài khoản → về đăng nhập và nhớ nơi định đến',
      () {
        expect(_redirect(_signedOut, '/today'), '/login?from=%2Ftoday');
        expect(
          _redirect(_signedOut, '/admin/units'),
          '/login?from=%2Fadmin%2Funits',
        );
        expect(_redirect(_signedOut, '/progress'), startsWith(AppRoutes.login));
        expect(
          _redirect(_signedOut, '/onboarding'),
          startsWith(AppRoutes.login),
        );
      },
    );

    test('người học đã đăng nhập vào trang dành cho khách → về Hôm nay', () {
      expect(_redirect(_learner, '/login'), AppRoutes.today);
      expect(_redirect(_learner, '/register'), AppRoutes.today);
      expect(_redirect(_learner, '/forgot-password'), AppRoutes.today);
      expect(_redirect(_learner, '/today'), isNull);
      expect(_redirect(_learner, '/trial'), isNull);
    });

    test(
      'đã đăng nhập vào trang khách có ?from hợp lệ → về đúng đích (lời mời tổ chức)',
      () {
        expect(
          _redirect(_learner, '/login?from=%2Finvite%2Ftok-1'),
          '/invite/tok-1',
        );
        expect(
          _redirect(_learner, '/register?from=%2Fprogress'),
          AppRoutes.progress,
        );
        // Đích không an toàn hoặc vòng chuyển hướng → rơi về "Hôm nay".
        for (final from in <String>[
          'https%3A%2F%2Fevil.example',
          '%2F%2Fevil.example',
          '%2Flogin',
          '%2Fsplash',
          '',
        ]) {
          expect(
            _redirect(_learner, '/login?from=$from'),
            AppRoutes.today,
            reason: from,
          );
        }
      },
    );

    test(
      'liên kết lời mời: khách bị đưa tới đăng nhập kèm đích, người đã đăng nhập vào thẳng',
      () {
        expect(
          _redirect(_signedOut, '/invite/tok-1'),
          '/login?from=%2Finvite%2Ftok-1',
        );
        expect(_redirect(_learner, '/invite/tok-1'), isNull);
        expect(_redirect(_learner, AppRoutes.org), isNull);
      },
    );

    test('/admin/organizations chỉ dành cho admin', () {
      expect(
        _redirect(_learner, AppRoutes.adminOrganizations),
        AppRoutes.today,
      );
      expect(_redirect(_admin, AppRoutes.adminOrganizations), isNull);
    });

    test('người học thường bị chặn khỏi /admin, admin thì vào được', () {
      expect(_redirect(_learner, '/admin'), AppRoutes.today);
      expect(_redirect(_learner, '/admin/units'), AppRoutes.today);
      expect(_redirect(_admin, '/admin'), isNull);
      expect(_redirect(_admin, '/admin/units'), isNull);
      // Không nhầm với route khác bắt đầu bằng "admin".
      expect(_redirect(_learner, '/administrator-guide'), isNull);
    });

    test('tài khoản chờ xóa chỉ được ở màn hình khôi phục', () {
      expect(_redirect(_pendingDeletion, '/today'), AppRoutes.restoreAccount);
      expect(_redirect(_pendingDeletion, '/trial'), AppRoutes.restoreAccount);
      expect(_redirect(_pendingDeletion, AppRoutes.restoreAccount), isNull);
    });

    test('người dùng bình thường không vào màn hình khôi phục tài khoản', () {
      expect(_redirect(_learner, AppRoutes.restoreAccount), AppRoutes.today);
    });
  });
}
