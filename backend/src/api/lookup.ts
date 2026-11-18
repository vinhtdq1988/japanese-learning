import type { FastifyInstance } from 'fastify';
import { lookupQuerySchema } from '../domain/profile-validation.js';
import { lookupTerms } from '../services/lookup.js';
import { parseInput } from './errors.js';
import { currentUserId } from './middleware/auth.js';

// Route tra cứu Hán tự/từ vựng cho popup furigana của bài luyện đọc: chỉ đọc, nội dung dùng chung.

export function registerLookupRoutes(api: FastifyInstance): void {
  const deps = api.deps;
  const secured = { preHandler: [api.authenticate] };

  api.get('/lookup', secured, async (request) => {
    const { terms } = parseInput(lookupQuerySchema, request.query);
    return lookupTerms(deps, currentUserId(request), terms);
  });
}
