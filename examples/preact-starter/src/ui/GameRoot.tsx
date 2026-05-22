import { TsuzuruGame, type TsuzuruGameAssets, type TsuzuruGameScenario } from "@tsuzuru/standard-ui-preact";
import type { ComponentChildren } from "preact";

interface GameRootProps {
  readonly scenario: TsuzuruGameScenario;
  readonly assets: TsuzuruGameAssets;
  readonly onTitle: () => void;
}

export function GameRoot({ scenario, assets, onTitle }: GameRootProps): ComponentChildren {
  return (
    <main className="starter-app starter-game-root">
      <TsuzuruGame
        scenario={scenario}
        assets={assets}
        className="starter-game"
        viewport={{ aspectRatio: "16:9", maxWidth: "min(100vw, calc(100dvh * 16 / 9))" }}
        advanceHint="クリックで進む"
      />
      <nav className="starter-game-root__menu" aria-label="Game menu">
        <button type="button" onClick={onTitle}>
          Title
        </button>
      </nav>
    </main>
  );
}
