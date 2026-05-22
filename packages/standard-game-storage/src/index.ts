export const STANDARD_GAME_STORAGE_PACKAGE_NAME = "@tsuzuru/standard-game-storage";

export const STANDARD_GAME_STORAGE_PLANNED_AREAS = ["preferences", "read-tracking", "save-slots"] as const;

export type StandardGameStoragePlannedArea = (typeof STANDARD_GAME_STORAGE_PLANNED_AREAS)[number];

export * from "./preferences.js";
