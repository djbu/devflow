import session from 'express-session';
import type { Request, RequestHandler } from 'express';
import { timingSafeEqual } from 'node:crypto';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    csrfToken?: string;
    oauth?: { state: string; verifier: string; createdAt: number };
  }
}

export const SESSION_COOKIE = 'devflow.sid';
export function createSessionMiddleware(store: session.Store, secret: string, secure: boolean) {
  return session({
    name: SESSION_COOKIE, secret, store, resave: false, saveUninitialized: false,
    cookie: { httpOnly: true, secure, sameSite: 'lax', maxAge: 8 * 60 * 60 * 1000, path: '/' },
  });
}

export function equalSecret(actual: unknown, expected: string): boolean {
  if (typeof actual !== 'string') return false;
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const requireAuth: RequestHandler = (request, response, next) => {
  if (!request.session?.userId) {
    response.status(401).json({ error: 'Sign in required' });
    return;
  }
  response.locals.userId = request.session.userId;
  next();
};

export const requireCsrf: RequestHandler = (request, response, next) => {
  if (!request.session.csrfToken || !equalSecret(request.get('X-Devflow-CSRF'), request.session.csrfToken)) {
    response.status(403).json({ error: 'Invalid request token' });
    return;
  }
  next();
};

export function saveSession(request: Request) {
  return new Promise<void>((resolve, reject) => request.session.save(error => error ? reject(error) : resolve()));
}
export function regenerateSession(request: Request) {
  return new Promise<void>((resolve, reject) => request.session.regenerate(error => error ? reject(error) : resolve()));
}
export function destroySession(request: Request) {
  return new Promise<void>((resolve, reject) => request.session.destroy(error => error ? reject(error) : resolve()));
}
