import { Router, raw } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { webhookSecret } from './connections.js';
import { InvalidWebhook, type WebhookProcessor } from './webhook.processor.js';

export function verifySignature(body: Buffer, signature: string | undefined, secret: string): boolean {
  if (!signature || !/^sha256=[0-9a-f]{64}$/.test(signature)) return false;
  const expected = createHmac('sha256', secret).update(body).digest();
  const supplied = Buffer.from(signature.slice(7), 'hex');
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
export function createWebhookRouter(masterSecret: string | undefined, processor: WebhookProcessor) {
  const router = Router();
  router.post('/:connectionId', raw({ type: 'application/json', limit: '1mb', inflate: false }), async (request, response) => {
    if (!masterSecret) { response.status(503).json({ error: 'Webhook delivery is unavailable' }); return; }
    const id = request.params.connectionId;
    if (typeof id !== 'string' || !/^[a-f0-9]{24}$/.test(id) || !Buffer.isBuffer(request.body)) {
      response.status(400).json({ error: 'Invalid webhook request' });
      return;
    }
    if (!verifySignature(request.body, request.get('X-Hub-Signature-256'), webhookSecret(masterSecret, id))) {
      response.status(401).json({ error: 'Invalid webhook signature' });
      return;
    }
    const deliveryId = request.get('X-GitHub-Delivery');
    if (!deliveryId || !/^[a-zA-Z0-9-]{1,100}$/.test(deliveryId)) {
      response.status(400).json({ error: 'Missing or invalid delivery ID' });
      return;
    }
    if (request.get('X-GitHub-Event') !== 'pull_request') {
      response.json({ status: 'ignored' });
      return;
    }
    let input: unknown;
    try { input = JSON.parse(request.body.toString('utf8')); }
    catch { response.status(400).json({ error: 'Invalid JSON payload' }); return; }
    if (typeof input === 'object' && input !== null && 'action' in input && input.action !== 'opened') {
      response.json({ status: 'ignored' });
      return;
    }
    try {
      const result = await processor.process(id, deliveryId, input);
      response.status(result.status === 'failed' ? 502 : 200).json(result);
    } catch (error) {
      if (error instanceof InvalidWebhook) { response.status(400).json({ error: error.message }); return; }
      throw error;
    }
  });
  return router;
}
