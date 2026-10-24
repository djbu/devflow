import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';
import { createApp } from './app.js';

test('health reports a successful database check', async () => {
  let calls = 0;
  const app = createApp(async () => { calls++; });
  const response = await request(app).get('/api/health').expect(200);
  assert.equal(calls, 1);
  assert.deepEqual(response.body, { status: 'ok', database: 'connected' });
});

test('health reports database failure without exposing its error', async () => {
  const app = createApp(async () => { throw new Error('mongodb://user:secret@localhost'); });
  const response = await request(app).get('/api/health').expect(503);
  assert.deepEqual(response.body, { status: 'unavailable', database: 'disconnected' });
  assert.ok(!response.text.includes('secret'));
});

test('unknown API routes return a JSON 404', async () => {
  const app = createApp(async () => {});
  const response = await request(app).get('/api/missing').expect(404);
  assert.deepEqual(response.body, { error: 'Not found' });
});


test('repository connections and execution records require a session before accessing data', async () => {
  const { Router } = await import('express');
  const { createGitHubRouter } = await import('./github/github.routes.js');
  const { createExecutionRouter } = await import('./executions/execution.routes.js');
  const unavailable = async () => { throw new Error('Must not access data without authentication'); };
  const connections = { reserve: unavailable, activate: unavailable, find: unavailable, list: unavailable };
  const executions = { claim: unavailable, succeed: unavailable, fail: unavailable, list: unavailable };
  const app = createApp(async () => {}, undefined, {
    webhooks: Router(),
    github: createGitHubRouter(connections, undefined),
    executions: createExecutionRouter(executions),
  });
  await request(app).get('/api/github/connections?userId=someone-else').expect(401);
  await request(app).post('/api/github/connections').send({ repository: 'owner/repo', userId: 'someone-else' }).expect(401);
  await request(app).get('/api/executions?userId=someone-else').expect(401);
});


test('unexpected asynchronous failures are sanitized and logged without sensitive request data', async context => {
  const { Router } = await import('express');
  const logs: string[] = [];
  context.mock.method(console, 'error', (...values: unknown[]) => logs.push(values.join(' ')));
  const router = Router();
  router.get('/failure', async () => { throw new Error('mongodb://user:credential-secret@localhost'); });
  const app = createApp(async () => {}, { session: (_request, _response, next) => next(), router });
  const response = await request(app).get('/api/auth/failure?code=authorization-secret')
    .set('Authorization', 'Bearer header-secret').expect(500);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal(response.body.error, 'Request failed. Please try again.');
  assert.deepEqual(logs, ['API GET /failure failed.']);
  assert.ok(!response.text.includes('credential-secret'));
});
