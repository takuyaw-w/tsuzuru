import type { RuntimeSaveSlot, RuntimeSaveSlotContext, RuntimeSnapshot } from "@tsuzuru/core";
import { validateRuntimeSaveSlot } from "@tsuzuru/core";
import type { CreateStandardGameStorageSavesOptions } from "./preset.js";
import type { StandardSaveProject, StandardSaveSlotParseContext } from "./save-slots.js";

export interface StandardRuntimeSnapshotContainer {
  readonly snapshot: RuntimeSnapshot;
}

export interface StandardRetainedMessageTextLine {
  readonly text: string;
}

export interface StandardNarrationRetainedMessageEvent {
  readonly type: "narration";
  readonly lines: readonly StandardRetainedMessageTextLine[];
}

export interface StandardDialogueRetainedMessageEvent {
  readonly type: "dialogue";
  readonly speaker: string;
  readonly lines: readonly StandardRetainedMessageTextLine[];
}

export type StandardRetainedMessageEvent = StandardNarrationRetainedMessageEvent | StandardDialogueRetainedMessageEvent;

export interface StandardRuntimeSaveData<
  TRuntimeData extends StandardRuntimeSnapshotContainer,
  TRetainedMessageEvent = StandardRetainedMessageEvent,
> {
  readonly version: 3;
  readonly saveSlot: RuntimeSaveSlot;
  readonly runtime: TRuntimeData;
  readonly retainedMessageEvent: TRetainedMessageEvent | null;
}

export interface StandardRuntimeSaveMigrationContext<
  TRuntimeData extends StandardRuntimeSnapshotContainer,
  TRetainedMessageEvent = StandardRetainedMessageEvent,
> {
  readonly project: StandardSaveProject;
  readonly savedAt?: string;
  readonly createData: (
    runtime: TRuntimeData,
    retainedMessageEvent: TRetainedMessageEvent | null,
    createdAt?: string,
  ) => StandardRuntimeSaveData<TRuntimeData, TRetainedMessageEvent>;
}

export interface CreateStandardRuntimeSaveAdapterOptions<
  TRuntimeData extends StandardRuntimeSnapshotContainer,
  TRetainedMessageEvent = StandardRetainedMessageEvent,
> {
  readonly project: StandardSaveProject;
  readonly isRuntimeData?: (value: unknown) => value is TRuntimeData;
  readonly parseRuntimeData?: (value: unknown) => TRuntimeData | null;
  readonly getRuntimeSnapshot?: (runtime: TRuntimeData) => RuntimeSnapshot;
  readonly isRetainedMessageEvent?: (value: unknown) => value is TRetainedMessageEvent;
  readonly parseRetainedMessageEvent?: (value: unknown) => TRetainedMessageEvent | null;
  readonly migrateData?: (
    value: unknown,
    context: StandardRuntimeSaveMigrationContext<TRuntimeData, TRetainedMessageEvent>,
  ) => StandardRuntimeSaveData<TRuntimeData, TRetainedMessageEvent> | null;
}

export interface StandardRuntimeSaveAdapter<
  TRuntimeData extends StandardRuntimeSnapshotContainer,
  TRetainedMessageEvent = StandardRetainedMessageEvent,
> extends CreateStandardGameStorageSavesOptions<StandardRuntimeSaveData<TRuntimeData, TRetainedMessageEvent>> {
  readonly createData: (
    runtime: TRuntimeData,
    retainedMessageEvent: TRetainedMessageEvent | null,
    createdAt?: string,
  ) => StandardRuntimeSaveData<TRuntimeData, TRetainedMessageEvent>;
  readonly isData: (value: unknown) => value is StandardRuntimeSaveData<TRuntimeData, TRetainedMessageEvent>;
}

export function createStandardRuntimeSaveAdapter<
  TRuntimeData extends StandardRuntimeSnapshotContainer,
  TRetainedMessageEvent = StandardRetainedMessageEvent,
>(
  options: CreateStandardRuntimeSaveAdapterOptions<TRuntimeData, TRetainedMessageEvent>,
): StandardRuntimeSaveAdapter<TRuntimeData, TRetainedMessageEvent> {
  const parseRuntimeData = createRuntimeDataParser(options);
  const parseRetainedMessageEvent = createRetainedMessageEventParser(options);
  const getRuntimeSnapshot = options.getRuntimeSnapshot ?? ((runtime: TRuntimeData) => runtime.snapshot);
  const runtimeSaveSlotContext = createRuntimeSaveSlotContext(options.project);

  const createData = (
    runtime: TRuntimeData,
    retainedMessageEvent: TRetainedMessageEvent | null,
    createdAt: string = new Date().toISOString(),
  ): StandardRuntimeSaveData<TRuntimeData, TRetainedMessageEvent> => ({
    version: 3,
    saveSlot: {
      version: 1,
      scenarioId: options.project.id,
      scenarioVersion: options.project.version,
      createdAt,
      snapshot: getRuntimeSnapshot(runtime),
    },
    runtime,
    retainedMessageEvent,
  });

  const parseData = (
    value: unknown,
    context: StandardSaveSlotParseContext,
  ): StandardRuntimeSaveData<TRuntimeData, TRetainedMessageEvent> | null =>
    parseStandardRuntimeSaveData(value, {
      getRuntimeSnapshot,
      parseRetainedMessageEvent,
      parseRuntimeData,
      runtimeSaveSlotContext,
    }) ??
    options.migrateData?.(value, {
      project: options.project,
      ...(context.savedAt === undefined ? {} : { savedAt: context.savedAt }),
      createData,
    }) ??
    null;

  return {
    createData,
    getSavedAt: getStandardRuntimeSaveDataSavedAt,
    isData(value): value is StandardRuntimeSaveData<TRuntimeData, TRetainedMessageEvent> {
      return parseData(value, { project: options.project }) !== null;
    },
    parseData,
  };
}

export function isStandardRetainedMessageEvent(value: unknown): value is StandardRetainedMessageEvent {
  if (!isObjectRecord(value) || (value.type !== "narration" && value.type !== "dialogue")) {
    return false;
  }

  if (!Array.isArray(value.lines) || !value.lines.every(isTextLineLike)) {
    return false;
  }

  return value.type !== "dialogue" || typeof value.speaker === "string";
}

export function getStandardRuntimeSaveDataSavedAt<
  TRuntimeData extends StandardRuntimeSnapshotContainer,
  TRetainedMessageEvent = StandardRetainedMessageEvent,
>(data: StandardRuntimeSaveData<TRuntimeData, TRetainedMessageEvent>): string {
  return data.saveSlot.createdAt;
}

interface ParseStandardRuntimeSaveDataOptions<
  TRuntimeData extends StandardRuntimeSnapshotContainer,
  TRetainedMessageEvent,
> {
  readonly parseRuntimeData: (value: unknown) => TRuntimeData | null;
  readonly parseRetainedMessageEvent: (value: unknown) => TRetainedMessageEvent | null;
  readonly getRuntimeSnapshot: (runtime: TRuntimeData) => RuntimeSnapshot;
  readonly runtimeSaveSlotContext: RuntimeSaveSlotContext;
}

function parseStandardRuntimeSaveData<TRuntimeData extends StandardRuntimeSnapshotContainer, TRetainedMessageEvent>(
  value: unknown,
  options: ParseStandardRuntimeSaveDataOptions<TRuntimeData, TRetainedMessageEvent>,
): StandardRuntimeSaveData<TRuntimeData, TRetainedMessageEvent> | null {
  if (!isObjectRecord(value) || value.version !== 3) {
    return null;
  }

  const runtime = options.parseRuntimeData(value.runtime);
  if (runtime === null) {
    return null;
  }

  const retainedMessageEvent =
    value.retainedMessageEvent === null ? null : options.parseRetainedMessageEvent(value.retainedMessageEvent);
  if (retainedMessageEvent === null && value.retainedMessageEvent !== null) {
    return null;
  }

  const saveSlot = validateRuntimeSaveSlot(value.saveSlot, options.runtimeSaveSlotContext);
  if (!saveSlot.ok || !areRuntimeSnapshotsEqual(saveSlot.slot.snapshot, options.getRuntimeSnapshot(runtime))) {
    return null;
  }

  return {
    version: 3,
    saveSlot: saveSlot.slot,
    runtime,
    retainedMessageEvent,
  };
}

function createRuntimeDataParser<TRuntimeData extends StandardRuntimeSnapshotContainer, TRetainedMessageEvent>(
  options: CreateStandardRuntimeSaveAdapterOptions<TRuntimeData, TRetainedMessageEvent>,
): (value: unknown) => TRuntimeData | null {
  if (options.parseRuntimeData !== undefined) {
    return options.parseRuntimeData;
  }
  if (options.isRuntimeData !== undefined) {
    return (value) => (options.isRuntimeData?.(value) === true ? value : null);
  }
  throw new TypeError("createStandardRuntimeSaveAdapter requires parseRuntimeData or isRuntimeData.");
}

function createRetainedMessageEventParser<TRuntimeData extends StandardRuntimeSnapshotContainer, TRetainedMessageEvent>(
  options: CreateStandardRuntimeSaveAdapterOptions<TRuntimeData, TRetainedMessageEvent>,
): (value: unknown) => TRetainedMessageEvent | null {
  if (options.parseRetainedMessageEvent !== undefined) {
    return options.parseRetainedMessageEvent;
  }
  if (options.isRetainedMessageEvent !== undefined) {
    return (value) => (options.isRetainedMessageEvent?.(value) === true ? value : null);
  }
  return (value) => (isStandardRetainedMessageEvent(value) ? (value as TRetainedMessageEvent) : null);
}

function createRuntimeSaveSlotContext(project: StandardSaveProject): RuntimeSaveSlotContext {
  return {
    scenarioId: project.id,
    scenarioVersion: project.version,
  };
}

function areRuntimeSnapshotsEqual(left: RuntimeSnapshot, right: RuntimeSnapshot): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isObjectRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}

function isTextLineLike(value: unknown): value is { readonly text: string } {
  return isObjectRecord(value) && typeof value.text === "string";
}
