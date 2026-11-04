import { DEFAULT_LANGUAGE, LANGUAGES, type I18nText, type Language } from './types.js';

// Bản địa hóa `i18n_text` theo `profile.language` (mặc định `vi`). Chữ Nhật, cách đọc và câu ví dụ
// chỉ có một bản nên không đi qua đây.

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

/** Văn bản dịch có đủ mọi ngôn ngữ hỗ trợ và không trống (điều kiện kích hoạt nội dung). */
export function isCompleteI18nText(value: unknown): value is I18nText {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return LANGUAGES.every((lang) => typeof record[lang] === 'string' && record[lang].trim() !== '');
}

/**
 * Lấy bản dịch theo ngôn ngữ. Thiếu bản dịch thì lùi về ngôn ngữ mặc định, rồi bản có sẵn bất kỳ,
 * để người học không bao giờ thấy ô trống do nội dung dở dang.
 */
export function localize(text: Partial<I18nText> | null | undefined, language: Language): string {
  if (!text) return '';
  return text[language] || text[DEFAULT_LANGUAGE] || Object.values(text).find(Boolean) || '';
}

/** Giá trị trung lập về ngôn ngữ (chuỗi dùng chung, ví dụ chữ Nhật) hoặc văn bản dịch vi + en. */
export type Localizable = string | I18nText;

/** Chuỗi dùng cho `language`: chuỗi trung lập giữ nguyên, văn bản dịch được bản địa hóa. */
export function resolveText(value: Localizable, language: Language): string {
  return typeof value === 'string' ? value : localize(value, language);
}

/** Như `localize` nhưng giữ `null`/`undefined` cho trường tùy chọn. */
export function localizeOptional(
  text: Partial<I18nText> | null | undefined,
  language: Language,
): string | null {
  return text ? localize(text, language) : null;
}

/** Ngôn ngữ từ tham số `lang` của API công khai; giá trị lạ về mặc định (`vi`). */
export function languageOrDefault(value: unknown): Language {
  return isLanguage(value) ? value : DEFAULT_LANGUAGE;
}
