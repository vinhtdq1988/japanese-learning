import type { Config } from '../config.js';
import type { Language } from '../domain/types.js';
import type { EmailSender } from '../services/email.js';
import { QUEUES, type JobDefinition } from './boss.js';

// Job gửi email có thử lại qua pg-boss (T045, R3/R5). Hiện chỉ có email đặt lại mật khẩu (FR-001).

export interface SendEmailJob {
  kind: 'password_reset';
  to: string;
  /** Token đặt lại dạng thô; chỉ tồn tại trong job (CSDL chỉ giữ băm). */
  token: string;
  language: Language;
}

/** Liên kết đặt lại trong client Flutter web (định tuyến hash mặc định): `<APP_BASE_URL>/#/reset-password?token=…`. */
export function passwordResetLink(config: Pick<Config, 'APP_BASE_URL'>, token: string): string {
  const base = config.APP_BASE_URL.replace(/\/+$/, '');
  return `${base}/#/reset-password?token=${encodeURIComponent(token)}`;
}

const COPY: Record<Language, { subject: string; body: (link: string) => string }> = {
  vi: {
    subject: 'Đặt lại mật khẩu Japanese Learning',
    body: (link) =>
      `Bạn (hoặc ai đó) vừa yêu cầu đặt lại mật khẩu.\n\n` +
      `Mở liên kết sau để đặt mật khẩu mới (hết hạn sau 1 giờ, chỉ dùng được một lần):\n${link}\n\n` +
      `Nếu bạn không yêu cầu, hãy bỏ qua email này; mật khẩu hiện tại vẫn giữ nguyên.`,
  },
  en: {
    subject: 'Reset your Japanese Learning password',
    body: (link) =>
      `You (or someone else) requested a password reset.\n\n` +
      `Open this link to choose a new password (it expires in 1 hour and works only once):\n${link}\n\n` +
      `If you did not request this, ignore this email; your current password stays unchanged.`,
  },
};

export function createSendEmailJob(deps: {
  config: Pick<Config, 'APP_BASE_URL'>;
  emailSender: EmailSender;
}): JobDefinition<SendEmailJob> {
  return {
    name: QUEUES.sendEmail,
    handler: async (job) => {
      const copy = COPY[job.language];
      await deps.emailSender.send({
        to: job.to,
        subject: copy.subject,
        text: copy.body(passwordResetLink(deps.config, job.token)),
      });
    },
  };
}
