# Devflow

A small workflow automation app: sign in with GitHub, create and enable a Zap,
and automatically comment on the same pull request when it opens.

The mandatory flow works against a real GitHub repository. Zaps are persisted
and owned by the signed-in user. The builder supports name, repository, on/off,
trigger, action, comment mapping, and a sample preview. GitLab, Linear, and Slack
appear in the app pickers as unavailable; only GitHub executes. Copilot was not
added.

Submission branch: main, with the verified implementation and root npm lockfile
published after explicit user review/approval. The repository is private; provide
evaluator access before sharing the submission.

## Timing

- Exercise start: **2026-10-24 06:20 -05:00, America/Bogota**, reported by the
  user with minute precision, including planning. It was supplied during review,
  not inferred from file metadata.
- Final code review and verification completed: **2026-10-24 08:46:41 -05:00**
  (agent-observed).
- Exercise work stop / publication handoff: **2026-10-24 08:50 -05:00**, observed
  with minute precision. Elapsed time from the user-reported start: about 2h 30m,
  including planning, approvals, review, and publication. Update this record if
  more exercise work is performed afterward.
- Four-hour deadline: 2026-10-24 10:20 -05:00. Review and commits also count.
- [Milestone tracker](milestones/README.md) records observed implementation phase
  start/end times; gaps between phases are not subtracted from elapsed time.

## Local setup

Tested with Node.js 24.22.1, npm 11.19.1, MongoDB 8.0.34, and cloudflared 2026.10.3
on macOS. Use Node 24/npm 11; the shell on the development machine initially
selected Node 14, which is unsupported. nvm reads the pinned .nvmrc.

From a fresh checkout:

```bash
git clone https://github.com/djbu/devflow.git
cd devflow
nvm install
nvm use
npm ci
cp .env.example .env
```

Copy the example only on first setup; preserve an existing .env. Generate three
independent secrets and copy each output into its matching local .env setting:

```bash
node -e "for (const key of ['SESSION_SECRET','TOKEN_ENCRYPTION_KEY','GITHUB_WEBHOOK_SECRET']) console.log(key+'='+require('node:crypto').randomBytes(32).toString('hex'))"
```

Never commit real secrets. The API loads the repository-root .env in source and
compiled runs; existing process environment variables take precedence. On this
machine .env has owner-only permissions and remains ignored by Git.

Use an existing MongoDB instance or create the local database container once:

```bash
docker run -d --name devflow-mongo \
  -p 127.0.0.1:27017:27017 \
  -v devflow-mongo-data:/data/db mongo:8.0
```

If that container already exists, use `docker start devflow-mongo`. Stop it with
`docker stop devflow-mongo`; the named volume retains data. The database user must
be able to create collections/indexes, including the sessions TTL and execution
unique indexes.

## GitHub and webhook configuration

1. Register your own [GitHub OAuth App](https://github.com/settings/applications/new).
   Homepage: `http://127.0.0.1:4200`. Callback:
   `http://127.0.0.1:4200/api/auth/github/callback`. Leave wildcard redirects and
   device flow disabled. Save its Client ID and generated client secret in .env.
   The current local account uses [Devflow local under djbu](https://github.com/settings/applications/3960466).
2. Start the API and frontend from the repository root:

   ```bash
   npm run dev
   ```

   Open http://127.0.0.1:4200. Use 127.0.0.1 consistently; localhost is a different
   cookie host. The backend starts only after MongoDB and required indexes are
   ready. Ctrl+C stops both development processes; MongoDB runs independently.
3. Run an HTTPS forwarding tool against the **webhook-only port 3001**, in another
   terminal. The temporary Cloudflare tool was installed with user approval:

   ```bash
   brew install cloudflared
   cloudflared tunnel --url http://127.0.0.1:3001 --no-autoupdate
   ```

4. Set WEBHOOK_PUBLIC_URL to the printed HTTPS origin, without a trailing slash
   or path, and restart the API to reload .env. Do not forward port 3000: it
   contains local account and application routes. The public listener exposes
   only POST /api/github/webhooks/:connectionId; other routes return 404.
5. Sign in, enter an administered repository as owner/name, and connect it.
   The app checks admin permission using the signed-in user's GitHub credential
   and creates/reuses only its own JSON pull_request webhook. TLS verification
   stays enabled. Reconnect updates the persisted hook when a tunnel URL changes.

Default scope public_repo supports public repositories. GITHUB_SCOPES=repo also
supports private repositories but grants broader repository access; change it
and sign in again to reauthorize. Neither scope is fine-grained per repository.
No email or organization-admin scope is requested. Organization policy can
restrict access. [GitHub scope reference](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps)

The demo uses public [djbu/devflow-demo](https://github.com/djbu/devflow-demo), with
only test fixtures. Application source remains in private djbu/devflow. The
current tunnel and app are left running. A quick tunnel has no uptime guarantee
and gets a new origin when restarted: update .env, restart the API, then reconnect
the repository. End public exposure by stopping cloudflared with Ctrl+C.

## Environment

| Setting | Required | Default / purpose |
| --- | --- | --- |
| NODE_ENV | No | development; also accepts test, production |
| PORT | No | 3000; local account/API port |
| MONGODB_URI | Yes | Example: mongodb://127.0.0.1:27017/devflow; include database name |
| SESSION_SECRET | Yes | At least 32 characters; signs session IDs |
| TOKEN_ENCRYPTION_KEY | Yes | 64 hex characters; AES-256-GCM key |
| APP_ORIGIN | No | http://127.0.0.1:4200; exact origin, no trailing slash |
| GITHUB_CALLBACK_URL | No | Same origin plus /api/auth/github/callback |
| GITHUB_CLIENT_ID | For sign-in | OAuth application Client ID |
| GITHUB_CLIENT_SECRET | For sign-in | Backend-only OAuth application secret |
| GITHUB_SCOPES | No | public_repo or repo |
| WEBHOOK_PORT | No | 3001; must differ from PORT |
| WEBHOOK_PUBLIC_URL | For connection | HTTPS origin forwarding to webhook-only listener |
| GITHUB_WEBHOOK_SECRET | With public URL | Independent secret of at least 32 characters |

Configure both OAuth credentials or leave both blank. Without them, health and
the frontend work but sign-in is unavailable. Partial credentials fail startup.
After any .env edit, restart the API; the TypeScript watcher does not reload .env.
If PORT changes, update apps/web/proxy.conf.json (default target is port 3000).
If APP_ORIGIN changes, explicitly update GITHUB_CALLBACK_URL and GitHub settings;
the callback's default is the fixed local URL shown above.

## Demo

1. Sign in and connect the test repository.
2. Create Zap, set its name/repository, choose GitHub / Pull request opened and
   GitHub / Comment on the same PR.
3. Edit the comment and append mapping variables with the buttons. The labelled
   preview uses sample data. Check Enabled, Save Zap, and confirm the list says On.
4. Open a real PR. Confirm the comment on that PR and Refresh results in Devflow.
5. Edit/save the Zap and open a new PR to verify the new template.
6. Disable/save the Zap and open another PR; it should produce no comment or
   execution claim. Re-enable it when ready for further demonstrations.

| Allowed variable | GitHub event field |
| --- | --- |
| {{pr.title}} | pull_request.title |
| {{pr.author}} | pull_request.user.login |
| {{pr.url}} | pull_request.html_url |
| {{repository.fullName}} | repository.full_name |

Unknown or malformed placeholders are rejected by the backend; no expressions
are evaluated. Names are 1-100 trimmed characters, templates 1-10000 characters.
Unsupported providers/events/actions are rejected even when the Zap is disabled.

## Checks and verification

```bash
npm run build
npm run typecheck
npm test
npm audit
curl http://127.0.0.1:3000/api/health
curl http://127.0.0.1:4200/api/health
```

Final automated checks pass: clean npm ci, Angular/API build, app/test typecheck,
**46 API tests + 11 Angular tests (57 total)**, and zero npm audit findings at
verification time. An isolated copy without local node_modules or .env also
passed the checks; its compiled API started against a fresh MongoDB database.
The audit result is a dependency snapshot, not a production security guarantee.

Real verification includes GitHub sign-in/reload/logout, saved Zap creation,
[mapped comment on PR #2](https://github.com/djbu/devflow-demo/pull/2#issuecomment-6384608525),
[edited comment on PR #3](https://github.com/djbu/devflow-demo/pull/3#issuecomment-6384620090),
and [disabled PR #4](https://github.com/djbu/devflow-demo/pull/4) returning ignored
with zero comments. Redelivery after editing kept one comment per saved Zap and
delivery. Final review also confirmed the [comment on PR #5](https://github.com/djbu/devflow-demo/pull/5#issuecomment-6384885418).
Cross-user API tests use mocked GitHub identities; separate real MongoDB checks
confirm owner-scoped persistence. No second live GitHub account was fabricated.
See the [detailed verification record](docs/verification.md) for evidence and
historical checkpoints.

## Architecture and API

- apps/web: Angular account view, repository connection form, owned Zap list and
  builder, sample preview, recent 20 executions.
- apps/api: Express features auth, github, zaps, executions; thin handlers and
  small GitHub services. OAuth uses backend fetch; repository/hooks/comments use
  Octokit REST with a five-second timeout and no retry plugin.
- One Node backend process and one MongoDB database. Two loopback HTTP listeners
  keep public webhook traffic separate from account/API traffic. No queue or
  additional workflow service was introduced.
- MongoDB stores users, sessions, connections, Zaps, executions. Ownership comes
  from the session, not a frontend userId. Connection admin access is checked on
  GitHub; webhook delivery resolves that connection's owner, not the PR author.

| Endpoint | Behavior |
| --- | --- |
| GET /api/health | Pings MongoDB; 200 connected, 503 unavailable |
| GET /api/auth/github | Random OAuth state + PKCE S256 authorization redirect |
| GET /api/auth/github/callback | State validation, backend exchange, user persistence, session rotation |
| GET /api/auth/me | Safe current-user profile or null, configured flag, CSRF token |
| POST /api/auth/logout | CSRF-protected local session destruction |
| GET /api/github/connections | Owned connections and webhook readiness |
| POST /api/github/connections | CSRF-protected admin repository connection |
| GET /api/zaps, /api/zaps/:id | Owned list/read; foreign IDs return 404 |
| POST /api/zaps, PUT /api/zaps/:id | CSRF-protected validated create/edit |
| GET /api/executions | Latest 20 owned executions |
| POST /api/github/webhooks/:connectionId | Raw-body signature verification and supported event execution |

All local API responses use no-store. Unexpected failures log only method/route
patterns, never error objects, queries, headers, bodies, or credentials. Startup
validation names invalid settings without printing their values.

## Decisions and limitations

- State is session-bound, expires after ten minutes, and is consumed before token
  exchange. Successful login rotates the session ID. Cookies are HttpOnly,
  SameSite=Lax, host-only, and last eight hours; production requires HTTPS and
  Secure cookies, with only a loopback TLS proxy trusted. Deployment is untested.
- Tokens stay on the backend, encrypted with AES-256-GCM and fresh IVs; sessions
  contain no GitHub token. A unique GitHub ID identifies users. Logout ends the
  local session but retains the encrypted credential for workflows. Revoke the
  OAuth grant in GitHub to revoke access. Token expiry is recorded; refresh tokens
  and automatic refresh are not implemented. Reauthorize after expiry. Losing or
  changing TOKEN_ENCRYPTION_KEY requires reauthorization, not automatic migration.
- Webhooks use raw JSON (1 MiB limit), constant-time HMAC-SHA256 checks, and reject
  compressed bodies. Per-connection secrets are derived from the environment
  master secret; rotating it requires reconnecting managed hooks. Invalid
  signatures return 401; unsupported signed events/actions return ignored.
- Execution claims use a unique (zapId, deliveryId) index before commenting.
  Duplicate claims return duplicate; failed and uncertain processing claims are
  also retained. No automatic retries occur, and the handler waits for work
  rather than pretending it is durably queued. Failed GitHub calls return 502;
  database failures return 500. Multiple matching Zaps have independent claims.
- Comment publication and success persistence are not one transaction. A crash or
  network timeout can leave an uncertain result even if a comment was accepted.
  Inspect the PR before recovery. This does not promise exactly-once external
  effects. GitHub does not automatically redeliver failed deliveries, and manual
  redelivery of an already-claimed delivery will not retry its write.
- Five-second database/GitHub timeouts can combine to exceed GitHub's response
  deadline under slow dependencies. There is no durable queue, recovery worker,
  pagination, deletion API, full execution-history UI, or Copilot. Disable applies
  before event selection and does not cancel an already-running comment. An
  earlier ignored event can run if manually redelivered after enabling a Zap.
- Only public-repository integration was verified live. Private repositories,
  organization restrictions, a second live account, and production hosting remain
  unverified. This is a local take-home MVP, not a production deployment.
- A scoped undici 7.30.1 override patches Angular 21's build dependency; remove it
  once upstream includes the fix. npm 11.19.1 reports optional/native dependency
  install-script approvals; no blanket approval was added and tested platform
  packages passed install/build/tests.

Individual development commands: npm run dev -w @devflow/api and npm run dev
-w @devflow/web. After building, npm start -w @devflow/api runs the compiled API.
Angular output is apps/web/dist/web/browser; API output is apps/api/dist.
Frontend deployment/static hosting is outside this exercise; Angular's API proxy
is a development-server feature.

## AI usage and Git history

Codex read the brief, helped scope and sequence the work, generated most of the
scaffold and implementation, wrote tests/documentation, ran checks, operated the
local app, and verified real GitHub behavior. The user supplied direction,
repository/tunnel/access approvals, the OAuth client secret locally, and the
reported start time. The author must review the code and be able to explain it.

The planning commit was created/pushed at explicit user request. Application
implementation was published as one reviewed delivery after explicit approval;
no milestone commits were invented or backdated. Public demo-repository commits/PRs are genuine disposable
fixtures created through GitHub's API for the live tests, not application source.
During final review Codex fixed private-response caching, safe error diagnostics,
managed-hook path validation, and missing execution-update detection. A new log
redaction test first assumed a full mounted path; its expectation was corrected
to Express's error-handler route context and the final test run passes.
