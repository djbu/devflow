import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decryptToken, encryptToken } from './auth/credentials.js';

const key = 'a'.repeat(64);
test('tokens are encrypted with a fresh IV and decrypt with the correct key', () => {
  const first = encryptToken('github-secret', key);
  const second = encryptToken('github-secret', key);
  assert.notEqual(first.iv, second.iv);
  assert.ok(!JSON.stringify(first).includes('github-secret'));
  assert.equal(decryptToken(first, key), 'github-secret');
});
test('authenticated encryption rejects altered ciphertext and wrong keys', () => {
  const encrypted = encryptToken('github-secret', key);
  assert.throws(() => decryptToken(encrypted, 'b'.repeat(64)));
  assert.throws(() => decryptToken({ ...encrypted, tag: Buffer.alloc(16).toString('base64') }, key));
});
