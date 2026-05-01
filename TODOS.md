# Tsuzuru v0.1 TODO

Codex は作業前に必ず `AGENTS.md` を読むこと。
`AGENTS.md` の設計方針、アーキテクチャ境界、Testing Policy、Documentation Requirements を優先すること。

## 1. v0.1 完了ライン

Tsuzuru v0.1 は、以下ができれば完了とみなす。

- `.tzr` で小規模なノベルゲームシナリオを書ける
- `@tsuzuru/core` で parse / compile / runtime 実行できる
- compile 時に主要な DSL エラーを検出できる
- plugin command を登録・検証できる
- Preact で runtime を表示・操作できる
- save/load を localStorage ベースで確認できる
- examples が clean checkout から動く
- 最低限の README / docs が現実装と一致している

---

## 2. Core DSL / Compiler

- [x] parser 実装
- [x] compiler 実装
- [x] same-file label validation
- [x] duplicate scene / label validation
- [x] `@jump(...)` validation
- [x] choice target validation
- [x] `@if` / `@else` / `@endif` 対応
- [x] `#scene` / `#label` の if 内配置禁止
- [x] core command argument validation
- [x] unknown macro validation
- [x] macro expansion
- [x] macro expansion の禁止命令 validation
- [x] plugin command registration
- [x] unknown non-core command validation
- [x] plugin command registry key/name consistency validation
- [x] plugin command argument schema validation
- [x] plugin command schema 定義自体の validation を追加
  - [x] named schema の duplicate argument name を検出
  - [x] positional schema で optional の後に required が来る場合を検出
- [x] macro argument schema validation を v0.1 に入れるか決める
  - [ ] 入れる場合: 実装する
  - [x] 入れない場合: post-v0.1 として docs に明記する
- [x] cross-file jump existence validation を v0.1 に入れるか決める
  - [x] 入れない場合: post-v0.1 として docs に明記する

---

## 3. Runtime

- [x] `stepRuntime` 実装
- [x] narration / dialogue runtime event
- [x] scene / label runtime event
- [x] jump runtime event
- [x] choice / resolveChoice
- [x] flags / variables
- [x] limited if condition evaluation
- [x] wait / waitClick / page / stop
- [x] plugin command dispatch
- [x] snapshot 作成・復元
- [x] complete runtime flow の regression test を追加
  - [x] scene -> narration -> dialogue -> choice -> jump
  - [x] if true branch
  - [x] if false branch
  - [x] flag / variable による分岐
  - [x] wait / waitClick / page / stop
- [x] `resolveChoice` の invalid index 挙動を決める
  - [x] error result にする
  - [x] throw しない
  - [x] 現状維持しない
- [x] runtime plugin handler missing 時の挙動を決める
  - [x] unsupported event にする
  - [x] runtime error にしない
  - [x] 現状維持する

---

## 4. Save / Load

- [x] `RuntimeSnapshot`
- [x] `createRuntimeSnapshot`
- [x] `restoreRuntimeState`
- [x] Preact 側 `RuntimeSaveData`
- [x] `createSaveData`
- [x] `restoreSaveData`
- [x] `restoreRuntimeSnapshotForView`
- [x] `isRuntimeSaveData`
- [x] visibleEvent を保存対象にする
- [x] choice / wait / waitClick の復元方針
- [x] snapshot round-trip test を追加
- [x] choice 中 save/load test を追加
- [x] wait 中 save/load test を追加
- [x] waitClick/page 中 save/load test を追加
- [x] narration/dialogue 表示中 save/load test を追加
- [x] save data に scenario identity / version が必要か決める
  - [x] 入れない場合: v0.1 では互換性保証なしと docs に明記する

---

## 5. Preact Adapter

- [x] `RuntimeView`
- [x] `useRuntime`
- [x] `autoClearWait`
- [x] `autoStepTransientEvents`
- [x] `autoStepMaxSteps`
- [x] `autoStepError`
- [x] `visibleEvent`
- [x] transient event flicker 抑制
- [x] click-to-advance for narration/dialogue
- [x] save/load API
- [ ] `useRuntime` の focused test を追加
  - [ ] auto-step が narration/dialogue で止まる
  - [ ] auto-step が choice で止まる
  - [ ] autoStepMaxSteps が loop を止める
  - [ ] visibleEvent が transient event を表示しない
- [ ] `RuntimeView` の責務を再確認
  - [ ] convenience component に留める
  - [ ] full game UI framework にしない
- [ ] waitClick / page をボタン継続にするか、画面クリック継続にするか決める

---

## 6. Examples

- [x] `examples/basic`
- [x] `examples/preact-basic`
- [x] examples で plugin command 登録
- [x] examples で runtime plugin handler 実装
- [x] preact example で save/load
- [x] preact example で visibleEvent 使用
- [ ] clean checkout から `examples/basic` が動くことを確認
- [ ] clean checkout から `examples/preact-basic` が動くことを確認
- [ ] `examples/preact-basic/scenario/main.tzr` を v0.1 機能確認用に整える
  - [ ] narration
  - [ ] dialogue
  - [ ] choice
  - [ ] jump
  - [ ] if
  - [ ] flag
  - [ ] variable
  - [ ] wait
  - [ ] plugin command
  - [ ] save/load 確認しやすい流れ

---

## 7. Docs

- [x] `docs/dsl.md`
- [x] `docs/runtime.md`
- [x] `docs/plugin-api.md`
- [x] `docs/macro-api.md` を作成または更新
- [ ] `docs/architecture.md` を作成または更新
- [ ] root `README.md` に quickstart を追加
- [ ] examples の実行手順を整理
- [ ] v0.1 limitations を明記
- [ ] docs と現実装の差分を確認

---

## 8. Project Creation / Distribution

- [ ] v0.1 で `create-tsuzuru` を作るか決める
  - [ ] 作る場合: package skeleton を作成
  - [ ] 作る場合: Vite + Preact template を生成
  - [ ] 作る場合: sample `.tzr` を含める
  - [ ] 作らない場合: manual setup を README に明記
- [ ] `@tsuzuru/vite` を v0.1 に入れるか決める
  - [ ] 入れる場合: package skeleton を作成
  - [ ] 入れる場合: `.tzr` import 方針を決める
  - [ ] 入れない場合: Vite `?raw` 利用を docs に明記

---

## 9. Quality Gates

- [ ] `pnpm install` が通る
- [x] `pnpm typecheck` が通る
- [x] `pnpm test` が通る
- [ ] `pnpm --filter @tsuzuru/core build` が通る
- [ ] `pnpm --filter @tsuzuru/preact build` が通る
- [ ] `pnpm --filter @tsuzuru/example-preact-basic build` が通る
- [ ] `pnpm --filter @tsuzuru/example-preact-basic dev` でブラウザ確認できる
- [ ] public exports を確認する
- [ ] 不要な export がないか確認する
- [ ] `any` が public API に漏れていないか確認する
- [ ] package names / directory structure が `AGENTS.md` と矛盾しないか確認する

---

## 10. post-v0.1 に回す候補

- [ ] macro argument schema validation
- [ ] cross-file jump existence validation
- [ ] save data scenario identity / version / migration
- [ ] backlog
- [ ] auto mode
- [ ] skip mode
- [ ] read tracking
- [ ] gallery
- [ ] achievements
- [ ] voice system
- [ ] BGM / SE volume settings
- [ ] Live2D
- [ ] Pixi integration
- [ ] GUI editor
- [ ] TyranoScript / KAG / Ren'Py compatibility
- [ ] arbitrary JavaScript / TypeScript inside `.tzr`

---

## 11. Codex 作業ルール

Codex は各作業で以下を守ること。

1. 作業前に `AGENTS.md` を読む
2. この TODO から unchecked item を1つ、または密接に関連する小さなまとまりだけ選ぶ
3. スコープ外の大改修をしない
4. behavior が変わる場合は test を追加する
5. public behavior が変わる場合は docs を更新する
6. 実行したコマンドと結果を報告する
7. 完了した TODO にチェックを入れる
8. 未対応の懸念点を明記する
