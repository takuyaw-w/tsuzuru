import "@tsuzuru/standard-ui-preact/style.css";
import "./styles.css";
import { TsuzuruThemeProvider } from "@tsuzuru/standard-ui-preact";
import { useState } from "preact/hooks";
import scenario from "../scenario/main.tzr";
import { assets } from "./assets.js";
import { TitleScreen } from "./screens/TitleScreen.js";
import { localTheme } from "./themes/localTheme.js";
import { GameRoot } from "./ui/GameRoot.js";

type AppScreen = "title" | "game";

export function App() {
  const [screen, setScreen] = useState<AppScreen>("title");

  const content =
    screen === "title" ? (
      <TitleScreen
        title="はじめてのTsuzuru"
        subtitle="シナリオを書いて、素材を置くだけ。"
        onStart={() => setScreen("game")}
      />
    ) : (
      <GameRoot scenario={scenario} assets={assets} />
    );

  return <TsuzuruThemeProvider theme={localTheme}>{content}</TsuzuruThemeProvider>;
}
