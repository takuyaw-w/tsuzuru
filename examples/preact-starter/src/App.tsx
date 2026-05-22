import "@tsuzuru/standard-ui-preact/style.css";
import "./style.css";
import { useState } from "preact/hooks";
import { assets } from "./assets.js";
import { scenario } from "./scenario.js";
import { TitleScreen } from "./screens/TitleScreen.js";
import { GameRoot } from "./ui/GameRoot.js";

type AppScreen = "title" | "game";

export function App() {
  const [screen, setScreen] = useState<AppScreen>("title");

  if (screen === "title") {
    return (
      <TitleScreen
        title="はじめてのTsuzuru"
        subtitle="シナリオを書いて、素材を登録するだけ。"
        onStart={() => setScreen("game")}
      />
    );
  }

  return <GameRoot scenario={scenario} assets={assets} onTitle={() => setScreen("title")} />;
}
