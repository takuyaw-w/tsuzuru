import "@tsuzuru/standard-ui-preact/style.css";
import "@tsuzuru/theme-standard/style.css";
import "@tsuzuru/theme-classic/style.css";
import "@tsuzuru/theme-dark-novel/style.css";
import "@tsuzuru/theme-minimal/style.css";
import "./style.css";
import { standardTheme } from "@tsuzuru/theme-standard";
import { classicTheme } from "@tsuzuru/theme-classic";
import { darkNovelTheme } from "@tsuzuru/theme-dark-novel";
import { minimalTheme } from "@tsuzuru/theme-minimal";
import { useState } from "preact/hooks";
import scenario from "../scenario/main.tzr";
import { assets } from "./assets.js";
import { TitleScreen } from "./screens/TitleScreen.js";
import { GameRoot } from "./ui/GameRoot.js";

type AppScreen = "title" | "game";

const themes = {
  standard: standardTheme,
  classic: classicTheme,
  "dark-novel": darkNovelTheme,
  minimal: minimalTheme,
} as const;

type ThemeId = keyof typeof themes;

function ThemeSwitcher({ value, onChange }: { value: ThemeId; onChange: (themeId: ThemeId) => void }) {
  return (
    <label className="starter-theme-switcher">
      <span>Theme</span>
      <select value={value} onChange={(event) => onChange(event.currentTarget.value as ThemeId)}>
        {Object.entries(themes).map(([themeId, theme]) => (
          <option key={themeId} value={themeId}>
            {theme.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function App() {
  const [screen, setScreen] = useState<AppScreen>("title");
  const [themeId, setThemeId] = useState<ThemeId>("standard");
  const selectedTheme = themes[themeId];

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

  return (
    <div className={selectedTheme.className}>
      <ThemeSwitcher value={themeId} onChange={setThemeId} />
      {content}
    </div>
  );
}
