import { defineTsuzuruConfig } from "@tsuzuru/config";
import { createStdAudioPlugin } from "@tsuzuru/plugin-std-audio";
import { createStdEffectPlugin } from "@tsuzuru/plugin-std-effect";
import { createStdVisualPlugin } from "@tsuzuru/plugin-std-visual";

export default defineTsuzuruConfig({
  scenario: {
    entry: "scenario/main.tzr",
    files: ["scenario/main.tzr"],
  },
  plugins: [createStdVisualPlugin(), createStdAudioPlugin(), createStdEffectPlugin()],
});
