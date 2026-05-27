# Subagent Operating Rules

Subagents are short-lived specialists, not resident workers. Start them only
when a narrow, independent task will reduce risk or improve review quality.
Close them as soon as they return findings.

The main agent owns scope control, final decisions, and integration of findings.
Subagents provide bounded input; they do not replace the main agent's judgment.

## When to Use Subagents

- Repository-wide investigation.
- Changes spanning multiple packages.
- Final review that is independent from the implementation pass.
- Pre-push verification.

## When Not to Use Subagents

- Clear single-file fixes.
- Minor CSS-only adjustments.
- Follow-up work where the relevant investigation is already complete.
- Work the main agent already understands well enough to complete directly.

## Default Lifecycle

1. Start with a narrow scope.
2. Receive findings.
3. Close the subagent.
4. Main agent integrates decisions.

## Operating Limits

- Keep concurrent subagents to three or fewer by default.
- Do not start multiple subagents for the same role unless the user explicitly
  asks for separate concern-specific reviews.
- Do not leave completed, blocked, or stale subagents open.
- Prefer one focused verification-review subagent over several broad review
  subagents when the change is small.
- The main agent must summarize which findings were accepted, deferred, or
  rejected when subagent output affects the final result.

## Final Report Requirement

Every task should include a subagent management section in the final report.
When no subagents were used, report `none` for started and closed subagents.

```txt
## subagent 管理
- 起動した subagents:
- 閉じた subagents:
- 最終的に残っている subagents:
- 残っている場合の理由:
```
