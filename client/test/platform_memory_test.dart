import 'package:flutter_test/flutter_test.dart';
import 'package:japanese_learning_client/platform/memory_platform.dart';
import 'package:japanese_learning_client/platform/platform.dart';

void main() {
  test('MemoryTokenStore ghi, đọc và xóa token', () async {
    final store = MemoryTokenStore();
    expect(await store.read(), isNull);
    await store.write(const StoredTokens(accessToken: 'a', refreshToken: 'r'));
    expect(
      await store.read(),
      const StoredTokens(accessToken: 'a', refreshToken: 'r'),
    );
    await store.clear();
    expect(await store.read(), isNull);
  });

  test('MemoryLocalStore ghi, đọc và xóa khóa', () async {
    final store = MemoryLocalStore();
    expect(await store.getString('k'), isNull);
    await store.setString('k', 'v');
    expect(await store.getString('k'), 'v');
    await store.remove('k');
    expect(await store.getString('k'), isNull);
  });

  test('FixedTimezone và RecordingLinks', () async {
    expect(
      await const FixedTimezone('Asia/Ho_Chi_Minh').currentIanaName(),
      'Asia/Ho_Chi_Minh',
    );
    expect(await const FixedTimezone().currentIanaName(), isNull);
    final links = RecordingLinks();
    await links.open(Uri.parse('https://example.com'));
    expect(links.opened, <Uri>[Uri.parse('https://example.com')]);
  });
}
