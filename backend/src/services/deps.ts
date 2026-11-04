import type { Config } from '../config.js';
import type { Database } from '../db/client.js';
import type { Clock } from '../engine/clock.js';
import type { JobQueue } from '../jobs/boss.js';
import type { ContentCache } from './content-cache.js';
import type { EmailSender } from './email.js';

/** Phụ thuộc mà các dịch vụ nhận (tập con của `ResolvedDeps` trong app.ts). */
export interface ServiceDeps {
  config: Config;
  db: Database;
  clock: Clock;
  emailSender: EmailSender;
  jobQueue: JobQueue;
  contentCache: ContentCache;
}
