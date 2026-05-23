import type { RuntimeEvent } from "@tsuzuru/core";
import { isRuntimeSaveData, type RuntimeSaveData } from "@tsuzuru/preact";
import {
  createStandardRuntimeSaveAdapter,
  isStandardRetainedMessageEvent,
  type StandardRuntimeSaveData,
  type StandardRuntimeSaveMigrationContext,
} from "@tsuzuru/standard-game-storage";
import { projectIdentity } from "../tsuzuru.config.js";

// Legacy save compatibility for examples/preact-basic only. New starters should
// not copy these migrations.
export type RetainedMessageEvent = Extract<RuntimeEvent, { readonly type: "narration" | "dialogue" }>;

export type ExampleSaveData = StandardRuntimeSaveData<RuntimeSaveData, RetainedMessageEvent>;

export const runtimeSaveAdapter = createStandardRuntimeSaveAdapter<RuntimeSaveData, RetainedMessageEvent>({
  project: projectIdentity,
  isRuntimeData: isRuntimeSaveData,
  isRetainedMessageEvent,
  migrateData: migrateLegacyExampleSaveData,
});

export function isRetainedMessageEvent(value: unknown): value is RetainedMessageEvent {
  return isStandardRetainedMessageEvent(value);
}

export function migrateLegacyExampleSaveData(
  value: unknown,
  context: StandardRuntimeSaveMigrationContext<RuntimeSaveData, RetainedMessageEvent>,
): ExampleSaveData | null {
  return (
    migrateExampleSaveDataV2(value, context) ??
    migrateExampleSaveDataV1(value, context) ??
    migrateLegacyRuntimeSaveData(value, context)
  );
}

interface ExampleSaveDataV2 {
  readonly version: 2;
  readonly scenario: ExampleScenarioIdentity;
  readonly runtime: RuntimeSaveData;
  readonly retainedMessageEvent: RetainedMessageEvent | null;
}

interface ExampleScenarioIdentity {
  readonly id: string;
  readonly version: string;
}

function migrateExampleSaveDataV2(
  value: unknown,
  context: StandardRuntimeSaveMigrationContext<RuntimeSaveData, RetainedMessageEvent>,
): ExampleSaveData | null {
  if (!isExampleSaveDataV2(value) || !isCompatibleScenarioIdentity(value.scenario, context.project)) {
    return null;
  }

  return context.createData(value.runtime, value.retainedMessageEvent, context.savedAt);
}

function migrateExampleSaveDataV1(
  value: unknown,
  context: StandardRuntimeSaveMigrationContext<RuntimeSaveData, RetainedMessageEvent>,
): ExampleSaveData | null {
  if (!isObjectRecord(value) || value.version !== 1 || !isRuntimeSaveData(value.runtime)) {
    return null;
  }

  if (value.retainedMessageEvent !== null && !isRetainedMessageEvent(value.retainedMessageEvent)) {
    return null;
  }

  return context.createData(value.runtime, value.retainedMessageEvent, context.savedAt);
}

function migrateLegacyRuntimeSaveData(
  value: unknown,
  context: StandardRuntimeSaveMigrationContext<RuntimeSaveData, RetainedMessageEvent>,
): ExampleSaveData | null {
  return isRuntimeSaveData(value) ? context.createData(value, null, context.savedAt) : null;
}

function isExampleSaveDataV2(value: unknown): value is ExampleSaveDataV2 {
  if (!isObjectRecord(value) || value.version !== 2 || !isScenarioIdentity(value.scenario)) {
    return false;
  }

  if (!isRuntimeSaveData(value.runtime)) {
    return false;
  }

  return value.retainedMessageEvent === null || isRetainedMessageEvent(value.retainedMessageEvent);
}

function isCompatibleScenarioIdentity(value: ExampleScenarioIdentity, project: ExampleScenarioIdentity): boolean {
  return value.id === project.id && value.version === project.version;
}

function isScenarioIdentity(value: unknown): value is ExampleScenarioIdentity {
  return isObjectRecord(value) && typeof value.id === "string" && typeof value.version === "string";
}

function isObjectRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}
