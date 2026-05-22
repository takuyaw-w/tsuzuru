import preact from "@preact/preset-vite";
import { createStdAudioPlugin } from "@tsuzuru/plugin-std-audio";
import { createStdEffectPlugin } from "@tsuzuru/plugin-std-effect";
import { createStdVisualPlugin } from "@tsuzuru/plugin-std-visual";
import { tsuzuru } from "@tsuzuru/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    preact(),
    tsuzuru({
      plugins: [createStdVisualPlugin(), createStdAudioPlugin(), createStdEffectPlugin()],
    }),
  ],
});
