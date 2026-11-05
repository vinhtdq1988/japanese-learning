import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// CSP của client web (T116, R16): token lưu ở trình duyệt nên CSP phải chặn script ngoài và nội dung nhúng.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const indexHtml = readFileSync(path.join(root, 'client/web/index.html'), 'utf8');
const nginxConf = readFileSync(path.join(root, 'client/nginx.conf'), 'utf8');

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
  it('thẻ meta trong index.html chặt chẽ: chỉ cùng nguồn, không script nội tuyến hay eval', () => {
    const match = indexHtml.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/);
    expect(match, 'thiếu thẻ meta CSP').not.toBeNull();
    expectStrict(directives(match![1]!));
  });

  it('nginx gửi cùng CSP kèm frame-ancestors none và HSTS', () => {
    const match = nginxConf.match(/add_header\s+Content-Security-Policy\s+"([^"]+)"/);
    expect(match, 'thiếu header CSP trong nginx.conf').not.toBeNull();
    const policy = directives(match![1]!);
    expectStrict(policy);
    expect(policy.get('frame-ancestors')).toEqual(["'none'"]);
    expect(nginxConf).toMatch(/Strict-Transport-Security/);
  });
});
