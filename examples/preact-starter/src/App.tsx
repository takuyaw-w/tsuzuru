import "@tsuzuru/standard-ui-preact/style.css";
import "./style.css";
import { TitleScreen, TsuzuruThemeProvider } from "@tsuzuru/standard-ui-preact";
import { useState } from "preact/hooks";
import scenario from "../scenario/main.tzr";
import { assets } from "./assets.js";
import { localTheme } from "./themes/localTheme.js";
import { GameRoot } from "./ui/GameRoot.js";

type AppScreen = "title" | "game";

export function App() {
  const [screen, setScreen] = useState<AppScreen>("title");

  const content =
    screen === "title" ? (
      <TitleScreen
        title="はじめてのTsuzuru"
        subtitle="シナリオを書いて、素材を登録するだけ。"
        description="scenario/main.tzr と src/assets.ts を編集して、自分の物語に差し替えられます。"
        actions={[
          { label: "Start", onSelect: () => setScreen("game") },
          { label: "Load", onSelect: () => undefined, disabled: true },
          { label: "Settings", onSelect: () => undefined, disabled: true },
        ]}
        footer="Tsuzuru Starter"
      />
    ) : (
      <GameRoot scenario={scenario} assets={assets} onTitle={() => setScreen("title")} />
    );

  return <TsuzuruThemeProvider theme={localTheme}>{content}</TsuzuruThemeProvider>;
}
