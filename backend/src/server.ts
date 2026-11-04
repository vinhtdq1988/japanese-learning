import { buildApp } from './app.js';
import { registerApiRoutes } from './api/routes.js';
import { loadConfig, loadDotEnv } from './config.js';
import { createDb } from './db/client.js';
import { JobRunner } from './jobs/boss.js';
import { createSendEmailJob } from './jobs/send-email.js';
import { SmtpEmailSender } from './services/email.js';

// Điểm vào của API: nạp cấu hình, kết nối CSDL, khởi động hàng đợi pg-boss và lắng nghe.

loadDotEnv();
const config = loadConfig();

const { db, close: closeDb } = createDb(config.DATABASE_URL);
const jobs = new JobRunner(config.DATABASE_URL);
const emailSender = new SmtpEmailSender(config.SMTP_URL);
// Job xóa tài khoản quá hạn (T112) sẽ đăng ký thêm tại đây khi được hiện thực.
await jobs.start([createSendEmailJob({ config, emailSender })]);

const app = await buildApp(
  { config, db, emailSender, jobQueue: jobs },
  { logger: true, registerRoutes: registerApiRoutes },
);

async function shutdown(signal: string): Promise<void> {
  app.log.info(`Nhận ${signal}, đang tắt…`);
  await app.close();
  await jobs.stop();
  await closeDb();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

await app.listen({ port: config.PORT, host: '0.0.0.0' });
