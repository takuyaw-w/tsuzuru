import { defineTsuzuruConfig } from "@tsuzuru/config";
import { createStdAudioPlugin } from "@tsuzuru/plugin-std-audio";
import { createStdEffectPlugin } from "@tsuzuru/plugin-std-effect";
import { createStdVisualPlugin } from "@tsuzuru/plugin-std-visual";

export const projectIdentity = {
  id: "{{projectName}}",
  version: "1",
} as const;

export default defineTsuzuruConfig({
  project: projectIdentity,
  scenario: {
    entry: "scenario/main.tzr",
    files: ["scenario/main.tzr"],
  },
  storage: {
    enabled: true,
    slots: 3,
    saves: "standard-runtime",
  },
  plugins: [createStdVisualPlugin(), createStdAudioPlugin(), createStdEffectPlugin()],
});
