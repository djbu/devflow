import express, { type ErrorRequestHandler, type RequestHandler, type Router } from 'express';

const noStore: RequestHandler = (_request, response, next) => {
  response.set('Cache-Control', 'no-store');
  next();
};
function safeErrors(message: string): ErrorRequestHandler {
  return (error, request, response, _next) => {
    const status = error?.type === 'entity.too.large' ? 413
      : error?.type === 'entity.parse.failed' ? 400 : error?.status === 415 ? 415 : 500;
    if (status === 500) {
      // Route patterns only: queries, headers, bodies, and error objects can
      // contain OAuth codes, tokens, connection strings, or secrets.
      const route = typeof request.route?.path === 'string' ? request.route.path : '';
      console.error(`API ${request.method} ${request.baseUrl}${route} failed.`);
    }
    if (response.headersSent) { response.destroy(); return; }
    response.status(status).json({ error: status === 500 ? message : 'Invalid request body' });
  };
}

export function createApp(checkDatabase: () => Promise<unknown>, auth?: { session: RequestHandler; router: Router },
  features?: { webhooks: Router; github: Router; executions: Router; zaps?: Router }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(noStore);

  app.get('/api/health', async (_request, response) => {
    try {
      await checkDatabase();
      response.json({ status: 'ok', database: 'connected' });
    } catch {
      response.status(503).json({ status: 'unavailable', database: 'disconnected' });
    }
  });

  if (features) app.use('/api/github/webhooks', features.webhooks);

  if (auth) {
    app.use('/api', auth.session);
    app.use('/api/auth', auth.router);
  }

  if (features) {
    app.use('/api/github', express.json({ limit: '16kb' }), features.github);
    app.use('/api/executions', features.executions);
    if (features.zaps) app.use('/api/zaps', express.json({ limit: '64kb' }), features.zaps);
  }

  app.use((_request, response) => {
    response.status(404).json({ error: 'Not found' });
  });
  app.use(safeErrors('Request failed. Please try again.'));
  return app;
}

// A second listener in the same backend exposes only signed webhook handling.
// The public tunnel must target this listener, never the account/API listener.
export function createPublicWebhookApp(webhooks: Router) {
  const app = express();
  app.disable('x-powered-by');
  app.use(noStore);
  app.use('/api/github/webhooks', webhooks);
  app.use((_request, response) => { response.status(404).json({ error: 'Not found' }); });
  app.use(safeErrors('Webhook processing failed. Inspect execution records.'));
  return app;
}
