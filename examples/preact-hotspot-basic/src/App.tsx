import "@tsuzuru/standard-ui-preact/style.css";
import "./style.css";
import { standardTheme, TitleScreen, TsuzuruThemeProvider } from "@tsuzuru/standard-ui-preact";
import { useState } from "preact/hooks";
import scenario from "../scenario/main.tzr";
import { assets } from "./assets.js";
import { GameRoot } from "./ui/GameRoot.js";

type AppScreen = "title" | "game";

export function App() {
  const [screen, setScreen] = useState<AppScreen>("title");

  const content =
    screen === "title" ? (
      <TitleScreen
        title="Hotspot Basic"
        subtitle="透明なクリック領域で探索する小さなADV"
        description="机、窓、本棚、扉をクリックして、scene jump の流れを確認できます。"
        actions={[
          { label: "Start", onSelect: () => setScreen("game") },
          { label: "Load", onSelect: () => undefined, disabled: true },
          { label: "Settings", onSelect: () => undefined, disabled: true },
        ]}
        footer="@tsuzuru/plugin-std-hotspot"
      />
    ) : (
      <GameRoot scenario={scenario} assets={assets} onTitle={() => setScreen("title")} />
    );

  return <TsuzuruThemeProvider theme={standardTheme}>{content}</TsuzuruThemeProvider>;
}
