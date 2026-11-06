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

/** Chữ Kanji mẫu CHƯA có trong thư viện seed (27 chữ ở research K14), đủ glyph trong phông đóng gói. */
const KANJI_SAMPLES = [
  {
    japanese: '山',
    on: ['サン'],
    kun: ['やま'],
    strokes: 3,
    meaning: { vi: 'núi', en: 'mountain' },
    examples: [
      { ja: '山', reading: 'やま', kanjiReading: 'やま', vi: 'núi', en: 'mountain' },
      { ja: '富士山', reading: 'ふじさん', kanjiReading: 'サン', vi: 'núi Phú Sĩ', en: 'Mt. Fuji' },
    ],
  },
  {
    japanese: '川',
    on: ['セン'],
    kun: ['かわ'],
    strokes: 3,
    meaning: { vi: 'sông', en: 'river' },
    examples: [
      { ja: '川', reading: 'かわ', kanjiReading: 'かわ', vi: 'sông', en: 'river' },
      { ja: '小川', reading: 'おがわ', kanjiReading: 'かわ', vi: 'suối nhỏ', en: 'stream' },
    ],
  },
  {
    japanese: '田',
    on: ['デン'],
    kun: ['た'],
    strokes: 5,
    meaning: { vi: 'ruộng', en: 'rice field' },
    examples: [
      { ja: '田んぼ', reading: 'たんぼ', kanjiReading: 'た', vi: 'ruộng lúa', en: 'paddy' },
      { ja: '水田', reading: 'すいでん', kanjiReading: 'デン', vi: 'ruộng nước', en: 'wet field' },
    ],
  },
  {
    japanese: '火',
    on: ['カ'],
    kun: ['ひ'],
    strokes: 4,
    meaning: { vi: 'lửa', en: 'fire' },
    examples: [
      { ja: '火', reading: 'ひ', kanjiReading: 'ひ', vi: 'lửa', en: 'fire' },
      { ja: '火曜日', reading: 'かようび', kanjiReading: 'カ', vi: 'thứ Ba', en: 'Tuesday' },
    ],
  },
  {
    japanese: '水',
    on: ['スイ'],
    kun: ['みず'],
    strokes: 4,
    meaning: { vi: 'nước', en: 'water' },
    examples: [
      { ja: '水', reading: 'みず', kanjiReading: 'みず', vi: 'nước', en: 'water' },
      { ja: '水曜日', reading: 'すいようび', kanjiReading: 'スイ', vi: 'thứ Tư', en: 'Wednesday' },
    ],
  },
] as const;

/**
 * Payload bài Kanji 5 phút đạt đủ quy tắc K10: 3 chữ × 3 khía cạnh = 9 bài tập (≤ 10 câu của quỹ 5 phút),
 * `goalTags` không rỗng, mỗi chữ có chủ đề Kanji (`itemTopicId`) và ≥ 2 từ ví dụ. `unitTopicId` là chủ đề cấp
 * đơn vị (kỹ năng kanji, cùng trình độ). `sampleIndexes` chọn chữ mẫu (0 山, 1 川, 2 田, 3 火, 4 水) để dựng
 * hai bài khác nhau mà không trùng chữ.
 */
export function kanjiUnitPayload(
  unitTopicId: string,
  itemTopicId: string,
  overrides: Record<string, unknown> = {},
  sampleIndexes: readonly number[] = [0, 1, 2],
) {
  const samples = sampleIndexes.map((i) => KANJI_SAMPLES[i]!);
  const items = samples.map((k) => ({
    japanese: k.japanese,
    reading: null,
    meaning: k.meaning,
    topicId: itemTopicId,
    kanjiDetails: {
      onReadings: [...k.on],
      kunReadings: [...k.kun],
      strokeCount: k.strokes,
      components: null,
    },
    examples: k.examples.map((e) => ({
      ja: e.ja,
      reading: e.reading,
      kanjiReading: e.kanjiReading,
      translation: { vi: e.vi, en: e.en },
    })),
  }));
  const exercises = samples.flatMap((k, itemIndex) => [
    {
      itemIndex,
      facet: 'meaning',
      type: 'multiple_choice',
      prompt: { vi: `「${k.japanese}」 nghĩa là gì?`, en: `What does 「${k.japanese}」 mean?` },
      payload: {
        choices: [`${k.meaning.vi} / ${k.meaning.en}`, 'lửa / fire', 'trăng / moon'],
        correct_index: 0,
      },
      feedbackCorrect: { vi: 'Đúng!', en: 'Correct!' },
      feedbackIncorrect: {
        vi: `${k.japanese} nghĩa là ${k.meaning.vi}.`,
        en: `It means ${k.meaning.en}.`,
      },
    },
    {
      itemIndex,
      facet: 'reading',
      type: 'fill_blank',
      prompt: {
        vi: `Viết âm Kun của 「${k.japanese}」.`,
        en: `Write the kun reading of 「${k.japanese}」.`,
      },
      payload: { accepted_answers: [k.kun[0]] },
      feedbackCorrect: { vi: 'Chính xác!', en: 'Exactly!' },
      feedbackIncorrect: { vi: `Đọc là ${k.kun[0]}.`, en: `It is read ${k.kun[0]}.` },
    },
    {
      itemIndex,
      facet: 'word',
      type: 'multiple_choice',
      prompt: {
        vi: `Từ nào chứa chữ 「${k.japanese}」?`,
        en: `Which word contains 「${k.japanese}」?`,
      },
      payload: { choices: [k.examples[0].ja, '火事', '月曜'], correct_index: 0 },
      feedbackCorrect: { vi: 'Đúng!', en: 'Correct!' },
      feedbackIncorrect: { vi: `Đáp án là ${k.examples[0].ja}.`, en: `It is ${k.examples[0].ja}.` },
    },
  ]);
  return {
    kind: 'kanji',
    title: { vi: 'Kanji kiểm thử quản trị', en: 'Admin test kanji' },
    level: 'N5',
    tier: 'core',
    goalTags: ['jlpt', 'daily_conversation'],
    topicId: unitTopicId,
    difficulty: 1,
    estMinutes: 5,
    sequence: 5000,
    items,
    exercises,
    ...overrides,
  };
}

/** Bản ghi trong CSDL (kiểm tra trạng thái sau thao tác). */
export const rows = async <T = any>(ctx: TestApp, sqlText: string, params: unknown[] = []) =>
  (await ctx.handle.pool.query(sqlText, params)).rows as T[];
