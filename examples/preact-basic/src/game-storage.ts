import {
  createStandardGameStorage,
  DEFAULT_STANDARD_GAME_PREFERENCES,
  STANDARD_GAME_TEXT_SPEED_OPTIONS,
  type StandardGamePreferences,
} from "@tsuzuru/standard-game-storage";
import { projectIdentity } from "../tsuzuru.config.js";
import { runtimeSaveAdapter } from "./save-compatibility.js";

// Creator-facing storage setup for this example. App/UI helpers live in
// game-storage-api.ts, and legacy save compatibility stays in save-compatibility.ts.
export { projectIdentity };

const STORAGE_PREFIX = "tsuzuru:example-preact-basic";

export const TEXT_SPEED_OPTIONS = STANDARD_GAME_TEXT_SPEED_OPTIONS;
export type TextSpeedCharactersPerSecond = (typeof TEXT_SPEED_OPTIONS)[number];

export interface ExamplePreferences extends StandardGamePreferences {
  readonly textSpeedCharactersPerSecond: TextSpeedCharactersPerSecond;
}

export const DEFAULT_EXAMPLE_PREFERENCES: ExamplePreferences = {
  ...DEFAULT_STANDARD_GAME_PREFERENCES,
  textSpeedCharactersPerSecond: 60,
};

export const gameStorage = createStandardGameStorage({
  project: projectIdentity,
  storagePrefix: STORAGE_PREFIX,
  slots: 3,
  preferences: {
    defaults: DEFAULT_EXAMPLE_PREFERENCES,
    textSpeedOptions: TEXT_SPEED_OPTIONS,
  },
  saves: runtimeSaveAdapter,
});
