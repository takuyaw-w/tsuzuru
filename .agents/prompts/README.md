# Prompt Templates

This directory contains copy-paste prompt templates for working with Codex.

These files are not tasks by themselves.

Before sending a prompt to Codex, replace placeholders such as:

```txt
<target-skill>
<TODO item>
<target files or package>
<commit-sha>
<failed command>
<error log>
```

## Files

### `next-task.md`

Use this when asking Codex to implement one TODO item or one small scoped task.

Typical use:

```txt
Use the tsuzuru-codex-workflow skill.
Use the <target-skill> skill.

TODOS.md から以下だけを実装してください。

- <TODO item>
```

### `review-commit.md`

Use this when asking Codex to review a commit before making any fixes.

Typical use:

```txt
Use the tsuzuru-codex-workflow skill.

以下のコミットをレビューしてください。

Commit:

<commit-sha>
```

### `fix-failing-checks.md`

Use this when asking Codex to fix a failing test, typecheck, build, or install command.

Typical use:

```txt
Use the tsuzuru-codex-workflow skill.
Use the tsuzuru-tests skill.

以下の失敗を修正してください。

Failed command:

<failed command>

Error:

<error log>
```

## Rules

- Replace all placeholders before sending a prompt.
- Use one prompt for one small task.
- Prefer one TODO item per Codex run.
- Always include the relevant skill name.
- Do not ask Codex to perform broad refactors unless explicitly intended.
- Do not treat these template files as repository requirements.
- Do not check TODO items unless the work is actually complete.

## Recommended Skill Usage

Use `tsuzuru-codex-workflow` for every task.

Add one or two area-specific skills as needed:

```txt
tsuzuru-core
tsuzuru-preact
tsuzuru-dsl
tsuzuru-tests
tsuzuru-docs
tsuzuru-examples
tsuzuru-plugin-macro
tsuzuru-release-readiness
```

Avoid loading too many skills at once.

Good:

```txt
Use the tsuzuru-codex-workflow skill.
Use the tsuzuru-tests skill.
Use the tsuzuru-core skill.
```

Usually unnecessary:

```txt
Use all skills.
```
