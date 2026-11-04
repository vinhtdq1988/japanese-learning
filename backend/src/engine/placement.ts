import { CONTENT_LEVELS, type ContentLevel } from '../domain/types.js';

// Engine chấm bài kiểm tra trình độ và ước tính trình độ (research R8, FR-007). Hàm thuần, tất định,
// không phụ thuộc HTTP/CSDL.

/** Tỷ lệ đúng tối thiểu của một nhóm trình độ để coi là "đạt" nhóm đó. */
export const LEVEL_PASS_RATIO = 0.6;
/** Mảng có tỷ lệ đúng dưới ngưỡng này là mảng yếu. */
export const WEAK_TOPIC_RATIO = 0.5;
/** Mảng có tỷ lệ đúng từ ngưỡng này trở lên là mảng mạnh. */
export const STRONG_TOPIC_RATIO = 0.8;
/** Tổng tỷ lệ đúng không vượt ngưỡng này nghĩa là xấp xỉ đoán mò (4 lựa chọn → 25%). */
export const GUESS_RATIO = 0.25;

export interface PlacementQuestionKey {
  id: string;
  level: ContentLevel;
  topicId: string;
  correctChoice: number;
}

export interface PlacementAnswer {
  questionId: string;
  /** Chỉ số lựa chọn; null = bỏ trống (tính là sai). */
  choice: number | null;
}

export type EstimatedLevel = 'none' | ContentLevel;

export interface PlacementOutcome {
  score: number;
  total: number;
  estimatedLevel: EstimatedLevel;
  /** `topicId` của các mảng mạnh/yếu. */
  strongTopics: string[];
  weakTopics: string[];
  guessSuspected: boolean;
}

/**
 * Chấm bộ câu hỏi `questions` với các câu trả lời `answers`. Câu không có trả lời hoặc bỏ trống tính sai.
 *
 * - Trình độ ước tính = mức cao nhất mà tỷ lệ đúng của nhóm ≥ 60% và mọi nhóm thấp hơn cũng ≥ 60%;
 *   nhóm N5 không đạt → `none`.
 * - Tổng tỷ lệ đúng ≤ 25% (xấp xỉ đoán mò) → `none` kèm `guessSuspected`.
 * - Mảng yếu: tỷ lệ đúng của mảng < 50%; mảng mạnh: ≥ 80%.
 */
export function gradePlacement(
  questions: readonly PlacementQuestionKey[],
  answers: readonly PlacementAnswer[],
): PlacementOutcome {
  const choiceByQuestion = new Map<string, number | null>();
  for (const a of answers) choiceByQuestion.set(a.questionId, a.choice);

  const perLevel = new Map<ContentLevel, { correct: number; total: number }>();
  const perTopic = new Map<string, { correct: number; total: number }>();
  let score = 0;

  for (const q of questions) {
    const isCorrect = choiceByQuestion.get(q.id) === q.correctChoice;
    if (isCorrect) score += 1;
    for (const [map, key] of [
      [perLevel, q.level],
      [perTopic, q.topicId],
    ] as const) {
      const entry = (map as Map<string, { correct: number; total: number }>).get(key) ?? {
        correct: 0,
        total: 0,
      };
      entry.total += 1;
      if (isCorrect) entry.correct += 1;
      (map as Map<string, { correct: number; total: number }>).set(key, entry);
    }
  }

  const total = questions.length;
  const guessSuspected = total > 0 && score / total <= GUESS_RATIO;

  let estimatedLevel: EstimatedLevel = 'none';
  for (const level of CONTENT_LEVELS) {
    const group = perLevel.get(level);
    // Nhóm không có câu hỏi nào không thể chứng minh trình độ đó: dừng ở mức đã đạt.
    if (!group || group.correct / group.total < LEVEL_PASS_RATIO) break;
    estimatedLevel = level;
  }
  if (guessSuspected) estimatedLevel = 'none';

  const strongTopics: string[] = [];
  const weakTopics: string[] = [];
  for (const [topicId, { correct, total: n }] of perTopic) {
    const ratio = correct / n;
    if (ratio < WEAK_TOPIC_RATIO) weakTopics.push(topicId);
    else if (ratio >= STRONG_TOPIC_RATIO) strongTopics.push(topicId);
  }

  return { score, total, estimatedLevel, strongTopics, weakTopics, guessSuspected };
}
