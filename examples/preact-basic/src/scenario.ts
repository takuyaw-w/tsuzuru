import { compileTzrProject } from "@tsuzuru/core";
import { createStdAudioPlugin } from "@tsuzuru/plugin-std-audio";
import { createStdCameraPlugin } from "@tsuzuru/plugin-std-camera";
import { createStdEffectPlugin } from "@tsuzuru/plugin-std-effect";
import { createStdSystemPlugin } from "@tsuzuru/plugin-std-system";
import { createStdTextSoundPlugin } from "@tsuzuru/plugin-std-text-sound";
import { createStdVisualPlugin } from "@tsuzuru/plugin-std-visual";

const scenarioModules = import.meta.glob<string>("../scenario/**/*.tzr", {
  query: "?raw",
  import: "default",
  eager: true,
});

export const scenarioIdentity = {
  id: "tsuzuru.example.preact-basic",
  version: "1",
} as const;

export const scenarioProject = compileTzrProject(
  {
    entryId: "scenario/main.tzr",
    documents: Object.entries(scenarioModules).map(([path, source]) => ({
      id: toScenarioDocumentId(path),
      source,
    })),
  },
  {
    plugins: [
      createStdVisualPlugin(),
      createStdAudioPlugin(),
      createStdTextSoundPlugin(),
      createStdEffectPlugin(),
      createStdCameraPlugin(),
      createStdSystemPlugin(),
    ],
  },
);

function toScenarioDocumentId(path: string): string {
  return path.replace(/^\.\.\//, "");
}
