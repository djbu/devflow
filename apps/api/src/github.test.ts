import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GitHubService } from './github/github.service.js';

const options = { clientId: 'client', clientSecret: 'server-only-secret', callbackUrl: 'http://127.0.0.1:4200/api/auth/github/callback', scope: 'public_repo' as const };

test('GitHub service sends PKCE during exchange and reads the token owner profile', async context => {
  let calls = 0;
  context.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    calls++;
    if (calls === 1) {
      assert.equal(url, 'https://github.com/login/oauth/access_token');
      const body = new URLSearchParams(String(init.body));
      assert.equal(body.get('code_verifier'), 'verifier');
      assert.equal(body.get('client_secret'), options.clientSecret);
      return Response.json({ access_token: 'token', token_type: 'bearer', scope: 'public_repo', expires_in: 3600 });
    }
    assert.equal(url, 'https://api.github.com/user');
    assert.equal(new Headers(init.headers).get('Authorization'), 'Bearer token');
    return Response.json({ id: 123, login: 'token-owner', name: null, avatar_url: 'https://avatars.githubusercontent.com/u/123', html_url: 'https://github.com/token-owner' });
  });
  const identity = await new GitHubService(options).signIn('code', 'verifier');
  assert.equal(identity.profile.login, 'token-owner');
  assert.equal(identity.accessToken, 'token');
  assert.ok(identity.expiresAt);
  assert.equal(calls, 2);
});

test('OAuth error bodies cannot create an authenticated identity', async context => {
  context.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'bad_verification_code' }));
  await assert.rejects(new GitHubService(options).signIn('code', 'verifier'));
});

test('insufficient granted scopes and GitHub profile failures reject sign-in', async context => {
  const mocked = context.mock.method(globalThis, 'fetch', async () => Response.json({ access_token: 'token', token_type: 'bearer', scope: '' }));
  await assert.rejects(new GitHubService(options).signIn('code', 'verifier'), /permission was not granted/);
  let calls = 0;
  mocked.mock.mockImplementation(async () => {
    calls++;
    return calls === 1
      ? Response.json({ access_token: 'token', token_type: 'bearer', scope: 'repo' })
      : Response.json({ message: 'Bad credentials' }, { status: 401 });
  });
  await assert.rejects(new GitHubService(options).signIn('code', 'verifier'), /profile lookup failed/);
});
