# 0008: Screen Host

## Status

Accepted

## Context

v0.4.0 で `@tsuzuru/standard-ui-preact` を追加しました。これにより、`GameShell`、`MessageWindow`、`ChoiceLayer`、`StatusLayer`、`RuntimeMessageLayer` を標準 UI component として組み合わせられるようになりました。

v0.5.0 では `GameViewport` を追加し、ゲーム画面の基準矩形を標準化しました。これにより、`GameShell` は viewport 内の UI layout container として扱えるようになりました。

custom screen system は v0.4 / v0.5 時点では deferred scope でした。一方で、ユーザーが TypeScript / Preact 側で手帳画面、証拠画面、設定画面などの custom screen を作れる土台が必要になりました。

ただし、v0.6.0 で DSL / core / runtime integration まで入れると、parser、compiler、runtime state、save/load、blocking policy まで scope が広がりすぎます。

## Decision

v0.6.0 では `@tsuzuru/standard-ui-preact` に `ScreenHost` component を追加します。

`ScreenHost` は次を担当します。

- active screen の有無に応じた screen rendering
- app-local screen registry から screen component を解決する
- screen component へ `params` / `onClose` を渡す
- unknown screen id の fallback UI を表示する
- overlay surface / backdrop の基本 layout を提供する

v0.6.0 では、screen state は app-local state として扱います。DSL / core / runtime integration は v0.7.0 で再検討します。

## Public API

`ScreenHost` の public API は次の通りです。

```ts
export type ScreenComponentProps<TParams = unknown> = {
  readonly params: TParams | undefined;
  readonly onClose: () => void;
};

export type ScreenComponent<TParams = unknown> = (
  props: ScreenComponentProps<TParams>,
) => ComponentChildren;

export type ActiveScreen<TParams = unknown> = {
  readonly id: string;
  readonly params?: TParams;
};

export type ScreenRegistry = Record<string, ScreenComponent>;

export type ScreenHostProps = {
  readonly activeScreen: ActiveScreen | null;
  readonly screens: ScreenRegistry;
  readonly onClose: () => void;
  readonly className?: string;
};
```

`activeScreen === null` の場合、`ScreenHost` は render しません。

`activeScreen.id` が registry に存在する場合、その screen component を render します。screen component には `params` と `onClose` を渡します。

`activeScreen.id` が registry に存在しない場合、fallback UI を render します。

`className` は outer wrapper に適用します。

## Rationale

### Why `ScreenHost` Belongs to `standard-ui-preact`

`ScreenHost` は UI component であり、runtime execution ではありません。

`ScreenHost` は Preact component を render するため、`@tsuzuru/core` には置けません。

`@tsuzuru/standard-ui-preact` は `GameShell`、`GameViewport`、`MessageWindow` などを提供する標準 UI component package です。custom screen を表示する host は、標準 UI の layout component として自然です。

`ScreenHost` は `useRuntime` を内包しません。また、`@tsuzuru/preact` に依存しません。runtime adapter と UI component package の境界は維持します。

### Why Not DSL / Core in v0.6.0

v0.6.0 では DSL / core に触れません。

`@openScreen` / `@closeScreen` を入れると、parser、compiler、runtime event、save/load、blocking policy まで論点が広がります。

また、screen params の DSL 表現を決める必要があります。screen 表示中に runtime step を止めるかどうか、active screen を save/load 対象にするかどうかも決める必要があります。

v0.6.0 ではまず UI foundation を固めます。DSL / runtime integration は v0.7.0 で扱います。

### Why Actual Custom Screens Are App-Local

`NotebookScreen` などの実画面は package に含めません。

手帳、証拠、地図、スマホ、人物図鑑などは作品固有性が強い画面です。`@tsuzuru/standard-ui-preact` が具体 screen を持つと、標準 UI package の責務が肥大化します。

`ScreenHost` は host / registry / fallback だけを提供します。実際の screen component は app / user project 側で定義します。

`examples/standard-ui-preact` の `NotebookScreen` は公式 screen ではなく、custom screen の作り方を示す sample です。

### Why Screen State Is App-Local in v0.6.0

v0.6.0 では runtime screen state を導入しません。

app-local state なら DSL / core を変えずに screen open / close を試せます。`useState<ActiveScreen | null>` で custom screen の表示体験を検証できます。

将来 runtime integration する場合にも、`ActiveScreen` の shape を基礎にできます。

### Overlay-First Policy

v0.6.0 では overlay screen を主対象にします。

手帳、設定、バックログ、メニューなどは本編上に重ねる用途が多いためです。

replace screen、title screen、gallery は別設計論点です。v0.6.0 では `mode: "overlay" | "replace"` のような API は持たせません。mode、stack、transition は後で検討します。

## DOM and CSS Structure

`ScreenHost` は次の DOM 構造を持ちます。

```tsx
<div className="tzr-screen-host">
  <div className="tzr-screen-host__backdrop" />
  <div className="tzr-screen-host__surface">
    ...
  </div>
</div>
```

`.tzr-screen-host` は `position: absolute; inset: 0;` により `GameShell` 内に overlay します。

backdrop と surface は分けます。surface は custom screen を表示する領域です。unknown screen fallback も同じ surface 内に表示します。

v0.6.0 では transition / animation / zIndex prop は提供しません。

## Excluded Scope

次は v0.6.0 では採用しません。

- DSL command: screen integration の DSL は v0.7.0 で扱う
- `@openScreen`: parser / compiler / runtime policy まで広がるため v0.7.0 に回す
- `@closeScreen`: open と同じく DSL / runtime integration として v0.7.0 に回す
- parser / compiler changes: v0.6.0 は UI foundation に限定する
- `@tsuzuru/core` runtime state changes: runtime screen state は導入しない
- `@tsuzuru/preact` changes: `ScreenHost` は `useRuntime` を内包しない standard UI component とする
- runtime screen state: v0.6.0 では app-local state で検証する
- screen stack: stack semantics は close / replace / save の設計と関係するため除外する
- screen transition: animation policy は foundation とは別に設計する
- screen mode: overlay-only とし、`mode` API は持たせない
- replace screen: title / gallery などの別設計論点になるため除外する
- modal manager: screen host と modal manager は別責務として扱う
- save/load screen implementation: concrete screen implementation であり、ScreenHost foundation とは別
- config screen implementation: concrete screen implementation であり、settings model の設計も必要
- create-tsuzuru changes: DSL / runtime integration 後の v0.8.0 へ回す

## Consequences

### Positive

- custom screen component を app 側で作れる
- `ScreenHost` により標準 UI 内に custom screen を表示できる
- DSL / core に触れずに custom screen UX を検証できる
- v0.7.0 の DSL / runtime integration へ進むための UI foundation ができる
- `standard-ui-preact` が screen host を提供しつつ、実 screen は app-local に保てる

### Negative

- `.tzr` から screen を開くことはまだできない
- screen state は save/load されない
- screen open / close は app-local state に依存する
- screen stack / transition / replace screen は未対応
- `create-tsuzuru` template にはまだ組み込まれていない

## Reconsideration Criteria

次の条件が出てきた場合、この decision を見直します。

- v0.7.0 で DSL / runtime screen integration を導入する
- `@openScreen` / `@closeScreen` の DSL command が確定する
- runtime state に `activeScreen` を持たせる必要が出る
- save/load が screen state を扱う必要が出る
- screen stack / transition / replace screen が必要になる
- `create-tsuzuru` template で screen registry を標準構成に含める

## Related Documents

- `docs/plans/v0.6-screen-host.md`
- `docs/decisions/0006-standard-ui-preact.md`
- `docs/decisions/0007-standard-ui-viewport.md`
- `packages/standard-ui-preact/src/screen-host.tsx`
- `packages/standard-ui-preact/src/style.css`
- `examples/standard-ui-preact/src/App.tsx`
- `examples/standard-ui-preact/src/NotebookScreen.tsx`
- `examples/standard-ui-preact/src/screens.ts`
