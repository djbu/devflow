import { Octokit } from '@octokit/rest';
import { CredentialUnavailable } from '../auth/user-store.js';

export interface RepositoryInfo { id: string; owner: string; name: string; fullName: string; admin: boolean; isPrivate: boolean }
export interface HookInfo { id: number; url: string }
export interface RepositoryGateway {
  repository(token: string, owner: string, repo: string): Promise<RepositoryInfo>;
  hooks(token: string, owner: string, repo: string): Promise<HookInfo[]>;
  saveHook(token: string, owner: string, repo: string, url: string, secret: string, hookId?: number): Promise<number>;
  comment(token: string, owner: string, repo: string, number: number, body: string): Promise<{ id: number; url: string }>;
}

export class GitHubRepositoryService implements RepositoryGateway {
  private client(token: string) {
    // @octokit/rest has no retry plugin. Do not add one for comment writes.
    return new Octokit({
      auth: token, userAgent: 'devflow', request: { timeout: 5000 },
      log: { debug() {}, info() {}, warn() {}, error() {} },
    });
  }
  async repository(token: string, owner: string, repo: string): Promise<RepositoryInfo> {
    const { data } = await this.client(token).rest.repos.get({ owner, repo });
    return { id: String(data.id), owner: data.owner.login, name: data.name, fullName: data.full_name, admin: data.permissions?.admin === true, isPrivate: data.private };
  }
  async hooks(token: string, owner: string, repo: string): Promise<HookInfo[]> {
    const client = this.client(token);
    const hooks = await client.paginate(client.rest.repos.listWebhooks, { owner, repo, per_page: 100 });
    return hooks.map(hook => ({ id: hook.id, url: hook.config.url ?? '' }));
  }
  async saveHook(token: string, owner: string, repo: string, url: string, secret: string, hookId?: number): Promise<number> {
    const client = this.client(token);
    const settings = { owner, repo, active: true, events: ['pull_request'], config: { url, content_type: 'json', secret, insecure_ssl: '0' } };
    const { data } = hookId === undefined
      ? await client.rest.repos.createWebhook({ ...settings, name: 'web' })
      : await client.rest.repos.updateWebhook({ ...settings, hook_id: hookId });
    return data.id;
  }
  async comment(token: string, owner: string, repo: string, number: number, body: string) {
    const { data } = await this.client(token).rest.issues.createComment({ owner, repo, issue_number: number, body });
    return { id: data.id, url: data.html_url };
  }
}

export function safeGitHubError(error: unknown): string {
  if (error instanceof CredentialUnavailable) return error.message;
  const status = typeof error === 'object' && error !== null && 'status' in error ? error.status : undefined;
  if (status === 401) return 'GitHub credentials expired or were revoked. Sign in again.';
  if (status === 403) return 'GitHub denied permission or rate limited the request. Check repository access.';
  if (status === 404) return 'GitHub repository or resource is unavailable. Check its name and access.';
  if (status === 422) return 'GitHub rejected the configuration. Check repository webhook settings.';
  return 'GitHub request failed or timed out. Inspect the PR before any recovery attempt.';
}
