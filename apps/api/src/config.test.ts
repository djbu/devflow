import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readConfig } from './config.js';
const secrets = { SESSION_SECRET: 's'.repeat(64), TOKEN_ENCRYPTION_KEY: 'a'.repeat(64) };
const valid = { ...secrets, MONGODB_URI: 'mongodb://127.0.0.1/devflow' };

test('validates environment and applies the default port', () => {
  const config = readConfig(valid);
  assert.equal(config.PORT, 3000);
  assert.equal(config.NODE_ENV, 'development');
  assert.equal(config.GITHUB_SCOPES, 'public_repo');
});

test('requires MongoDB and rejects invalid ports and runtime modes', () => {
  assert.throws(() => readConfig({ ...secrets }), /MONGODB_URI/);
  for (const PORT of ['', '0', '65536', '3000abc', '1.5']) {
    assert.throws(() => readConfig({ ...valid, PORT }), /PORT/);
  }
  assert.throws(() => readConfig({ ...valid, NODE_ENV: 'unknown' }), /NODE_ENV/);
});

test('validation errors do not expose connection-string credentials', () => {
  assert.throws(() => readConfig({ ...valid, MONGODB_URI: 'https://user:secret@localhost/db' }), {
    message: 'Invalid environment settings: MONGODB_URI',
  });
});

test('requires strong secrets and complete OAuth configuration', () => {
  assert.throws(() => readConfig({ ...valid, SESSION_SECRET: 'short' }), /SESSION_SECRET/);
  assert.throws(() => readConfig({ ...valid, TOKEN_ENCRYPTION_KEY: 'invalid' }), /TOKEN_ENCRYPTION_KEY/);
  assert.throws(() => readConfig({ ...valid, GITHUB_CLIENT_ID: 'client' }), /GITHUB_CLIENT/);
  assert.equal(readConfig({ ...valid, GITHUB_CLIENT_ID: '', GITHUB_CLIENT_SECRET: '' }).GITHUB_CLIENT_ID, undefined);
});

test('requires matching callback origin and HTTPS in production', () => {
  assert.throws(() => readConfig({ ...valid, GITHUB_CALLBACK_URL: 'https://attacker.example/callback' }), /GITHUB_CALLBACK_URL/);
  assert.throws(() => readConfig({ ...valid, APP_ORIGIN: 'not-a-url' }), /APP_ORIGIN/);
  assert.throws(() => readConfig({ ...valid, NODE_ENV: 'production' }), /APP_ORIGIN/);
});


test('webhook configuration requires HTTPS, a signing secret, and a distinct port', () => {
  assert.throws(() => readConfig({ ...valid, WEBHOOK_PUBLIC_URL: 'http://example.test' }), /WEBHOOK_PUBLIC_URL/);
  assert.throws(() => readConfig({ ...valid, WEBHOOK_PUBLIC_URL: 'https://example.test' }), /GITHUB_WEBHOOK_SECRET/);
  assert.throws(() => readConfig({ ...valid, WEBHOOK_PORT: '3000' }), /WEBHOOK_PORT/);
});
