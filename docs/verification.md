# Verification record

These are actual delivery checkpoints. Earlier counts describe those deliveries;
final results are recorded under milestone 6. Mocks and live checks are identified
separately. See milestones/README.md for actual phase timings.

## Verification and limitations

### Milestone 2 verification

Verified on 2026-10-24 with Node.js 24.22.1, npm 11.19.1, MongoDB 8.0.34,
and the root package-lock.json:

| Automated check | Actual result |
| --- | --- |
| npm ci | Passed: clean workspace install |
| npm run build | Passed: Angular production bundle and compiled API |
| npm run typecheck | Passed: app and test TypeScript, plus Angular template checks |
| npm test | Passed: 2 Angular tests and 6 API/config tests |
| npm audit | Passed: zero reported vulnerabilities at verification time |
| git diff --check | Passed |

The tests cover loading/connected/unavailable frontend states, API health
success/failure, sanitized errors, unknown routes, and environment validation.
They use a stub database check and Angular's HTTP testing backend.

Local integration smoke checks (run separately against real MongoDB):
- npm run dev started both applications; direct and proxied health returned 200.
- Browser page displayed "API and MongoDB are connected."
- Compiled API started against MongoDB; stopping MongoDB returned sanitized 503,
  restarting it restored 200, and SIGTERM exited the compiled API cleanly.
- Compiled startup rejected missing MongoDB URI, invalid port, and unreachable
  MongoDB with nonzero exits and without printing the connection string.
- .env, dependencies, and generated output are ignored; examples and lockfile
  remain trackable.

Dependency note: Angular 21's build tooling pins an affected undici version.
A scoped root override selects the patched undici 7.30.1 release; clean install,
build, tests, and audit were repeated afterward. Remove the override when the
upstream tooling includes a fixed dependency. npm 11.19.1 also reports unapproved
optional/native dependency install scripts. No blanket script approval was added;
the installed platform packages passed the checks above.

At milestone 2 delivery, the local development setup was verified; no production
deployment, real GitHub integration, or workflow execution had been performed.
See milestone 3 below for subsequent real authentication verification.

### Milestone 3 verification

Automated verification on 2026-10-24:
- Build and typecheck passed.
- npm test passed: 21 backend tests and 5 Angular tests (26 total).
- npm audit reported zero vulnerabilities.
- Tests cover invalid/missing/expired/cross-session OAuth state, PKCE request
  construction, session rotation, unauthorized access, CSRF/logout invalidation,
  provider denial/failure, encryption tampering, and account view states.
- GitHub HTTP exchanges in these tests are mocked; they do not prove real sign-in.

A separate local smoke check used real MongoDB with a disposable database and a
mocked GitHub provider. It verified encrypted credential persistence, unique
identity upsert, session reload from a fresh app/store instance, exclusion of
credentials from session/API data, and persisted logout invalidation. The
smoke database was removed afterward; no real GitHub identity was fabricated.

Manual/external verification:
- OAuth App creation under djbu confirmed in GitHub.
- User generated and configured the client secret locally; values were not printed.
- After explicit confirmation, public_repo access was authorized for Devflow local.
  Organization access was not requested; private repositories remain outside this grant.
- Real Chrome sign-in returned to Devflow as djbu. Reload preserved the session.
- Sign out returned to login; another reload remained signed out. Signing in again
  with the existing grant succeeded. The verification tab was left signed in.
- Real MongoDB user credential decrypted successfully only on the backend; its
  plaintext value was absent from the stored user/session JSON. HttpOnly and
  SameSite=Lax session settings and cleared temporary OAuth state were confirmed.
- At milestone 3 completion, PR/webhook execution had not been tested; see
  milestone 4 below for the subsequent real integration evidence.

### Milestone 4 verification

Automated verification on 2026-10-24:
- Build and typecheck passed; npm test passed 38 API tests and 5 Angular tests
  (43 total); npm audit reported zero vulnerabilities.
- Coverage includes official GitHub HMAC vector, raw pretty JSON, invalid
  signatures, unsupported events/actions, disabled execution, repository mismatch,
  concurrent duplicate deliveries, GitHub failure, uncertain success persistence,
  managed-hook reuse, non-admin rejection, authentication, and template validation.
- A separate real MongoDB smoke check allowed exactly one of 16 concurrent claims,
  kept a failed delivery claimed, and scoped execution listing to its owner.
  The disposable database was removed after verification.

Real GitHub and local integration verification:
- Connected djbu/devflow-demo through the signed-in Angular app using the OAuth
  user's credential; GitHub ping returned 200. Managed hook ID: 702570687.
- Reconnected through the app and confirmed GitHub still had one hook with the
  same ID; reconnect did not provision a second hook.
- Opened [real demo PR #1](https://github.com/djbu/devflow-demo/pull/1), producing
  a signed pull_request/opened delivery and the [configured comment](https://github.com/djbu/devflow-demo/pull/1#issuecomment-6384422526).
- Original delivery GUID 7aa6a400-cfa9-11f1-9456-4626794cf0a4 returned HTTP 200
  succeeded; MongoDB recorded the matching successful execution/comment ID.
- Requested one manual GitHub redelivery of that same event. It returned HTTP 200
  duplicate. The PR still had exactly one comment and one execution record.
- Public tunnel checks returned 404 for /api/auth/me and 401 for an unsigned
  webhook. Devflow's signed-in view displayed the successful execution link.
- Real GitHub failure scenarios were covered with mocks, not induced against the
  live repository. No production deployment was tested.

### Milestone 5 verification

Automated checks on 2026-10-24:
- Build and typecheck passed; npm test passed 44 API tests and 11 Angular tests
  (55 total); npm audit reported zero vulnerabilities.
- Added Zap API create/list/read/edit/disable and cross-user isolation tests,
  CSRF checks, foreign connection rejection, unsupported provider/event/action
  rejection, and malformed/unknown template-variable checks.
- Builder tests cover loading/empty/error states, provider availability, create,
  edit/disable, safe save payloads, preserved failed drafts, mapping insertion,
  and the labelled sample preview.
- Webhook tests cover enabled persisted Zap selection, per-Zap execution claims,
  and multiple matching Zaps with independent duplicate protection.
- A separate disposable real MongoDB check verified Zap persistence, owner-scoped
  reads/updates, connection ownership, and exclusion of disabled/foreign-user Zaps
  from event selection. The test database was removed afterward.

Real Chrome/GitHub/MongoDB verification:
- Created and enabled PR welcome through the signed-in Angular builder, using
  all four supported variables. Reload preserved the saved Zap.
- [PR #2](https://github.com/djbu/devflow-demo/pull/2) received the [mapped saved-Zap comment](https://github.com/djbu/devflow-demo/pull/2#issuecomment-6384608525)
  and a succeeded execution keyed by persisted Zap ID 6adcade5a1b5f951fe30a58c.
- Edited its name to PR welcome updated and changed the template through the UI.
  [PR #3](https://github.com/djbu/devflow-demo/pull/3) received the [updated comment](https://github.com/djbu/devflow-demo/pull/3#issuecomment-6384620090).
- Disabled and saved the Zap. [PR #4](https://github.com/djbu/devflow-demo/pull/4)
  generated a real delivery returning HTTP 200 ignored, with zero comments and
  no execution claim.
- Re-enabled the same Zap. Manually redelivered PR #2 after the edit: response
  was duplicate and its original comment count stayed at one. PR #3 also had
  one comment, while PR #4 remained at zero. The persisted Zap ID did not change.
- The demo Zap is left enabled and the webhook tunnel is still running.


### Milestone 6 verification

Reviewed both pages of the brief and AGENTS.md against the final implementation.
All mandatory product behaviors are implemented; publishing the application
source/lockfile was authorized after review; evaluator access to the private
repository remains a user submission step.

Review fixes (no new features):
- Added no-store to local API and public webhook responses, including private
  resource reads and errors.
- Unexpected asynchronous failures now emit safe method/route-pattern diagnostics
  and sanitized responses. Queries, headers, bodies, and error objects are never
  logged. Already-started responses are closed safely rather than written twice.
- Startup environment errors identify setting names without their values.
- Managed hook paths must match exactly; malformed or externally repurposed
  tracked URLs cannot be overwritten. The normal reconnect still reuses hook
  702570687 without creating another hook.
- Failed execution updates now require a matching processing record, so missing
  persistence is not silently reported as a recorded failure.

Final automated verification:
- Workspace and clean-copy build/typecheck passed.
- 46 API tests and 11 Angular tests passed (57 total); npm audit reported zero
  vulnerabilities at verification time.
- Clean npm ci installed from the lockfile in an isolated copy containing only
  Git-trackable source/config, without the real .env or existing node_modules.
- All 55 tested source/config/lock files matched the reviewed workspace. Later
  documentation edits do not change the tested application source.
- The clean-copy compiled API started against a fresh temporary MongoDB database
  on isolated ports 3100/3101 with generated test secrets and no OAuth credentials;
  health returned connected and /api/auth/me returned configured false/user null.
  It shut down cleanly on SIGTERM; the disposable database was removed.
- Invalid startup PORT configuration exited nonzero and printed only its setting
  name. A separate real MongoDB check confirmed that missing failure-update
  records throw and existing failed claims continue blocking duplicates.
- The new logging test initially assumed Express retained the full mounted path
  in the app-level error handler. Its route-context expectation was corrected;
  credential/query redaction assertions remained intact and final runs passed.

Final live regression:
- Repeated Chrome sign-out and GitHub sign-in as djbu with the existing grant;
  the owned connection and enabled saved Zap loaded after login.
- Opened [final review PR #5](https://github.com/djbu/devflow-demo/pull/5). The
  [mapped comment](https://github.com/djbu/devflow-demo/pull/5#issuecomment-6384885418)
  appeared, with exactly one matching succeeded MongoDB execution under persisted
  Zap ID 6adcade5a1b5f951fe30a58c.
- Delivery GUID 1648f5b0-cfb0-11f1-8d12-644e079aaac6 returned HTTP 200 succeeded.
- Real edit/disable behavior remains evidenced by PRs #3/#4 and final automated
  regression checks; a second live GitHub account was not used.
- The public tunnel still returned 404 for /api/auth/me. App, MongoDB, and the
  webhook-only tunnel were left running, with the demo Zap enabled.

Unverified or intentionally limited:
- Production hosting/TLS deployment, private repositories, organization policy,
  and another live GitHub account were not verified.
- No durable queue, automatic retry/refresh, or exactly-once external effect is
  claimed. Crash/timeout recovery limitations are documented in the root README.
- Copilot and non-GitHub execution were not added.


Final handoff: user approved committing/pushing main. The implementation and root
lockfile are published as a single reviewed delivery after the original planning
commit; there are no fabricated or backdated milestone commits. The user reported
06:20 as the actual exercise start; the final publication handoff/stop is recorded
as 08:48 America/Bogota on 2026-10-24, with minute precision. The private repository
still needs evaluator access before it is shared externally.
