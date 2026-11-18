import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api/api_error.dart';
import 'session_controller.dart';

/// Từ vựng trong thư viện trùng khít một cụm đã tra (`GET /lookup`, OpenAPI 1.16.0).
class LookupWord {
  const LookupWord({
    required this.term,
    required this.reading,
    required this.meaning,
  });

  factory LookupWord.fromJson(Map<String, dynamic> json) => LookupWord(
    term: json['term'] as String,
    reading: json['reading'] as String?,
    meaning: json['meaning'] as String,
  );

  final String term;

  /// Cách đọc kana của từ; `null` khi nội dung chưa có.
  final String? reading;
  final String meaning;
}

/// Chữ Kanji trong thư viện: nghĩa và âm On/Kun (âm Kun dạng dữ liệu `た.べる`).
class LookupKanji {
  const LookupKanji({
    required this.char,
    required this.meaning,
    required this.onReadings,
    required this.kunReadings,
  });

  factory LookupKanji.fromJson(Map<String, dynamic> json) => LookupKanji(
    char: json['char'] as String,
    meaning: json['meaning'] as String,
    onReadings: List<String>.from(json['onReadings'] as List<dynamic>),
    kunReadings: List<String>.from(json['kunReadings'] as List<dynamic>),
  );

  final String char;
  final String meaning;
  final List<String> onReadings;
  final List<String> kunReadings;
}

/// Kết quả tra một lượt: từ vựng khớp và các chữ Kanji có trong thư viện.
class LookupResult {
  const LookupResult({required this.words, required this.kanji});

  factory LookupResult.fromJson(Map<String, dynamic> json) => LookupResult(
    words: <LookupWord>[
      for (final w in json['words'] as List<dynamic>)
        LookupWord.fromJson(
          Map<String, dynamic>.from(w as Map<dynamic, dynamic>),
        ),
    ],
    kanji: <LookupKanji>[
      for (final k in json['kanji'] as List<dynamic>)
        LookupKanji.fromJson(
          Map<String, dynamic>.from(k as Map<dynamic, dynamic>),
        ),
    ],
  );

  final List<LookupWord> words;
  final List<LookupKanji> kanji;
}

/// Hàm tra cụm Hán tự; tách khỏi repository để widget không phụ thuộc Riverpod (dễ thử nghiệm).
typedef TermLookup = Future<LookupResult> Function(List<String> terms);

/// Tra nghĩa/âm đọc của cụm Hán tự cho popup furigana ở bài luyện đọc. Dùng `dio` trực tiếp vì route mới
/// chưa nằm trong API client sinh sẵn (sẽ có khi sinh lại từ OpenAPI 1.16.0).
class LookupRepository {
  LookupRepository(this._dio);

  final Dio _dio;

  Future<LookupResult> lookup(List<String> terms) async {
    try {
      final response = await _dio.get<Object?>(
        '/lookup',
        queryParameters: <String, Object?>{'terms': terms.join(',')},
      );
      return LookupResult.fromJson(
        Map<String, dynamic>.from(response.data! as Map<dynamic, dynamic>),
      );
    } on DioException catch (e) {
      throw ApiError.fromDio(e);
    }
  }
}

final lookupRepositoryProvider = Provider<LookupRepository>((ref) {
  return LookupRepository(ref.watch(dioProvider));
});
