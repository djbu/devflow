import { Router } from 'express';
import { requireAuth, requireCsrf } from '../auth/session.js';
import { zapSchema, type ZapStore } from './zap-store.js';
import { ZapUnavailable, type ZapService } from './zap.service.js';

export function createZapRouter(store: ZapStore, service: ZapService) {
  const router = Router();
  router.use(requireAuth);
  router.get('/', async (_request, response) => {
    response.json({ zaps: await store.list(response.locals.userId) });
  });
  router.get('/:id', async (request, response) => {
    const zap = await store.findOwned(String(request.params.id), response.locals.userId);
    if (!zap) { response.status(404).json({ error: 'Zap not found' }); return; }
    response.json({ zap });
  });
  router.post('/', requireCsrf, async (request, response) => {
    const input = zapSchema.safeParse(request.body);
    if (!input.success) { response.status(400).json({ error: 'Invalid Zap. Check its name, repository, supported trigger/action, and template.' }); return; }
    try {
      response.status(201).json({ zap: await service.create(response.locals.userId, input.data) });
    } catch (error) {
      if (error instanceof ZapUnavailable) { response.status(404).json({ error: error.message }); return; }
      throw error;
    }
  });
  router.put('/:id', requireCsrf, async (request, response) => {
    const input = zapSchema.safeParse(request.body);
    if (!input.success) { response.status(400).json({ error: 'Invalid Zap. Check its name, repository, supported trigger/action, and template.' }); return; }
    try {
      response.json({ zap: await service.update(String(request.params.id), response.locals.userId, input.data) });
    } catch (error) {
      if (error instanceof ZapUnavailable) { response.status(404).json({ error: error.message }); return; }
      throw error;
    }
  });
  return router;
}
