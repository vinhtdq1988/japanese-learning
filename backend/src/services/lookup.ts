import { findKanjiByChars, findVocabularyByWords } from '../db/repositories/lookup.js';
import { getProfile } from '../db/repositories/profiles.js';
import { localize } from '../domain/i18n.js';
import { DEFAULT_LANGUAGE } from '../domain/types.js';
import type { ServiceDeps } from './deps.js';

// Tra cứu cho popup furigana của bài luyện đọc: với mỗi cụm Hán tự người học bấm, trả nghĩa của từ vựng
// trùng khít (nếu thư viện có) và nghĩa/âm On/Kun của từng chữ Kanji trong cụm. Nội dung chung, đã bản địa hóa.

export interface LookupWord {
  term: string;
  reading: string | null;
  meaning: string;
}

export interface LookupKanji {
  char: string;
  meaning: string;
  onReadings: string[];
  kunReadings: string[];
}

export interface LookupResult {
  words: LookupWord[];
  kanji: LookupKanji[];
}

/** Chữ Hán (CJK thống nhất + mở rộng A + dấu lặp 々). */
const HAN = /[㐀-䶿一-鿿々]/u;

/** Các chữ Hán khác nhau trong `terms`, giữ thứ tự xuất hiện lần đầu (bỏ 々: không phải chữ riêng). */
export function uniqueHanChars(terms: readonly string[]): string[] {
  const seen = new Set<string>();
  for (const term of terms) {
    for (const ch of term) {
      if (ch !== '々' && HAN.test(ch)) seen.add(ch);
    }
  }
  return [...seen];
}

export async function lookupTerms(
  deps: Pick<ServiceDeps, 'db'>,
  userId: string,
  terms: readonly string[],
): Promise<LookupResult> {
  const profile = await getProfile(deps.db, userId);
  const language = profile?.language ?? DEFAULT_LANGUAGE;
  const distinct = [...new Set(terms)];
  const [wordRows, kanjiRows] = await Promise.all([
    findVocabularyByWords(deps.db, distinct),
    findKanjiByChars(deps.db, uniqueHanChars(distinct)),
  ]);
  // Một từ có thể thuộc nhiều đơn vị: giữ bản đầu tiên cho mỗi `term`.
  const words = new Map<string, LookupWord>();
  for (const row of wordRows) {
    if (!words.has(row.japanese)) {
      words.set(row.japanese, {
        term: row.japanese,
        reading: row.reading,
        meaning: localize(row.meaning, language),
      });
    }
  }
  const kanji = new Map<string, LookupKanji>();
  for (const row of kanjiRows) {
    if (!kanji.has(row.japanese)) {
      kanji.set(row.japanese, {
        char: row.japanese,
        meaning: localize(row.meaning, language),
        onReadings: row.kanjiDetails?.onReadings ?? [],
        kunReadings: row.kanjiDetails?.kunReadings ?? [],
      });
    }
  }
  return { words: [...words.values()], kanji: [...kanji.values()] };
}
