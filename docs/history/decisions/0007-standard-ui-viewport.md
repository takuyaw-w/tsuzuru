# 0007: Standard UI Viewport

## Status

Accepted

## Context

v0.4.0 で `@tsuzuru/standard-ui-preact` を追加しました。既存 public components は次の通りです。

- `GameShell`
- `MessageWindow`
- `ChoiceLayer`
- `StatusLayer`
- `RuntimeMessageLayer`

これらにより、message / choice / status を Preact component として組み合わせられるようになりました。一方で、`GameShell` は固定 aspect-ratio を持っていませんでした。

`examples/standard-ui-preact` では example 側 CSS で `max-width: 960px` / `min-height: 540px` 相当の調整はできましたが、これは標準 API ではありません。custom screen system に進む前に、ゲーム画面の基準矩形を `@tsuzuru/standard-ui-preact` 側で標準化する必要がありました。

## Decision

v0.5.0 では `@tsuzuru/standard-ui-preact` に `GameViewport` component を追加します。

`GameViewport` は次を担当します。

- ゲーム画面の基準矩形
- aspect-ratio
- optional `maxWidth`
- 中央寄せ
- viewport 内の overflow clipping

`GameShell` は引き続き、与えられた viewport 内で標準 UI を配置する root layout container とします。

## Public API

`GameViewport` の public API は次の通りです。

```ts
export type GameViewportAspectRatio = "16:9" | "4:3";

export type GameViewportProps = {
  aspectRatio?: GameViewportAspectRatio;
  maxWidth?: number | string;
  className?: string;
  style?: ComponentProps<"div">["style"];
  children: ComponentChildren;
};
```

`aspectRatio` の default は `"16:9"` です。

`maxWidth` は optional です。`number` の場合は px として扱います。

```tsx
<GameViewport maxWidth={960} />
```

これは `max-width: 960px` として扱います。

`string` の場合は CSS value としてそのまま扱います。

```tsx
<GameViewport maxWidth="80vw" />
```

`className` / `style` は outer wrapper に適用します。`innerClassName` / `innerStyle` は v0.5.0 では提供しません。

## Aspect Ratio Resolution

`aspectRatio` の public API は `"16:9" | "4:3"` の preset string とします。ただし、CSS inline style に渡す値は CSS valid な形式へ正規化します。

```txt
"16:9" -> "16 / 9"
"4:3" -> "4 / 3"
```

理由:

- public API としては `"16:9"` の方が利用者に分かりやすい
- CSS の `aspect-ratio` としては `"16 / 9"` のような形式が適切
- preset string をそのまま inline style に渡すと表示が崩れる可能性がある

## DOM and CSS Structure

`GameViewport` は 2 層 DOM 構造にします。

```tsx
<div className="tzr-game-viewport">
  <div className="tzr-game-viewport__inner">
    {children}
  </div>
</div>
```

`.tzr-game-viewport` は outer wrapper です。

```css
.tzr-game-viewport {
  position: relative;
  width: 100%;
  margin-inline: auto;
}
```

`.tzr-game-viewport` には `height` / `min-height` を指定しません。高さは inline style の `aspect-ratio` によって幅から計算します。

`.tzr-game-viewport__inner` は outer rectangle を埋める clipping layer です。

```css
.tzr-game-viewport__inner {
  position: absolute;
  inset: 0;
  overflow: hidden;
}
```

inner を absolute にした理由は、aspect-ratio で作った outer rectangle を確実に埋めるためです。`height: 100%` だけにすると、ブラウザ上で期待通り高さ解決できず、viewport 内の UI が潰れる可能性があります。

## Rationale

### Why Separate from `GameShell`

`GameViewport` は画面サイズ、比率、外枠の責務を持ちます。

`GameShell` は viewport 内の UI 配置責務を持ちます。

この 2 つを 1 component にまとめると、layout sizing と UI layout の責務が混ざります。将来の screen system、theme system、safe area、letterbox 対応を検討する際にも、外枠と中身を分けておく方が境界を保ちやすくなります。

### Why Not Plugin

`GameViewport` は次を拡張しません。

- `.tzr` syntax
- runtime state
- command handlers
- diagnostics
- save/load serialization
- plugin state key

したがって、`GameViewport` は `@tsuzuru/plugin-*` ではなく、`@tsuzuru/standard-ui-preact` の Preact UI component として提供します。

### GameShell CSS Breaking Change

`.tzr-game-shell` は `height: 100%` ベースに見直します。

```css
.tzr-game-shell {
  width: 100%;
  height: 100%;
}
```

`GameShell` が `min-height: 100vh` のような full-screen 前提を持つと、`GameViewport` 内で高さを突き破ります。v0.x のうちに viewport と shell の責務分離を明確にするため、v0.5.0 の breaking change として受け入れます。

## Excluded Scope

次は v0.5.0 では採用しません。

- `fit` prop: v0.5.0 は contain-only とし、切り替え可能な layout mode を public API にしない
- `maxHeight` prop: 高さ基準の別設計論点になるため除外する
- safe area support: smartphone optimization / fullscreen 対応まで論点が広がるため除外する
- `"full"` aspect ratio: aspect ratio ではなく sizing mode なので除外する
- `cover` / `stretch`: contain-only から外れ、asset framing や clipping policy の設計が必要になるため除外する
- screen registry: custom screen system の設計領域なので除外する
- custom screen system: v0.5.0 は基準矩形の標準化に留める
- notebook / evidence screen: screen system の具体 screen なので除外する
- config screen: screen system と settings model の設計が必要なので除外する
- save/load screen UI: save/load UI flow と slot design の設計が必要なので除外する
- theme system: viewport の責務ではなく、別途 UI theming として設計する
- create-tsuzuru changes: template 反映は別 task とする
- viewport plugin package: viewport は runtime / DSL / plugin state を拡張しないため plugin にしない

## Consequences

### Positive

- 16:9 / 4:3 のゲーム画面を標準 UI で作れる
- `GameShell` の責務が viewport 内 UI layout として明確になる
- custom screen system 前の基準矩形が定義される
- `examples/standard-ui-preact` が標準 API に沿った構成になる

### Negative

- `GameShell` 単体利用時の見た目が変わる可能性がある
- `GameViewport` は背景や立ち絵を描画しない
- visual rendering は example-local `VisualLayer` や app 側 renderer の責務として残る
- safe area や cover layout は将来対応として残る

## Reconsideration Criteria

次の条件が出てきた場合、この decision を見直します。

- screen system の設計が固まり、viewport と screen root の責務を再定義する必要が出た
- safe area / fullscreen / letterbox の requirements が明確になった
- `cover` / `stretch` のような layout mode が標準 UI に必要になった
- `create-tsuzuru` template で viewport composition を固定する必要が出た
- Preact 以外の standard UI package で同じ viewport API を共有する必要が出た

## Related Documents

- `docs/history/plans/v0.5-standard-ui-viewport.md`
- `docs/history/decisions/0006-standard-ui-preact.md`
- `packages/standard-ui-preact/src/game-viewport.tsx`
- `packages/standard-ui-preact/src/style.css`
- `examples/standard-ui-preact/src/App.tsx`
