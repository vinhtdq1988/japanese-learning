/* eslint-disable @typescript-eslint/no-explicit-any */
import { ContractClient } from '../contract/client.js';
import { createAdmin } from '../../src/seed/create-admin.js';
import type { TestApp } from './helpers.js';

// Tiện ích dùng chung cho kiểm thử US6 (quản trị): tạo admin đăng nhập được, dựng payload đơn vị học hợp lệ.

export const ADMIN_PASSWORD = 'Admin-Matkhau-123';

export interface AdminSession {
  token: string;
  userId: string;
  email: string;
}

let counter = 0;

/** Tạo tài khoản admin bằng lệnh vận hành (không có đường công khai) rồi đăng nhập lấy token. */
export async function adminSession(api: ContractClient, ctx: TestApp): Promise<AdminSession> {
  counter += 1;
  const email = `admin${counter}-${Date.now()}@example.com`;
  const { userId } = await createAdmin(ctx.handle.db, email, ADMIN_PASSWORD);
  const login = await api.post('/auth/login', { body: { email, password: ADMIN_PASSWORD } });
  if (login.status !== 200) throw new Error(`Admin đăng nhập lỗi: ${JSON.stringify(login.body)}`);
  return { token: login.body.accessToken, userId, email };
}

/** Một mảng nội dung bất kỳ khớp (kỹ năng × trình độ). */
export async function topicIdFor(ctx: TestApp, skill: string, level: string): Promise<string> {
  const { rows } = await ctx.handle.pool.query(
    'SELECT id FROM topics WHERE skill = $1 AND level = $2 ORDER BY created_at LIMIT 1',
    [skill, level],
  );
  if (rows.length === 0) throw new Error(`Không có mảng ${level} × ${skill}`);
  return rows[0].id;
}

/**
 * Payload đơn vị từ vựng đạt đủ quy tắc nội dung: 2 mục, 3 bài tập (2 trắc nghiệm + 1 điền chỗ trống).
 * `sequence` rất nhỏ và `tier=foundation` để đơn vị xếp đầu lộ trình người mới (kiểm thử chọn qua học thêm).
 */
export function vocabUnitPayload(topicId: string, overrides: Record<string, unknown> = {}) {
  return {
    kind: 'vocabulary',
    title: { vi: 'Từ vựng kiểm thử quản trị', en: 'Admin test vocabulary' },
    level: 'N5',
    tier: 'foundation',
    goalTags: ['daily_conversation'],
    topicId,
    difficulty: 1,
    estMinutes: 5,
    sequence: -100000,
    items: [
      {
        japanese: '試験',
        reading: 'しけん',
        meaning: { vi: 'kỳ thi', en: 'exam' },
        examples: [
          {
            ja: '明日、試験があります。',
            translation: { vi: 'Ngày mai có kỳ thi.', en: 'There is an exam tomorrow.' },
          },
        ],
      },
      {
        japanese: '宿題',
        reading: 'しゅくだい',
        meaning: { vi: 'bài tập về nhà', en: 'homework' },
      },
    ],
    exercises: [
      {
        itemIndex: 0,
        type: 'multiple_choice',
        prompt: { vi: '「試験」nghĩa là gì?', en: 'What does 「試験」 mean?' },
        payload: {
          choices: ['kỳ thi / exam', 'bài tập / homework', 'bữa ăn / meal'],
          correct_index: 0,
        },
        feedbackCorrect: { vi: 'Đúng! 試験 là kỳ thi.', en: 'Correct! 試験 is an exam.' },
        feedbackIncorrect: { vi: '試験 nghĩa là kỳ thi.', en: '試験 means exam.' },
      },
      {
        itemIndex: 1,
        type: 'fill_blank',
        prompt: { vi: 'Viết cách đọc của 「宿題」.', en: 'Write the reading of 「宿題」.' },
        payload: { accepted_answers: ['しゅくだい'] },
        feedbackCorrect: { vi: 'Chính xác!', en: 'Exactly!' },
        feedbackIncorrect: { vi: 'Đọc là しゅくだい.', en: 'It is read しゅくだい.' },
      },
      {
        itemIndex: 0,
        type: 'multiple_choice',
        prompt: { vi: 'Chọn cách đọc của 「試験」.', en: 'Choose the reading of 「試験」.' },
        payload: { choices: ['しけん', 'しゅくだい', 'しごと'], correct_index: 0 },
        feedbackCorrect: { vi: 'Đúng!', en: 'Correct!' },
        feedbackIncorrect: { vi: 'Đọc là しけん.', en: 'It is read しけん.' },
      },
    ],
    ...overrides,
  };
}

/** Bản ghi trong CSDL (kiểm tra trạng thái sau thao tác). */
export const rows = async <T = any>(ctx: TestApp, sqlText: string, params: unknown[] = []) =>
  (await ctx.handle.pool.query(sqlText, params)).rows as T[];
