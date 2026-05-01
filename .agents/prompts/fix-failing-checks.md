Use the tsuzuru-codex-workflow skill.
Use the tsuzuru-tests skill.

以下の失敗を修正してください。

## Failed Command

```sh
<failed command>
```

## Error Log

```txt
<error log>
```

## Goal

失敗原因を特定し、最小差分で修正してください。

## Constraints

- 作業前に `AGENTS.md` / `TODOS.md` / relevant skill を読んでください。
- まず失敗原因を特定してください。
- 関係ないリファクタは禁止です。
- 関係ない TODO は触らないでください。
- エラーを隠す修正は禁止です。
- test を弱くする修正は禁止です。
- type error を `any` で握りつぶす修正は禁止です。
- public behavior が変わる場合は docs を更新してください。
- public API が変わる場合は package の `src/index.ts` export を確認してください。
- 修正後、失敗したコマンドを再実行してください。
- 必要に応じて関連する test / typecheck / build も実行してください。

## Investigation Checklist

以下を確認してください。

- 失敗は現在の変更に起因するか
- 既存の unrelated failure か
- test expectation が古いのか
- 実装が仕様とズレているのか
- docs / TODO / Skill の方針と矛盾していないか
- package boundary を壊していないか
- public API 変更が必要か
- examples への影響があるか

## Suggested Checks

Core 関連の場合:

```sh
pnpm --filter @tsuzuru/core test
pnpm --filter @tsuzuru/core typecheck
pnpm --filter @tsuzuru/core build
```

Preact 関連の場合:

```sh
pnpm --filter @tsuzuru/preact test
pnpm --filter @tsuzuru/preact typecheck
pnpm --filter @tsuzuru/preact build
```

Example 関連の場合:

```sh
pnpm --filter @tsuzuru/example-preact-basic build
pnpm --filter @tsuzuru/example-preact-basic typecheck
```

Repository 全体確認が必要な場合:

```sh
pnpm test
pnpm typecheck
```

## Final Report Format

最後は以下の形式で短く報告してください。

```txt
原因:
- ...

実施内容:
- ...

確認:
- <failed command>: pass
- ...

更新したTODO:
- ...

未対応 / 懸念:
- ...
```

## Rules

- 失敗したコマンドが通っていない場合、成功扱いにしないでください。
- コマンドを実行できなかった場合は、未実行と理由を明記してください。
- 推測で完了扱いにしないでください。
- 追加で見つかった unrelated issue は、修正せず未対応 / 懸念に記載してください。
