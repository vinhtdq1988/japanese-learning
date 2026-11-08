import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:japanese_learning_client/data/api/api_error.dart';
import 'package:japanese_learning_client/l10n/app_localizations.dart';
import 'package:japanese_learning_client/presentation/shared/error_messages.dart';

// Thông báo lỗi tổ chức/lớp có đủ tiếng Việt và tiếng Anh (spec 004, T133, FR-042): mỗi mã lỗi mới ánh xạ tới một
// chuỗi riêng (không rơi vào thông báo chung) ở CẢ HAI ngôn ngữ, và khác nhau giữa hai ngôn ngữ.

ApiError _error(String code, int status) => ApiError.fromDio(
  DioException(
    requestOptions: RequestOptions(path: '/x'),
    response: Response<Object?>(
      requestOptions: RequestOptions(path: '/x'),
      statusCode: status,
      data: <String, Object?>{'code': code, 'message': 'x'},
    ),
    type: DioExceptionType.badResponse,
  ),
);

Future<String> _describe(
  WidgetTester tester,
  Locale locale,
  ApiError error,
) async {
  late String message;
  await tester.pumpWidget(
    MaterialApp(
      locale: locale,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Builder(
        builder: (BuildContext context) {
          message = describeError(context, error);
          return const SizedBox.shrink();
        },
      ),
    ),
  );
  return message;
}

void main() {
  const codes = <String, int>{
    'CLASS_MANAGED': 409,
    'SEAT_UNAVAILABLE': 409,
    'SEAT_REASSIGN_LIMIT': 422,
    'SEAT_BELOW_USAGE': 422,
    'CLASS_NOT_READY': 409,
    'CLASS_FULL': 409,
    'CLASS_ARCHIVED': 409,
    'LAST_TEACHER': 409,
    'ALREADY_IN_CLASS': 409,
    'INVITEE_UNAVAILABLE': 409,
  };

  testWidgets('mỗi mã lỗi tổ chức/lớp có thông báo riêng ở cả vi và en', (
    tester,
  ) async {
    final generic = <String, String>{
      'vi': await _describe(
        tester,
        const Locale('vi'),
        _error('INTERNAL_ERROR', 500),
      ),
      'en': await _describe(
        tester,
        const Locale('en'),
        _error('INTERNAL_ERROR', 500),
      ),
    };
    for (final entry in codes.entries) {
      final vi = await _describe(
        tester,
        const Locale('vi'),
        _error(entry.key, entry.value),
      );
      final en = await _describe(
        tester,
        const Locale('en'),
        _error(entry.key, entry.value),
      );
      expect(vi, isNotEmpty, reason: entry.key);
      expect(en, isNotEmpty, reason: entry.key);
      expect(
        vi,
        isNot(generic['vi']),
        reason: '${entry.key} rơi vào lỗi chung',
      );
      expect(
        en,
        isNot(generic['en']),
        reason: '${entry.key} rơi vào lỗi chung',
      );
      expect(vi, isNot(en), reason: '${entry.key} chưa dịch');
    }
  });

  testWidgets('TOO_MANY_REQUESTS (429) nêu số giây chờ ở cả vi và en', (
    tester,
  ) async {
    final error = ApiError.fromDio(
      DioException(
        requestOptions: RequestOptions(path: '/x'),
        response: Response<Object?>(
          requestOptions: RequestOptions(path: '/x'),
          statusCode: 429,
          headers: Headers.fromMap(<String, List<String>>{
            'retry-after': <String>['900'],
          }),
          data: <String, Object?>{'code': 'TOO_MANY_REQUESTS', 'message': 'x'},
        ),
        type: DioExceptionType.badResponse,
      ),
    );
    final vi = await _describe(tester, const Locale('vi'), error);
    final en = await _describe(tester, const Locale('en'), error);
    expect(vi, contains('900'));
    expect(en, contains('900'));
    expect(vi, isNot(en));
  });
}
