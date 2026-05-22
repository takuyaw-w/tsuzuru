import preact from "@preact/preset-vite";
import { createStdAudioPlugin } from "@tsuzuru/plugin-std-audio";
import { createStdCameraPlugin } from "@tsuzuru/plugin-std-camera";
import { createStdEffectPlugin } from "@tsuzuru/plugin-std-effect";
import { createStdParticlePlugin } from "@tsuzuru/plugin-std-particle";
import { createStdSystemPlugin } from "@tsuzuru/plugin-std-system";
import { createStdTextSoundPlugin } from "@tsuzuru/plugin-std-text-sound";
import { createStdVisualPlugin } from "@tsuzuru/plugin-std-visual";
import { tsuzuru } from "@tsuzuru/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    preact(),
    tsuzuru({
      plugins: [
        createStdVisualPlugin(),
        createStdAudioPlugin(),
        createStdTextSoundPlugin(),
        createStdEffectPlugin(),
        createStdCameraPlugin(),
        createStdParticlePlugin(),
        createStdSystemPlugin(),
      ],
    }),
  ],
});
