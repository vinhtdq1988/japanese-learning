import argon2 from 'argon2';

// Băm mật khẩu bằng argon2id (R4). Dùng chung cho đăng ký, đặt lại, đổi mật khẩu và lệnh `admin:create`.

export const MIN_PASSWORD_LENGTH = 8;

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    // Hash hỏng/không đúng định dạng coi như không khớp, không làm lộ lỗi nội bộ.
    return false;
  }
}
