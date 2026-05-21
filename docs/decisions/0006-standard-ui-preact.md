# 0006: Standard UI Preact Package

## Status

Accepted

2026-05 update: the original low-level component boundary remains useful, but
`@tsuzuru/standard-ui-preact` now also exposes `TsuzuruGame` as a starter-level
convenience component for the standard visual/audio plugin set. This narrows the
creator entry path while keeping the existing low-level components available for
apps that need to own runtime wiring directly.

## Context

v0.1 から v0.3 までで、Core runtime、Preact adapter、std-visual plugin、std-audio plugin は整ってきました。Tsuzuru は scenario execution、runtime state、plugin state、Preact からの runtime 操作を分離して扱えるようになっています。

一方で、`@tsuzuru/preact` は runtime と Preact を接続する adapter / hooks package です。`useRuntime`、visible event handling、choice resolution wiring、save/load adapter などを提供しますが、full game UI framework ではありません。

visual novel として使うには、message window、choice layer、status display、root shell の標準 component が必要です。

ただし、UI package が runtime 実行、plugin 登録、visual/audio integration、screen system まで内包すると、custom screen system や Preact 以外の renderer 展開と衝突しやすくなります。

## Decision

`@tsuzuru/standard-ui-preact` を追加します。

directory は次の通りです。

```txt
packages/standard-ui-preact
```

package name は次の通りです。

```txt
@tsuzuru/standard-ui-preact
```

これは Preact 製の standard UI component package です。runtime を生成・進行する package ではなく、message / choice / status / shell を提供する UI package として扱います。

`@tsuzuru/preact-standard-ui` ではなく `@tsuzuru/standard-ui-preact` とします。

理由:

- `standard-ui` が主語になる
- Preact は実装 target として扱える
- `@tsuzuru/preact` の拡張 package だと誤解されにくい
- 将来 optional non-Preact UI package を検討する場合も境界を保ちやすい

## Scope

v0.4 初期では、次の component を提供します。

- `GameShell`
- `MessageWindow`
- `ChoiceLayer`
- `StatusLayer`
- `RuntimeMessageLayer`

CSS は package から export します。

```txt
@tsuzuru/standard-ui-preact/style.css
```

統合 example として次を追加します。

```txt
examples/standard-ui-preact
```

## Boundary with `@tsuzuru/preact`

`@tsuzuru/preact` は runtime adapter / hooks package です。

`@tsuzuru/standard-ui-preact` は UI component package です。

v0.4 初期の境界では、`@tsuzuru/standard-ui-preact` は `useRuntime` を内包せず、`@tsuzuru/preact` に依存しませんでした。

現在は creator-facing starter として `TsuzuruGame` を提供するため、package は `@tsuzuru/preact` に依存し、`TsuzuruGame` の内部で `useRuntime` を利用します。

app / example 側で `useRuntime` と standard UI components を組み合わせる低レベル構成も引き続き有効です。

低レベル構成では、runtime の生成、進行、save/load、plugin 登録を adapter / app 側に残せます。`TsuzuruGame` は入口を簡単にする starter convenience として扱い、save/load や screen system までは内包しません。

## Boundary with std-visual / std-audio

v0.4 初期の境界では、`@tsuzuru/standard-ui-preact` は `@tsuzuru/plugin-std-visual` と `@tsuzuru/plugin-std-audio` に依存しませんでした。

現在は `TsuzuruGame` の starter runtime wiring に限って、std-visual / std-audio の plugin 定義・command handler・state reader に依存します。

`TsuzuruGame` の範囲を超える visual / audio integration は app / example 側に置きます。

`examples/standard-ui-preact` の `VisualLayer` / `AudioLayer` は example-local implementation です。これらは std-visual / std-audio state を読み、asset map と browser API に接続するための例です。

package には public `VisualLayer` / `AudioLayer` を含めません。

## Component Design

leaf component は pure props を受け取ります。

`RuntimeEvent` を知るのは `RuntimeMessageLayer` だけです。

`GameShell` は root layout container に限定します。`useRuntime`、slot system、screen registry は持ちません。

`MessageWindow` は narration / dialogue を同一 component で扱います。speaker がある場合は dialogue、ない場合は narration として表示します。

`ChoiceLayer` は choices を `{ text: string }[]` として受け取り、選択時に index based の `onChoice(itemIndex)` を呼びます。

`StatusLayer` は `label` と optional button を持ちます。button は `buttonLabel` と `onButtonClick` が両方ある場合だけ表示します。

`RuntimeMessageLayer` は `RuntimeEvent` を `MessageWindow` / `ChoiceLayer` / `StatusLayer` に変換します。

## Transient Event Policy

次の runtime events は、デフォルトでは UI に表示しません。

```txt
scene
label
jump
if
state
pluginCommand
```

`showTransientStatus=true` の場合だけ、`StatusLayer` で表示します。

理由:

- `pluginCommand` などが game UI 上に直接表示されると不自然
- visual / audio plugin command は別 layer が runtime state を読んで表示・再生する
- debugging 用には表示できる余地を残したい

## CSS Policy

package は `style.css` を export します。

standard UI package として最低限の見た目を提供します。対象は shell、message window、choice layer、status layer の基本 layout と見た目です。

利用者は className と CSS variables で上書きできます。

theme system は v0.4 では作りません。theme、animation、advanced responsive layout、screen transition は必要になった時点で別途設計します。

## Non-goals / Deferred Scope

次の機能はこの decision の scope 外です。

- `TsuzuruStandardGame` のような一枚岩 component
- screen registry / custom screen system
- save/load screen
- config screen
- backlog / auto / skip
- rich text / ruby / inline links
- visual layer component
- audio layer component
- std-visual dependency
- std-audio dependency
- create-tsuzuru
- `@tsuzuru/vite`

これらは必要になった時点で別途設計します。

## Consequences

### Positive

- `@tsuzuru/preact` を adapter / hooks package に保てる
- standard UI の入口ができる
- app 側で runtime adapter、standard UI、visual/audio layers を組み合わせやすい
- visual / audio plugin との疎結合を維持できる
- 将来の custom screen system と衝突しにくい
- Preact 以外の renderer 向け standard UI package を検討しやすい

### Negative

- 利用者は `useRuntime` と UI components を自分で組み合わせる必要がある
- `VisualLayer` / `AudioLayer` は package からは提供されない
- 一枚岩 component より quick start は少し長くなる
- theme / screen / save UI はまだ別途必要

## Reconsideration Criteria

次の条件が出てきた場合、この decision を見直します。

- 利用者が毎回同じ composition を書く負担が大きい
- `create-tsuzuru` template で標準 composition を固定したくなった
- screen system の設計が固まり、`GameShell` / layer structure を再考する必要が出た
- standard UI に visual/audio layer を含める必要が明確になった
- optional non-Preact UI package を作る際に package naming or boundary を見直す必要が出た

## Related Documents

- `docs/plans/v0.4-standard-ui-preact.md`
- `docs/plugins/std-visual.md`
- `docs/plugins/std-audio.md`
- `docs/decisions/0004-std-visual-plugin.md`
- `docs/decisions/0005-std-audio-plugin.md`
