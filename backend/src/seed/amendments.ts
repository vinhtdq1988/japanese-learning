import { and, asc, eq, sql } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { contentItems, exercises, learningUnits, type ExampleSentence } from '../db/schema.js';
import { exerciseAmendKey } from '../domain/amendments.js';
import {
  formatIssues,
  validateUnit,
  type ExerciseDraft,
  type ItemDraft,
} from '../domain/content-validation.js';
import type { Amendment } from '../domain/types.js';
import type { LoadedContent } from './content.js';

// Áp `amendments[]` của manifest cho chữ Kanji ĐÃ CÓ trong CSDL (spec 008, release-manifest.md §4, FR-018, I2).
// CHỈ THÊM và idempotent: khóa so khớp — âm = chuỗi; ví dụ = `ja`; bài tập = `(item, facet, prompt.en)`.
// KHÔNG xóa/đổi giá trị cũ, KHÔNG đổi id mục/bài tập nên `review_schedules`, `unit_progress`, `study_records`
// của người học giữ nguyên. Mỗi bổ sung chạy trong một giao dịch và đơn vị sau gộp PHẢI đạt quy tắc Kanji
// (đủ ba khía cạnh, quỹ thời lượng); nếu không thì ném lỗi và hoàn tác.

export interface AmendmentSummary {
  /** Số bổ sung đã xử lý. */
  applied: number;
  onReadingsAdded: number;
  kunReadingsAdded: number;
  examplesAdded: number;
  exercisesAdded: number;
}

/** Thêm các phần tử còn thiếu theo khóa so khớp; trả danh sách mới và số phần tử đã thêm. */
function addMissing<T>(existing: readonly T[], incoming: readonly T[], keyOf: (v: T) => string) {
  const seen = new Set(existing.map(keyOf));
  const added: T[] = [];
  for (const value of incoming) {
    const key = keyOf(value);
    if (seen.has(key)) continue;
    seen.add(key);
    added.push(value);
  }
  return { merged: [...existing, ...added], added: added.length };
}

/** Áp mọi bổ sung của các đợt được chọn (theo thứ tự mã đợt). Idempotent. */
export async function applyAmendments(
  db: Database,
  content: LoadedContent,
  options: { secondsPerExercise?: number } = {},
): Promise<AmendmentSummary> {
  const summary: AmendmentSummary = {
    applied: 0,
    onReadingsAdded: 0,
    kunReadingsAdded: 0,
    examplesAdded: 0,
    exercisesAdded: 0,
  };
  const selected = content.releases
    .filter((r) => content.selectedReleases.includes(r.id))
    .sort((a, b) => a.id.localeCompare(b.id));
  for (const release of selected) {
    for (const amendment of release.amendments ?? []) {
      await db.transaction(async (tx) => {
        await applyOne(tx as unknown as Database, amendment, release.id, summary, options);
      });
      summary.applied += 1;
    }
  }
  return summary;
}

async function applyOne(
  tx: Database,
  amendment: Amendment,
  releaseId: string,
  summary: AmendmentSummary,
  options: { secondsPerExercise?: number },
): Promise<void> {
  const where = `đợt ${releaseId}, chữ 「${amendment.item}」 (${amendment.unit.titleEn})`;
  const [unit] = await tx
    .select()
    .from(learningUnits)
    .where(
      and(
        eq(learningUnits.kind, 'kanji'),
        eq(learningUnits.level, amendment.unit.level),
        sql`${learningUnits.title}->>'en' = ${amendment.unit.titleEn}`,
      ),
    )
    .limit(1);
  if (!unit) throw new Error(`Amendment: không có đơn vị Kanji trong CSDL (${where})`);

  const items = await tx
    .select()
    .from(contentItems)
    .where(eq(contentItems.unitId, unit.id))
    .orderBy(asc(contentItems.position), asc(contentItems.createdAt), asc(contentItems.id));
  const item = items.find((i) => i.japanese === amendment.item && i.status === 'active');
  if (!item) throw new Error(`Amendment: không có chữ trong đơn vị đã seed (${where})`);

  // Âm On/Kun và ví dụ: chỉ thêm giá trị chưa có.
  const details = item.kanjiDetails ?? { onReadings: [], kunReadings: [], strokeCount: 1 };
  const on = addMissing(details.onReadings, amendment.add.onReadings ?? [], (v) => v);
  const kun = addMissing(details.kunReadings, amendment.add.kunReadings ?? [], (v) => v);
  const ex = addMissing<ExampleSentence>(
    item.examples as ExampleSentence[],
    (amendment.add.examples ?? []) as ExampleSentence[],
    (v) => v.ja,
  );
  if (on.added + kun.added + ex.added > 0) {
    await tx
      .update(contentItems)
      .set({
        kanjiDetails: { ...details, onReadings: on.merged, kunReadings: kun.merged },
        examples: ex.merged as typeof item.examples,
      })
      .where(eq(contentItems.id, item.id));
  }
  summary.onReadingsAdded += on.added;
  summary.kunReadingsAdded += kun.added;
  summary.examplesAdded += ex.added;

  // Bài tập: khóa (item, facet, prompt.en); thêm vào cuối, bài cũ giữ nguyên id.
  const existing = await tx
    .select()
    .from(exercises)
    .where(eq(exercises.unitId, unit.id))
    .orderBy(asc(exercises.position), asc(exercises.createdAt), asc(exercises.id));
  const itemById = new Map(items.map((i) => [i.id, i.japanese]));
  const keys = new Set(
    existing.map((e) =>
      exerciseAmendKey(e.itemId ? (itemById.get(e.itemId) ?? '') : '', e.facet, e.prompt.en),
    ),
  );
  let position = existing.reduce((max, e) => Math.max(max, e.position), -1);
  let exercisesAdded = 0;
  for (const added of amendment.add.exercises ?? []) {
    const itemJapanese = added.item ?? amendment.item;
    const target = items.find((i) => i.japanese === itemJapanese && i.status === 'active');
    if (!target)
      throw new Error(`Amendment: bài tập trỏ tới chữ không có 「${itemJapanese}」 (${where})`);
    const key = exerciseAmendKey(itemJapanese, added.facet, added.prompt.en);
    if (keys.has(key)) continue;
    keys.add(key);
    position += 1;
    await tx.insert(exercises).values({
      unitId: unit.id,
      itemId: target.id,
      facet: added.facet,
      type: added.type,
      prompt: added.prompt,
      payload: added.payload,
      feedbackCorrect: added.feedbackCorrect,
      feedbackIncorrect: added.feedbackIncorrect,
      position,
    });
    exercisesAdded += 1;
  }
  summary.exercisesAdded += exercisesAdded;
  if (on.added + kun.added + ex.added + exercisesAdded === 0) return;

  // Sau gộp, đơn vị phải còn đạt quy tắc Kanji (ba khía cạnh + quỹ thời lượng); không thì hoàn tác.
  const finalItems = await tx
    .select()
    .from(contentItems)
    .where(eq(contentItems.unitId, unit.id))
    .orderBy(asc(contentItems.position), asc(contentItems.createdAt), asc(contentItems.id));
  const finalExercises = await tx
    .select()
    .from(exercises)
    .where(eq(exercises.unitId, unit.id))
    .orderBy(asc(exercises.position), asc(exercises.createdAt), asc(exercises.id));
  const indexOfItem = new Map(finalItems.map((i, index) => [i.id, index]));
  const issues = validateUnit(
    {
      id: unit.id,
      kind: unit.kind,
      level: unit.level,
      tier: unit.tier,
      estMinutes: unit.estMinutes,
      goalTags: unit.goalTags,
      title: unit.title,
      items: finalItems.map((i): ItemDraft => ({ ...i, topic: i.topicId })),
      exercises: finalExercises.map((e): ExerciseDraft => ({
        ...e,
        itemIndex: e.itemId ? (indexOfItem.get(e.itemId) ?? null) : null,
      })),
    },
    {
      ...(options.secondsPerExercise ? { secondsPerExercise: options.secondsPerExercise } : {}),
      // Chủ đề của chữ đã được seed kiểm; ở đây chỉ cần có chủ đề.
      topicSkillOf: () => 'kanji',
    },
  );
  if (issues.length > 0) {
    throw new Error(
      `Amendment làm đơn vị không còn đạt quy tắc Kanji (${where}); nêu phương án ở notes ` +
        `(ví dụ đổi estMinutes qua Admin API):\n${formatIssues(issues)}`,
    );
  }
}
