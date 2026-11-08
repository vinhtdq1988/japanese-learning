import { describe, expect, it } from 'vitest';
import { QUEUES } from '../../src/jobs/boss.js';
import { createSendEmailJob, type SendEmailJob } from '../../src/jobs/send-email.js';
import {
  buildOrgInvitationEmail,
  invitationLink,
  sendOrgInvitationEmail,
  type OrgInvitationEmailInput,
} from '../../src/services/org-emails.js';
import { InMemoryEmailSender } from '../../src/services/email.js';
import { loadConfig } from '../../src/config.js';

// Kiểm thử email lời mời tổ chức/lớp (spec 004, T023, research O20, FR-011).

const config = loadConfig({
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  JWT_SECRET: 'x'.repeat(32),
  SMTP_URL: 'smtp://localhost:1025',
  APP_BASE_URL: 'https://app.example.com/',
});

const base: OrgInvitationEmailInput = {
  kind: 'teacher',
  organizationName: 'Trung tâm Sakura',
  inviterName: 'Cô Lan',
  token: 'tok_abc-123',
  // 2026-11-21 17:30 UTC = 2026-11-22 00:30 ở Asia/Ho_Chi_Minh.
  expiresAt: new Date('2026-11-21T17:30:00Z'),
};

describe('buildOrgInvitationEmail', () => {
  it.each(['owner', 'teacher', 'student'] as const)(
    '%s: tiêu đề song ngữ và thân có cả tiếng Việt lẫn tiếng Anh',
    (kind) => {
      const mail = buildOrgInvitationEmail(config, { ...base, kind, className: 'N5 buổi tối' });
      expect(mail.subject).toContain(' / ');
      const [vi, en] = mail.text.split('----------');
      expect(vi).toMatch(/mời bạn/);
      expect(en).toMatch(/invited you/);
      expect(vi).toContain('Trung tâm Sakura');
      expect(en).toContain('Trung tâm Sakura');
      expect(vi).toContain('Cô Lan');
      expect(en).toContain('Cô Lan');
    },
  );

  it('nêu tên lớp khi mời học viên và ghi rõ có thể từ chối để tiếp tục học cá nhân', () => {
    const mail = buildOrgInvitationEmail(config, {
      ...base,
      kind: 'student',
      className: 'N5 buổi tối',
    });
    expect(mail.text.match(/N5 buổi tối/g)).toHaveLength(2); // một lần mỗi ngôn ngữ
    expect(mail.text).toMatch(/từ chối và tiếp tục học cá nhân/);
    expect(mail.text).toMatch(/decline and keep studying on your own/);
  });

  it('thư giáo viên nêu chiếm seat; thư chủ tổ chức nêu không chiếm seat', () => {
    expect(buildOrgInvitationEmail(config, { ...base, kind: 'teacher' }).text).toMatch(
      /chiếm một seat/,
    );
    const owner = buildOrgInvitationEmail(config, { ...base, kind: 'owner' }).text;
    expect(owner).toMatch(/không chiếm seat/);
    expect(owner).toMatch(/do not use a seat/);
  });

  it('chứa liên kết nhận lời mời và ngày hết hạn theo múi giờ cấu hình ở cả hai ngôn ngữ', () => {
    const mail = buildOrgInvitationEmail(config, base);
    const link = invitationLink(config, 'tok_abc-123');
    expect(link).toBe('https://app.example.com/#/invite/tok_abc-123');
    expect(mail.text.split(link)).toHaveLength(3); // xuất hiện đúng hai lần
    expect(mail.text.match(/22\/11\/2026/g)).toHaveLength(2);
  });

  it('dùng tên tổ chức khi thiếu tên người mời', () => {
    const mail = buildOrgInvitationEmail(config, { ...base, inviterName: null });
    expect(mail.text).toMatch(/Trung tâm Sakura mời bạn/);
  });

  it('không chứa dữ liệu học tập hay thông tin nhạy cảm ngoài liên kết', () => {
    const mail = buildOrgInvitationEmail(config, { ...base, kind: 'student', className: 'Lớp A' });
    expect(mail.text).not.toMatch(/mật khẩu|password|tiến độ|progress|điểm|score/i);
  });

  it('mã hóa ký tự đặc biệt của token trong liên kết', () => {
    expect(invitationLink(config, 'a b/c')).toBe('https://app.example.com/#/invite/a%20b%2Fc');
  });
});

describe('sendOrgInvitationEmail + job send-email', () => {
  it('đẩy job vào hàng đợi send-email và handler gửi đúng nội dung đã dựng', async () => {
    const queued: { name: string; data: unknown }[] = [];
    const jobQueue = {
      enqueue: async (name: string, data: object) => {
        queued.push({ name, data });
      },
    };
    await sendOrgInvitationEmail({ config, jobQueue } as never, 'an@example.com', base);
    expect(queued).toHaveLength(1);
    expect(queued[0]!.name).toBe(QUEUES.sendEmail);

    const emailSender = new InMemoryEmailSender();
    const job = createSendEmailJob({ config, emailSender });
    await job.handler(queued[0]!.data as SendEmailJob);
    const sent = emailSender.lastTo('an@example.com');
    expect(sent?.subject).toContain('Lời mời làm giáo viên');
    expect(sent?.text).toContain('#/invite/tok_abc-123');
  });

  it('job đặt lại mật khẩu cũ vẫn hoạt động', async () => {
    const emailSender = new InMemoryEmailSender();
    const job = createSendEmailJob({ config, emailSender });
    await job.handler({
      kind: 'password_reset',
      to: 'b@example.com',
      token: 'xyz',
      language: 'vi',
    });
    expect(emailSender.lastTo('b@example.com')?.subject).toMatch(/Đặt lại mật khẩu/);
  });
});

describe('thư mời CHUYỂN lớp (học viên đồng ý lại, US8)', () => {
  const transfer: OrgInvitationEmailInput = {
    ...base,
    kind: 'student',
    className: 'Lớp B',
    fromClassName: 'Lớp A',
  };

  it('song ngữ vi + en, nêu cả lớp hiện tại lẫn lớp đích và nói rõ có thể từ chối', () => {
    const mail = buildOrgInvitationEmail(config, transfer);
    expect(mail.subject).toBe('Lời mời chuyển sang lớp khác / Invitation to move to another class');
    expect(mail.text).toContain('chuyển từ lớp "Lớp A" sang lớp "Lớp B"');
    expect(mail.text).toContain('move from the class "Lớp A" to the class "Lớp B"');
    expect(mail.text).toContain('Bạn chỉ chuyển lớp khi bạn đồng ý');
    expect(mail.text).toContain('You only move if you agree');
    expect(mail.text).toContain('#/invite/tok_abc-123');
  });

  it('không có fromClassName thì vẫn là thư mời vào lớp thông thường', () => {
    const mail = buildOrgInvitationEmail(config, { ...transfer, fromClassName: null });
    expect(mail.subject).toBe('Lời mời vào lớp học / Invitation to join a class');
  });
});
