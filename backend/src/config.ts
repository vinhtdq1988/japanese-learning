import { z } from 'zod';
import { DEFAULT_FONT_PATH } from './domain/font-coverage.js';

// Cấu hình môi trường: đọc và kiểm tra một lần khi khởi động (xem `.env.example`).

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL là bắt buộc'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET phải dài ít nhất 32 ký tự'),
  SMTP_URL: z.string().min(1, 'SMTP_URL là bắt buộc'),
  APP_BASE_URL: z.url(),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  // Giới hạn tần suất theo IP (số yêu cầu/phút/IP, R9, FR-040)
  RATE_LIMIT_TRIAL_PER_MIN: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_TRIAL_GRADE_PER_MIN: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_AUTH_PER_MIN: z.coerce.number().int().positive().default(10),

  // Ngưỡng engine (R6/R7)
  DIFFICULTY_LOW_THRESHOLD_PCT: z.coerce.number().min(0).max(100).default(60),
  DIFFICULTY_HIGH_THRESHOLD_PCT: z.coerce.number().min(0).max(100).default(90),
  REVIEW_SECONDS_PER_ITEM: z.coerce.number().int().positive().default(30),

  // Phông đóng gói cho client, dùng kiểm tra phủ glyph của nội dung Kanji (research K9, FR-006)
  FONT_PATH: z.string().min(1).default(DEFAULT_FONT_PATH),

  // Tổ chức, lớp học và seat (spec 004, research O16)
  /** Số ngày lời mời còn hiệu lực. */
  INVITATION_TTL_DAYS: z.coerce.number().int().positive().default(14),
  /** Số ngày ân hạn mặc định sau khi hết hạn giấy phép (chỉnh được theo từng giấy phép, 0–60). */
  SEAT_GRACE_DAYS: z.coerce.number().int().min(0).max(60).default(7),
  /** Số lần đổi người giữ tối đa của mỗi seat trong một kỳ hạn (mặc định cho giấy phép mới). */
  SEAT_MAX_REASSIGNMENTS: z.coerce.number().int().min(0).default(2),
  /** Còn ≤ số ngày này đến hạn giấy phép thì cảnh báo "sắp hết". */
  SEAT_EXPIRY_WARNING_DAYS: z.coerce.number().int().positive().default(14),
  /** Số thành viên đang hoạt động tối đa của một lớp. */
  CLASS_MAX_MEMBERS: z.coerce.number().int().positive().default(100),
  /** Số dòng dữ liệu tối đa của một file CSV nhập học viên. */
  CSV_IMPORT_MAX_ROWS: z.coerce.number().int().positive().default(200),
  /** Kích thước thân tối đa của yêu cầu nhập CSV (byte). */
  CSV_IMPORT_MAX_BYTES: z.coerce.number().int().positive().default(262144),
  /** Số lần nhập sai mã tham gia (theo tài khoản) trước khi tạm khóa. */
  JOIN_CODE_MAX_FAILURES: z.coerce.number().int().positive().default(5),
  /** Thời gian khóa nhập mã tham gia (phút), cũng là độ dài cửa sổ đếm lần sai. */
  JOIN_CODE_LOCK_MINUTES: z.coerce.number().int().positive().default(15),
  /** Ngưỡng số ngày vắng mặc định của lớp mới (giáo viên chỉnh 1–14). */
  CLASS_ABSENCE_DEFAULT_DAYS: z.coerce.number().int().min(1).max(14).default(3),
  /** Biên (%) để coi học viên là chậm/vượt tiến độ so với mốc. */
  CLASS_PROGRESS_MARGIN_PCT: z.coerce.number().min(0).max(100).default(10),
  /** Chủ đề của lớp bị coi là yếu khi độ chính xác dưới ngưỡng này (%). */
  CLASS_WEAK_ACCURACY_PCT: z.coerce.number().min(0).max(100).default(60),
  /** Số lượt trả lời tối thiểu của cả lớp trên một chủ đề để xét yếu. */
  CLASS_WEAK_MIN_ANSWERS: z.coerce.number().int().positive().default(30),
  /** Múi giờ IANA dùng để tính ngày giấy phép (không phải ngày học của từng học viên). */
  ORG_TIMEZONE: z.string().min(1).default('Asia/Ho_Chi_Minh'),
});

export type Config = z.infer<typeof envSchema> & {
  /** Thời hạn access token (giây): 15 phút, R4. */
  ACCESS_TOKEN_TTL_SECONDS: number;
  /** Thời hạn refresh token (giây): 30 ngày, R4. */
  REFRESH_TOKEN_TTL_SECONDS: number;
  /** Thời hạn token đặt lại mật khẩu (giây): 1 giờ, R4. */
  PASSWORD_RESET_TTL_SECONDS: number;
};

/** Nạp file `.env` ở thư mục hiện tại (nếu có) vào `process.env`; biến đã đặt sẵn không bị ghi đè. */
export function loadDotEnv(file = '.env'): void {
  try {
    process.loadEnvFile(file);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
}

/**
 * Đọc và kiểm tra biến môi trường. Nhận `env` làm tham số để kiểm thử không phụ thuộc `process.env`.
 * Ném lỗi liệt kê đủ mọi biến sai để người vận hành sửa một lần.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(env)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Cấu hình môi trường không hợp lệ:\n${details}`);
  }
  if (parsed.data.DIFFICULTY_LOW_THRESHOLD_PCT >= parsed.data.DIFFICULTY_HIGH_THRESHOLD_PCT) {
    throw new Error(
      'Cấu hình môi trường không hợp lệ: DIFFICULTY_LOW_THRESHOLD_PCT phải nhỏ hơn DIFFICULTY_HIGH_THRESHOLD_PCT',
    );
  }
  return {
    ...parsed.data,
    ACCESS_TOKEN_TTL_SECONDS: 15 * 60,
    REFRESH_TOKEN_TTL_SECONDS: 30 * 24 * 60 * 60,
    PASSWORD_RESET_TTL_SECONDS: 60 * 60,
  };
}
