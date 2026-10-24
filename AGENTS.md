# Project instructions

## Goal and scope
Deliver a working workflow automation MVP within a four-hour take-home.
Mandatory flow: GitHub sign-in -> create and enable a Zap -> open a real
PR -> automatically comment on that same PR.

- Zaps belong to the signed-in user.
- Support listing, creating, and editing name, enabled state, trigger,
  action, repository, and comment field mapping.
- Execute only GitHub pull_request events with action opened.
- Include several developer tools in the picker; mark unsupported ones unavailable.
- Keep minimal execution records as a project addition for debugging and demo evidence.
- Comment preview and richer execution UI are optional polish.
- Copilot is a bonus only after all mandatory requirements are verified.

## Stack and architecture
- TypeScript, Angular, Express, Node.js, and MongoDB.
- npm workspaces: apps/web and apps/api; commit package-lock.json.
- One backend and one database; no additional infrastructure without asking.
- Backend features: auth, github, zaps, executions.
- Thin HTTP handlers and a small service for GitHub API calls.
- Add shared code only when both applications actually need it.

## Security and correctness
- Derive ownership from the authenticated session, never frontend userId.
- Keep GitHub credentials on the backend and out of logs and responses.
- Validate OAuth state; use server-side sessions and HttpOnly cookies.
- Verify webhook signatures against the raw request body before processing.
- Persist repository ID, connection owner, and webhook ID. Reuse only hooks
  managed by this application; never alter an unrelated repository hook.
- Resolve verified deliveries through authorized repository connections before
  selecting enabled Zaps and the owner's credentials. Do not use the PR author
  or event sender as the Zap owner.
- Atomically claim each (zapId, deliveryId) with a unique database index before
  commenting. Track processing, succeeded, and failed states.
- Do not claim exactly-once external effects: a crash after comment publication
  but before recording success can leave an uncertain outcome.
- No automatic retries in the initial MVP; document crash and retry limitations.
- Allow only {{pr.title}}, {{pr.author}}, {{pr.url}}, and
  {{repository.fullName}}. Reject unknown or malformed placeholders.
- Validate configuration on the backend; never evaluate template code.

## Working process and budget
- Implement small, reviewable vertical slices and verify each before expanding.
- Follow numbered milestones; update milestones/README.md with status, actual
  duration, blockers, and verification evidence after each delivery.
- Fix earlier defects when needed for the current milestone; boundaries guide
  scope rather than preventing necessary corrections.
- Target budget: scaffold 20m, authentication 40m, real integration 55m,
  persisted Zaps and builder 80m, final checks and documentation 45m.
- Planning, testing, troubleshooting, review, documentation, and commits all
  count toward four hours. Subtract timed planning from implementation targets
  and protect the final 45 minutes; do not reset the clock between milestones.
- Verify real GitHub integration before UI polish. Trim optional work first.
- Prefer existing dependencies and straightforward code.
- Never fabricate test results, timestamps, or Git history.
- Do not commit automatically; the user reviews each delivery. Remind the user
  to make meaningful commits as they work rather than reconstructing history.
- Report changes, actual verification, and known limitations.

## Completion
- Mandatory flow verified against a real repository using the user's GitHub account.
- Relevant automated checks pass; unverified behavior is explicitly identified.
- README includes setup, environment variables, GitHub configuration, demo steps,
  limitations, and an honest account of AI usage.
- Record actual exercise start and stop times with timezone in README.
