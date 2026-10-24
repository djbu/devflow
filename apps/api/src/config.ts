import { z } from 'zod';

const optionalSetting = z.preprocess(value => value === '' ? undefined : value, z.string().min(1).optional());
const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().regex(/^\d+$/).default('3000')
    .transform(Number).pipe(z.number().int().min(1).max(65535)),
  MONGODB_URI: z.string().regex(/^mongodb(?:\+srv)?:\/\/\S+$/),
  SESSION_SECRET: z.string().min(32),
  TOKEN_ENCRYPTION_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/),
  APP_ORIGIN: z.string().url().default('http://127.0.0.1:4200'),
  GITHUB_CALLBACK_URL: z.string().url().default('http://127.0.0.1:4200/api/auth/github/callback'),
  GITHUB_CLIENT_ID: optionalSetting,
  GITHUB_CLIENT_SECRET: optionalSetting,
  GITHUB_SCOPES: z.enum(['public_repo', 'repo']).default('public_repo'),
  WEBHOOK_PORT: z.string().regex(/^\d+$/).default('3001')
    .transform(Number).pipe(z.number().int().min(1).max(65535)),
  WEBHOOK_PUBLIC_URL: optionalSetting,
  GITHUB_WEBHOOK_SECRET: z.preprocess(value => value === '' ? undefined : value, z.string().min(32).optional()),

}).superRefine((config, context) => {
  if (config.PORT === config.WEBHOOK_PORT) {
    context.addIssue({ code: 'custom', path: ['WEBHOOK_PORT'], message: 'Use a separate webhook port' });
  }
  if (config.WEBHOOK_PUBLIC_URL) {
    let valid = false;
    try {
      const url = new URL(config.WEBHOOK_PUBLIC_URL);
      valid = url.protocol === 'https:' && url.origin === config.WEBHOOK_PUBLIC_URL && !url.username && !url.password;
    } catch { /* Invalid configuration is reported using its setting name only. */ }
    if (!valid) context.addIssue({ code: 'custom', path: ['WEBHOOK_PUBLIC_URL'], message: 'Use an HTTPS origin without a path' });
    if (!config.GITHUB_WEBHOOK_SECRET) context.addIssue({ code: 'custom', path: ['GITHUB_WEBHOOK_SECRET'], message: 'Required for webhooks' });
  }

  if (Boolean(config.GITHUB_CLIENT_ID) !== Boolean(config.GITHUB_CLIENT_SECRET)) {
    context.addIssue({ code: 'custom', path: ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'], message: 'Configure both or neither' });
  }
  let origin: URL;
  let callback: URL;
  try {
    origin = new URL(config.APP_ORIGIN);
    callback = new URL(config.GITHUB_CALLBACK_URL);
  } catch {
    return; // The URL validators already report invalid URLs without exposing values.
  }
  if (!['http:', 'https:'].includes(origin.protocol) || origin.origin !== config.APP_ORIGIN || origin.username || origin.password) {
    context.addIssue({ code: 'custom', path: ['APP_ORIGIN'], message: 'Use an HTTP(S) origin without a path' });
  }
  if (callback.origin !== origin.origin || callback.pathname !== '/api/auth/github/callback' || callback.search || callback.hash || callback.username || callback.password) {
    context.addIssue({ code: 'custom', path: ['GITHUB_CALLBACK_URL'], message: 'Callback must use the application origin and fixed route' });
  }
  if (config.NODE_ENV === 'production' && origin.protocol !== 'https:') {
    context.addIssue({ code: 'custom', path: ['APP_ORIGIN'], message: 'Production requires HTTPS' });
  }
});

export class EnvironmentError extends Error {}

export function readConfig(environment: NodeJS.ProcessEnv) {
  const result = environmentSchema.safeParse(environment);
  if (!result.success) {
    const fields = [...new Set(result.error.issues.map(issue => issue.path.join('.')))];
    throw new EnvironmentError(`Invalid environment settings: ${fields.join(', ')}`);
  }
  return result.data;
}

export type Config = ReturnType<typeof readConfig>;
