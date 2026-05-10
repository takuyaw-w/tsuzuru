import { defineTsuzuruConfig } from "@tsuzuru/config";
import { createStdAudioPlugin } from "@tsuzuru/plugin-std-audio";
import { createStdVisualPlugin } from "@tsuzuru/plugin-std-visual";

export default defineTsuzuruConfig({
  scenario: {
    entry: "public/scenario/main.tzr",
    files: ["public/scenario/**/*.tzr"],
  },
  plugins: [createStdVisualPlugin(), createStdAudioPlugin()],
});
