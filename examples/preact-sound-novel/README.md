# Tsuzuru Preact Sound Novel Example

この example は、長い文章を読む sound novel presentation の確認用 reference です。
`TsuzuruGame` を `messagePresentation="novel"` 相当の object form で使い、fullscreen novel text layer の見え方を確認します。

```tsx
<TsuzuruGame
  scenario={scenario}
  assets={assets}
  messagePresentation={{ mode: "novel", speakerMode }}
  text={{ reveal: true, charactersPerSecond }}
/>
```

## 役割

- prose-heavy な narration と multi-line dialogue の表示を確認する
- speaker 表示 mode の違いを見る
- text reveal speed と overflow behavior を確認する
- long-form sound novel 向けの presentation を検証する

短い starter flow を見たい場合は `examples/preact-starter` を使います。
save/load や settings まで含む統合 reference を見たい場合は `examples/preact-basic` を使います。

## 起動

```sh
pnpm --filter @tsuzuru/example-preact-sound-novel dev
```

## preview controls

画面右上の preview controls で次を切り替えられます。

- `speakerMode`: `inline`, `block`, `hidden`
- text speed: `30`, `60`, `120` characters per second

## よく見るファイル

- `scenario/main.tzr`
  long narration blocks、multi-line dialogue、choices、placeholder background changes、audio/effect commands を含みます。

- `src/assets.ts`
  placeholder CSS classes と audio ids を登録します。

- `src/ui/GameRoot.tsx`
  `TsuzuruGame` の novel presentation 設定を確認します。

## チェック

```sh
pnpm --filter @tsuzuru/example-preact-sound-novel check:scenario
pnpm --filter @tsuzuru/example-preact-sound-novel test
pnpm --filter @tsuzuru/example-preact-sound-novel typecheck
pnpm --filter @tsuzuru/example-preact-sound-novel build
pnpm --filter @tsuzuru/example-preact-sound-novel test:ui
```

## 補足

この example は image / audio files を bundle していません。
Backgrounds は `src/assets.ts` で登録した placeholder CSS classes を使います。
missing audio assets は、この preview では安全に無視できる想定です。
