import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireCsrf } from '../auth/session.js';
import { ConnectionError, type ConnectionStore, type RepositoryConnectionService } from './connections.js';
import { safeGitHubError } from './repository.service.js';

export function createGitHubRouter(store: ConnectionStore, service: RepositoryConnectionService | undefined) {
  const router = Router();
  router.use(requireAuth);
  router.get('/connections', async (_request, response) => {
    response.json({ connections: await store.list(response.locals.userId), webhookConfigured: Boolean(service) });
  });
  router.post('/connections', requireCsrf, async (request, response) => {
    if (!service) { response.status(503).json({ error: 'Webhook delivery is not configured on the server.' }); return; }
    const input = z.object({ repository: z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/).max(200) }).strict().safeParse(request.body);
    if (!input.success) { response.status(400).json({ error: 'Enter a repository as owner/name. No user ID is accepted.' }); return; }
    const [owner, name] = input.data.repository.split('/');
    try {
      const connection = await service.connect(response.locals.userId, owner!, name!);
      response.status(201).json({ connection });
    } catch (error) {
      if (error instanceof ConnectionError) {
        response.status(error.status).json({ error: error.message });
      } else {
        response.status(502).json({ error: safeGitHubError(error) });
      }
    }
  });
  return router;
}
