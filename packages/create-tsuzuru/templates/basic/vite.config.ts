import preact from "@preact/preset-vite";
import { tsuzuru } from "@tsuzuru/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [preact(), tsuzuru()],
});
