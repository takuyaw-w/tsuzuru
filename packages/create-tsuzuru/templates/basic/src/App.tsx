import { useState } from "preact/hooks";
import scenario from "../scenario/main.tzr";
import { TitleScreen } from "./screens/TitleScreen.js";
import { GameRoot } from "./ui/GameRoot.js";

type AppScreen = "title" | "game";

export function App() {
  const [screen, setScreen] = useState<AppScreen>("title");

  if (screen === "title") {
    return (
      <TitleScreen
        title="はじめてのTsuzuru"
        subtitle="シナリオを書いて、素材を置くだけ。"
        onStart={() => setScreen("game")}
      />
    );
  }

  return <GameRoot scenario={scenario} />;
}
