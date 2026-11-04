import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { gradePlacement, type PlacementQuestionKey } from '../../src/engine/placement.js';
import type { ContentLevel } from '../../src/domain/types.js';
import { loadLearnerProfile } from '../fixtures/learner-profiles/index.js';
import { DEFAULT_CONTENT_DIR, type PlacementFile } from '../../src/seed/content.js';

// Kiểm thử engine chấm placement (T034, research R8) trên bộ câu hỏi thật `placement-v1.json`.

const placement = JSON.parse(
  readFileSync(`${DEFAULT_CONTENT_DIR}/placement/placement-v1.json`, 'utf8'),
) as PlacementFile;

/** Khóa câu hỏi: id = `q<position>`, `topicId` = khóa mảng trong content. */
const questions: PlacementQuestionKey[] = placement.questions.map((q) => ({
  id: `q${q.position}`,
  level: q.level,
  topicId: q.topic,
  correctChoice: q.correctChoice,
}));

/** Tạo câu trả lời: đúng với vị trí thỏa `isCorrect`, sai (chọn lệch đáp án) với vị trí còn lại. */
function answersWhere(isCorrect: (position: number, level: ContentLevel) => boolean) {
  return placement.questions.map((q) => ({
    questionId: `q${q.position}`,
    choice: isCorrect(q.position, q.level) ? q.correctChoice : (q.correctChoice + 1) % 4,
  }));
}

describe('gradePlacement – trình độ ước tính', () => {
  it('đúng hết → N3, không nghi đoán mò, không có mảng yếu', () => {
    const r = gradePlacement(
      questions,
      answersWhere(() => true),
    );
    expect(r).toMatchObject({ score: 20, total: 20, estimatedLevel: 'N3', guessSuspected: false });
    expect(r.weakTopics).toEqual([]);
    expect(r.strongTopics.length).toBeGreaterThan(0);
  });

  it('đạt N5 và N4 nhưng sai hết N3 → N4', () => {
    const r = gradePlacement(
      questions,
      answersWhere((_, level) => level !== 'N3'),
    );
    expect(r.estimatedLevel).toBe('N4');
    expect(r.score).toBe(14);
  });

  it('đạt N5 (5/8 = 62,5%) nhưng N4 dưới 60% → N5', () => {
    // Đúng 5 câu N5 đầu và 3/6 câu N4 (50%).
    const r = gradePlacement(
      questions,
      answersWhere((p) => (p >= 1 && p <= 5) || (p >= 9 && p <= 11)),
    );
    expect(r.estimatedLevel).toBe('N5');
  });

  it('nhóm cao đạt nhưng nhóm thấp hơn dưới 60% → không tính nhóm cao (N5 hỏng → none)', () => {
    // N5 chỉ 4/8 = 50%, nhưng toàn bộ N4 + N3 đúng (16/20 = 80% tổng).
    const r = gradePlacement(
      questions,
      answersWhere((p, level) => level !== 'N5' || p <= 4),
    );
    expect(r.score).toBe(16);
    expect(r.estimatedLevel).toBe('none');
    expect(r.guessSuspected).toBe(false);
  });

  it('ngưỡng 60%: N4 đúng 4/6 (66,7%) đạt, 3/6 (50%) không đạt', () => {
    const pass = gradePlacement(
      questions,
      answersWhere((p, level) => level === 'N5' || (level === 'N4' && p <= 12)),
    );
    expect(pass.estimatedLevel).toBe('N4');
    const fail = gradePlacement(
      questions,
      answersWhere((p, level) => level === 'N5' || (level === 'N4' && p <= 11)),
    );
    expect(fail.estimatedLevel).toBe('N5');
  });

  it('N5 chỉ đúng 4/8 (50%) → none dù tổng 6/20 = 30% chưa bị coi là đoán mò', () => {
    const r = gradePlacement(
      questions,
      answersWhere((p) => p <= 4 || p === 9 || p === 10),
    );
    expect(r.score).toBe(6);
    expect(r.estimatedLevel).toBe('none');
    expect(r.guessSuspected).toBe(false);
  });
});

describe('gradePlacement – đoán mò', () => {
  it('tổng tỷ lệ đúng ≤ 25% → none kèm guessSuspected, kể cả khi N5 đạt trên giấy', () => {
    // 5/20 = 25%: đúng cả 5 câu đều thuộc N5 (5/8 = 62,5% ≥ 60%) nhưng tổng vẫn là đoán mò.
    const r = gradePlacement(
      questions,
      answersWhere((p) => p <= 5),
    );
    expect(r.score).toBe(5);
    expect(r.guessSuspected).toBe(true);
    expect(r.estimatedLevel).toBe('none');
  });

  it('trên 25% (2/4 = 50%) không bị coi là đoán mò', () => {
    const small = questions.slice(0, 4);
    const r = gradePlacement(
      small,
      small.map((q, i) => ({ questionId: q.id, choice: i < 2 ? q.correctChoice : null })),
    );
    expect(r.guessSuspected).toBe(false);
  });

  it('hồ sơ placement-guesser: 5/20 → none, guessSuspected', () => {
    const fixture = loadLearnerProfile('placement-guesser');
    const correct = fixture.placement!.correctByPosition;
    const r = gradePlacement(
      questions,
      answersWhere((p) => correct[p - 1] === true),
    );
    expect(r).toMatchObject(fixture.expected.placement!);
  });
});

describe('gradePlacement – mảng mạnh/yếu và dữ liệu thiếu', () => {
  it('mảng yếu = tỷ lệ đúng < 50% (1/2 = 50% không phải yếu; 0/2 là yếu)', () => {
    // `particles` có câu 6 và 7; `te-form` có câu 11 và 12.
    const r = gradePlacement(
      questions,
      answersWhere((p) => p !== 6 && p !== 7 && p !== 11),
    );
    expect(r.weakTopics).toContain('particles'); // 0/2
    expect(r.weakTopics).not.toContain('te-form'); // 1/2
  });

  it('mảng mạnh khi đúng từ 80% trở lên', () => {
    const r = gradePlacement(
      questions,
      answersWhere((p) => p !== 6),
    );
    expect(r.strongTopics).toContain('numbers'); // 1/1
    expect(r.strongTopics).not.toContain('particles'); // 1/2
  });

  it('câu bỏ trống (null) và câu không có trả lời tính là sai', () => {
    const r = gradePlacement(questions, [
      { questionId: 'q1', choice: null },
      { questionId: 'q2', choice: questions[1]!.correctChoice },
    ]);
    expect(r.score).toBe(1);
    expect(r.total).toBe(20);
  });

  it('bỏ qua câu trả lời cho id không thuộc bộ câu hỏi', () => {
    const r = gradePlacement(questions, [{ questionId: 'khong-ton-tai', choice: 0 }]);
    expect(r.score).toBe(0);
  });

  it('không có câu hỏi → điểm 0, không nghi đoán mò, none', () => {
    expect(gradePlacement([], [])).toMatchObject({
      score: 0,
      total: 0,
      estimatedLevel: 'none',
      guessSuspected: false,
    });
  });
});
