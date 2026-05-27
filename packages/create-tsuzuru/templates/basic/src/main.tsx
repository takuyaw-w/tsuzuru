import { render } from "preact";
import { App } from "./App.js";

const root = document.querySelector("#app");
if (root === null) {
  throw new Error("Missing #app root element.");
}

render(<App />, root);
