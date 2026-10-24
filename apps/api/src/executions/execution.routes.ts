import { Router } from 'express';
import { requireAuth } from '../auth/session.js';
import type { ExecutionStore } from './execution-store.js';

export function createExecutionRouter(store: ExecutionStore) {
  const router = Router();
  router.use(requireAuth);
  router.get('/', async (_request, response) => {
    response.json({ executions: await store.list(response.locals.userId) });
  });
  return router;
}
