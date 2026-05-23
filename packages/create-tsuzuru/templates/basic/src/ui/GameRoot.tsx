import { TsuzuruGame } from "@tsuzuru/standard-ui-preact";
import type { game as starterGame } from "../game.js";

interface GameRootProps {
  readonly game: typeof starterGame;
}

export function GameRoot({ game }: GameRootProps) {
  return (
    <main className="starter-app starter-game-root">
      <TsuzuruGame
        scenario={game.scenario}
        assets={game.assets}
        className="starter-game"
        viewport={{ aspectRatio: "16:9", maxWidth: "min(100vw, calc(100dvh * 16 / 9))" }}
        advanceHint="クリックで進む"
      />
    </main>
  );
}
