import type { ScreenRegistry } from "@tsuzuru/standard-ui-preact";
import { NotebookScreen } from "./NotebookScreen.js";

export const screens = {
  notebook: NotebookScreen,
} satisfies ScreenRegistry;
