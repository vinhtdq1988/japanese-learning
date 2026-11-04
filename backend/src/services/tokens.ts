import { createHash, randomBytes } from 'node:crypto';

// Token đục 256-bit cho refresh token và liên kết đặt lại mật khẩu (R4). Chỉ lưu băm SHA-256 trong CSDL.

export function generateOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
