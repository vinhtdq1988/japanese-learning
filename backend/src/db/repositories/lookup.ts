import { and, eq, inArray } from 'drizzle-orm';
import type { DbExecutor } from '../client.js';
import { contentItems, learningUnits } from '../schema.js';
import type { I18nText, KanjiDetails } from '../../domain/types.js';

// Repository tra cứu chữ Kanji và từ vựng cho popup furigana của bài luyện đọc. Chỉ đọc mục `active`
// của đơn vị `active`; không phụ thuộc người học (nội dung dùng chung), nên không lọc theo `user_id`.

export interface LookupKanjiRow {
  japanese: string;
  meaning: I18nText;
  kanjiDetails: KanjiDetails | null;
}

export interface LookupWordRow {
  japanese: string;
  reading: string | null;
  meaning: I18nText;
}

/** Chữ Kanji (`kind = kanji`) có `japanese` thuộc `chars`. */
export async function findKanjiByChars(
  db: DbExecutor,
  chars: readonly string[],
): Promise<LookupKanjiRow[]> {
  if (chars.length === 0) return [];
  return db
    .select({
      japanese: contentItems.japanese,
      meaning: contentItems.meaning,
      kanjiDetails: contentItems.kanjiDetails,
    })
    .from(contentItems)
    .innerJoin(learningUnits, eq(learningUnits.id, contentItems.unitId))
    .where(
      and(
        eq(contentItems.kind, 'kanji'),
        eq(contentItems.status, 'active'),
        eq(learningUnits.status, 'active'),
        inArray(contentItems.japanese, [...chars]),
      ),
    );
}

/** Từ vựng (`kind = vocabulary`) có `japanese` trùng khít một trong `words`. */
export async function findVocabularyByWords(
  db: DbExecutor,
  words: readonly string[],
): Promise<LookupWordRow[]> {
  if (words.length === 0) return [];
  return db
    .select({
      japanese: contentItems.japanese,
      reading: contentItems.reading,
      meaning: contentItems.meaning,
    })
    .from(contentItems)
    .innerJoin(learningUnits, eq(learningUnits.id, contentItems.unitId))
    .where(
      and(
        eq(contentItems.kind, 'vocabulary'),
        eq(contentItems.status, 'active'),
        eq(learningUnits.status, 'active'),
        inArray(contentItems.japanese, [...words]),
      ),
    );
}
