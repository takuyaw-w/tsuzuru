# verification-review

## Purpose

Review the final diff for scope compliance, test coverage, verification status,
and unintended changes.

## Use When

- Before commit.
- Before push.
- After broad UI, API, or config changes.

## Check

- Diff scope.
- Unrelated changes.
- Tests, typecheck, and format status.
- DSL, runtime, and plugin boundary violations.
- Public API breakage.
- Generated files accidentally included in the diff.

## Prohibited

- Additional implementation without explicit instruction.
- Out-of-scope design discussion.
- Unrelated refactors.

## Completion

- Return actionable findings.
- State whether any finding blocks push.
- Close after the main agent receives the review.
