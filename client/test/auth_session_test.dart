import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:japanese_learning_client/domain/auth_session.dart';

String _jwt(Map<String, Object?> claims) {
  String part(Object value) =>
      base64Url.encode(utf8.encode(jsonEncode(value))).replaceAll('=', '');
  return '${part(<String, String>{'alg': 'HS256'})}.${part(claims)}.chu-ky';
}

void main() {
  group('AuthSession.fromAccessToken', () {
    test('đọc vai trò, trạng thái và hạn từ payload', () {
      final session = AuthSession.fromAccessToken(
        _jwt(<String, Object?>{
          'sub': 'user-1',
          'role': 'admin',
          'status': 'active',
          'exp': 1767225600,
        }),
      );
      expect(session, isNotNull);
      expect(session!.userId, 'user-1');
      expect(session.isAdmin, isTrue);
      expect(session.status, AccountStatus.active);
      expect(session.expiresAt, DateTime.utc(2026, 1, 1));
    });

    test(
      'mặc định là người học đang hoạt động; nhận biết pending_deletion',
      () {
        final learner = AuthSession.fromAccessToken(
          _jwt(<String, Object?>{'sub': 'u'}),
        );
        expect(learner!.role, UserRole.learner);
        expect(learner.status, AccountStatus.active);
        expect(learner.expiresAt, isNull);

        final pending = AuthSession.fromAccessToken(
          _jwt(<String, Object?>{'sub': 'u', 'status': 'pending_deletion'}),
        );
        expect(pending!.isPendingDeletion, isTrue);
      },
    );

    test('trả null với token sai định dạng', () {
      expect(AuthSession.fromAccessToken('khong-phai-jwt'), isNull);
      expect(AuthSession.fromAccessToken('a.b.c'), isNull);
      expect(
        AuthSession.fromAccessToken(_jwt(<String, Object?>{'role': 'admin'})),
        isNull,
      );
      expect(
        AuthSession.fromAccessToken(_jwt(<String, Object?>{'sub': ''})),
        isNull,
      );
    });
  });
}
