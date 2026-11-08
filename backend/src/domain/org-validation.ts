import { z } from 'zod';
import { DASHBOARD_FILTERS, DASHBOARD_SORTS } from './org-types.js';
import { DAILY_MINUTES, LEVELS, SKILLS, TARGET_LEVELS } from './types.js';

// Kiểm tra dữ liệu vào của các route tổ chức/lớp (spec 004). File này chứa các primitive dùng chung; schema
// body của từng câu chuyện được bổ sung dần ở các task sau (cùng file nên KHÔNG chạy song song).
// Thông báo lỗi cụ thể theo trường, bằng tiếng Việt.

/** Email dùng cho lời mời: cắt khoảng trắng, chuẩn hóa chữ thường, ≤ 254 ký tự, đúng định dạng. */
export const orgEmailSchema = z
  .string({ error: 'Email là bắt buộc' })
  .trim()
  .max(254, 'Email quá dài')
  .pipe(z.email('Email không đúng định dạng'))
  .transform((v) => v.toLowerCase());

/** Mã định danh (uuid) trong body hoặc tham số đường dẫn. */
export const orgUuidSchema = z.uuid({ error: 'Mã định danh không hợp lệ' });

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Ngày `YYYY-MM-DD` hợp lệ trong lịch (từ chối `2026-02-30`). */
export const localDateSchema = z
  .string({ error: 'Ngày là bắt buộc (YYYY-MM-DD)' })
  .regex(DATE_RE, 'Ngày phải có dạng YYYY-MM-DD')
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, 'Ngày không tồn tại');

/** Thao tác ghi quan trọng PHẢI kèm `confirm: true`; thiếu hoặc khác ⇒ 422. */
export const confirmSchema = z.object({
  confirm: z.literal(true, { error: 'Cần xác nhận (confirm: true)' }),
});

/** Quỹ thời gian mỗi ngày: 5/10/15/30 phút (Nguyên tắc I, FR-017, FR-026). */
export const dailyMinutesSchema = z
  .number({ error: 'Số phút mỗi ngày là bắt buộc' })
  .refine(
    (v): v is (typeof DAILY_MINUTES)[number] => (DAILY_MINUTES as readonly number[]).includes(v),
    {
      error: 'Số phút mỗi ngày phải là 5, 10, 15 hoặc 30',
    },
  );

/** Tên tổ chức/lớp: 1–120 ký tự sau khi cắt khoảng trắng. */
export const orgNameSchema = z
  .string({ error: 'Tên là bắt buộc' })
  .trim()
  .min(1, 'Tên không được để trống')
  .max(120, 'Tên tối đa 120 ký tự');

// --- US1: quản trị viên cấp tổ chức/giấy phép, chủ tổ chức mời giáo viên, trả lời lời mời ---

/** Số seat tối đa của một giấy phép (chặn nhập nhầm làm tạo hàng triệu dòng). */
export const MAX_LICENSE_SEATS = 10_000;

const seatCountSchema = z
  .number({ error: 'Số seat phải là số nguyên' })
  .int('Số seat phải là số nguyên')
  .max(MAX_LICENSE_SEATS, `Số seat tối đa ${MAX_LICENSE_SEATS}`);

const graceDaysSchema = z
  .number({ error: 'Số ngày ân hạn phải là số nguyên' })
  .int('Số ngày ân hạn phải là số nguyên')
  .min(0, 'Số ngày ân hạn từ 0 đến 60')
  .max(60, 'Số ngày ân hạn từ 0 đến 60');

const maxReassignmentsSchema = z
  .number({ error: 'Giới hạn đổi người giữ phải là số nguyên' })
  .int('Giới hạn đổi người giữ phải là số nguyên')
  .min(0, 'Giới hạn đổi người giữ không âm');

/** `POST …/licenses` và phần `license` của `POST /admin/organizations`. */
export const licenseWriteSchema = z
  .object({
    seats: seatCountSchema.min(1, 'Giấy phép cần ít nhất 1 seat'),
    startsOn: localDateSchema,
    endsOn: localDateSchema,
    graceDays: graceDaysSchema.optional(),
    maxReassignments: maxReassignmentsSchema.optional(),
  })
  .refine((v) => v.endsOn >= v.startsOn, {
    path: ['endsOn'],
    error: 'Ngày hết hạn phải từ ngày bắt đầu trở đi',
  });
export type LicenseWriteInput = z.infer<typeof licenseWriteSchema>;

/** `PATCH …/licenses/{licenseId}`: ít nhất một trường. */
export const licenseUpdateSchema = z
  .object({
    seats: seatCountSchema.min(0, 'Số seat không âm').optional(),
    endsOn: localDateSchema.optional(),
    graceDays: graceDaysSchema.optional(),
    maxReassignments: maxReassignmentsSchema.optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    error: 'Cần ít nhất một trường để cập nhật',
  });
export type LicenseUpdateInput = z.infer<typeof licenseUpdateSchema>;

export const adminOrgCreateSchema = z.object({
  name: orgNameSchema,
  ownerEmail: orgEmailSchema,
  license: licenseWriteSchema.optional(),
});
export type AdminOrgCreateInput = z.infer<typeof adminOrgCreateSchema>;

export const adminOrgUpdateSchema = z
  .object({
    name: orgNameSchema.optional(),
    status: z.enum(['active', 'disabled'], { error: 'Trạng thái không hợp lệ' }).optional(),
  })
  .refine((v) => v.name !== undefined || v.status !== undefined, {
    error: 'Cần ít nhất một trường để cập nhật',
  });
export type AdminOrgUpdateInput = z.infer<typeof adminOrgUpdateSchema>;

export const adminOrgListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(['active', 'disabled'], { error: 'Trạng thái không hợp lệ' }).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

/** Body chỉ gồm email: mời chủ tổ chức, mời giáo viên. */
export const emailBodySchema = z.object({ email: orgEmailSchema });

// --- US2: lớp học, lời mời học viên, mã tham gia ---

export const classCreateSchema = z.object({
  name: orgNameSchema,
  description: z.string().trim().max(2000, 'Mô tả tối đa 2000 ký tự').nullable().optional(),
  teacherIds: z.array(orgUuidSchema).max(50, 'Tối đa 50 giáo viên').optional(),
});
export type ClassCreateInput = z.infer<typeof classCreateSchema>;

export const classPatchSchema = z
  .object({
    name: orgNameSchema.optional(),
    description: z.string().trim().max(2000, 'Mô tả tối đa 2000 ký tự').nullable().optional(),
    absenceThresholdDays: z
      .number({ error: 'Ngưỡng vắng mặt phải là số nguyên' })
      .int('Ngưỡng vắng mặt phải là số nguyên')
      .min(1, 'Ngưỡng vắng mặt từ 1 đến 14 ngày')
      .max(14, 'Ngưỡng vắng mặt từ 1 đến 14 ngày')
      .optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    error: 'Cần ít nhất một trường để cập nhật',
  });
export type ClassPatchInput = z.infer<typeof classPatchSchema>;

export const classTeachersSchema = z.object({
  userIds: z.array(orgUuidSchema, { error: 'Danh sách giáo viên không hợp lệ' }).max(50),
});

/** Số lời mời tối đa của một lần gọi `POST /classes/{id}/invitations`. */
export const MAX_INVITEES_PER_REQUEST = 50;

export const inviteLearnersSchema = z.object({
  invitees: z
    .array(
      z.object({
        // Email sai định dạng KHÔNG làm hỏng cả yêu cầu: dòng đó nhận `invalid_email` (csv-formats §1).
        email: z.string({ error: 'Email là bắt buộc' }).max(500, 'Email quá dài'),
        displayName: z.string().max(200).optional(),
      }),
      { error: 'Danh sách lời mời không hợp lệ' },
    )
    .min(1, 'Cần ít nhất một email')
    .max(MAX_INVITEES_PER_REQUEST, `Tối đa ${MAX_INVITEES_PER_REQUEST} email mỗi lần`),
});
export type InviteLearnersInput = z.infer<typeof inviteLearnersSchema>;

export const joinCodeUpdateSchema = z.object({
  enabled: z.boolean({ error: 'Cần chỉ rõ bật hay tắt mã' }),
  expiresAt: z.iso.datetime({ error: 'Hạn dùng phải là thời điểm ISO-8601' }).nullable().optional(),
});
export type JoinCodeUpdateInput = z.infer<typeof joinCodeUpdateSchema>;

export const joinByCodeSchema = z.object({
  code: z.string({ error: 'Mã là bắt buộc' }).trim().min(1, 'Mã là bắt buộc').max(32, 'Mã quá dài'),
  decision: z.enum(['join_class', 'stay_personal'], { error: 'Lựa chọn không hợp lệ' }).optional(),
  confirmed: z.boolean().optional(),
});
export type JoinByCodeInput = z.infer<typeof joinByCodeSchema>;

/** `POST /invitations/{token}/respond`. `join_class`/`stay_personal` dành cho học viên (US2). */
export const invitationRespondSchema = z.object({
  decision: z.enum(['join_class', 'stay_personal', 'accept', 'decline'], {
    error: 'Lựa chọn không hợp lệ',
  }),
  confirmed: z.boolean().optional(),
});
export type InvitationRespondInput = z.infer<typeof invitationRespondSchema>;

// --- US3: lộ trình lớp theo mẫu ---

/** `PUT /classes/{id}/path`: mẫu lộ trình (trình độ xuất phát/đích, kỹ năng, mốc, 5/10/15/30 phút). */
export const classPathTemplateSchema = z
  .object({
    startLevel: z.enum(LEVELS, { error: 'Trình độ xuất phát không hợp lệ' }),
    targetLevel: z.enum(TARGET_LEVELS, { error: 'Trình độ mục tiêu không hợp lệ' }),
    skills: z
      .array(z.enum(SKILLS, { error: 'Kỹ năng không hợp lệ' }), {
        error: 'Cần chọn ít nhất một kỹ năng',
      })
      .min(1, 'Cần chọn ít nhất một kỹ năng')
      .refine((v) => new Set(v).size === v.length, { error: 'Kỹ năng không được trùng nhau' }),
    startsOn: localDateSchema,
    endsOn: localDateSchema,
    dailyMinutes: dailyMinutesSchema,
  })
  .refine((v) => v.endsOn > v.startsOn, {
    path: ['endsOn'],
    error: 'Ngày kết thúc phải sau ngày bắt đầu',
  });
export type ClassPathTemplateInputDto = z.infer<typeof classPathTemplateSchema>;

// --- US4: bảng điều khiển lớp ---

/** Query của `GET /classes/{id}/dashboard`: khóa sắp xếp/lọc nằm trong danh sách cố định (không SQL tùy ý). */
export const classDashboardQuerySchema = z.object({
  sort: z.enum(DASHBOARD_SORTS, { error: 'Khóa sắp xếp không hợp lệ' }).optional(),
  order: z.enum(['asc', 'desc'], { error: 'Thứ tự sắp xếp không hợp lệ' }).optional(),
  filter: z.enum(DASHBOARD_FILTERS, { error: 'Bộ lọc không hợp lệ' }).optional(),
});
export type ClassDashboardQuery = z.infer<typeof classDashboardQuerySchema>;

// --- US5: chọn bài, bài giao, ghi đè riêng, tạm dừng ---

/** Số đơn vị tối đa trong danh sách chọn của một lớp. */
export const MAX_PATH_UNITS = 500;

/** `PUT /classes/{id}/path/units`: thay toàn bộ danh sách chọn; `units: []` quay lại chế độ mẫu. */
export const pathUnitsSchema = z.object({
  units: z
    .array(
      z.object({
        unitId: orgUuidSchema,
        opensOn: localDateSchema.nullish(),
      }),
      { error: 'Danh sách đơn vị là bắt buộc' },
    )
    .max(MAX_PATH_UNITS, `Tối đa ${MAX_PATH_UNITS} đơn vị`),
});
export type PathUnitsInput = z.infer<typeof pathUnitsSchema>;

/** `POST /classes/{id}/assignments`: 1–20 đơn vị không trùng, một hạn. */
export const assignmentCreateSchema = z.object({
  unitIds: z
    .array(orgUuidSchema, { error: 'Cần chọn đơn vị để giao' })
    .min(1, 'Cần chọn ít nhất một đơn vị')
    .max(20, 'Tối đa 20 đơn vị mỗi lần giao')
    .refine((v) => new Set(v).size === v.length, { error: 'Đơn vị không được trùng nhau' }),
  dueOn: localDateSchema,
});
export type AssignmentCreateInput = z.infer<typeof assignmentCreateSchema>;

/** `PUT /classes/{id}/members/{userId}/override`: phút/ngày riêng (hoặc `null` = theo lớp) và dời mốc ±60 ngày. */
export const learnerOverrideSchema = z.object({
  dailyMinutes: dailyMinutesSchema.nullish(),
  shiftDays: z
    .number({ error: 'Số ngày dời mốc là bắt buộc' })
    .int('Số ngày dời mốc phải là số nguyên')
    .min(-60, 'Dời mốc tối đa 60 ngày')
    .max(60, 'Dời mốc tối đa 60 ngày'),
});
export type LearnerOverrideInput = z.infer<typeof learnerOverrideSchema>;

/** `POST /classes/{id}/pauses`: vắng `userId` ⇒ cả lớp; `endedOn` vắng/`null` ⇒ khoảng mở. */
export const pauseCreateSchema = z.object({
  userId: orgUuidSchema.optional(),
  startedOn: localDateSchema,
  endedOn: localDateSchema.nullish(),
});
export type PauseCreateInput = z.infer<typeof pauseCreateSchema>;

/** `POST /classes/{id}/pauses/{pauseId}/end`: thân tùy chọn, mặc định kết thúc hôm nay. */
export const pauseEndSchema = z
  .object({ endedOn: localDateSchema.optional() })
  .nullish()
  .transform((v) => v ?? {});
export type PauseEndInput = z.output<typeof pauseEndSchema>;

/** Tham số đường dẫn `userId` của học viên trong lớp. */
export const memberParamsSchema = z.object({ id: orgUuidSchema, userId: orgUuidSchema });

// --- US8: mời học viên chuyển sang lớp khác (học viên PHẢI đồng ý lại) ---

export const moveStudentSchema = z.object({
  toClassId: z.uuid({ error: 'toClassId phải là UUID' }),
});
export type MoveStudentInput = z.infer<typeof moveStudentSchema>;
