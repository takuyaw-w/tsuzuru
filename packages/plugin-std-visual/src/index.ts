import type { RuntimePluginDefinition, RuntimeState } from "@tsuzuru/core";

const STD_VISUAL_PLUGIN_NAME = "stdVisual";

export type StdVisualSpritePosition = "left" | "center" | "right";

export interface StdVisualBackground {
  readonly assetId: string;
}

export interface StdVisualSprite {
  readonly position: StdVisualSpritePosition;
}

export type StdVisualSprites = Readonly<Record<string, StdVisualSprite>>;

export interface StdVisualState {
  readonly background: StdVisualBackground | null;
  readonly sprites: StdVisualSprites;
}

export function createStdVisualPlugin(): RuntimePluginDefinition<StdVisualState> {
  return {
    name: STD_VISUAL_PLUGIN_NAME,
    createInitialState: createInitialStdVisualState,
  };
}

export function getStdVisualState(runtimeState: RuntimeState): StdVisualState {
  const state = runtimeState.plugins[STD_VISUAL_PLUGIN_NAME];
  if (!isStdVisualState(state)) {
    throw new Error("runtimeState.plugins.stdVisual is not initialized. Register createStdVisualPlugin().");
  }

  return state;
}

function createInitialStdVisualState(): StdVisualState {
  return {
    background: null,
    sprites: {},
  };
}

function isStdVisualState(value: unknown): value is StdVisualState {
  if (!isObjectRecord(value)) {
    return false;
  }

  if (value.background !== null && !isStdVisualBackground(value.background)) {
    return false;
  }

  if (!isObjectRecord(value.sprites)) {
    return false;
  }

  return Object.values(value.sprites).every(isStdVisualSprite);
}

function isStdVisualBackground(value: unknown): value is StdVisualBackground {
  return isObjectRecord(value) && typeof value.assetId === "string";
}

function isStdVisualSprite(value: unknown): value is StdVisualSprite {
  return isObjectRecord(value) && isStdVisualSpritePosition(value.position);
}

function isStdVisualSpritePosition(value: unknown): value is StdVisualSpritePosition {
  return value === "left" || value === "center" || value === "right";
}

function isObjectRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}
