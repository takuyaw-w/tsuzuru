import "@tsuzuru/standard-ui-preact/style.css";
import "@tsuzuru/theme-standard/style.css";
import { standardThemeClassName } from "@tsuzuru/theme-standard";
import "./style.css";
import { useState } from "preact/hooks";
import scenario from "../scenario/main.tzr";
import { assets } from "./assets.js";
import { TitleScreen } from "./screens/TitleScreen.js";
import { GameRoot } from "./ui/GameRoot.js";

type AppScreen = "title" | "game";

export function App() {
  const [screen, setScreen] = useState<AppScreen>("title");

  const content =
    screen === "title" ? (
      <TitleScreen
        title="はじめてのTsuzuru"
        subtitle="シナリオを書いて、素材を登録するだけ。"
        onStart={() => setScreen("game")}
      />
    ) : (
      <GameRoot scenario={scenario} assets={assets} onTitle={() => setScreen("title")} />
    );

  return <div className={standardThemeClassName}>{content}</div>;
}
