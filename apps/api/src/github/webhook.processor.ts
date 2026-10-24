import { z } from 'zod';
import type { Connection, ConnectionStore } from './connections.js';
import type { Zap, ZapStore } from '../zaps/zap-store.js';
import type { RepositoryGateway } from './repository.service.js';
import { safeGitHubError } from './repository.service.js';
import type { ExecutionStore } from '../executions/execution-store.js';
import { renderTemplate } from '../zaps/template.js';

const openedPullRequest = z.object({
  action: z.literal('opened'),
  number: z.number().int().positive(),
  repository: z.object({ id: z.number().int().positive(), full_name: z.string().min(1) }),
  pull_request: z.object({
    number: z.number().int().positive(), title: z.string(), html_url: z.string().url(),
    user: z.object({ login: z.string().min(1) }),
    base: z.object({ repo: z.object({ id: z.number().int().positive() }) }),
  }),
});
export class InvalidWebhook extends Error {}
export class WebhookProcessor {
  constructor(private readonly connections: ConnectionStore, private readonly executions: ExecutionStore,
    private readonly github: RepositoryGateway, private readonly tokenFor: (userId: string) => Promise<string>,
    private readonly zaps: ZapStore) {}

  async process(connectionId: string, deliveryId: string, input: unknown) {
    const parsed = openedPullRequest.safeParse(input);
    if (!parsed.success) throw new InvalidWebhook('Invalid pull request payload');
    const event = parsed.data;
    const connection = await this.connections.find(connectionId);
    if (!connection || !connection.enabled || !connection.webhookId) {
      return { status: 'ignored' as const };
    }
    if (String(event.repository.id) !== connection.repositoryId
      || event.pull_request.base.repo.id !== event.repository.id
      || event.number !== event.pull_request.number) {
      throw new InvalidWebhook('Repository or pull request does not match the connection');
    }
    const zaps = await this.zaps.enabledForConnection(connection.id, connection.userId);
    if (!zaps.length) return { status: 'ignored' as const };
    const executions = await Promise.all(zaps.map(zap => this.execute(zap, connection, deliveryId, event)));
    const status = executions.some(result => result.status === 'failed') ? 'failed' as const
      : executions.some(result => result.status === 'succeeded') ? 'succeeded' as const : 'duplicate' as const;
    return { status, executions };
  }

  private async execute(zap: Zap, connection: Connection, deliveryId: string, event: z.infer<typeof openedPullRequest>) {
    const zapId = zap.id;
    const claimed = await this.executions.claim({
      userId: connection.userId, connectionId: connection.id, zapId, deliveryId,
      repository: connection.fullName, pullRequestNumber: event.number,
    });
    if (!claimed) return { zapId, status: 'duplicate' as const };

    let comment: { id: number; url: string };
    try {
      const token = await this.tokenFor(connection.userId);
      const body = renderTemplate(zap.action.template, {
        'pr.title': event.pull_request.title, 'pr.author': event.pull_request.user.login,
        'pr.url': event.pull_request.html_url, 'repository.fullName': event.repository.full_name,
      });
      comment = await this.github.comment(token, connection.owner, connection.name, event.number, body);
    } catch (error) {
      const message = safeGitHubError(error);
      await this.executions.fail(zapId, deliveryId, message);
      return { zapId, status: 'failed' as const, error: message };
    }
    // A failure here leaves processing rather than claiming the external write failed.
    // Redelivery cannot safely repeat the comment after an uncertain database result.
    await this.executions.succeed(zapId, deliveryId, comment);
    return { zapId, status: 'succeeded' as const };
  }
}
