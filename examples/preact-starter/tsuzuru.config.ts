import { defineTsuzuruConfig } from "@tsuzuru/config";
import { createStdAudioPlugin } from "@tsuzuru/plugin-std-audio";
import { createStdEffectPlugin } from "@tsuzuru/plugin-std-effect";
import { createStdVisualPlugin } from "@tsuzuru/plugin-std-visual";

export default defineTsuzuruConfig({
  scenario: {
    entry: "scenario/main.tzr",
    files: ["scenario/**/*.tzr"],
  },
  ui: {
    theme: {
      default: "local",
    },
  },
  plugins: [createStdVisualPlugin(), createStdAudioPlugin(), createStdEffectPlugin()],
});
