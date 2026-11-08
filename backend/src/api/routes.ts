import type { FastifyInstance } from 'fastify';
import { registerAccountRoutes } from './account.js';
import { registerAdminRoutes } from './admin/index.js';
import { registerAuthRoutes } from './auth.js';
import { registerClassPathRoutes } from './class-path.js';
import { registerClassReportRoutes } from './class-reports.js';
import { registerClassRoutes } from './classes.js';
import { registerDailyRoutes } from './daily.js';
import { registerInvitationRoutes } from './invitations.js';
import { registerMyClassRoutes } from './my-class.js';
import { registerOnboardingRoutes } from './onboarding.js';
import { registerOrgRoutes } from './org.js';
import { registerPathRoutes } from './path.js';
import { registerPlacementRoutes } from './placement.js';
import { registerProgressRoutes } from './progress.js';
import { registerSessionRoutes } from './sessions.js';
import { registerTrialRoutes } from './trial.js';

/** Đăng ký mọi route nghiệp vụ dưới `/api/v1`; các câu chuyện sau bổ sung dần tại đây. */
export async function registerApiRoutes(api: FastifyInstance): Promise<void> {
  registerAuthRoutes(api);
  registerTrialRoutes(api);
  registerAccountRoutes(api);
  registerOnboardingRoutes(api);
  registerPlacementRoutes(api);
  registerPathRoutes(api);
  registerDailyRoutes(api);
  registerSessionRoutes(api);
  registerProgressRoutes(api);
  registerAdminRoutes(api);
  registerOrgRoutes(api);
  registerInvitationRoutes(api);
  registerClassRoutes(api);
  registerClassPathRoutes(api);
  registerClassReportRoutes(api);
  registerMyClassRoutes(api);
}
