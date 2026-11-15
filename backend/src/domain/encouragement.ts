import type { Language } from './types.js';

// Danh mục lời khích lệ ở màn hình "Hôm nay" (spec 007, FR-026…FR-031, SC-007). Hằng số trong mã, không phải
// bảng CSDL; văn bản đúng `specs/007-fix-comments/contracts/encouragement-catalog.md` §3. Giọng điệu luôn
// tích cực, tập trung vào bước tiếp theo; bộ từ cấm được quét bởi `tests/unit/encouragement-catalog.test.ts`.
// `{n}` (chỉ ở `streak`) được thay bằng số ngày của chuỗi học.

export const ENCOURAGEMENT_STATES = [
  'not_started',
  'in_progress',
  'day_completed',
  'streak',
  'welcome_back',
  'behind_target',
] as const;
export type EncouragementState = (typeof ENCOURAGEMENT_STATES)[number];

/** Chuỗi học tối thiểu (ngày) để hiện lời khích lệ theo chuỗi. */
export const STREAK_MIN_DAYS = 3;

export type EncouragementText = Record<Language, string>;

export const ENCOURAGEMENT_CATALOG: Record<EncouragementState, readonly EncouragementText[]> = {
  not_started: [
    {
      vi: 'Một buổi học ngắn hôm nay là đủ để tiến thêm một bước. Bắt đầu thôi nào!',
      en: "A short session today is enough to take one more step. Let's begin!",
    },
    {
      vi: 'Chào bạn! Vài phút học hôm nay sẽ giúp tiếng Nhật của bạn chắc hơn từng chút.',
      en: 'Hello! A few minutes today will make your Japanese a little stronger.',
    },
    {
      vi: 'Mỗi bài học nhỏ là một viên gạch cho mục tiêu của bạn. Chọn bài đầu tiên nhé!',
      en: 'Every small lesson is a brick toward your goal. Pick the first one!',
    },
    {
      vi: 'Sẵn sàng chưa? Bài đầu tiên của hôm nay đang chờ bạn.',
      en: "Ready? Today's first lesson is waiting for you.",
    },
  ],
  in_progress: [
    {
      vi: 'Bạn đã bắt đầu rồi, tuyệt lắm! Còn vài bài nữa là xong ngày hôm nay.',
      en: "You've already started, great job! Just a few more lessons to finish today.",
    },
    {
      vi: 'Làm tốt lắm, bạn đang đi đúng nhịp. Tiếp tục bài kế tiếp nhé!',
      en: "Nice work, you're right on rhythm. On to the next lesson!",
    },
    {
      vi: 'Mỗi bài hoàn thành là một bước tiến. Chỉ còn một chút nữa thôi!',
      en: 'Every finished lesson is progress. Just a little more to go!',
    },
    {
      vi: 'Bạn đã làm được một phần rồi, phần còn lại sẽ nhẹ nhàng hơn bạn nghĩ.',
      en: "You've done part of it already, and the rest will feel lighter than you think.",
    },
  ],
  day_completed: [
    {
      vi: 'Chúc mừng! Bạn đã hoàn thành kế hoạch hôm nay. Nghỉ ngơi xứng đáng nhé!',
      en: "Congratulations! You've finished today's plan. Enjoy a well-earned rest!",
    },
    {
      vi: 'Xuất sắc! Nỗ lực hôm nay của bạn thật đáng ghi nhận.',
      en: "Excellent! Today's effort is truly worth recognizing.",
    },
    {
      vi: 'Hôm nay bạn đã làm xong tất cả. Hẹn gặp lại bạn vào ngày mai!',
      en: "You've done everything for today. See you tomorrow!",
    },
    {
      vi: 'Tuyệt vời, một ngày học trọn vẹn! Kiến thức hôm nay sẽ ở lại với bạn lâu.',
      en: "Wonderful, a complete day of learning! Today's knowledge will stay with you.",
    },
  ],
  streak: [
    {
      vi: 'Bạn đã học liên tiếp {n} ngày, một thói quen tuyệt vời đang hình thành!',
      en: "You've studied {n} days in a row, a great habit is forming!",
    },
    {
      vi: '{n} ngày liền! Sự đều đặn của bạn thật đáng ngưỡng mộ.',
      en: '{n} days straight! Your consistency is admirable.',
    },
    {
      vi: 'Chuỗi {n} ngày học cho thấy sự kiên trì của bạn. Hôm nay tiếp tục nhé!',
      en: "Your {n}-day streak shows real perseverance. Let's keep going today!",
    },
    {
      vi: 'Mỗi ngày một chút, bạn đã đi được {n} ngày liên tiếp. Làm tốt lắm!',
      en: "A little each day, and you've reached {n} days in a row. Well done!",
    },
  ],
  welcome_back: [
    {
      vi: 'Chào mừng bạn quay lại! Hôm nay mình bắt đầu thật nhẹ nhàng nhé.',
      en: "Welcome back! Let's start gently today.",
    },
    {
      vi: 'Rất vui được gặp lại bạn. Kế hoạch hôm nay đã được chuẩn bị vừa sức cho bạn.',
      en: "So good to see you again. Today's plan has been prepared to suit you.",
    },
    {
      vi: 'Bạn đã trở lại, đó là bước quan trọng nhất. Cùng học một bài nhỏ nào!',
      en: "You're back, and that's the most important step. Let's do one small lesson!",
    },
    {
      vi: 'Chào bạn trở lại! Kiến thức cũ vẫn còn đó, mình ôn lại từng chút một.',
      en: "Welcome back! What you learned is still there, so we'll revisit it bit by bit.",
    },
  ],
  behind_target: [
    {
      vi: 'Bước tiếp theo rất đơn giản: hoàn thành một bài ngắn hôm nay.',
      en: 'The next step is simple: finish one short lesson today.',
    },
    {
      vi: 'Mỗi bài học hôm nay đưa bạn đến gần mục tiêu hơn. Bắt đầu với bài đầu tiên nhé!',
      en: 'Every lesson today brings you closer to your goal. Start with the first one!',
    },
    {
      vi: 'Chỉ cần tập trung vào hôm nay: một bài nhỏ, một bước tiến chắc chắn.',
      en: 'Just focus on today: one small lesson, one solid step.',
    },
    {
      vi: 'Mục tiêu của bạn vẫn trong tầm tay. Một bài hôm nay sẽ giúp ích rất nhiều.',
      en: 'Your goal is still within reach. One lesson today will help a lot.',
    },
  ],
};
