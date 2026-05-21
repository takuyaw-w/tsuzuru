import { defineTsuzuruGameScenario } from "@tsuzuru/standard-ui-preact";

const scenarioModules = import.meta.glob<string>("../scenario/**/*.tzr", {
  query: "?raw",
  import: "default",
  eager: true,
});

export const scenario = defineTsuzuruGameScenario({
  entryId: "scenario/main.tzr",
  documents: Object.entries(scenarioModules).map(([path, source]) => ({
    id: toScenarioDocumentId(path),
    source,
  })),
});

function toScenarioDocumentId(path: string): string {
  return path.replace(/^\.\.\//, "");
}
