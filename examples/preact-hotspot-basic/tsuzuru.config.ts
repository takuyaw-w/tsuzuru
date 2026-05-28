import { defineTsuzuruConfig } from "@tsuzuru/config";
import { createStdHotspotPlugin } from "@tsuzuru/plugin-std-hotspot";
import { createStdVisualPlugin } from "@tsuzuru/plugin-std-visual";

export default defineTsuzuruConfig({
  scenario: {
    entry: "scenario/main.tzr",
    files: ["scenario/**/*.tzr"],
  },
  plugins: [createStdVisualPlugin(), createStdHotspotPlugin()],
});
