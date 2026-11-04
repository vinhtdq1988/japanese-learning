import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '../db/client.js';
import { adminActionLogs, learningProfiles, users } from '../db/schema.js';
import { hashPassword, MIN_PASSWORD_LENGTH } from '../services/password.js';

// Lệnh vận hành `pnpm admin:create --email <email>` (FR-004, data-model §2.1): tạo tài khoản admin mới
// hoặc nâng quyền tài khoản có sẵn. KHÔNG có đường đăng ký công khai nào tạo `role='admin'`.
// Mỗi lần chạy ghi `admin_action_logs` với `action='user.grant_admin'`, `actor_id` null (thao tác hệ thống).

export interface CreateAdminResult {
  userId: string;
  /** `created`: tạo mới; `promoted`: nâng quyền tài khoản có sẵn; `unchanged`: đã là admin. */
  outcome: 'created' | 'promoted' | 'unchanged';
}

const emailSchema = z.email();

/** Mật khẩu ngẫu nhiên 20 ký tự (base64url) khi người vận hành không cung cấp. */
export function generatePassword(): string {
  return randomBytes(15).toString('base64url');
}

/**
 * Tạo hoặc nâng quyền admin. `password` chỉ dùng khi tạo mới (tài khoản có sẵn giữ mật khẩu cũ).
 * Tài khoản `disabled`/`pending_deletion` bị từ chối để không vô tình cấp quyền cho tài khoản bị khóa.
 */
export async function createAdmin(
  db: Database,
  emailInput: string,
  password?: string,
): Promise<CreateAdminResult> {
  const email = emailSchema.parse(emailInput.trim());
  if (password !== undefined && password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Mật khẩu phải dài ít nhất ${MIN_PASSWORD_LENGTH} ký tự`);
  }
  const passwordHash = password === undefined ? null : await hashPassword(password);

  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(users).where(eq(users.email, email)).limit(1);

    let userId: string;
    let outcome: CreateAdminResult['outcome'];
    let diff: Record<string, unknown>;

    if (!existing) {
      if (!passwordHash)
        throw new Error('Tài khoản chưa tồn tại: cần cung cấp mật khẩu để tạo mới');
      const [created] = await tx
        .insert(users)
        .values({ email, passwordHash, role: 'admin' })
        .returning({ id: users.id });
      userId = created!.id;
      await tx.insert(learningProfiles).values({ userId, displayName: 'Admin' });
      outcome = 'created';
      diff = { created: true, role: { from: null, to: 'admin' } };
    } else {
      if (existing.status !== 'active') {
        throw new Error(
          `Tài khoản ${email} đang ở trạng thái ${existing.status}, không thể cấp quyền admin`,
        );
      }
      userId = existing.id;
      if (existing.role === 'admin') {
        outcome = 'unchanged';
        diff = { role: { from: 'admin', to: 'admin' } };
      } else {
        await tx
          .update(users)
          .set({ role: 'admin', updatedAt: new Date() })
          .where(eq(users.id, userId));
        outcome = 'promoted';
        diff = { role: { from: existing.role, to: 'admin' } };
      }
    }

    await tx.insert(adminActionLogs).values({
      actorId: null,
      action: 'user.grant_admin',
      targetType: 'user',
      targetId: userId,
      diff,
    });
    return { userId, outcome };
  });
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: { email: { type: 'string' }, password: { type: 'string' } },
  });
  if (!values.email) {
    console.error('Cách dùng: pnpm admin:create --email <email> [--password <mật khẩu>]');
    console.error(
      'Mật khẩu có thể đặt qua biến ADMIN_PASSWORD; nếu bỏ trống khi tạo mới sẽ sinh ngẫu nhiên.',
    );
    process.exitCode = 1;
    return;
  }
  const { loadDotEnv } = await import('../config.js');
  const { createDb } = await import('../db/client.js');
  loadDotEnv();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl)
    throw new Error('Thiếu biến môi trường DATABASE_URL (xem backend/.env.example)');
  const handle = createDb(databaseUrl);
  try {
    const supplied = values.password ?? process.env.ADMIN_PASSWORD;
    const password = supplied ?? generatePassword();
    const result = await createAdmin(handle.db, values.email, password);
    if (result.outcome === 'created') {
      console.log(`Đã tạo tài khoản admin ${values.email}.`);
      if (!supplied) console.log(`Mật khẩu (chỉ hiển thị một lần): ${password}`);
    } else if (result.outcome === 'promoted') {
      console.log(`Đã nâng quyền ${values.email} lên admin (mật khẩu giữ nguyên).`);
    } else {
      console.log(`${values.email} đã là admin, không có thay đổi.`);
    }
  } finally {
    await handle.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
