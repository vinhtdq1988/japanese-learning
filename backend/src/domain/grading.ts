import { resolveText, type Localizable } from './i18n.js';
import { DEFAULT_LANGUAGE, type ExerciseType, type Language } from './types.js';

// Bộ chấm bài tập khách quan (FR-025): multiple_choice, matching, fill_blank.
// Hàm thuần: nhận `payload` của bài tập (có đáp án) và câu trả lời của người học.
//
// Định dạng câu trả lời (khớp `AnswerSubmission.answer` trong openapi.yaml):
// - multiple_choice: chỉ số lựa chọn (số nguyên)
// - matching: danh sách cặp [vế trái, vế phải] theo văn bản đã bản địa hóa mà người học thấy
// - fill_blank: chuỗi người học điền

export interface MultipleChoicePayload {
  /** Mỗi lựa chọn là chuỗi dùng chung (ví dụ chữ Nhật) hoặc văn bản dịch vi + en. */
  choices: Localizable[];
  correct_index: number;
}

export interface MatchingPayload {
  /** Mỗi cặp là [vế trái, vế phải đúng]; mỗi vế là chuỗi dùng chung hoặc văn bản dịch vi + en. */
  pairs: [Localizable, Localizable][];
}

export interface FillBlankPayload {
  accepted_answers: string[];
}

export interface GradeResult {
  isCorrect: boolean;
  /** Đáp án đúng, trả về khi trả lời sai (schema `AnswerResult.correctAnswer`). */
  correctAnswer: number | [string, string][] | string;
}

/**
 * Chuẩn hóa chuỗi trước khi so khớp điền từ: NFKC (đưa chữ Nhật toàn/bán chiều về cùng dạng),
 * bỏ khoảng trắng thừa ở hai đầu và gộp khoảng trắng giữa, đổi chữ thường.
 */
export function normalizeAnswer(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

function gradeMultipleChoice(payload: MultipleChoicePayload, answer: unknown): GradeResult {
  return {
    isCorrect: Number.isInteger(answer) && answer === payload.correct_index,
    correctAnswer: payload.correct_index,
  };
}

function isPair(value: unknown): value is [string, string] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === 'string' &&
    typeof value[1] === 'string'
  );
}

function gradeMatching(payload: MatchingPayload, answer: unknown, language: Language): GradeResult {
  const canonical = payload.pairs.map(
    ([l, r]) => [resolveText(l, language), resolveText(r, language)] as [string, string],
  );
  const key = (pair: [string, string]): string => JSON.stringify(pair);
  const expected = new Set(canonical.map(key));
  let isCorrect = false;
  if (Array.isArray(answer) && answer.length === canonical.length && answer.every(isPair)) {
    const given = new Set((answer as [string, string][]).map(key));
    // Đủ cặp, không trùng và mọi cặp khớp đáp án (thứ tự tùy ý).
    isCorrect = given.size === expected.size && [...given].every((k) => expected.has(k));
  }
  return { isCorrect, correctAnswer: canonical };
}

function gradeFillBlank(payload: FillBlankPayload, answer: unknown): GradeResult {
  const accepted = new Set(payload.accepted_answers.map(normalizeAnswer));
  return {
    isCorrect: typeof answer === 'string' && accepted.has(normalizeAnswer(answer)),
    correctAnswer: payload.accepted_answers[0] ?? '',
  };
}

/**
 * Chấm một bài tập. `language` là ngôn ngữ người học đang thấy (vế ghép dạng văn bản dịch được
 * so khớp theo ngôn ngữ đó). `payload` sai cấu trúc là lỗi dữ liệu nội dung, do kiểm tra nội dung chặn từ trước.
 */
export function gradeExercise(
  type: ExerciseType,
  payload: Record<string, unknown>,
  answer: unknown,
  language: Language = DEFAULT_LANGUAGE,
): GradeResult {
  switch (type) {
    case 'multiple_choice':
      return gradeMultipleChoice(payload as unknown as MultipleChoicePayload, answer);
    case 'matching':
      return gradeMatching(payload as unknown as MatchingPayload, answer, language);
    case 'fill_blank':
      return gradeFillBlank(payload as unknown as FillBlankPayload, answer);
  }
}
