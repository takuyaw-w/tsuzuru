import { createStandardGameStorage } from "@tsuzuru/standard-game-storage";
import scenario from "../scenario/main.tzr";
import { projectIdentity } from "../tsuzuru.config.js";
import { assets } from "./assets.js";

export const game = {
  project: projectIdentity,
  scenario,
  assets,
  storage: createStandardGameStorage({
    project: projectIdentity,
    slots: 3,
  }),
} as const;
