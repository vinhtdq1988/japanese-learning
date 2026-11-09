import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// CSP của client web (T116, R16): token lưu ở trình duyệt nên CSP phải chặn script ngoài và nội dung nhúng.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const indexHtml = readFileSync(path.join(root, 'client/web/index.html'), 'utf8');
const nginxConf = readFileSync(path.join(root, 'client/nginx.conf'), 'utf8');
const startClientPs1 = readFileSync(path.join(root, 'scripts/start-client.ps1'), 'utf8');
const dockerfile = readFileSync(path.join(root, 'client/Dockerfile'), 'utf8');

// Tách start-client.ps1 thành nhánh prod (build release) và nhánh local (flutter run) quanh `if ($Environment -eq 'prod')`.
function psBranches(script: string): { prod: string; local: string } {
  const prodStart = script.indexOf("if ($Environment -eq 'prod') {");
  const localStart = script.indexOf('} else {', prodStart);
  const localEnd = script.indexOf('} finally', localStart);
  expect(prodStart, 'không tìm thấy nhánh prod trong start-client.ps1').toBeGreaterThan(-1);
  expect(localStart, 'không tìm thấy nhánh local trong start-client.ps1').toBeGreaterThan(
    prodStart,
  );
  expect(localEnd, 'không tìm thấy khối finally trong start-client.ps1').toBeGreaterThan(
    localStart,
  );
  return { prod: script.slice(prodStart, localStart), local: script.slice(localStart, localEnd) };
}

function directives(policy: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const part of policy.split(';')) {
    const [name, ...values] = part.trim().split(/\s+/);
    if (name) map.set(name, values);
  }
  return map;
}

function expectStrict(policy: Map<string, string[]>): void {
  expect(policy.get('default-src')).toEqual(["'self'"]);
  expect(policy.get('script-src')).toEqual(["'self'", "'wasm-unsafe-eval'"]);
  expect(policy.get('script-src')).not.toContain("'unsafe-inline'");
  expect(policy.get('script-src')).not.toContain("'unsafe-eval'");
  expect(policy.get('connect-src')).toEqual(["'self'"]);
  expect(policy.get('object-src')).toEqual(["'none'"]);
  expect(policy.get('base-uri')).toEqual(["'self'"]);
  for (const [name, values] of policy) {
    expect(values.join(' '), name).not.toMatch(/https?:|\*/);
  }
}

describe('CSP của client web', () => {
  // C-01: meta CSP chặt trong mẫu dùng chung sẽ chặn script nội tuyến của dev server khi chạy local (trang trắng).
  it('index.html không có thẻ meta CSP (CSP release chỉ khai báo bằng header ở client/nginx.conf)', () => {
    expect(
      indexHtml,
      'thẻ meta CSP trong index.html chặn công cụ chạy thử ở local; CSP release chỉ khai báo ở client/nginx.conf',
    ).not.toMatch(/http-equiv\s*=\s*["']?Content-Security-Policy/i);
  });

  // C-07: local phục vụ CanvasKit cùng nguồn, không phụ thuộc Internet.
  it('local chạy flutter run với --no-web-resources-cdn', () => {
    const { local } = psBranches(startClientPs1);
    const flutterArgs = local.match(/\$flutterArgs\s*=\s*@\(([^)]*)\)/);
    expect(flutterArgs, 'thiếu mảng $flutterArgs ở nhánh local').not.toBeNull();
    expect(flutterArgs![1]).toContain("'run'");
    expect(flutterArgs![1], 'nhánh local thiếu --no-web-resources-cdn').toContain(
      '--no-web-resources-cdn',
    );
  });

  // C-02: mẫu trang không kéo tài nguyên ngoài; `$FLUTTER_BASE_HREF` không bắt đầu bằng http(s):// nên được phép.
  it('index.html không tham chiếu tài nguyên ngoài (src/href http(s)://)', () => {
    expect(indexHtml).not.toMatch(/(?:src|href)\s*=\s*["']https?:\/\//i);
  });

  // C-03 + C-04: header CSP của nginx là nguồn duy nhất của bản release.
  it('nginx gửi đúng một CSP chặt ở mức server (always) kèm frame-ancestors none', () => {
    const matches = [
      ...nginxConf.matchAll(/add_header\s+Content-Security-Policy\s+"([^"]+)"([^;]*);/g),
    ];
    expect(matches, 'nginx.conf phải có đúng một header CSP').toHaveLength(1);
    expect(matches[0]![2], 'header CSP thiếu `always`').toMatch(/\balways\b/);
    const policy = directives(matches[0]![1]!);
    expectStrict(policy);
    expect(policy.get('frame-ancestors')).toEqual(["'none'"]);
    expect(policy.get('script-src')).not.toContain("'unsafe-inline'");
    expect(policy.get('default-src')).not.toContain("'unsafe-inline'");
  });

  // C-05: nginx bỏ header cấp server nếu khối location có add_header, làm mất CSP một cách âm thầm.
  it('nginx có HSTS và không khối location nào chứa add_header', () => {
    expect(nginxConf).toMatch(/add_header\s+Strict-Transport-Security\s+"[^"]+"\s+always\s*;/);
    const blocks = [...nginxConf.matchAll(/location[^{]*\{([^}]*)\}/g)];
    expect(blocks.length, 'không tìm thấy khối location nào để kiểm tra').toBeGreaterThan(0);
    for (const block of blocks) {
      expect(
        block[1],
        'add_header trong location làm nginx bỏ các header bảo mật (CSP, HSTS) khai báo ở mức server',
      ).not.toMatch(/add_header/);
    }
  });

  // C-06: thiếu --no-web-resources-cdn thì CanvasKit tải từ gstatic và bị CSP của nginx chặn.
  it('build release luôn có --no-web-resources-cdn (Dockerfile và nhánh prod của start-client.ps1)', () => {
    const buildLine = dockerfile
      .split(/\r?\n/)
      .find((line) => /^\s*RUN\s.*flutter build web/.test(line));
    expect(buildLine, 'Dockerfile thiếu lệnh RUN flutter build web').toBeDefined();
    const message =
      'thiếu --no-web-resources-cdn thì CanvasKit tải từ gstatic và bị CSP chặn; cấm khắc phục bằng cách nới nginx.conf';
    expect(buildLine, message).toContain('--no-web-resources-cdn');
    const { prod } = psBranches(startClientPs1);
    expect(prod, message).toMatch(/flutter build web[^\r\n]*--no-web-resources-cdn/);
  });
});
