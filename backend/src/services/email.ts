import nodemailer, { type Transporter } from 'nodemailer';

// Giao diện gửi email (R5): nghiệp vụ chỉ biết `EmailSender`, nhà cung cấp cắm qua cấu hình.

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

/** Gửi qua SMTP (dev: Mailpit; production: SES/Resend/Mailgun… qua SMTP). */
export class SmtpEmailSender implements EmailSender {
  private readonly transport: Transporter;

  constructor(
    smtpUrl: string,
    private readonly from = 'Japanese Learning <no-reply@japanese-learning.local>',
  ) {
    this.transport = nodemailer.createTransport(smtpUrl);
  }

  async send(message: EmailMessage): Promise<void> {
    await this.transport.sendMail({ from: this.from, ...message });
  }
}

/** Triển khai trong bộ nhớ cho kiểm thử: giữ thư đã gửi để kiểm tra nội dung (ví dụ liên kết đặt lại). */
export class InMemoryEmailSender implements EmailSender {
  readonly sent: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
  }

  /** Thư gần nhất gửi tới một địa chỉ (không phân biệt hoa thường). */
  lastTo(address: string): EmailMessage | undefined {
    return [...this.sent].reverse().find((m) => m.to.toLowerCase() === address.toLowerCase());
  }

  clear(): void {
    this.sent.length = 0;
  }
}
