import { defineTsuzuruConfig } from "@tsuzuru/config";
import { createStdAudioPlugin } from "@tsuzuru/plugin-std-audio";
import { createStdCameraPlugin } from "@tsuzuru/plugin-std-camera";
import { createStdEffectPlugin } from "@tsuzuru/plugin-std-effect";
import { createStdSystemPlugin } from "@tsuzuru/plugin-std-system";
import { createStdTextSoundPlugin } from "@tsuzuru/plugin-std-text-sound";
import { createStdVisualPlugin } from "@tsuzuru/plugin-std-visual";

export default defineTsuzuruConfig({
  scenario: {
    entry: "scenario/main.tzr",
    files: ["scenario/**/*.tzr"],
  },
  plugins: [
    createStdVisualPlugin(),
    createStdAudioPlugin(),
    createStdTextSoundPlugin(),
    createStdEffectPlugin(),
    createStdCameraPlugin(),
    createStdSystemPlugin(),
  ],
});
