import {
  type RuntimeNovelTextSpeakerMode,
  TsuzuruGame,
  type TsuzuruGameAssets,
  type TsuzuruGameScenario,
} from "@tsuzuru/standard-ui-preact";
import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";

export const speakerModes = ["inline", "block", "hidden"] as const satisfies readonly RuntimeNovelTextSpeakerMode[];
export const textSpeedOptions = [30, 60, 120] as const;

export type SoundNovelSpeakerMode = (typeof speakerModes)[number];
export type SoundNovelTextSpeed = (typeof textSpeedOptions)[number];

interface GameRootProps {
  readonly scenario: TsuzuruGameScenario;
  readonly assets: TsuzuruGameAssets;
  readonly onTitle: () => void;
}

export interface SoundNovelGameProps {
  readonly scenario: TsuzuruGameScenario;
  readonly assets: TsuzuruGameAssets;
  readonly speakerMode: SoundNovelSpeakerMode;
  readonly charactersPerSecond: SoundNovelTextSpeed;
}

export function GameRoot({ scenario, assets, onTitle }: GameRootProps): ComponentChildren {
  const [speakerMode, setSpeakerMode] = useState<SoundNovelSpeakerMode>("inline");
  const [charactersPerSecond, setCharactersPerSecond] = useState<SoundNovelTextSpeed>(60);

  return (
    <main className="sound-novel-app sound-novel-runtime">
      <SoundNovelGame
        scenario={scenario}
        assets={assets}
        speakerMode={speakerMode}
        charactersPerSecond={charactersPerSecond}
      />
      <nav className="sound-novel-preview-controls" aria-label="Preview controls">
        <button type="button" className="sound-novel-button" onClick={onTitle}>
          Title
        </button>
        <label>
          <span>Speaker</span>
          <select
            aria-label="Speaker mode"
            value={speakerMode}
            onChange={(event) => setSpeakerMode(event.currentTarget.value as SoundNovelSpeakerMode)}
          >
            {speakerModes.map((mode) => (
              <option value={mode} key={mode}>
                {mode}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Speed</span>
          <select
            aria-label="Text speed"
            value={charactersPerSecond}
            onChange={(event) => setCharactersPerSecond(Number(event.currentTarget.value) as SoundNovelTextSpeed)}
          >
            {textSpeedOptions.map((speed) => (
              <option value={speed} key={speed}>
                {speed}
              </option>
            ))}
          </select>
        </label>
      </nav>
    </main>
  );
}

export function SoundNovelGame({
  scenario,
  assets,
  speakerMode,
  charactersPerSecond,
}: SoundNovelGameProps): ComponentChildren {
  return (
    <TsuzuruGame
      scenario={scenario}
      assets={assets}
      className="sound-novel-game"
      viewport={{
        aspectRatio: "16:9",
        maxWidth: "min(100vw, calc(100dvh * 16 / 9))",
      }}
      messagePresentation={{
        mode: "novel",
        speakerMode,
      }}
      text={{
        reveal: true,
        charactersPerSecond,
      }}
      advanceHint="クリックで進む"
    />
  );
}
