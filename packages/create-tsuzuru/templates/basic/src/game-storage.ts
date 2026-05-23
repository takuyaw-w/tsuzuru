import { createStandardGameStorage } from "@tsuzuru/standard-game-storage";
import { projectIdentity } from "../tsuzuru.config.js";

export const gameStorage = createStandardGameStorage({
  project: projectIdentity,
  storagePrefix: `tsuzuru:${projectIdentity.id}`,
  slots: 3,
});
