import { describe, expect, it } from 'vitest';
import { suggestAfterExhaustion } from '../../src/services/daily-plan.js';

describe('suggestAfterExhaustion (hết nội dung phù hợp khi học thêm)', () => {
  const skills = ['vocabulary', 'grammar'];

  it('còn nội dung ở trình độ cao hơn trong N5–N3 → nâng trình độ', () => {
    expect(
      suggestAfterExhaustion({ levelRange: ['N5', 'N5'] }, skills, [
        { kind: 'vocabulary', level: 'N5' },
        { kind: 'grammar', level: 'N4' },
      ]),
    ).toBe('raise_level');
  });

  it('đã ở trần N3 nhưng còn kỹ năng chưa chọn → thêm kỹ năng', () => {
    expect(
      suggestAfterExhaustion(
        { levelRange: ['N5', 'N3'] },
        ['vocabulary'],
        [
          { kind: 'vocabulary', level: 'N3' },
          { kind: 'grammar', level: 'N5' },
        ],
      ),
    ).toBe('add_skill');
  });

  it('không còn gì để gợi ý → đã hết nội dung', () => {
    expect(
      suggestAfterExhaustion({ levelRange: ['N5', 'N3'] }, skills, [
        { kind: 'vocabulary', level: 'N3' },
        { kind: 'grammar', level: 'N5' },
      ]),
    ).toBe('content_exhausted');
  });

  it('nội dung cao hơn nhưng thuộc kỹ năng không chọn không tính là nâng trình độ', () => {
    expect(
      suggestAfterExhaustion(
        { levelRange: ['N5', 'N5'] },
        ['vocabulary'],
        [
          { kind: 'vocabulary', level: 'N5' },
          { kind: 'grammar', level: 'N4' },
        ],
      ),
    ).toBe('add_skill');
  });
});
