import { eq } from 'drizzle-orm';
import type { DbExecutor } from '../client.js';
import { learningProfiles } from '../schema.js';

// Repository hồ sơ học tập (quan hệ 1–1 với `users`). Mọi truy vấn lọc theo `user_id` lấy từ token (R16).

export type ProfileRow = typeof learningProfiles.$inferSelect;
export type ProfilePatch = Partial<Omit<typeof learningProfiles.$inferInsert, 'userId'>>;

export async function getProfile(db: DbExecutor, userId: string): Promise<ProfileRow | undefined> {
  const [row] = await db
    .select()
    .from(learningProfiles)
    .where(eq(learningProfiles.userId, userId))
    .limit(1);
  return row;
}

export async function updateProfile(
  db: DbExecutor,
  userId: string,
  patch: ProfilePatch,
  now: Date,
): Promise<ProfileRow> {
  const [row] = await db
    .update(learningProfiles)
    .set({ ...patch, updatedAt: now })
    .where(eq(learningProfiles.userId, userId))
    .returning();
  return row!;
}
