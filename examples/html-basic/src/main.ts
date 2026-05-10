import "@tsuzuru/html/style.css";
import { mountTsuzuruHtmlAppsFromDocument, normalizeTsuzuruHtmlAssetsManifest } from "@tsuzuru/html";
import { assets as assetsManifest } from "../assets.js";
import settingsHtml from "./screens/settings.html?raw";
import "./style.css";

const assets = normalizeTsuzuruHtmlAssetsManifest(assetsManifest, new URL("../assets.ts", import.meta.url));

await mountTsuzuruHtmlAppsFromDocument(document, {
  assets,
  screenFragments: {
    settings: settingsHtml,
  },
});
