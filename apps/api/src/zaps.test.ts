import assert from 'node:assert/strict';
import { test } from 'node:test';
import session from 'express-session';
import { Router } from 'express';
import request from 'supertest';
import { createApp } from './app.js';
import { createAuthRouter } from './auth/auth.routes.js';
import { createSessionMiddleware } from './auth/session.js';
import { createZapRouter } from './zaps/zap.routes.js';
import { ZapService } from './zaps/zap.service.js';
import { zapSchema, type ZapInput, type Zap, type ZapStore } from './zaps/zap-store.js';
import type { ConnectionStore } from './github/connections.js';

const connectionId = '507f1f77bcf86cd799439011';
const foreignConnectionId = '507f1f77bcf86cd799439012';
const input: ZapInput = {
  name: 'PR welcome', connectionId, enabled: true,
  trigger: { provider: 'github', event: 'pull_request.opened' },
  action: { provider: 'github', type: 'comment', template: 'Thanks {{pr.author}} for {{pr.title}}' },
};
function fixture() {
  let next = 1;
  const documents = new Map<string, Zap>();
  const store: ZapStore = {
    list: async userId => [...documents.values()].filter(zap => zap.userId === userId),
    findOwned: async (id, userId) => documents.get(id)?.userId === userId ? documents.get(id)! : null,
    create: async (userId, config) => {
      const zap = { ...config, id: String(next++).padStart(24, '0'), userId, createdAt: new Date(), updatedAt: new Date() };
      documents.set(zap.id, zap); return zap;
    },
    updateOwned: async (id, userId, config) => {
      const current = documents.get(id);
      if (!current || current.userId !== userId) return null;
      const updated = { ...current, ...config, updatedAt: new Date() };
      documents.set(id, updated); return updated;
    },
    enabledForConnection: async (id, userId) => [...documents.values()].filter(zap => zap.userId === userId && zap.connectionId === id && zap.enabled),
  };
  const connections: ConnectionStore = {
    reserve: async () => { throw new Error('not used'); }, activate: async () => { throw new Error('not used'); }, list: async () => [],
    find: async id => [connectionId, foreignConnectionId].includes(id) ? {
      id, userId: id === connectionId ? 'user-a' : 'user-b', repositoryId: '123', owner: 'owner', name: 'repo', fullName: 'owner/repo', enabled: true, webhookId: 99, updatedAt: new Date(),
    } : null,
  };
  const app = createApp(async () => {}, {
    session: createSessionMiddleware(new session.MemoryStore(), 'test-session-secret-with-at-least-32-characters', false),
    router: createAuthRouter({ appOrigin: 'http://127.0.0.1:4200', callbackUrl: 'http://127.0.0.1:4200/api/auth/github/callback', clientId: 'client', scope: 'public_repo', secure: false,
      github: { signIn: async code => ({ profile: { id: code === 'a' ? 1 : 2, login: code, name: null, avatar_url: 'https://example.test/avatar', html_url: 'https://github.com/' + code }, accessToken: 'test-only-token', scopes: ['public_repo'] }) },
      users: { saveIdentity: async identity => ({ id: identity.profile.id === 1 ? 'user-a' : 'user-b', login: identity.profile.login, name: null, avatarUrl: identity.profile.avatar_url, profileUrl: identity.profile.html_url }), findPublicUser: async id => ({ id, login: id, name: null, avatarUrl: 'https://example.test/avatar', profileUrl: 'https://github.com/a' }) },
    }),
  }, { webhooks: Router(), github: Router(), executions: Router(), zaps: createZapRouter(store, new ZapService(store, connections)) });
  return { app, documents };
}
async function signIn(app: ReturnType<typeof createApp>, code = 'a') {
  const agent = request.agent(app);
  const login = await agent.get('/api/auth/github').expect(302);
  const state = new URL(login.headers.location).searchParams.get('state');
  await agent.get('/api/auth/github/callback').query({ code, state }).expect(302);
  const me = await agent.get('/api/auth/me').expect(200);
  return { agent, csrf: me.body.csrfToken as string };
}

test('Zap API rejects anonymous access and writes without a CSRF token', async () => {
  const { app } = fixture();
  await request(app).get('/api/zaps').expect(401);
  await request(app).post('/api/zaps').send(input).expect(401);
  const { agent } = await signIn(app);
  await agent.post('/api/zaps').send(input).expect(403);
});

test('signed-in users can create, list, read, edit, and disable their Zap', async () => {
  const { app, documents } = fixture();
  const { agent, csrf } = await signIn(app);
  const created = await agent.post('/api/zaps').set('X-Devflow-CSRF', csrf).send(input).expect(201);
  const id = created.body.zap.id;
  assert.equal(documents.get(id)?.userId, 'user-a');
  const listed = await agent.get('/api/zaps').expect(200);
  assert.equal(listed.headers['cache-control'], 'no-store');
  assert.equal(listed.body.zaps.length, 1);
  await agent.get('/api/zaps/' + id).expect(200);
  const edited = await agent.put('/api/zaps/' + id).set('X-Devflow-CSRF', csrf).send({ ...input, name: 'Edited', enabled: false, action: { ...input.action, template: 'Updated {{pr.url}}' } }).expect(200);
  assert.equal(edited.body.zap.name, 'Edited');
  assert.equal(edited.body.zap.enabled, false);
  assert.equal(edited.body.zap.action.template, 'Updated {{pr.url}}');
});

test('another user cannot list, read, or edit the first user Zap', async () => {
  const { app, documents } = fixture();
  const owner = await signIn(app, 'a');
  const other = await signIn(app, 'b');
  const id = (await owner.agent.post('/api/zaps').set('X-Devflow-CSRF', owner.csrf).send(input).expect(201)).body.zap.id;
  assert.equal((await other.agent.get('/api/zaps?userId=user-a')).body.zaps.length, 0);
  await other.agent.get('/api/zaps/' + id).expect(404);
  await other.agent.put('/api/zaps/' + id).set('X-Devflow-CSRF', other.csrf).send({ ...input, connectionId: foreignConnectionId, name: 'Stolen' }).expect(404);
  assert.equal(documents.get(id)?.name, input.name);
});

test('foreign repository connections and frontend user IDs cannot create Zaps', async () => {
  const { app } = fixture();
  const { agent, csrf } = await signIn(app);
  await agent.post('/api/zaps').set('X-Devflow-CSRF', csrf).send({ ...input, connectionId: foreignConnectionId }).expect(404);
  await agent.post('/api/zaps').set('X-Devflow-CSRF', csrf).send({ ...input, userId: 'user-b' }).expect(400);
});

test('unsupported providers, events, actions, and invalid mapping are rejected', () => {
  assert.equal(zapSchema.safeParse(input).success, true);
  for (const candidate of [
    { ...input, trigger: { provider: 'slack', event: 'pull_request.opened' } },
    { ...input, trigger: { provider: 'github', event: 'push' } },
    { ...input, action: { ...input.action, provider: 'linear' } },
    { ...input, action: { ...input.action, type: 'execute-code' } },
    { ...input, action: { ...input.action, template: '{{credentials.token}}' } },
    { ...input, action: { ...input.action, template: '{{pr.title}' } },
  ]) assert.equal(zapSchema.safeParse(candidate).success, false);
});
