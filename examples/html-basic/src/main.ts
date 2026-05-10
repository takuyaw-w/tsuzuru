import { mountTsuzuruHtml } from "@tsuzuru/html";
import "@tsuzuru/html/style.css";
import "./style.css";

const root = document.getElementById("app");

if (!(root instanceof HTMLElement)) {
  throw new Error("Missing #app element.");
}

await mountTsuzuruHtml(root, {
  title: "Tsuzuru HTML Basic",
  className: "html-basic-player",
});
