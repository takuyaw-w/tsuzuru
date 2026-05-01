Use the tsuzuru-codex-workflow skill.
Use the <target-skill> skill.

TODOS.md から以下だけを実装してください。

- <TODO item>

## Target

対象範囲:

- <target files or package>

## Constraints

- 作業前に `AGENTS.md` / `TODOS.md` / relevant skill を読んでください。
- スコープ外の変更は禁止です。
- 大規模リファクタは禁止です。
- behavior が変わる場合は test を追加してください。
- public behavior が変わる場合は docs を更新してください。
- public API が変わる場合は package の `src/index.ts` export を確認してください。
- 完了した TODO にチェックを入れてください。
- 未完了の TODO はチェックしないでください。
- 実行したコマンドと結果を報告してください。

## Suggested Checks

必要に応じて以下を実行してください。

```sh
pnpm --filter @tsuzuru/core test
pnpm --filter @tsuzuru/core typecheck
pnpm --filter @tsuzuru/preact test
pnpm --filter @tsuzuru/preact typecheck
pnpm --filter @tsuzuru/example-preact-basic build
pnpm test
pnpm typecheck
```

## Final Report Format

最後は以下の形式で短く報告してください。

```txt
実施内容:
- ...

確認:
- ...

更新したTODO:
- ...

未対応 / 懸念:
- ...
```
