# コード / ドキュメント乖離調査 2026-07-02

## 調査範囲

現在の作業ツリーと、リポジトリ内のドキュメントおよび repo-local agent skills を照合した。
作業ツリーには、Biome から Oxfmt/Oxlint への移行を含む未コミットの依存・tooling 変更がすでに含まれている。
以下の調査結果は、その現在状態を前提にしている。

確認した対象は次のとおり。

- `packages/*` と `examples/*` 配下の workspace package / example inventory
- root `package.json` の scripts と `pnpm-workspace.yaml` の catalog entries
- `README.md`、`README.ja.md`、`AGENTS.md`、`docs/**`
- `.agents/skills/**` 配下の repo-local skills
- リポジトリ内 Markdown ファイルの相対リンク
- `scripts/lib/check-quality-gate.mjs` と `scripts/lib/check-publish-readiness.mjs` の既存 inventory gate

## 現在の Inventory Snapshot

現在の workspace inventory は次の状態。

- public packages: 20
- private examples: 4
- current examples:
  - `examples/preact-basic`
  - `examples/preact-hotspot-basic`
  - `examples/preact-sound-novel`
  - `examples/preact-starter`

root quality gate は、すでに次の inventory-sensitive な領域を検証している。

- root package scripts が public packages と examples をカバーしていること
- `AGENTS.md`、`README.md`、`docs/architecture.md` の inventory block が workspace package / example directories と一致していること
- `release-readiness:check` が `packages:build`、`examples:check:self`、`pack:dry-run`、`publish-readiness:check`、local `create-tsuzuru` smoke を実行すること

## 調査結果

### 1. Repo-local skills が削除済みの `examples/dsl-v2-basic` を参照している

重要度: high

複数の `.agents/skills/**/SKILL.md` が、`examples/dsl-v2-basic` を current runnable example として説明している。
また、`@tsuzuru/example-dsl-v2-basic` に対する verification command も残っている。
しかし、現在の workspace にはこの package / directory は存在しない。
現在の runnable examples は、上記の 4 つの Preact examples である。

古い参照が確認されたファイル:

- `.agents/skills/tsuzuru-codex-workflow/SKILL.md`
- `.agents/skills/tsuzuru-docs/SKILL.md`
- `.agents/skills/tsuzuru-dsl/SKILL.md`
- `.agents/skills/tsuzuru-examples/SKILL.md`
- `.agents/skills/tsuzuru-preact/SKILL.md`
- `.agents/skills/tsuzuru-release-readiness/SKILL.md`
- `.agents/skills/tsuzuru-tests/SKILL.md`
- `.agents/skills/tsuzuru-core/SKILL.md`
- `.agents/skills/tsuzuru-plugin-macro/SKILL.md`

影響:

- 今後の agent 作業で、存在しない verification target が選ばれる可能性がある。
- `AGENTS.md`、README、`docs/architecture.md` は Preact examples を使っているにもかかわらず、docs / DSL / tests / examples / release-readiness 作業が削除済み example 名へ戻る可能性がある。

推奨対応:

- `examples/dsl-v2-basic` の guidance を現在の primary examples に置き換える。
- 広い runnable verification では、`pnpm examples:check` または該当する `@tsuzuru/example-preact-*` filter を使う。
- 1 つの example だけで十分な skill では、hotspot / sound-novel / starter を明示的に対象にする場合を除き、`examples/preact-basic` を使う。

### 2. Repo-local release-readiness skill が Biome を現行 tooling として説明している

重要度: high

`.agents/skills/tsuzuru-release-readiness/SKILL.md` には、まだ次の記述が残っている。

- TypeScript、Vitest、Biome versions are managed through the pnpm catalog.
- Biome is a root dev dependency and root-level tool.
- Biome format, lint, and check pass.

現在の root scripts は次の状態である。

- `format`: `oxfmt`
- `format:check`: `oxfmt --check`
- `lint`: `oxlint`
- `check`: `node scripts/check-quality-gate.mjs && oxfmt --check && oxlint`

影響:

- release-readiness guidance が実際の root tooling と矛盾している。
- 今後の release check で、誤った tool を前提に報告・debug する可能性がある。

推奨対応:

- skill の記述を Oxfmt/Oxlint 前提に更新する。
- `pnpm format:check`、`pnpm lint`、`pnpm check` は安定した command surface として残っているため、docs 上の script 名は維持してよい。

### 3. `README.ja.md` の package table に `@tsuzuru/plugin-std-hotspot` がない

重要度: medium

`README.md` には `@tsuzuru/plugin-std-hotspot` が記載されており、package も `packages/plugin-std-hotspot` に存在する。
一方で、`README.ja.md` は `@tsuzuru/plugin-std-particle` から `@tsuzuru/plugin-std-system` に進んでおり、`@tsuzuru/plugin-std-hotspot` の行がない。

影響:

- 日本語の package overview が、現在の public package set を過少に説明している。
- `scripts/lib/check-quality-gate.mjs` は現在 `README.md`、`AGENTS.md`、`docs/architecture.md` の inventory を検査しているが、`README.ja.md` は対象外のため見落としやすい。

推奨対応:

- `README.ja.md` に `@tsuzuru/plugin-std-hotspot` の行を追加する。
- 日本語 README を first-class に保つ方針なら、`check-quality-gate.mjs` で Japanese README の package inventory も検証することを検討する。

### 4. 現行 Markdown に相対リンク切れが 2 件ある

重要度: medium

Markdown relative-link scan で次のリンク切れを確認した。

- `docs/design/dsl-v2.md` が `../../../examples/preact-basic/` にリンクしている。`docs/design/` から見た正しい相対パスは `../../examples/preact-basic/` のはず。
- `docs/roadmap.md` が `design/design/dsl-v2.md` にリンクしている。`docs/` から見た意図されたパスは `design/dsl-v2.md` と思われる。

影響:

- 現行 DSL docs と roadmap を読む人が、存在しない path に誘導される。
- `docs/roadmap.md` は partially historical と明記されているが、冒頭の status note は current guidance なのでリンクは有効であるべき。

推奨対応:

- 上記 2 件の相対リンクを修正する。
- doc link 切れが再発するなら、軽量な Markdown link check を追加する。

### 5. Historical release/checklist docs に `examples/preact-hotspot-basic` がない

重要度: low / 判断が必要

`docs/releases/v1.0.0.md` と `docs/plans/v1.0-manual-publish-checklist.md` は、publish target ではない private examples として次だけを列挙している。

- `examples/preact-basic`
- `examples/preact-sound-novel`
- `examples/preact-starter`

現在の workspace には次も存在する。

- `examples/preact-hotspot-basic`

影響:

- これらのファイルを変更しない historical release record とみなすなら、許容できる可能性がある。
- manual publish checklist を現在の運用 guidance として使うなら stale であり、hotspot example を含めるべき。

推奨対応:

- これらの docs を historical snapshot として扱うのか、maintained operational checklist として扱うのかを決める。
- maintained docs として扱う場合は、non-publish target examples に `examples/preact-hotspot-basic` を追加する。

## Non-Findings / Notes

- `README.md`、`AGENTS.md`、`docs/architecture.md` の package / example inventories は現在の workspace inventory と一致している。
- `docs/design/dsl-support-matrix.md` は、削除済み legacy DSL syntax を removed / historical として正しく扱っており、parser-only、design-only、plugin-dependent syntax も分離している。
- `docs/plans/**` と `docs/history/decisions/**` には古い path や legacy syntax の参照が多く残っている。ただし多くは明示的に historical design / plan records であり、ファイルが current behavior として提示していない限り、現在 docs の乖離として扱うべきではない。

## 実行したコマンド

```sh
find packages -mindepth 2 -maxdepth 2 -name package.json | sort
find examples -mindepth 2 -maxdepth 2 -name package.json | sort
node -e "<workspace package/example inventory script>"
rg -n "dsl-v2-basic|example-dsl|preact-basic|preact-hotspot|preact-sound|preact-starter|14 packages|20 package|20 public|package\\(s\\)|Biome|Oxfmt|Oxlint|oxfmt|oxlint|@tsuzuru/plugin-std-hotspot|plugin-std-hotspot|plugin-std-system|plugin-std-text-sound" README.md README.ja.md AGENTS.md docs .agents/skills -g '*.md'
node --input-type=module -e "<Markdown relative link check>"
rg -n "examples/(basic|preact-std-visual|preact-std-audio|dsl-v2-basic)|src/game\\.ts|src/style\\.css|VisualLayer\\.tsx|@tsuzuru/example-dsl-v2-basic|parseTzrV2|compileTzrV2|#scene\\(|:: Speaker|@command\\(|\\$macro\\(" README.md README.ja.md docs .agents/skills -g '*.md'
```

## 推奨修正順

1. `.agents/skills/**` を更新し、`examples/dsl-v2-basic` と Biome guidance を、現在の examples と Oxfmt/Oxlint guidance に置き換える。
2. 相対リンク切れ 2 件を修正する。
3. `README.ja.md` に不足している `@tsuzuru/plugin-std-hotspot` の行を追加する。
4. historical release/checklist docs を `examples/preact-hotspot-basic` に合わせて更新するかどうかを判断する。
