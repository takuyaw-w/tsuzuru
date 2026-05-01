Use the tsuzuru-codex-workflow skill.

以下のコミットをレビューしてください。

Commit:

```txt
<commit-sha>
```

## Review Scope

この時点では修正しないでください。  
まずレビューだけしてください。

## Review Criteria

以下の観点で確認してください。

- `AGENTS.md` の設計方針に反していないか
- `TODOS.md` の対象スコープから逸脱していないか
- core / preact / plugin / macro の責務境界が崩れていないか
- `.tzr` を任意 JavaScript / TypeScript 実行環境に近づけていないか
- public API の変更が妥当か
- package の `src/index.ts` export が必要十分か
- behavior 変更に対して tests が足りているか
- public behavior 変更に対して docs が更新されているか
- examples への影響が考慮されているか
- TODO のチェックが妥当か
- 不要なリファクタやフォーマット変更が混ざっていないか
- quality gate に不足がないか

## Area-Specific Checks

変更内容に応じて、必要な skill の観点も使ってください。

- core 変更: `tsuzuru-core`
- preact 変更: `tsuzuru-preact`
- DSL 変更: `tsuzuru-dsl`
- test 変更: `tsuzuru-tests`
- docs 変更: `tsuzuru-docs`
- examples 変更: `tsuzuru-examples`
- plugin / macro 変更: `tsuzuru-plugin-macro`
- release readiness 変更: `tsuzuru-release-readiness`

## Output Format

以下の形式で短く報告してください。

```txt
総評:
- ...

問題あり:
- ...

問題なし:
- ...

追加で確認したいこと:
- ...

推奨アクション:
- ...
```

## Rules

- まだ修正はしないでください。
- 指摘は重要度順に並べてください。
- 重大でない好みの指摘は控えめにしてください。
- 実装意図が読み取れる場合は、その意図を踏まえて評価してください。
- 不確かな点は断定せず「要確認」としてください。
