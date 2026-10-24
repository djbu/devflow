import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RepositoryConnectionService, type Connection, type ConnectionStore } from './github/connections.js';
import type { RepositoryGateway } from './github/repository.service.js';

const saved: Connection = { id: '507f1f77bcf86cd799439011', userId: 'user-1', repositoryId: '123', owner: 'owner', name: 'repo', fullName: 'owner/repo', enabled: false, updatedAt: new Date() };
function fixture(admin = true, managed = false, managedUrl?: string) {
  let saveCalls = 0;
  let reserved = 0;
  let updatedHook: number | undefined;
  const store: ConnectionStore = {
    reserve: async userId => { assert.equal(userId, 'user-1'); reserved++; return managed ? { ...saved, webhookId: 100 } : saved; },
    activate: async (_id, userId, hookId) => { assert.equal(userId, 'user-1'); return { ...saved, enabled: true, webhookId: hookId }; },
    find: async () => saved, list: async () => [saved],
  };
  const github: RepositoryGateway = {
    repository: async () => ({ id: '123', owner: 'owner', name: 'repo', fullName: 'owner/repo', admin, isPrivate: false }),
    hooks: async () => [
      { id: 999, url: 'https://unrelated.example/webhook' },
      ...(managed ? [{ id: 100, url: managedUrl ?? 'https://old-tunnel.example/api/github/webhooks/' + saved.id }] : []),
    ],
    saveHook: async (_token, _owner, _repo, url, secret, hookId) => {
      saveCalls++;
      assert.equal(url, 'https://tunnel.example/api/github/webhooks/' + saved.id);
      assert.equal(secret.length, 64);
      updatedHook = hookId;
      return hookId ?? 101;
    },
    comment: async () => { throw new Error('not used'); },
  };
  return {
    service: new RepositoryConnectionService(store, github, async userId => { assert.equal(userId, 'user-1'); return 'token'; }, 'https://tunnel.example', 'master'),
    reserved: () => reserved, updatedHook: () => updatedHook, saveCalls: () => saveCalls,
  };
}

test('non-admin repositories are rejected before reserving connections or changing hooks', async () => {
  const f = fixture(false);
  await assert.rejects(f.service.connect('user-1', 'owner', 'repo'), /administrator access/);
  assert.equal(f.reserved(), 0);
});

test('connecting creates an owned hook while leaving unrelated hooks untouched', async () => {
  const f = fixture();
  const result = await f.service.connect('user-1', 'owner', 'repo');
  assert.equal(result.webhookId, 101);
  assert.equal(f.updatedHook(), undefined);
});

test('reconnecting updates only the persisted managed hook and keeps its identity', async () => {
  const f = fixture(true, true);
  const result = await f.service.connect('user-1', 'owner', 'repo');
  assert.equal(result.webhookId, 100);
  assert.equal(f.updatedHook(), 100);
});

test('externally repurposed or malformed managed hook URLs cannot be overwritten', async () => {
  for (const url of ['https://other.example/prefix/api/github/webhooks/' + saved.id, 'not-a-url']) {
    const f = fixture(true, true, url);
    await assert.rejects(f.service.connect('user-1', 'owner', 'repo'), /changed outside Devflow/);
    assert.equal(f.saveCalls(), 0);
  }
});
