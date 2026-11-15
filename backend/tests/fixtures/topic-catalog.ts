import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { I18nText, Level, Skill } from '../../src/domain/types.js';

// Danh mục chủ đề của `content/topics.json` cho kiểm thử: hồ sơ đại diện tham chiếu chủ đề bằng khóa (`key`),
// còn CSDL chỉ có id sinh ngẫu nhiên nên kiểm thử tích hợp tra ngược theo (kỹ năng, trình độ, tên).

export interface TopicEntry {
  key: string;
  skill: Skill;
  level: Level;
  name: I18nText;
}

const FILE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../content/topics.json',
);

let cache: TopicEntry[] | null = null;

/** Mọi chủ đề trong `content/topics.json`. */
export function topicCatalog(): TopicEntry[] {
  cache ??= (JSON.parse(readFileSync(FILE, 'utf8')) as { topics: TopicEntry[] }).topics;
  return cache;
}

/** Chủ đề theo khóa; ném lỗi nếu không có (hồ sơ tham chiếu khóa sai). */
export function topicByKey(key: string): TopicEntry {
  const found = topicCatalog().find((t) => t.key === key);
  if (!found) throw new Error(`Không có chủ đề "${key}" trong content/topics.json`);
  return found;
}
