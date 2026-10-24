# Devflow

A small workflow automation app for the four-hour MEAN-stack take-home.
The required workflow is GitHub sign-in -> create and enable a Zap -> open a
real pull request -> publish the configured comment on that same pull request.

## Current status

Planning only. There is no application scaffold, package.json, npm lockfile,
or runnable implementation yet. Setup commands and runtime results will be
added when verified; the descriptions below are implementation targets.

## Scope and acceptance checklist

Mandatory from the brief:
- [ ] TypeScript throughout, Angular frontend, Express/Node.js backend, MongoDB.
- [ ] GitHub OAuth sign-in using the user's own GitHub account.
- [ ] Zaps belong to the signed-in user; other users cannot read or change them.
- [ ] List, create, and edit Zaps with name, on/off, trigger, action, and field mapping.
- [ ] Enabled GitHub PR-opened Zaps comment on the same real PR.
- [ ] Disabled Zaps do not execute.
- [ ] Picker includes several developer tools; only GitHub runs.
- [ ] Runnable Git repository with teammate setup instructions.
- [ ] Actual start and stop times recorded; authentic Git history retained.

Project additions for correctness and debugging:
- [ ] Signature verification, supported-event filtering, and atomic delivery claims.
- [ ] Minimal execution records with status, timestamps, comment ID when available,
      and sanitized error details.
- [ ] Critical automated checks and a recorded real-repository demonstration.

Optional: comment preview, richer execution display, then natural-language
Copilot drafts that the user can review and enable. Never trade mandatory
features for these additions.

## Implementation workflow

Use the numbered instructions and [delivery tracker](milestones/README.md)
in order. For example: "Implement milestone 2, following AGENTS.md."
Each delivery includes verification, a status/time update, and user review.
The user manages commits; AI must not commit automatically. Fix earlier defects
when needed to complete the current milestone.

## Planned architecture

- apps/web: Angular app with a Zap list and a simple form-based builder.
- apps/api: Express app organized into auth, github, zaps, and executions.
- MongoDB: users, server-side sessions, repository connections, Zaps, executions.
- npm workspaces with a committed package-lock.json.
- A small GitHub service owns outbound API calls; handlers stay thin.

One backend and one database. No queue, workflow engine, or additional service
is planned. The development proxy will let the frontend call the API.

## Comment mapping contract

Supported placeholders only:

| Placeholder | Value from the PR-opened event |
| --- | --- |
| {{pr.title}} | pull_request.title |
| {{pr.author}} | pull_request.user.login |
| {{pr.url}} | pull_request.html_url |
| {{repository.fullName}} | repository.full_name |

Example: `Thanks {{pr.author}} for opening "{{pr.title}}"!`

Validate templates on the backend. Reject unknown and malformed placeholders;
never evaluate expressions or execute template code. Preview is optional.

## Installation and environment

Not runnable yet. The scaffold milestone must establish and verify the Node.js
version, MongoDB prerequisite, npm install/start/build/check commands, and
.env.example before those instructions are presented as working setup.

Planned environment settings (names and requiredness must be confirmed in code):

| Setting | Purpose |
| --- | --- |
| PORT | API listen port |
| MONGODB_URI | Database connection |
| GITHUB_CLIENT_ID | GitHub OAuth application client ID |
| GITHUB_CLIENT_SECRET | Backend-only OAuth client secret |
| GITHUB_CALLBACK_URL | Exact registered OAuth callback URL |
| SESSION_SECRET | Session signing secret |
| WEBHOOK_PUBLIC_URL | Public HTTPS URL reaching the webhook route |
| GITHUB_WEBHOOK_SECRET | Secret for this application's webhook signatures |

Document any additional credential-protection configuration when implemented.
Keep real secrets in ignored local environment files; commit example values only.

## GitHub configuration targets

1. Register an OAuth application under your own GitHub account and configure
   the callback URL to match the implemented route exactly.
2. Document the implemented OAuth scopes for repository access, comments, and
   webhook management, including any public/private repository limitations.
3. Use a test repository you administer. Provide a public HTTPS webhook URL
   reaching the local API; document the chosen forwarding tool and exact steps
   once tested. A localhost URL alone cannot receive GitHub webhook deliveries.
4. Persist repository ID, connection owner, and webhook ID. Create or reuse only
   webhooks managed by this application; leave unrelated hooks unchanged.
5. Verify signatures over the raw body, then resolve the authorized connection
   and enabled Zaps. The event sender is not the Zap owner.

## Delivery and failure policy

Claim (zapId, deliveryId) atomically using a unique MongoDB index before calling
GitHub. Track processing, succeeded, and failed execution states. Duplicate
claims must not trigger another comment. Do not add automatic retries initially.

This is duplicate-delivery protection, not an exactly-once guarantee: GitHub
comment publication and MongoDB updates are not one transaction. A crash after
publication can leave an execution in processing with an uncertain result.
Inspect the PR before any recovery attempt. Document the actual acknowledgement,
timeout, and recovery behavior after implementation; do not acknowledge work
as safely queued unless it has a real durable processing path.

## Planned demonstration

Not yet performed:
1. Start MongoDB, API, frontend, and the documented public webhook connection.
2. Sign in with GitHub and connect an administered test repository.
3. Create and enable a Zap with supported template variables.
4. Open a real PR; confirm the configured comment on that PR and execution record.
5. Edit the Zap and confirm the updated template on a new PR.
6. Disable the Zap and confirm a new PR does not cause a comment.
7. Check that another signed-in user cannot access the first user's Zaps.

Record actual evidence and failures during implementation. Security and duplicate
handling should also have focused automated tests; mocks do not prove integration.

## Four-hour budget and timing

| Phase | Target minutes |
| --- | ---: |
| Scaffold and configuration | 20 |
| GitHub authentication | 40 |
| Real webhook and PR comment | 55 |
| Persisted Zaps and Angular builder | 80 |
| Final verification, fixes, README | 45 |
| Total | 240 |

The targets total four hours, including implementation, troubleshooting,
verification, reviews, documentation, and commits. Planning performed during the
exercise also counts: reduce the first five implementation targets accordingly
and protect the final 45 minutes. Do not reset the clock between milestones.

Actual exercise start: not recorded.
Actual exercise stop: not recorded.
Use timestamps with timezone (America/Bogota). Do not infer or backfill times
from file metadata. Make meaningful commits using your normal workflow; AI
must not commit automatically or reconstruct a fictional development history.

## Verification and limitations

- Documentation review: brief compared with scope and milestones.
- Automated application checks: not run; no implementation exists.
- Manual application verification: not performed.
- Real GitHub OAuth/webhook/comment flow: unverified.
- Setup, permission scopes, timeout behavior, and recovery: pending implementation.
- Only GitHub PR-opened -> comment is planned; other providers are unavailable.

## AI usage

Codex reviewed the supplied brief and planning documents, suggested scope,
security, delivery, and time-budget clarifications, and edited the project
instructions, milestones, README, and .gitignore. No application code has been
implemented or runtime behavior verified. Update this account as work proceeds,
including what AI produced, what you changed, and what you personally verified.
