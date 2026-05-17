import { assertRuntimeSnapshot } from "./runtime-snapshot.js";
import type {
  RuntimeSaveSlot,
  RuntimeSaveSlotContext,
  RuntimeSaveSlotValidationErrorReason,
  RuntimeSaveSlotValidationResult,
} from "./runtime-types.js";

export function validateRuntimeSaveSlot(
  value: unknown,
  context: RuntimeSaveSlotContext,
): RuntimeSaveSlotValidationResult {
  if (!isObjectRecord(value)) {
    return validationFailure("invalid_slot", "RuntimeSaveSlot must be an object.");
  }

  const versionResult = validateSlotVersion(value.version);
  if (versionResult !== null) {
    return versionResult;
  }

  if (typeof value.scenarioId !== "string" || value.scenarioId.length === 0) {
    return validationFailure("invalid_slot", "RuntimeSaveSlot.scenarioId must be a non-empty string.");
  }

  if (value.scenarioId !== context.scenarioId) {
    return validationFailure(
      "scenario_id_mismatch",
      `RuntimeSaveSlot scenarioId "${value.scenarioId}" does not match current scenarioId "${context.scenarioId}".`,
    );
  }

  if (value.scenarioVersion !== undefined && typeof value.scenarioVersion !== "string") {
    return validationFailure("invalid_slot", "RuntimeSaveSlot.scenarioVersion must be a string when present.");
  }

  if (
    value.scenarioVersion !== undefined &&
    context.scenarioVersion !== undefined &&
    value.scenarioVersion !== context.scenarioVersion
  ) {
    return validationFailure(
      "scenario_version_mismatch",
      `RuntimeSaveSlot scenarioVersion "${value.scenarioVersion}" does not match current scenarioVersion "${context.scenarioVersion}".`,
    );
  }

  if (typeof value.createdAt !== "string") {
    return validationFailure("invalid_slot", "RuntimeSaveSlot.createdAt must be a string.");
  }

  const snapshotResult = validateSlotSnapshot(value.snapshot);
  if (snapshotResult !== null) {
    return snapshotResult;
  }

  if (value.label !== undefined && typeof value.label !== "string") {
    return validationFailure("invalid_slot", "RuntimeSaveSlot.label must be a string when present.");
  }

  if (value.metadata !== undefined && !isObjectRecord(value.metadata)) {
    return validationFailure("invalid_slot", "RuntimeSaveSlot.metadata must be an object when present.");
  }

  return {
    ok: true,
    slot: value as unknown as RuntimeSaveSlot,
  };
}

function validateSlotVersion(version: unknown): RuntimeSaveSlotValidationResult | null {
  if (typeof version !== "number" || !Number.isFinite(version)) {
    return validationFailure("unsupported_slot_version", "RuntimeSaveSlot.version must be 1.");
  }
  if (version < 1) {
    return validationFailure(
      "unsupported_slot_version",
      `Unsupported old RuntimeSaveSlot version ${version}; expected version 1.`,
    );
  }
  if (version > 1) {
    return validationFailure(
      "unsupported_slot_version",
      `Unsupported future RuntimeSaveSlot version ${version}; expected version 1.`,
    );
  }
  if (version !== 1) {
    return validationFailure("unsupported_slot_version", "RuntimeSaveSlot.version must be 1.");
  }
  return null;
}

function validateSlotSnapshot(snapshot: unknown): RuntimeSaveSlotValidationResult | null {
  try {
    assertRuntimeSnapshot(snapshot);
    return null;
  } catch (error) {
    if (error instanceof Error) {
      return validationFailure("invalid_snapshot", error.message);
    }
    return validationFailure("invalid_snapshot", "RuntimeSaveSlot.snapshot is invalid.");
  }
}

function validationFailure(
  reason: RuntimeSaveSlotValidationErrorReason,
  message: string,
): RuntimeSaveSlotValidationResult {
  return {
    ok: false,
    reason,
    message,
  };
}

function isObjectRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
