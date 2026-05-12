# 0022: Standard Text Sound Plugin

## Status

Accepted

## Context

visual novel では、文字送りに同期する短い音、いわゆる popopo / text blip sound がよく使われます。

一方で、Core runtime や standard plugin が `AudioContext`、DOM、timer、text reveal の進行、volume、句読点 skip policy まで持つと、renderer / app の presentation policy と runtime state が混ざります。

Tsuzuru には Preact と Vue の example があり、text reveal の実装場所や実際の音声再生方式は renderer ごとに異なります。

## Decision

`@tsuzuru/plugin-std-text-sound` を提供します。

plugin state key は `stdTextSound` とします。

```ts
runtimeState.plugins.stdTextSound
```

提供する DSL command は次の 2 つです。

```txt
textSound assetId
stopTextSound
```

`textSound` は現在の text sound を上書きし、`stopTextSound` は `current` を `null` にします。

## State Design

std-text-sound state は renderer 非依存のデータだけを持ちます。

```ts
{
  current: null | { assetId: string },
}
```

初期 state は次の値です。

```ts
{
  current: null,
}
```

volume、interval、punctuation skip、speaker-specific mapping は plugin state に入れません。

## Rationale

text blip sound は継続的な audio playback ではなく、表示中の文字ごとの presentation effect です。

plugin が保持すべき情報は、scenario が現在どの text sound profile を意図しているかだけです。実際にどのタイミングで鳴らすか、どの文字を skip するか、Web Audio oscillator にするか audio file にするかは renderer / app 側で決める方が境界が明確です。

`std-audio` の state shape は変更しません。`std-audio` は BGM / SE / Voice を扱い、text reveal 同期の presentation policy は `std-text-sound` state と example 側の再生実装で表現します。

## Consequences

### Positive

- Core runtime semantics を変更しない
- `std-audio` state shape を変更しない
- Preact / Vue それぞれの text reveal implementation に同期できる
- plugin state は save / restore しやすい単純な shape に保てる
- example 側で tone profile から file mapping へ差し替えられる

### Negative

- renderer / app は text reveal callback と playback policy を実装する必要がある
- package 単体では音は鳴らない
- speaker-specific mapping や punctuation policy は標準化されていない

## Reconsideration Criteria

- 複数 renderer で同じ presentation policy を共有する必要が強くなった場合
- text reveal の標準 event stream を core / adapter が提供する場合
- audio file mapping や speaker-specific defaults を公式 asset manifest として扱う場合

## Related Documents

- `docs/plugins/std-text-sound.md`
- `docs/plugins/std-audio.md`
- `docs/decisions/0005-std-audio-plugin.md`
- `docs/decisions/0012-text-preferences-mvp.md`
