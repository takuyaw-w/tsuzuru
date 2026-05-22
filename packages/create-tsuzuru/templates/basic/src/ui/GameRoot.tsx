import { TsuzuruGame, type TsuzuruGameScenario } from "@tsuzuru/standard-ui-preact";
import { assets } from "../assets.js";

interface GameRootProps {
  readonly scenario: TsuzuruGameScenario;
}

export function GameRoot({ scenario }: GameRootProps) {
  return (
    <main className="starter-app starter-game-root">
      <TsuzuruGame
        scenario={scenario}
        assets={assets}
        className="starter-game"
        viewport={{ aspectRatio: "16:9", maxWidth: "min(100vw, calc(100dvh * 16 / 9))" }}
        advanceHint="クリックで進む"
      />
    </main>
  );
}
