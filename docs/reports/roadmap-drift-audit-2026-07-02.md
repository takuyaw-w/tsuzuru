# ROADMAP / 現行コード・docs 乖離調査 2026-07-02

## 調査範囲

`docs/roadmap.md` を中心に、現在の作業ツリーにある package inventory、root scripts、README、v1.0 release / plan docs、代表的な package exports / example docs と照合した。

この調査は、既存の未コミット変更を含む現在の作業ツリーを前提にしている。

主に確認した対象:

- `docs/roadmap.md`
- `package.json`
- `README.md` / `README.ja.md`
- `docs/releases/v1.0.0.md`
- `docs/plans/v1.0-release-gate.md`
- `docs/design/dsl-support-matrix.md`
- `packages/create-tsuzuru/package.json`
- `packages/vite-plugin/package.json`
- `packages/standard-game-storage/src/index.ts`
- `packages/standard-ui-preact/src/index.ts`
- `examples/preact-basic/README.md`

## 結論

`docs/roadmap.md` は v0.1 史料としての注記を持っているが、冒頭では現在も「product and architecture scope boundary」と説明している。
そのため、読者が現行の product boundary として読むと、v1.0 系の実装・README・release docs と大きくずれる。

一番大きい乖離は、ROADMAP が post-v0.1 候補として残している項目のうち、`create-tsuzuru`、Vite integration、storage/read-tracking/save-slots、standard UI hooks、camera / visual transitions / voice などが、すでに現在の package / example / docs では実装済みまたは現行機能として扱われている点。

推奨としては、`docs/roadmap.md` を小修正で延命するより、次のどちらかを選ぶのが安全。

1. `docs/roadmap.md` を完全に historical に寄せ、現在の scope は `README.md`、`docs/architecture.md`、`docs/design/dsl-support-matrix.md`、`docs/plans/v1.0-release-gate.md` に委譲する。
2. `docs/roadmap.md` を現行 roadmap に作り直し、v1.0 delivered / post-v1.0 planned / non-goals を明確に分ける。

## 調査結果

### 1. ROADMAP が「現在の scope boundary」として読める一方で、中身は v0.1 中心のまま

重要度: high

`docs/roadmap.md` の冒頭は、古い v0.1 scope が partially historical であることを示している。
一方で、同じ冒頭で次のように説明している。

- `This document defines Tsuzuru's product scope by milestone.`
- `This roadmap is the product and architecture scope boundary.`

しかし現在の root package version は `1.0.0` で、`docs/releases/v1.0.0.md` は v1.0.0 release notes として、npm publish 済みの release state を記録している。
また、`docs/plans/v1.0-release-gate.md` は v1.0 release gate の現行チェック、design readiness、manual gates を説明している。

影響:

- ROADMAP を最上位の scope boundary として読むと、v1.0 で成立している package / DSL / release gate の状態を見落とす。
- 「どれが historical で、どれが現在の product direction なのか」が reader に委ねられている。
- 今後の docs / agent guidance が、古い v0.1 boundary に引き戻される可能性がある。

根拠:

- `docs/roadmap.md:3-14`
- `docs/roadmap.md:40-49`
- `docs/roadmap.md:432-449`
- `package.json:1-4`
- `docs/releases/v1.0.0.md:1-22`
- `docs/plans/v1.0-release-gate.md:1-35`

推奨対応:

- `docs/roadmap.md` 冒頭の責務を変更し、「historical roadmap archive」なのか「current roadmap」なのかを明確にする。
- current roadmap として維持する場合は、v1.0 delivered scope と post-v1.0 roadmap を追加する。
- historical として維持する場合は、current scope の参照先を `README.md`、`docs/architecture.md`、`docs/design/dsl-support-matrix.md`、`docs/plans/v1.0-release-gate.md` に寄せる。

### 2. `create-tsuzuru` が post-v0.1 candidate のまま残っている

重要度: high

ROADMAP は `create-tsuzuru` を `Deferred from v0.1` / `post-v0.1 Candidates` の project creation package として扱い、v0.1 では manual setup を使うと説明している。

現在は `packages/create-tsuzuru` が存在し、package version は `1.0.0`、bin も `create-tsuzuru` として定義されている。
README も npm users 向けの想定 path として `pnpm create tsuzuru my-game` を案内している。
v1.0 release notes でも `create-tsuzuru` は release target として扱われている。

影響:

- ROADMAP だけ読むと、project generator が未実装または候補段階に見える。
- README / release notes と ROADMAP の導線が逆方向になっている。

根拠:

- `docs/roadmap.md:301-345`
- `packages/create-tsuzuru/package.json:1-24`
- `README.md:59-79`
- `README.md:194-195`
- `docs/releases/v1.0.0.md:49-51`
- `docs/releases/v1.0.0.md:73-76`

推奨対応:

- `Project Creation` を delivered scope に移す。
- v0.1 historical note として残すなら、現在は `create-tsuzuru` が v1.0 package として存在することを明記する。

### 3. Vite integration の package 名と状態が古い

重要度: high

ROADMAP は Vite integration の候補 package を `@tsuzuru/vite` としており、v0.1 では `.tzr` を `?raw` で読み込む想定を説明している。

現在の package は `@tsuzuru/vite-plugin` で、`.tzr` scenario files を compiled runtime documents として import する Vite plugin として実装されている。
README、example README、v1.0 release notes も `@tsuzuru/vite-plugin` を現行機能として扱っている。

影響:

- `@tsuzuru/vite` という存在しない / 旧候補名が残り、現行 package 名と混同される。
- Vite integration が未実装に見える。
- `?raw` が現在の primary path のように読める。

根拠:

- `docs/roadmap.md:301-308`
- `docs/roadmap.md:347-365`
- `packages/vite-plugin/package.json:1-4`
- `README.md:38-39`
- `README.md:194-195`
- `examples/preact-basic/README.md:3-6`
- `docs/releases/v1.0.0.md:40-40`
- `docs/releases/v1.0.0.md:73-74`

推奨対応:

- `@tsuzuru/vite` を `@tsuzuru/vite-plugin` に更新するか、historical candidate 名として明示する。
- 現在の guidance は `@tsuzuru/vite-plugin` と `tsuzuru.config.ts` / include support に寄せる。
- `?raw` は historical/manual fallback として必要な場合だけ残す。

### 4. Runtime Features の deferred list が、現行 package / example-owned behavior と混ざっている

重要度: medium

ROADMAP は次を post-v0.1 runtime feature candidate として列挙している。

- backlog
- skip mode
- auto mode
- read tracking
- text speed settings
- multiple save slots
- config screen
- audio volume settings

現在は、これらの一部が core runtime feature ではなく、storage helper / standard UI / example-owned app behavior として実装・公開されている。

確認できた現行状態:

- `@tsuzuru/standard-game-storage` は preferences、read tracking、save slots、standard runtime save adapter を export している。
- `@tsuzuru/standard-ui-preact` は `useAutoMode`、`useMessageHistory`、`RuntimeControlBar`、screen primitives、audio asset volume helper を export している。
- `examples/preact-basic` は Save / Load、settings、backlog、auto、skip、read tracking、text speed、audio volume settings を example-owned behavior として説明している。
- README も `examples/preact-basic` を、save/load、preferences、backlog、auto mode、skip mode、read tracking の integration reference として説明している。

ただし、これらは「core runtime が標準機能として所有する」という意味ではない。
README は app screens / storage policy は application code と明記しているため、ROADMAP 側だけが粒度を古いまま残している状態に近い。

影響:

- ROADMAP を読むと、read tracking / save slots / settings / auto / skip / backlog が全部未着手に見える。
- 実際には core-owned feature、package helper、example-owned behavior、future design が分離されているため、ROADMAP の分類が粗すぎる。

根拠:

- `docs/roadmap.md:301-319`
- `docs/roadmap.md:380-393`
- `packages/standard-game-storage/src/index.ts:1-12`
- `packages/standard-ui-preact/src/index.ts:22-62`
- `packages/standard-ui-preact/src/index.ts:134-151`
- `examples/preact-basic/README.md:18-31`
- `examples/preact-basic/README.md:43-52`
- `README.md:56-58`
- `README.md:223-225`
- `README.md:340-342`

推奨対応:

- Runtime Features を「core-owned」「standard package helper」「example-owned app behavior」「post-v1.0 design」に分ける。
- `read tracking`、`text speed settings`、`multiple save slots` は implemented helper として記載する。
- `backlog`、`auto mode`、`skip mode`、`config/settings screen`、`audio volume settings` は example / UI helper として実装済み部分と、engine-owned non-goal を分ける。

### 5. Visual Features の future list が現在の standard plugin 実装を反映していない

重要度: medium

ROADMAP の Visual Features は、次を potential scope として列挙している。

- richer transition system
- camera-like effects
- advanced character positioning
- voice playback
- Live2D
- Pixi integration

現在は一部がすでに実装済みまたは plugin-dependent の現行機能になっている。

確認できた現行状態:

- `docs/design/dsl-support-matrix.md` では visual transition sugar / background transitions が `plugin-dependent` とされている。
- `camera x=...`、`camera focus ...`、`reset camera` は `plugin-dependent` とされている。
- `voice asset` は std-audio sugar として `plugin-dependent` とされている。
- `@tsuzuru/standard-ui-preact` は `StdCameraLayer`、`StdCameraRuntimeLayer`、`StdAudioLayer`、`StdAudioRuntimeLayer` を export している。

一方で、Visual coordinate placement、Live2D、Pixi は現在も future / deferred として整合している。

影響:

- ROADMAP の Visual Features が「全部 future」に見える。
- 実際には `richer transition system` の一部、camera state、voice event は v1.0 surface に入っているため、実装済み範囲と残タスクの境界が曖昧。

根拠:

- `docs/roadmap.md:395-406`
- `docs/design/dsl-support-matrix.md:116-129`
- `docs/design/dsl-support-matrix.md:137-138`
- `packages/standard-ui-preact/src/index.ts:63-76`

推奨対応:

- Visual Features を current plugin-dependent features と future renderer/editor features に分ける。
- `advanced character positioning` は coordinate placement / renderer policy として post-v1.0 のままにする。
- Live2D / Pixi は non-goal または future optional integration として維持する。

### 6. 現行 package scope が ROADMAP の Product Direction に反映されていない

重要度: medium

ROADMAP の Product Direction は、Tsuzuru が提供するものとして `.tzr` scenario、static validation、runtime behavior、TypeScript plugins、Preact UI customization、static web app distribution を列挙している。

現在の README / architecture が説明している現行 surface はより広い。

- CLI / config
- Vite plugin
- project generator
- standard UI
- official themes
- standard game storage
- standard plugins: visual / audio / text-sound / effect / camera / particle / hotspot / system
- multiple Preact examples
- release / publish readiness gates

この差分は、ROADMAP が古い v0.1 product direction から更新されていないことに起因している。

影響:

- 現在の public package set と product surface が ROADMAP から読み取れない。
- 「roadmap にないから非公式なのか」という誤解が起きる。

根拠:

- `docs/roadmap.md:16-30`
- `README.md:29-61`
- `README.md:154-210`
- `docs/architecture.md:69-90`
- `docs/architecture.md:225-254`
- `docs/architecture.md:438-440`

推奨対応:

- `Product Direction` を v1.0 現行 surface に合わせる。
- あるいは `Product Direction` 自体を historical note に移し、current overview は README / architecture を authoritative にする。

### 7. ROADMAP 内の current guidance link が壊れている

重要度: medium

ROADMAP 冒頭の current guidance link が `design/design/dsl-v2.md` になっている。
`docs/roadmap.md` から見た正しいリンクは `design/dsl-v2.md` のはず。

これは既存の `docs/reports/code-doc-drift-audit-2026-07-02.md` でも相対リンク切れとして確認済み。

影響:

- ROADMAP を historical として残す場合でも、current DSL direction への導線が壊れている。

根拠:

- `docs/roadmap.md:3-9`
- `docs/reports/code-doc-drift-audit-2026-07-02.md`

推奨対応:

- `design/design/dsl-v2.md` を `design/dsl-v2.md` に修正する。

## Non-Findings / Notes

- Macro / generic macro / preset / stage を deferred / removed として扱う方針は、AGENTS / README / DSL support matrix と整合している。
- KAG / TyranoScript / Ren'Py compatibility を near-term goal にしない方針は、README と ROADMAP で大きく矛盾していない。
- GUI editor、visual scripting editor、Live2D、Pixi、cloud save は、現在も non-goal / future optional として扱ってよさそう。
- `docs/roadmap.md` の v0.1 historical sections に旧 DSL が出てくること自体は、historical と明記されている限り許容できる。ただし、ROADMAP 全体を current boundary と呼ぶ表現とは相性が悪い。

## 推奨修正順

1. `docs/roadmap.md` の位置づけを決める。current roadmap にするか、historical archive にするかを先に決める。
2. current roadmap にする場合は、v1.0 delivered scope と post-v1.0 candidates を新設する。
3. `create-tsuzuru` と `@tsuzuru/vite-plugin` を delivered scope に移す。
4. Runtime / Visual feature list を、core-owned、package helper、example-owned、future design に分け直す。
5. `design/design/dsl-v2.md` のリンク切れを修正する。

## 実行したコマンド

```sh
rg --files -g 'ROADMAP*' -g '*roadmap*' -g '*.md'
sed -n '1,260p' docs/reports/code-doc-drift-audit-2026-07-02.md
rtk git status --short
find packages examples -maxdepth 2 -name package.json -print | sort
sed -n '1,620p' docs/roadmap.md
sed -n '1,220p' TODOS.md
sed -n '1,220p' package.json
sed -n '1,220p' docs/architecture.md
find docs/plans docs/history/decisions docs/releases -maxdepth 2 -type f -name '*.md' | sort
rg -n "v0\\.|v1\\.|roadmap|Roadmap|TODO|planned|future|deferred|post-v0|scope|Status:" docs README.md README.ja.md AGENTS.md TODOS.md -g '*.md'
sed -n '1,260p' packages/standard-game-storage/src/index.ts
sed -n '1,280p' packages/standard-ui-preact/src/index.ts
sed -n '1,260p' packages/vite-plugin/package.json
sed -n '1,260p' packages/create-tsuzuru/package.json
rg -n "create-tsuzuru|vite-plugin|standard-game-storage|read tracking|read-tracking|save slots|save-slots|auto mode|skip mode|backlog|text speed|volume|settings|config screen|multiple save|@tsuzuru/vite" README.md README.ja.md docs/architecture.md docs/runtime.md docs/dsl.md docs/releases/v1.0.0.md docs/plans/v1.0-release-gate.md docs/plans/v1.0-manual-publish-checklist.md docs/plans/v1.0-standard-plugin-save-load-matrix.md packages/*/README.md examples/*/README.md -g '*.md'
sed -n '1,260p' docs/design/dsl-support-matrix.md
sed -n '1,260p' packages/standard-game-storage/README.md
sed -n '1,260p' packages/standard-ui-preact/README.md
sed -n '1,140p' examples/preact-basic/README.md
find packages/standard-game-storage/src packages/standard-ui-preact/src examples/preact-basic/src -maxdepth 1 -type f | sort
rg -n "useAutoMode|useMessageHistory|readTracking|skip|auto|backlog|saveSlot|preferences|Settings|textSpeed|volume" packages/standard-game-storage/src packages/standard-ui-preact/src examples/preact-basic/src -g '*.{ts,tsx}'
rg -n "@tsuzuru/vite-plugin|create-tsuzuru|standard-game-storage|plugin-std-hotspot|theme-|screen|ScreenHost|useAutoMode|useMessageHistory|read tracking|save slot" docs/roadmap.md README.md README.ja.md docs/releases/v1.0.0.md docs/plans/v1.0-release-gate.md docs/plans/v1.0-manual-publish-checklist.md docs/architecture.md
nl -ba docs/roadmap.md | sed -n '1,470p'
nl -ba README.md | sed -n '1,360p'
nl -ba packages/standard-game-storage/src/index.ts | sed -n '1,80p'
nl -ba packages/standard-ui-preact/src/index.ts | sed -n '1,180p'
nl -ba packages/vite-plugin/package.json | sed -n '1,100p'
nl -ba packages/create-tsuzuru/package.json | sed -n '1,100p'
nl -ba examples/preact-basic/README.md | sed -n '1,100p'
nl -ba docs/design/dsl-support-matrix.md | sed -n '1,240p'
nl -ba docs/releases/v1.0.0.md | sed -n '1,120p'
nl -ba package.json | sed -n '1,80p'
nl -ba docs/plans/v1.0-release-gate.md | sed -n '1,220p'
rg -n "version\\\": \\\"1\\.0\\.0\\\"" packages examples package.json
```
