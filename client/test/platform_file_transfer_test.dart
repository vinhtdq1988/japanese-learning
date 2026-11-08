import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:japanese_learning_client/platform/file_transfer.dart';
import 'package:japanese_learning_client/platform/memory_platform.dart';
import 'package:japanese_learning_client/platform/platform_providers.dart';

// Kiểm thử giao diện chuyển tệp CSV (spec 004, T025, Nguyên tắc V, research O18): triển khai trong bộ nhớ
// và việc đăng ký provider; triển khai web dùng API trình duyệt nên chỉ kiểm bằng biên dịch/chạy thật.

void main() {
  test('MemoryFileTransfer trả nội dung CSV định sẵn khi chọn tệp', () async {
    final transfer = MemoryFileTransfer(
      pickResult: 'email,display_name\nan@example.com,Nguyễn Văn An\n',
    );
    expect(
      await transfer.pickCsv(),
      'email,display_name\nan@example.com,Nguyễn Văn An\n',
    );
    expect(transfer.pickCalls, 1);
  });

  test('người dùng hủy chọn tệp: pickCsv trả null', () async {
    final transfer = MemoryFileTransfer();
    expect(await transfer.pickCsv(), isNull);
    transfer.setPickResult('email\nx@example.com\n');
    expect(await transfer.pickCsv(), isNotNull);
    transfer.setPickResult(null);
    expect(await transfer.pickCsv(), isNull);
    expect(transfer.pickCalls, 3);
  });

  test(
    'saveCsv ghi lại tên tệp và byte nguyên vẹn (kể cả BOM UTF-8 và tiếng Nhật)',
    () async {
      final transfer = MemoryFileTransfer();
      final bytes = <int>[
        0xEF,
        0xBB,
        0xBF,
        ...utf8.encode('名前,email\r\n佐藤,sato@example.jp\r\n'),
      ];
      await transfer.saveCsv('class-lop-a-2026-11-07.csv', bytes);
      await transfer.saveCsv('b.csv', const <int>[1, 2, 3]);

      expect(transfer.saved, hasLength(2));
      expect(transfer.saved.first.filename, 'class-lop-a-2026-11-07.csv');
      expect(transfer.saved.first.bytes, bytes);
      expect(transfer.saved.first.bytes.take(3), <int>[0xEF, 0xBB, 0xBF]);
      expect(
        utf8.decode(transfer.saved.first.bytes.skip(3).toList()),
        '名前,email\r\n佐藤,sato@example.jp\r\n',
      );
      expect(transfer.saved.last.bytes, <int>[1, 2, 3]);
    },
  );

  test('byte đã lưu không bị đổi khi nguồn bị sửa sau đó', () async {
    final transfer = MemoryFileTransfer();
    final bytes = <int>[1, 2, 3];
    await transfer.saveCsv('a.csv', bytes);
    bytes[0] = 99;
    expect(transfer.saved.single.bytes, <int>[1, 2, 3]);
  });

  test('fileTransferProvider không có triển khai mặc định, override được', () {
    final bare = ProviderContainer();
    addTearDown(bare.dispose);
    expect(() => bare.read(fileTransferProvider), throwsA(anything));

    final memory = MemoryFileTransfer();
    final container = ProviderContainer(
      overrides: <Override>[fileTransferProvider.overrideWithValue(memory)],
    );
    addTearDown(container.dispose);
    final FileTransfer resolved = container.read(fileTransferProvider);
    expect(identical(resolved, memory), isTrue);
  });
}
