import { Router } from 'express';
import { createHash, randomBytes } from 'node:crypto';
import type { GitHubAuthGateway } from '../github/github.service.js';
import type { UserStore } from './user-store.js';
import { destroySession, equalSecret, regenerateSession, requireAuth, requireCsrf, saveSession, SESSION_COOKIE } from './session.js';

export interface AuthOptions {
  appOrigin: string;
  callbackUrl: string;
  clientId?: string;
  scope: 'public_repo' | 'repo';
  secure: boolean;
  github?: GitHubAuthGateway;
  users: UserStore;
}

export function createAuthRouter(options: AuthOptions) {
  const router = Router();
  const configured = Boolean(options.clientId && options.github);
  router.use((_request, response, next) => {
    response.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
    next();
  });

  router.get('/me', async (request, response) => {
    const user = request.session.userId ? await options.users.findPublicUser(request.session.userId) : null;
    if (!user && request.session.userId) {
      await destroySession(request);
      response.clearCookie(SESSION_COOKIE, { path: '/', httpOnly: true, sameSite: 'lax', secure: options.secure });
    }
    response.json({ configured, user, ...(user ? { csrfToken: request.session.csrfToken } : {}) });
  });

  router.get('/github', async (request, response) => {
    if (!configured) {
      response.status(503).json({ error: 'GitHub sign-in is not configured' });
      return;
    }
    const state = randomBytes(32).toString('hex');
    const verifier = randomBytes(32).toString('base64url');
    request.session.oauth = { state, verifier, createdAt: Date.now() };
    await saveSession(request);
    const url = new URL('https://github.com/login/oauth/authorize');
    url.search = new URLSearchParams({
      client_id: options.clientId!, redirect_uri: options.callbackUrl,
      scope: options.scope, state,
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: 'S256',
    }).toString();
    response.redirect(url.toString());
  });

  router.get('/github/callback', async (request, response) => {
    const pending = request.session.oauth;
    delete request.session.oauth;
    await saveSession(request);
    if (!pending || !equalSecret(request.query.state, pending.state)
      || Date.now() - pending.createdAt > 10 * 60 * 1000) {
      response.status(400).json({ error: 'Invalid or expired OAuth state. Start sign-in again.' });
      return;
    }
    if (request.query.error || typeof request.query.code !== 'string' || !request.query.code || !options.github) {
      response.redirect(`${options.appOrigin}/?authError=github`);
      return;
    }
    try {
      const identity = await options.github.signIn(request.query.code, pending.verifier);
      const user = await options.users.saveIdentity(identity);
      await regenerateSession(request);
      request.session.userId = user.id;
      request.session.csrfToken = randomBytes(32).toString('hex');
      await saveSession(request);
      response.redirect(`${options.appOrigin}/`);
    } catch {
      // Never reflect provider responses, authorization codes, or token errors.
      response.redirect(`${options.appOrigin}/?authError=github`);
    }
  });

  router.post('/logout', requireAuth, requireCsrf, async (request, response) => {
    await destroySession(request);
    response.clearCookie(SESSION_COOKIE, { path: '/', httpOnly: true, sameSite: 'lax', secure: options.secure });
    response.sendStatus(204);
  });

  return router;
}
