import { compileTzrProject } from "@tsuzuru/core";
import { createStdAudioPlugin } from "@tsuzuru/plugin-std-audio";
import { createStdVisualPlugin } from "@tsuzuru/plugin-std-visual";
import opening from "../scenario/chapters/01-opening.tzr?raw";
import common from "../scenario/chapters/02-common.tzr?raw";
import ending from "../scenario/chapters/03-ending.tzr?raw";
import main from "../scenario/main.tzr?raw";

export const scenarioProject = compileTzrProject(
  {
    entryId: "scenario/main.tzr",
    documents: [
      { id: "scenario/main.tzr", source: main },
      { id: "scenario/chapters/01-opening.tzr", source: opening },
      { id: "scenario/chapters/02-common.tzr", source: common },
      { id: "scenario/chapters/03-ending.tzr", source: ending },
    ],
  },
  { plugins: [createStdVisualPlugin(), createStdAudioPlugin()] },
);
