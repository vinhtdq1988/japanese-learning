import { PgBoss, type Job } from 'pg-boss';

// Khung hàng đợi pg-boss (R3): khởi động/dừng, đăng ký handler. Hàng đợi nằm trên PostgreSQL nên
// không cần thêm dịch vụ nào. Các job cụ thể (gửi email, xóa tài khoản) đăng ký qua `JobDefinition`.

/** Tên các hàng đợi; handler nằm ở `send-email.ts` (T045), `purge-deleted-accounts.ts` (T112) và `org-lifecycle.ts` (spec 004). */
export const QUEUES = {
  sendEmail: 'send-email',
  purgeDeletedAccounts: 'purge-deleted-accounts',
  orgLifecycle: 'org-lifecycle',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

/** Giao diện đẩy việc cho các dịch vụ; kiểm thử dùng `InMemoryJobQueue` để không cần pg-boss. */
export interface JobQueue {
  enqueue<T extends object>(name: QueueName, data: T): Promise<void>;
}

export interface JobDefinition<T extends object = object> {
  name: QueueName;
  /** Xử lý một job; ném lỗi để pg-boss thử lại theo `retryLimit`. */
  handler: (data: T) => Promise<void>;
  /** Số lần thử lại khi lỗi (mặc định 5) với độ trễ tăng dần. */
  retryLimit?: number;
  /** Biểu thức cron nếu là job định kỳ (chạy với dữ liệu rỗng). */
  cron?: string;
}

export class JobRunner implements JobQueue {
  readonly boss: PgBoss;
  private started = false;

  constructor(databaseUrl: string) {
    this.boss = new PgBoss(databaseUrl);
    // Không để lỗi nền làm sập tiến trình; pg-boss tự thử lại các job.
    this.boss.on('error', (err) => console.error('[pg-boss]', err));
  }

  async start(definitions: JobDefinition<never>[] = []): Promise<void> {
    if (this.started) return;
    await this.boss.start();
    this.started = true;
    for (const def of definitions) await this.register(def as JobDefinition);
  }

  async register(def: JobDefinition): Promise<void> {
    await this.boss.createQueue(def.name, {
      retryLimit: def.retryLimit ?? 5,
      retryDelay: 30,
      retryBackoff: true,
    });
    await this.boss.work<object>(def.name, async (jobs: Job<object>[]) => {
      for (const job of jobs) await def.handler(job.data);
    });
    if (def.cron) await this.boss.schedule(def.name, def.cron, {});
  }

  async enqueue<T extends object>(name: QueueName, data: T): Promise<void> {
    await this.boss.send(name, data);
  }

  async stop(): Promise<void> {
    if (!this.started) return;
    this.started = false;
    await this.boss.stop({ graceful: true });
  }
}

/** Hàng đợi trong bộ nhớ cho kiểm thử: ghi lại job đã đẩy, có thể chạy handler thủ công. */
export class InMemoryJobQueue implements JobQueue {
  readonly jobs: { name: QueueName; data: object }[] = [];

  async enqueue<T extends object>(name: QueueName, data: T): Promise<void> {
    this.jobs.push({ name, data });
  }

  /** Chạy và xóa mọi job đang chờ bằng handler tương ứng. */
  async drain(definitions: JobDefinition<never>[]): Promise<void> {
    const pending = this.jobs.splice(0);
    for (const job of pending) {
      const def = definitions.find((d) => d.name === job.name) as JobDefinition | undefined;
      if (def) await def.handler(job.data);
    }
  }
}
