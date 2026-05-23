import type { CompiledTzrDocument } from "@tsuzuru/core";
import { TsuzuruGame, type TsuzuruGameAssets } from "@tsuzuru/standard-ui-preact";

interface GameRootProps {
  readonly scenario: CompiledTzrDocument;
  readonly assets: TsuzuruGameAssets;
}

export function GameRoot({ scenario, assets }: GameRootProps) {
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
