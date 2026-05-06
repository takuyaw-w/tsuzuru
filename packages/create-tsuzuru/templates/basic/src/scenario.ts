import { compileTzrProject } from "@tsuzuru/core";
import { createStdAudioPlugin } from "@tsuzuru/plugin-std-audio";
import { createStdVisualPlugin } from "@tsuzuru/plugin-std-visual";

const scenarioModules = import.meta.glob<string>("../scenario/**/*.tzr", {
  query: "?raw",
  import: "default",
  eager: true,
});

export const scenarioProject = compileTzrProject(
  {
    entryId: "scenario/main.tzr",
    documents: Object.entries(scenarioModules).map(([path, source]) => ({
      id: toScenarioDocumentId(path),
      source,
    })),
  },
  { plugins: [createStdVisualPlugin(), createStdAudioPlugin()] },
);

function toScenarioDocumentId(path: string): string {
  return path.replace(/^\.\.\//, "");
}
