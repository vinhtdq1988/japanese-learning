import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';

Future<void> main(List<String> args) async {
  final output = Directory(args.single).absolute.uri;
  final manifest = File.fromUri(output.resolve('assets/FontManifest.json'));
  final families = (jsonDecode(manifest.readAsStringSync()) as List)
      .cast<Map<String, dynamic>>();
  final japaneseFonts =
      (families.singleWhere((font) => font['family'] == 'Noto Sans JP')['fonts']
              as List)
          .cast<Map<String, dynamic>>();
  const original = 'assets/fonts/NotoSansJP.ttf';
  const compressed = 'assets/fonts/NotoSansJP.woff2';
  final japaneseFont = japaneseFonts.singleWhere(
    (font) => font['asset'] == original || font['asset'] == compressed,
  );

  final bootstrap = File.fromUri(output.resolve('flutter_bootstrap.js'));
  final bootstrapSource = bootstrap.readAsStringSync();
  final bundlePath = RegExp(
    r'("(?:mainJsPath|mainWasmPath|jsSupportRuntimePath)"\s*:\s*")'
    r'(main\.dart\.(?:js|wasm|mjs))(?:\?v=[a-f0-9]{64})?(")',
  );
  final paths = bundlePath
      .allMatches(bootstrapSource)
      .map((match) => match[2]!)
      .toSet();
  if (!paths.contains('main.dart.js')) {
    throw const FormatException(
      'Cannot find the Flutter release bundle paths.',
    );
  }
  final revisions = <String, Digest>{};
  for (final path in paths) {
    final bundle = File.fromUri(output.resolve(path));
    revisions[path] = await sha256.bind(bundle.openRead()).first;
  }

  // The native Flutter build and the backend glyph checker keep using the TTF.
  final source = File.fromUri(Platform.script.resolve('../$compressed'));
  source.copySync(File.fromUri(output.resolve('assets/$compressed')).path);
  japaneseFont['asset'] = compressed;
  manifest.writeAsStringSync(jsonEncode(families));
  // A previous deployment may have cached the unversioned URL for seven days.
  bootstrap.writeAsStringSync(
    bootstrapSource.replaceAllMapped(
      bundlePath,
      (match) => '${match[1]}${match[2]}?v=${revisions[match[2]]}${match[3]}',
    ),
  );
}
