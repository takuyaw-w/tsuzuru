import { TsuzuruGame } from "@tsuzuru/standard-ui-preact";
import "@tsuzuru/standard-ui-preact/style.css";
import "./style.css";
import { assets } from "./assets.js";
import { scenario } from "./scenario.js";

export function App() {
  return <TsuzuruGame scenario={scenario} assets={assets} />;
}
