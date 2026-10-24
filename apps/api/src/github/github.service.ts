import { z } from 'zod';

const tokenSchema = z.object({ access_token: z.string().min(1), token_type: z.literal('bearer'), scope: z.string(), expires_in: z.number().positive().optional() });
const profileSchema = z.object({
  id: z.number().int().positive(), login: z.string().min(1), name: z.string().nullable(),
  avatar_url: z.string().url(), html_url: z.string().url(),
});
export type GitHubProfile = z.infer<typeof profileSchema>;
export interface GitHubIdentity {
  profile: GitHubProfile;
  accessToken: string;
  scopes: string[];
  expiresAt?: Date;
}
export interface GitHubAuthGateway {
  signIn(code: string, verifier: string): Promise<GitHubIdentity>;
}

export class GitHubService implements GitHubAuthGateway {
  constructor(private readonly options: { clientId: string; clientSecret: string; callbackUrl: string; scope: 'public_repo' | 'repo' }) {}

  async signIn(code: string, verifier: string): Promise<GitHubIdentity> {
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST', signal: AbortSignal.timeout(10_000),
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.options.clientId, client_secret: this.options.clientSecret,
        redirect_uri: this.options.callbackUrl, code, code_verifier: verifier,
      }),
    });
    if (!tokenResponse.ok) throw new Error('GitHub authentication failed');
    const token = tokenSchema.parse(await tokenResponse.json());
    const scopes = token.scope.split(/[ ,]+/).filter(Boolean);
    if (!scopes.includes(this.options.scope) && !scopes.includes('repo')) {
      throw new Error('GitHub repository permission was not granted');
    }
    const profileResponse = await fetch('https://api.github.com/user', {
      signal: AbortSignal.timeout(10_000),
      headers: {
        Accept: 'application/vnd.github+json', Authorization: `Bearer ${token.access_token}`,
        'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'devflow',
      },
    });
    if (!profileResponse.ok) throw new Error('GitHub profile lookup failed');
    const profile = profileSchema.parse(await profileResponse.json());
    return {
      profile, accessToken: token.access_token, scopes,
      ...(token.expires_in ? { expiresAt: new Date(Date.now() + token.expires_in * 1000) } : {}),
    };
  }
}
