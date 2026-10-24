import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHmac } from 'node:crypto';
import request from 'supertest';
import { createPublicWebhookApp } from './app.js';
import { createWebhookRouter, verifySignature } from './github/webhook.routes.js';
import { WebhookProcessor } from './github/webhook.processor.js';
import { webhookSecret, type Connection, type ConnectionStore } from './github/connections.js';
import type { ExecutionStore } from './executions/execution-store.js';
import type { RepositoryGateway } from './github/repository.service.js';
import type { Zap, ZapStore } from './zaps/zap-store.js';

const master = 'test-webhook-master-secret-at-least-32-characters';
const id = '507f1f77bcf86cd799439011';
const connection: Connection = { id, userId: 'owner-user-id', repositoryId: '123', owner: 'repo-owner', name: 'demo', fullName: 'repo-owner/demo', webhookId: 456, enabled: true, updatedAt: new Date() };
const payload = {
  action: 'opened', number: 7, repository: { id: 123, full_name: 'repo-owner/demo' },
  pull_request: { number: 7, title: 'Real title', html_url: 'https://github.com/repo-owner/demo/pull/7', user: { login: 'contributor' }, base: { repo: { id: 123 } } },
  sender: { login: 'someone-else' },
};
function fixture(options: { disabled?: boolean; connectionDisabled?: boolean; failure?: boolean; saveFailure?: boolean; multiple?: boolean } = {}) {
  const claims = new Set<string>();
  let comments = 0;
  let failure = '';
  let succeeded = 0;
  const connections: ConnectionStore = {
    reserve: async () => connection, activate: async () => connection,
    list: async () => [connection], find: async key => key === id ? { ...connection, enabled: !options.connectionDisabled } : null,
  };
  const executions: ExecutionStore = {
    claim: async claim => {
      assert.equal(claim.userId, connection.userId);
      const key = claim.zapId + claim.deliveryId;
      if (claims.has(key)) return false;
      claims.add(key);
      return true;
    },
    succeed: async () => { if (options.saveFailure) throw new Error('database unavailable'); succeeded++; },
    fail: async (_zap, _delivery, message) => { failure = message; }, list: async () => [],
  };
  const github: RepositoryGateway = {
    repository: async () => { throw new Error('not used'); }, hooks: async () => [], saveHook: async () => 1,
    comment: async (token, owner, repo, number, body) => {
      comments++;
      assert.equal(token, 'owner-token');
      assert.deepEqual([owner, repo, number], ['repo-owner', 'demo', 7]);
      assert.equal(body, 'Thanks contributor for Real title in repo-owner/demo');
      if (options.failure) throw Object.assign(new Error('Authorization Bearer secret-token'), { status: 403 });
      return { id: 1, url: 'https://github.com/repo-owner/demo/pull/7#issuecomment-1' };
    },
  };
  const zap: Zap = {
    id: '507f191e810c19729de860ea', userId: connection.userId, connectionId: id,
    name: 'Test Zap', enabled: !options.disabled, createdAt: new Date(), updatedAt: new Date(),
    trigger: { provider: 'github', event: 'pull_request.opened' },
    action: { provider: 'github', type: 'comment', template: 'Thanks {{pr.author}} for {{pr.title}} in {{repository.fullName}}' },
  };
  const zaps: ZapStore = {
    list: async () => [zap], findOwned: async () => zap, create: async () => zap, updateOwned: async () => zap,
    enabledForConnection: async (connectionId, userId) => {
      assert.equal(connectionId, id); assert.equal(userId, connection.userId);
      if (!zap.enabled) return [];
      return options.multiple ? [zap, { ...zap, id: '507f191e810c19729de860eb' }] : [zap];
    },
  };
  const processor = new WebhookProcessor(connections, executions, github, async userId => {
    assert.equal(userId, connection.userId); return 'owner-token';
  }, zaps);
  const app = createPublicWebhookApp(createWebhookRouter(master, processor));
  const deliver = (body: unknown = payload, delivery = 'delivery-1', event = 'pull_request') => {
    const raw = JSON.stringify(body, null, 2);
    const signature = 'sha256=' + createHmac('sha256', webhookSecret(master, id)).update(raw).digest('hex');
    return request(app).post('/api/github/webhooks/' + id).set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', signature).set('X-GitHub-Delivery', delivery).set('X-GitHub-Event', event).send(raw);
  };
  return { app, deliver, comments: () => comments, failure: () => failure, claims: () => claims.size, succeeded: () => succeeded };
}

test('signature verification matches the official GitHub vector and rejects tampering', () => {
  const signature = 'sha256=757107ea0eb2509fc211221cce984b8a37570b6d7586c22c46f4379c8b043e17';
  assert.equal(verifySignature(Buffer.from('Hello, World!'), signature, "It's a Secret to Everybody"), true);
  assert.equal(verifySignature(Buffer.from('Hello, World!!'), signature, "It's a Secret to Everybody"), false);
});

test('invalid signature cannot execute even when event body is otherwise valid', async () => {
  const f = fixture();
  await request(f.app).post('/api/github/webhooks/' + id).set('Content-Type', 'application/json')
    .set('X-Hub-Signature-256', 'sha256=' + '0'.repeat(64)).send(payload).expect(401);
  assert.equal(f.comments(), 0);
  assert.equal(f.claims(), 0);
});

test('unsupported events and actions are acknowledged without executing', async () => {
  const f = fixture();
  assert.equal((await f.deliver(payload, 'delivery-1', 'push').expect(200)).body.status, 'ignored');
  assert.equal((await f.deliver({ ...payload, action: 'synchronize' }).expect(200)).body.status, 'ignored');
  assert.equal(f.claims(), 0);
});

test('raw pretty-printed JSON is verified and mapped using the connection owner credentials', async () => {
  const f = fixture();
  assert.equal((await f.deliver().expect(200)).body.status, 'succeeded');
  assert.equal(f.comments(), 1);
  assert.equal(f.succeeded(), 1);
});

test('concurrent duplicate deliveries claim once and make one comment', async () => {
  const f = fixture();
  const results = await Promise.all(Array.from({ length: 8 }, () => f.deliver().expect(200)));
  assert.equal(results.filter(result => result.body.status === 'succeeded').length, 1);
  assert.equal(results.filter(result => result.body.status === 'duplicate').length, 7);
  assert.equal(f.comments(), 1);
});

test('disabled persisted Zap and disabled connection do not execute', async () => {
  for (const options of [{ disabled: true }, { connectionDisabled: true }]) {
    const f = fixture(options);
    assert.equal((await f.deliver().expect(200)).body.status, 'ignored');
    assert.equal(f.claims(), 0);
  }
});

test('mismatched repository payloads cannot execute for another connection', async () => {
  const f = fixture();
  await f.deliver({ ...payload, repository: { id: 999, full_name: 'other/repo' } }).expect(400);
  assert.equal(f.comments(), 0);
});

test('GitHub failure is recorded safely and redelivery does not retry the write', async () => {
  const f = fixture({ failure: true });
  const result = await f.deliver().expect(502);
  assert.equal(result.body.status, 'failed');
  assert.ok(!result.text.includes('secret-token'));
  assert.ok(!f.failure().includes('secret-token'));
  assert.equal((await f.deliver().expect(200)).body.status, 'duplicate');
  assert.equal(f.comments(), 1);
});

test('failed success persistence leaves an uncertain claim and does not comment twice', async () => {
  const f = fixture({ saveFailure: true });
  await f.deliver().expect(500);
  assert.equal(f.failure(), '');
  assert.equal((await f.deliver().expect(200)).body.status, 'duplicate');
  assert.equal(f.comments(), 1);
});

test('public listener exposes neither auth endpoints nor health', async () => {
  const f = fixture();
  await request(f.app).get('/api/auth/me').expect(404);
  await request(f.app).get('/api/health').expect(404);
});

test('each enabled Zap claims independently for the same delivery', async () => {
  const f = fixture({ multiple: true });
  const first = await f.deliver().expect(200);
  assert.equal(first.body.executions.length, 2);
  assert.ok(first.body.executions.every((result: { zapId: string }) => !result.zapId.startsWith('development:')));
  assert.equal(f.claims(), 2);
  assert.equal(f.comments(), 2);
  assert.equal((await f.deliver().expect(200)).body.status, 'duplicate');
  assert.equal(f.comments(), 2);
});
