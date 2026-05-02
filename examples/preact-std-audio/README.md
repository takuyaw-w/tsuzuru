# Preact std-audio Example

この example は、`@tsuzuru/plugin-std-audio` の `@startBgm()` / `@stopBgm()` / `@se()` / `@voice()` が Preact app からどう見えるかを確認するための最小構成です。

`@tsuzuru/plugin-std-audio` は実際の音声再生 engine ではありません。BGM state と SE / Voice の一回性 event を `runtimeState.plugins.stdAudio` に保持するだけです。

この example では `src/AudioLayer.tsx` が `getStdAudioState(runtimeState)` で audio state を読み、current BGM、SE events、Voice events、sequence、消費済み sequence を画面に表示します。`AudioLayer.tsx` は example 用の薄い実装であり、公式 renderer component ではありません。

## Audio Files

実音声ファイルは同梱していません。

任意の音声ファイルを置く場合は、次の path を使えます。

```txt
public/assets/audio/bgm/main_theme.mp3
public/assets/audio/se/click.mp3
public/assets/audio/se/confirm.mp3
public/assets/audio/voice/alice_001.mp3
public/assets/audio/voice/alice_002.mp3
```

`assetId` と path の対応は `src/assets.ts` にあります。

音声ファイルが存在しない場合や、browser autoplay 制約により再生が拒否された場合でも、example は落ちないようにしています。再生失敗は画面上の notice と console warning で確認できます。

## Scenario

シナリオは `scenario/main.tzr` です。

`@stopBgm()` は parentheses 必須です。bare form の `@stopBgm` は使いません。

## Run

リポジトリ root から実行します。

```sh
pnpm --filter @tsuzuru/example-preact-std-audio dev
```

production build:

```sh
pnpm --filter @tsuzuru/example-preact-std-audio build
```

typecheck:

```sh
pnpm --filter @tsuzuru/example-preact-std-audio typecheck
```
