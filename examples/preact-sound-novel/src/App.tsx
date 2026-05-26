import "@tsuzuru/standard-ui-preact/style.css";
import "./style.css";
import { useState } from "preact/hooks";
import scenario from "../scenario/main.tzr";
import { assets } from "./assets.js";
import { TitleScreen } from "./screens/TitleScreen.js";
import { GameRoot } from "./ui/GameRoot.js";

type AppScreen = "title" | "game";

export function App() {
  const [screen, setScreen] = useState<AppScreen>("title");

  if (screen === "title") {
    return (
      <TitleScreen
        title="雨のページ"
        subtitle="長文とサウンドノベル形式の表示確認用 example"
        onStart={() => setScreen("game")}
      />
    );
  }

  return <GameRoot scenario={scenario} assets={assets} onTitle={() => setScreen("title")} />;
}
