import type { FastifyInstance } from 'fastify';
import { onboardingCompleteSchema, onboardingDraftSchema } from '../domain/profile-validation.js';
import {
  completeOnboarding,
  getOnboardingState,
  saveOnboardingDraft,
} from '../services/onboarding.js';
import { parseInput } from './errors.js';
import { currentUserId } from './middleware/auth.js';

// Route onboarding (T047): trạng thái/nháp, lưu nháp, hoàn tất (sinh lộ trình + kế hoạch hôm nay).

export function registerOnboardingRoutes(api: FastifyInstance): void {
  const deps = api.deps;
  const secured = { preHandler: [api.authenticate] };

  api.get('/onboarding', secured, async (request) =>
    getOnboardingState(deps, currentUserId(request)),
  );

  api.put('/onboarding', secured, async (request) =>
    saveOnboardingDraft(
      deps,
      currentUserId(request),
      parseInput(onboardingDraftSchema, request.body),
    ),
  );

  api.post('/onboarding/complete', secured, async (request) =>
    completeOnboarding(
      deps,
      currentUserId(request),
      parseInput(onboardingCompleteSchema, request.body),
    ),
  );
}
