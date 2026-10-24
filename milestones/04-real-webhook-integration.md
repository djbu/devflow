Read AGENTS.md. Implement the first real integration:
a pull request is opened -> a comment appears on that same PR.
Target: 55 minutes.

Allow an authenticated user to connect a repository they administer.
Persist repository ID, connection owner, and webhook ID. Create or reuse only
hooks managed by this application; never repurpose an unrelated hook.

Include:
- Signature verification against the raw request body before processing.
- Filtering for pull_request events with action opened.
- Authorized connection lookup before selecting Zaps or owner credentials.
  Do not infer ownership from the PR author or webhook sender.
- A small Octokit service for publishing comments.
- Minimal persisted executions: status, timestamps, comment ID when available,
  and sanitized errors.
- Atomic execution claims using a unique (zapId, deliveryId) database index.
- processing, succeeded, and failed states; duplicate claims do not comment.

A temporary development configuration is acceptable before persisted Zaps.
Give it a stable identity for duplicate protection, then replace it in milestone 5.

No automatic retries initially. A crash after commenting but before saving success
can leave an uncertain outcome; do not promise exactly-once comments. Document
actual timeout, acknowledgement, and recovery behavior. Do not acknowledge work
as durably queued without a durable processing path.

Test invalid signatures, unsupported events/actions, concurrent duplicate claims,
and GitHub API failure. Explain how the chosen implementation handles failures
without exposing tokens or webhook secrets.

Document and test a public HTTPS webhook URL reaching the API, callback/permission
configuration, and a real PR/comment demonstration. Mark unperformed steps
unverified. Do not polish the UI or commit automatically.
