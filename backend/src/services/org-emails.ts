import type { Config } from '../config.js';
import { QUEUES } from '../jobs/boss.js';
import type { SendEmailJob } from '../jobs/send-email.js';
import type { ServiceDeps } from './deps.js';

// Email lời mời tổ chức/lớp (spec 004, research O20, FR-011): ba mẫu – mời chủ tổ chức, mời giáo viên, mời
// vào lớp. Người nhận có thể CHƯA có tài khoản nên không biết ngôn ngữ ưa thích: mỗi thư chứa CẢ tiếng
// Việt lẫn tiếng Anh, tiêu đề song ngữ. Thư KHÔNG chứa dữ liệu học tập.

export type OrgInvitationKind = 'owner' | 'teacher' | 'student';

export interface OrgInvitationEmailInput {
  kind: OrgInvitationKind;
  /** Tên tổ chức (luôn có). */
  organizationName: string;
  /** Tên lớp (bắt buộc khi `kind = 'student'`). */
  className?: string | null;
  /** Lớp hiện tại của học viên khi đây là lời mời CHUYỂN lớp (cần học viên đồng ý lại); chỉ với `kind = 'student'`. */
  fromClassName?: string | null;
  /** Tên người mời (hiển thị tên, không phải email); thiếu thì dùng tên tổ chức. */
  inviterName?: string | null;
  /** Token thô, chỉ nằm trong thư (CSDL giữ băm). */
  token: string;
  /** Hạn dùng của lời mời. */
  expiresAt: Date;
}

export interface OrgEmailContent {
  subject: string;
  text: string;
}

/**
 * Liên kết nhận lời mời trong client Flutter web. Client dùng định tuyến hash mặc định (như liên kết đặt
 * lại mật khẩu) nên đường dẫn `/invite/{token}` nằm sau `#`: `<APP_BASE_URL>/#/invite/{token}`.
 */
export function invitationLink(config: Pick<Config, 'APP_BASE_URL'>, token: string): string {
  const base = config.APP_BASE_URL.replace(/\/+$/, '');
  return `${base}/#/invite/${encodeURIComponent(token)}`;
}

/** Ngày dạng `dd/mm/yyyy` theo múi giờ cấu hình (đọc được ở cả hai ngôn ngữ). */
function formatExpiry(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

interface Copy {
  subject: string;
  intro: (i: { org: string; cls: string | null; inviter: string; from: string | null }) => string;
  action: string;
  note: string;
  expiry: (date: string) => string;
  ignore: string;
}

const COPY: Record<OrgInvitationKind | 'transfer', { vi: Copy; en: Copy }> = {
  owner: {
    vi: {
      subject: 'Lời mời làm chủ tổ chức',
      intro: ({ org, inviter }) =>
        `${inviter} mời bạn làm chủ tổ chức "${org}" trên Japanese Learning.`,
      action:
        'Mở liên kết sau, đăng nhập (hoặc đăng ký bằng đúng email này) rồi chấp nhận lời mời:',
      note: 'Chủ tổ chức không chiếm seat.',
      expiry: (d) => `Lời mời hết hạn vào ${d}.`,
      ignore: 'Nếu bạn không mong đợi thư này, hãy bỏ qua.',
    },
    en: {
      subject: 'Invitation to own an organization',
      intro: ({ org, inviter }) =>
        `${inviter} invited you to own the organization "${org}" on Japanese Learning.`,
      action: 'Open the link below, sign in (or register with this exact email) and accept:',
      note: 'Owners do not use a seat.',
      expiry: (d) => `This invitation expires on ${d}.`,
      ignore: 'If you did not expect this email, you can ignore it.',
    },
  },
  teacher: {
    vi: {
      subject: 'Lời mời làm giáo viên',
      intro: ({ org, inviter }) =>
        `${inviter} mời bạn làm giáo viên của "${org}" trên Japanese Learning.`,
      action:
        'Mở liên kết sau, đăng nhập (hoặc đăng ký bằng đúng email này) rồi chấp nhận lời mời:',
      note: 'Vai trò giáo viên chiếm một seat của tổ chức.',
      expiry: (d) => `Lời mời hết hạn vào ${d}.`,
      ignore: 'Nếu bạn không mong đợi thư này, hãy bỏ qua.',
    },
    en: {
      subject: 'Invitation to teach',
      intro: ({ org, inviter }) =>
        `${inviter} invited you to teach at "${org}" on Japanese Learning.`,
      action: 'Open the link below, sign in (or register with this exact email) and accept:',
      note: 'The teacher role uses one seat of the organization.',
      expiry: (d) => `This invitation expires on ${d}.`,
      ignore: 'If you did not expect this email, you can ignore it.',
    },
  },
  student: {
    vi: {
      subject: 'Lời mời vào lớp học',
      intro: ({ org, cls, inviter }) =>
        `${inviter} mời bạn vào lớp "${cls ?? ''}" của "${org}" trên Japanese Learning.`,
      action: 'Mở liên kết sau để xem điều kiện và quyết định:',
      note: 'Bạn có thể từ chối và tiếp tục học cá nhân; từ chối không tốn gì và không đổi hồ sơ của bạn.',
      expiry: (d) => `Lời mời hết hạn vào ${d}.`,
      ignore: 'Nếu bạn không mong đợi thư này, hãy bỏ qua.',
    },
    en: {
      subject: 'Invitation to join a class',
      intro: ({ org, cls, inviter }) =>
        `${inviter} invited you to the class "${cls ?? ''}" at "${org}" on Japanese Learning.`,
      action: 'Open the link below to see the terms and decide:',
      note: 'You may decline and keep studying on your own; declining costs nothing and does not change your profile.',
      expiry: (d) => `This invitation expires on ${d}.`,
      ignore: 'If you did not expect this email, you can ignore it.',
    },
  },
  // Chuyển lớp trong cùng tổ chức: học viên PHẢI đồng ý lại (Hiến pháp III), không tự động chuyển.
  transfer: {
    vi: {
      subject: 'Lời mời chuyển sang lớp khác',
      intro: ({ org, cls, inviter, from }) =>
        `${inviter} mời bạn chuyển từ lớp "${from ?? ''}" sang lớp "${cls ?? ''}" của "${org}" trên Japanese Learning.`,
      action: 'Mở liên kết sau để xem điều kiện và quyết định:',
      note: 'Bạn chỉ chuyển lớp khi bạn đồng ý. Nếu từ chối, bạn ở lại lớp hiện tại; nếu đồng ý, tiến độ và lịch ôn của bạn được giữ nguyên.',
      expiry: (d) => `Lời mời hết hạn vào ${d}.`,
      ignore: 'Nếu bạn không mong đợi thư này, hãy bỏ qua.',
    },
    en: {
      subject: 'Invitation to move to another class',
      intro: ({ org, cls, inviter, from }) =>
        `${inviter} invited you to move from the class "${from ?? ''}" to the class "${cls ?? ''}" at "${org}" on Japanese Learning.`,
      action: 'Open the link below to see the terms and decide:',
      note: 'You only move if you agree. If you decline you stay in your current class; if you accept, your progress and review schedule are kept.',
      expiry: (d) => `This invitation expires on ${d}.`,
      ignore: 'If you did not expect this email, you can ignore it.',
    },
  },
};

/** Dựng nội dung thư: tiêu đề song ngữ (`vi / en`), thân gồm khối tiếng Việt rồi khối tiếng Anh. */
export function buildOrgInvitationEmail(
  config: Pick<Config, 'APP_BASE_URL' | 'ORG_TIMEZONE'>,
  input: OrgInvitationEmailInput,
): OrgEmailContent {
  const link = invitationLink(config, input.token);
  const expiry = formatExpiry(input.expiresAt, config.ORG_TIMEZONE);
  const copies = input.kind === 'student' && input.fromClassName ? COPY.transfer : COPY[input.kind];
  const block = (c: Copy): string =>
    [
      c.intro({
        org: input.organizationName,
        cls: input.className ?? null,
        inviter: input.inviterName?.trim() || input.organizationName,
        from: input.fromClassName ?? null,
      }),
      '',
      c.action,
      link,
      '',
      c.note,
      c.expiry(expiry),
      c.ignore,
    ].join('\n');
  return {
    subject: `${copies.vi.subject} / ${copies.en.subject}`,
    text: `${block(copies.vi)}\n\n----------\n\n${block(copies.en)}\n`,
  };
}

/** Đưa thư lời mời vào hàng đợi `send-email` (thử lại sẵn có của pg-boss). */
export async function sendOrgInvitationEmail(
  deps: Pick<ServiceDeps, 'config' | 'jobQueue'>,
  to: string,
  input: OrgInvitationEmailInput,
): Promise<void> {
  const content = buildOrgInvitationEmail(deps.config, input);
  const job: SendEmailJob = {
    kind: 'org_invitation',
    to,
    subject: content.subject,
    text: content.text,
  };
  await deps.jobQueue.enqueue(QUEUES.sendEmail, job);
}
