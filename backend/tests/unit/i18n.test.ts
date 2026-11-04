import { describe, expect, it } from 'vitest';
import {
  isCompleteI18nText,
  languageOrDefault,
  localize,
  localizeOptional,
  resolveText,
} from '../../src/domain/i18n.js';

describe('bản địa hóa i18n_text', () => {
  const text = { vi: 'Xin chào', en: 'Hello' };

  it('chọn bản dịch theo ngôn ngữ', () => {
    expect(localize(text, 'vi')).toBe('Xin chào');
    expect(localize(text, 'en')).toBe('Hello');
  });

  it('lùi về tiếng Việt (mặc định) rồi bản bất kỳ khi thiếu bản dịch', () => {
    expect(localize({ vi: 'Chỉ có tiếng Việt' }, 'en')).toBe('Chỉ có tiếng Việt');
    expect(localize({ en: 'English only' }, 'vi')).toBe('English only');
    expect(localize({ vi: '', en: 'Fallback' }, 'vi')).toBe('Fallback');
    expect(localize(null, 'vi')).toBe('');
  });

  it('localizeOptional giữ null cho trường tùy chọn', () => {
    expect(localizeOptional(null, 'vi')).toBeNull();
    expect(localizeOptional(text, 'en')).toBe('Hello');
  });

  it('resolveText giữ nguyên chuỗi dùng chung (chữ Nhật) và bản địa hóa văn bản dịch', () => {
    expect(resolveText('こんにちは', 'en')).toBe('こんにちは');
    expect(resolveText(text, 'en')).toBe('Hello');
  });

  it('isCompleteI18nText yêu cầu đủ vi + en không trống', () => {
    expect(isCompleteI18nText(text)).toBe(true);
    expect(isCompleteI18nText({ vi: 'a' })).toBe(false);
    expect(isCompleteI18nText({ vi: 'a', en: '  ' })).toBe(false);
    expect(isCompleteI18nText('chuỗi')).toBe(false);
    expect(isCompleteI18nText(null)).toBe(false);
  });

  it('languageOrDefault về vi với giá trị lạ', () => {
    expect(languageOrDefault('en')).toBe('en');
    expect(languageOrDefault('fr')).toBe('vi');
    expect(languageOrDefault(undefined)).toBe('vi');
  });
});
