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
| [02 Foundation](02-runnable-foundation.md) | pending | 20m | Not recorded | Not started. |
| [03 Authentication](03-github-authentication.md) | pending | 40m | Not recorded | Not started. |
| [04 Real integration](04-real-webhook-integration.md) | pending | 55m | Not recorded | Not started. |
| [05 Zaps and builder](05-zaps-and-builder.md) | pending | 80m | Not recorded | Not started. |
| [06 Review and submission](06-review-and-submission.md) | pending | 45m reserved | Not recorded | Not started. |

The implementation targets total 240 minutes; they do not grant extra planning
time. If planning occurred within the timed exercise, subtract it from the first
five implementation targets. Preserve the final 45 minutes. Record actual
exercise start/stop timestamps with timezone in the root README; do not invent
missing times or reset the clock between milestones.

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
- Application builds, tests, and real GitHub flow: not run; no scaffold exists.
