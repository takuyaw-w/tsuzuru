import "@tsuzuru/html/style.css";
import { createHtmlBasicApp } from "./app.js";
import "./style.css";

const root = document.getElementById("app");

if (!(root instanceof HTMLElement)) {
  throw new Error("Missing #app element.");
}

await createHtmlBasicApp(root);
