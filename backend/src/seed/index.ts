import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { and, eq, sql } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import {
  contentItems,
  exercises,
  learningUnits,
  placementQuestions,
  topics,
  users,
} from '../db/schema.js';
import { createAdmin } from './create-admin.js';
import { DEFAULT_CONTENT_DIR, loadValidatedContent, type LoadedContent } from './content.js';

// Lệnh `pnpm seed`: nạp nội dung từ `content/` (đã kiểm tra JSON Schema + quy tắc nội dung T014),
// nạp topics và bộ placement, tạo tài khoản admin dev. Chạy lại an toàn: phần tử đã có (theo khóa tự
// nhiên) được bỏ qua để không ghi đè nội dung admin đã chỉnh sửa qua Admin API.

export interface SeedSummary {
  topicsInserted: number;
  unitsInserted: number;
  unitsSkipped: number;
  placementInserted: number;
  placementActivated: boolean;
}

/** Tìm hoặc tạo mảng; trả bảng tra khóa mảng → id. */
async function seedTopics(db: Database, content: LoadedContent, summary: SeedSummary) {
  const ids = new Map<string, string>();
  for (const t of content.topics) {
    const [found] = await db
      .select({ id: topics.id })
      .from(topics)
      .where(
        and(
          eq(topics.skill, t.skill),
          eq(topics.level, t.level),
          sql`${topics.name}->>'en' = ${t.name.en}`,
        ),
      )
      .limit(1);
    if (found) {
      ids.set(t.key, found.id);
      continue;
    }
    const [created] = await db
      .insert(topics)
      .values({ skill: t.skill, level: t.level, name: t.name })
      .returning({ id: topics.id });
    ids.set(t.key, created!.id);
    summary.topicsInserted += 1;
  }
  return ids;
}

async function seedUnits(
  db: Database,
  content: LoadedContent,
  topicIds: Map<string, string>,
  summary: SeedSummary,
): Promise<void> {
  for (const u of content.units) {
    const [existing] = await db
      .select({ id: learningUnits.id })
      .from(learningUnits)
      .where(
        and(
          eq(learningUnits.kind, u.kind),
          eq(learningUnits.level, u.level),
          sql`${learningUnits.title}->>'en' = ${u.title.en}`,
        ),
      )
      .limit(1);
    if (existing) {
      summary.unitsSkipped += 1;
      continue;
    }

    await db.transaction(async (tx) => {
      const [unit] = await tx
        .insert(learningUnits)
        .values({
          kind: u.kind,
          title: u.title,
          level: u.level,
          goalTags: u.goalTags ?? [],
          topicId: topicIds.get(u.topic)!,
          difficulty: u.difficulty,
          tier: u.tier ?? 'core',
          estMinutes: u.estMinutes,
          sequence: u.sequence ?? 0,
          isTrial: u.isTrial ?? false,
          status: 'active',
        })
        .returning({ id: learningUnits.id });
      const unitId = unit!.id;

      const itemIds = new Map<string, string>();
      for (const [position, item] of u.items.entries()) {
        const [row] = await tx
          .insert(contentItems)
          .values({
            unitId,
            kind: u.kind,
            japanese: item.japanese,
            reading: item.reading ?? null,
            meaning: item.meaning,
            explanation: item.explanation ?? null,
            examples: item.examples ?? [],
            // Chữ Kanji: chủ đề riêng và chi tiết (NULL với mục khác); reading để NULL.
            topicId: item.topic ? topicIds.get(item.topic)! : null,
            kanjiDetails: item.kanjiDetails ?? null,
            position,
          })
          .returning({ id: contentItems.id });
        itemIds.set(item.japanese, row!.id);
      }

      for (const [position, ex] of u.exercises.entries()) {
        await tx.insert(exercises).values({
          unitId,
          itemId: ex.item ? itemIds.get(ex.item)! : null,
          facet: ex.facet ?? 'item',
          type: ex.type,
          prompt: ex.prompt,
          payload: ex.payload,
          feedbackCorrect: ex.feedbackCorrect,
          feedbackIncorrect: ex.feedbackIncorrect,
          position,
        });
      }
    });
    summary.unitsInserted += 1;
  }
}

/**
 * Nạp bộ placement. Chỉ tự kích hoạt bộ này khi chưa có bộ nào hiện hành, để không ghi đè bộ do
 * admin chọn (kích hoạt nguyên tử qua `PUT /admin/placement-questions/active-set`).
 */
async function seedPlacement(
  db: Database,
  content: LoadedContent,
  topicIds: Map<string, string>,
  summary: SeedSummary,
): Promise<void> {
  const [{ activeCount } = { activeCount: 0 }] = await db
    .select({ activeCount: sql<number>`count(*)::int` })
    .from(placementQuestions)
    .where(eq(placementQuestions.isActive, true));
  const activate = activeCount === 0;

  await db.transaction(async (tx) => {
    for (const q of content.placement.questions) {
      const [existing] = await tx
        .select({ id: placementQuestions.id })
        .from(placementQuestions)
        .where(
          and(
            eq(placementQuestions.level, q.level),
            sql`${placementQuestions.prompt}->>'ja' = ${q.prompt}`,
          ),
        )
        .limit(1);
      if (existing) continue;
      await tx.insert(placementQuestions).values({
        level: q.level,
        skill: q.skill,
        topicId: topicIds.get(q.topic)!,
        prompt: q.hint ? { ja: q.prompt, hint: q.hint } : { ja: q.prompt },
        choices: q.choices,
        correctChoice: q.correctChoice,
        position: q.position,
        isActive: activate,
      });
      summary.placementInserted += 1;
    }
  });
  summary.placementActivated = activate && summary.placementInserted > 0;
}

/** Nạp toàn bộ nội dung vào CSDL. Ném lỗi (trước khi ghi gì) nếu nội dung không hợp lệ. */
export async function seedContent(
  db: Database,
  contentDir: string = DEFAULT_CONTENT_DIR,
): Promise<SeedSummary> {
  const content = await loadValidatedContent(contentDir);
  const summary: SeedSummary = {
    topicsInserted: 0,
    unitsInserted: 0,
    unitsSkipped: 0,
    placementInserted: 0,
    placementActivated: false,
  };
  const topicIds = await seedTopics(db, content, summary);
  await seedUnits(db, content, topicIds, summary);
  await seedPlacement(db, content, topicIds, summary);
  return summary;
}

/** Tài khoản admin dev (chỉ ngoài production). Đã có thì giữ nguyên. */
export async function seedDevAdmin(db: Database, env: NodeJS.ProcessEnv = process.env) {
  const email = env.SEED_ADMIN_EMAIL ?? 'admin@japanese-learning.local';
  const password = env.SEED_ADMIN_PASSWORD ?? 'admin-dev-password';
  const [existing] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing?.role === 'admin') return { email, outcome: 'unchanged' as const };
  const result = await createAdmin(db, email, password);
  return { email, outcome: result.outcome };
}

async function main(): Promise<void> {
  const { loadDotEnv } = await import('../config.js');
  const { createDb } = await import('../db/client.js');
  loadDotEnv();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl)
    throw new Error('Thiếu biến môi trường DATABASE_URL (xem backend/.env.example)');
  const contentDir = process.env.CONTENT_DIR ?? DEFAULT_CONTENT_DIR;
  const handle = createDb(databaseUrl);
  try {
    const summary = await seedContent(handle.db, contentDir);
    console.log(
      `Nội dung: +${summary.topicsInserted} mảng, +${summary.unitsInserted} đơn vị ` +
        `(bỏ qua ${summary.unitsSkipped} đã có), +${summary.placementInserted} câu placement` +
        (summary.placementActivated ? ' (đã kích hoạt bộ 20 câu)' : ''),
    );
    if (process.env.NODE_ENV === 'production') {
      console.log(
        'Production: bỏ qua tài khoản admin dev; dùng `pnpm admin:create --email <email>`.',
      );
    } else {
      const admin = await seedDevAdmin(handle.db);
      console.log(`Admin dev: ${admin.email} (${admin.outcome})`);
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
