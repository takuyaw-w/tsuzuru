# DSL Adversarial Hardening Backlog

> Status: deferred follow-up
>
> Created: 2026-07-19
>
> Source review: [`dsl-adversarial-review.md`](../design/dsl-adversarial-review.md)

現行 `.tzr` DSLの敵対的検証で確認した9件を、後日対応するための追跡用
バックログ。詳細な再現入力、原因、改善案、回帰テスト案はsource reviewを参照する。

現時点では調査と文書化のみ完了しており、実装には着手していない。

## Recommended order

### Batch A: 必須の安全性修正

- [ ] `ADV-001` prototype-safeなscene / character辞書を構築する
  - 必要性: 必須
  - 概算: 1〜2日
- [ ] `ADV-002` 数値リテラルのfinite / safe-integer検証を共通化する
  - 必要性: 必須
  - 概算: 1.5〜3日
- [ ] `ADV-003` 条件式にネスト上限と通常診断を追加する
  - 必要性: 必須に近い
  - 概算: 0.5〜1日
- [ ] `ADV-004` text block空行のstable subset上の意味を決定して実装する
  - 必要性: 高い
  - 推奨: 空行から暗黙の `TextClickWait` を生成しない
  - 概算: 1〜2日。クリック待ちを正式実装する場合は3〜5日以上

Batch A概算: 4〜7日。

### Batch B: 作者向け静的診断

- [ ] compiler warning / strict-mode昇格の共通方針を設計する
- [ ] `ADV-005` `end` / `jump` 後の到達不能文を診断する
  - 必要性: 中
- [ ] `ADV-006` fallbackのない全条件付きchoiceを診断する
  - 必要性: 中
- [ ] `ADV-007` 静的に確定するcondition型不一致を拒否する
  - 必要性: 高い

Batch B概算: warning基盤を含めて3〜5日。

### Batch C: strict authoring validation

- [ ] `ADV-008` 未定義scenario変数の任意診断を設計する
  - 必要性: 中
  - 注意: host初期値を誤検出しないschemaまたは既知変数入力が必要
- [ ] `ADV-009` 指定された表示用文字列のtrim後non-empty検証を追加する
  - 必要性: 低〜中

Batch C概算: `ADV-008` の対応範囲により3〜7日。

## Start conditions

実装を開始するときは次を先に確認する。

1. `main` のparser、compiler、runtime、Vite pluginがsource review時点から
   変わっていないか再検証する。
2. `ADV-004` は空行を無視・段落化・クリック待ち実装のどれにするか決定する。
3. `ADV-005`、`ADV-006`、`ADV-008` はwarning APIとstrict modeの方針を
   決定してから着手する。
4. Batch Aはcore単体テストだけでなく、ViteのJSON往復と
   `examples/preact-basic` のscenario check / buildまで検証する。

## Completion rule

- 対応した項目をこのファイルでcheckする。
- source review側のfindingに `status: resolved`、解決commit、実行した検証を追記する。
- public syntaxまたは診断契約が変わる場合は、DSL designとsupport matrixも同時に更新する。
- 9件すべてを一括実装せず、Batch A、B、Cを独立したreviewable changeとして扱う。
