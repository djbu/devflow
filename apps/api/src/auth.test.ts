import assert from 'node:assert/strict';
import { test } from 'node:test';
import session from 'express-session';
import request from 'supertest';
import { createApp } from './app.js';
import { createAuthRouter } from './auth/auth.routes.js';
import { createSessionMiddleware } from './auth/session.js';
import type { PublicUser, UserStore } from './auth/user-store.js';
import type { GitHubIdentity } from './github/github.service.js';

const user: PublicUser = { id: '507f1f77bcf86cd799439011', login: 'test-user', name: 'Test', avatarUrl: 'https://avatars.githubusercontent.com/u/1', profileUrl: 'https://github.com/test-user' };
const identity: GitHubIdentity = {
  profile: { id: 1, login: user.login, name: user.name, avatar_url: user.avatarUrl, html_url: user.profileUrl },
  accessToken: 'provider-secret-token', scopes: ['public_repo'],
};

function fixture(configured = true, providerFails = false) {
  let exchanges = 0;
  const users: UserStore = {
    saveIdentity: async () => user,
    findPublicUser: async id => id === user.id ? user : null,
  };
  const store = new session.MemoryStore(); // Tests only; production uses MongoDB.
  const app = createApp(async () => {}, {
    session: createSessionMiddleware(store, 'test-only-session-secret-at-least-32-characters', false),
    router: createAuthRouter({
      appOrigin: 'http://127.0.0.1:4200', callbackUrl: 'http://127.0.0.1:4200/api/auth/github/callback',
      clientId: configured ? 'test-client' : undefined, scope: 'public_repo', secure: false, users,
      github: configured ? { signIn: async (_code, verifier) => {
        exchanges++;
        assert.ok(verifier.length >= 43);
        if (providerFails) throw new Error('sensitive provider-secret-token');
        return identity;
      } } : undefined,
    }),
  });
  return { app, store, exchanges: () => exchanges };
}

async function begin(agent: ReturnType<typeof request.agent>) {
  const response = await agent.get('/api/auth/github').expect(302);
  return { response, url: new URL(response.headers.location) };
}

test('anonymous session reports no user and protected logout returns 401', async () => {
  const { app } = fixture();
  const response = await request(app).get('/api/auth/me').expect(200);
  assert.deepEqual(response.body, { configured: true, user: null });
  assert.equal(response.headers['set-cookie'], undefined);
  await request(app).post('/api/auth/logout').expect(401);
});

test('missing configuration leaves health available and refuses sign-in', async () => {
  const { app } = fixture(false);
  await request(app).get('/api/health').expect(200);
  const response = await request(app).get('/api/auth/me').expect(200);
  assert.equal(response.body.configured, false);
  await request(app).get('/api/auth/github').expect(503);
});

test('authorization uses state, PKCE, fixed callback, and HttpOnly SameSite cookie', async () => {
  const { app } = fixture();
  const { response, url } = await begin(request.agent(app));
  assert.equal(url.origin, 'https://github.com');
  assert.equal(url.searchParams.get('state')?.length, 64);
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.ok(url.searchParams.get('code_challenge'));
  assert.equal(url.searchParams.get('redirect_uri'), 'http://127.0.0.1:4200/api/auth/github/callback');
  assert.equal(url.searchParams.has('client_secret'), false);
  assert.match(response.headers['set-cookie'][0], /HttpOnly/);
  assert.match(response.headers['set-cookie'][0], /SameSite=Lax/);
});

test('invalid state is rejected before token exchange and consumes the attempt', async () => {
  const f = fixture();
  const agent = request.agent(f.app);
  const { url } = await begin(agent);
  await agent.get('/api/auth/github/callback').query({ code: 'code', state: 'wrong' }).expect(400);
  await agent.get('/api/auth/github/callback').query({ code: 'code', state: url.searchParams.get('state') }).expect(400);
  assert.equal(f.exchanges(), 0);
});

test('missing session and state from a different browser cannot authenticate', async () => {
  const f = fixture();
  const { url } = await begin(request.agent(f.app));
  await request(f.app).get('/api/auth/github/callback').query({ code: 'code', state: url.searchParams.get('state') }).expect(400);
  assert.equal(f.exchanges(), 0);
});

test('OAuth attempts expire after ten minutes', async context => {
  const f = fixture();
  const agent = request.agent(f.app);
  const { url } = await begin(agent);
  const later = Date.now() + 11 * 60 * 1000;
  context.mock.method(Date, 'now', () => later);
  await agent.get('/api/auth/github/callback').query({ code: 'code', state: url.searchParams.get('state') }).expect(400);
  assert.equal(f.exchanges(), 0);
});

test('successful sign-in rotates session, excludes credentials, and logout invalidates it', async () => {
  const f = fixture();
  const agent = request.agent(f.app);
  const { response: initial, url } = await begin(agent);
  const callback = await agent.get('/api/auth/github/callback').query({ code: 'code', state: url.searchParams.get('state') }).expect(302);
  assert.equal(callback.headers.location, 'http://127.0.0.1:4200/');
  const initialCookie = initial.headers['set-cookie'][0].split(';')[0];
  const signedInCookie = callback.headers['set-cookie'][0].split(';')[0];
  assert.notEqual(initialCookie, signedInCookie);
  const me = await agent.get('/api/auth/me').expect(200);
  assert.deepEqual(me.body.user, user);
  assert.equal(me.body.csrfToken.length, 64);
  assert.ok(!me.text.includes(identity.accessToken));
  await agent.post('/api/auth/logout').expect(403);
  await agent.post('/api/auth/logout').set('X-Devflow-CSRF', me.body.csrfToken).expect(204);
  const after = await request(f.app).get('/api/auth/me').set('Cookie', signedInCookie).expect(200);
  assert.equal(after.body.user, null);
});

test('provider failures and denials redirect with a fixed sanitized message', async () => {
  const f = fixture(true, true);
  const agent = request.agent(f.app);
  const { url } = await begin(agent);
  const response = await agent.get('/api/auth/github/callback').query({ code: 'code', state: url.searchParams.get('state') }).expect(302);
  assert.equal(response.headers.location, 'http://127.0.0.1:4200/?authError=github');
  assert.ok(!response.text.includes(identity.accessToken));
  assert.equal((await agent.get('/api/auth/me')).body.user, null);
  const denied = await begin(agent);
  await agent.get('/api/auth/github/callback').query({ error: 'access_denied', state: denied.url.searchParams.get('state') }).expect(302);
  assert.equal(f.exchanges(), 1);
});
