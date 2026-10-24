# Implementation milestones

Use these files as bounded delivery instructions, working in numerical order.
For example: "Implement milestone 2, following AGENTS.md."
Read the selected milestone and the project instructions before making changes.

## Document responsibilities

- ../AGENTS.md: rules that apply throughout the project.
- ../README.md: product status, setup, demonstration, and submission documentation.
- Numbered files here: scope and verification for each implementation delivery.
- This file: delivery status, actual time spent, blockers, and verification evidence.

## Delivery tracker

Allowed statuses: pending, in progress, completed, blocked. Mark a delivery
completed only after its required verification is recorded. If blocked, record
the concrete blocker and what resolves it. Do not infer actual durations.

| Milestone | Status | Target | Actual time | Verification evidence / blocker |
| --- | --- | --- | --- | --- |
| [01 Scope](01-project-scope.md) | completed | Planning; counts toward the four-hour limit | Not recorded | Brief compared with scope and plans; AGENTS.md and root README prepared. Documentation review only; no application behavior verified. |
| [02 Foundation](02-runnable-foundation.md) | completed | 20m | 6m 36s; 2026-10-24 07:12:24 to 07:19:00 -05:00 | [Verification results](../docs/verification.md#milestone-2-verification): clean install, build/typecheck, 8 tests, zero audit findings, real MongoDB/proxy/browser smoke checks and failure recovery. Changes awaiting user review/commit. |
| [03 Authentication](03-github-authentication.md) | completed | 40m | 15m 25s; 2026-10-24 07:20:14 to 07:35:39 -05:00, including setup/consent wait | [Verification results](../docs/verification.md#milestone-3-verification): build/typecheck, 26 tests, audit, real MongoDB checks, and real Chrome sign-in as djbu/reload/logout/repeat sign-in passed. public_repo grant confirmed; no organization access requested. Changes awaiting user review/commit. |
| [04 Real integration](04-real-webhook-integration.md) | completed | 55m | 17m 15s; 2026-10-24 07:41:09 to 07:58:24 -05:00, including approvals/tunnel setup | [Verification results](../docs/verification.md#milestone-4-verification): build/typecheck, 43 tests, zero audit findings, real PR/comment and persisted execution, real redelivery suppression, and 16 concurrent MongoDB claims checked. Uses temporary development Zap. Application changes awaiting user review/commit. |
| [05 Zaps and builder](05-zaps-and-builder.md) | completed | 80m | 18m 30s; 2026-10-24 08:00:41 to 08:19:11 -05:00 | [Verification results](../docs/verification.md#milestone-5-verification): build/typecheck, 55 tests, audit, real MongoDB owner isolation, saved Zap PR #2, edited template PR #3, disabled PR #4, and redelivery after edit passed. Demo Zap re-enabled. Application changes awaiting user review/commit. |
| [06 Review and submission](06-review-and-submission.md) | completed | 45m reserved | About 25m; 2026-10-24 08:23:23 to 08:48 -05:00 (handoff minute precision) | [Final verification](../docs/verification.md#milestone-6-verification): review fixes, clean install/build/typecheck, 57 tests, audit, credential scan, and real PR #5 passed. User approved publishing the implementation/lockfile on main. Start/stop recorded in root README; evaluator access remains a user handoff step. |

The implementation targets total 240 minutes; they do not grant extra planning
time. If planning occurred within the timed exercise, subtract it from the first
five implementation targets. Preserve the final 45 minutes. Record actual
exercise start/stop timestamps with timezone in the root README; do not invent
missing times or reset the clock between milestones. The user reported an actual
start of 2026-10-24 06:20 -05:00 during final review; planning counts from that time.

## How to use a milestone

1. Mark the selected milestone in progress and record actual time as available.
2. Implement its bounded scope, including any necessary fixes to earlier work.
3. Run the specified checks and report changes, actual results, and limitations.
4. Update this tracker with actual elapsed time and evidence links. Link to the
   relevant root README verification entry, committed test/report, or real PR
   comment when available. Separate automated checks from manual verification;
   never include secrets or treat mocked tests as real integration evidence.
5. Review the delivery and make meaningful commits using your normal workflow.
   AI must not commit automatically. Then move to the next milestone.

The boundaries guide delivery; they do not prevent fixing an earlier defect
that blocks the current milestone. Record significant changes or blockers here
instead of silently expanding scope. Keep tests, troubleshooting, review,
documentation, and commits within the allocated time. Trim optional work first;
reserve the final 45 minutes for required checks and honest submission notes.

## Planning verification

- Scope review: both pages of the supplied brief compared with the project plans.
- .gitignore: 14 ignore/track cases checked in a temporary Git repository;
  environment examples and package-lock.json remain trackable.
- Milestone 2 application builds, typechecks, tests, and local startup checks:
  passed; see the linked verification results.
- Milestone 3 real GitHub authentication: passed.
- Milestone 4 real PR webhook/comment execution and redelivery suppression: passed
  using the temporary development Zap at that checkpoint.
- Milestone 5 persisted Zap create/edit/disable and duplicate suppression: passed
  with real PRs #2-#4. The temporary configuration is removed.
