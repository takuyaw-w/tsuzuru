import { isCoreCommandName } from "./commands.js";
import type { CommandInstruction, RuntimeDocument } from "./ir.js";
import {
  getNamedNumber,
  getNamedRuntimeValue,
  getNamedString,
  getPositionalNumber,
  getPositionalString,
} from "./runtime-args.js";
import type { RuntimeState, RuntimeStepOptions, RuntimeStepResult } from "./runtime-types.js";

export const DSL_ADD_COMMAND_NAME = "__tsuzuru_add";

export function stepCommandInstruction(
  _document: RuntimeDocument,
  _state: RuntimeState,
  nextState: RuntimeState,
  instruction: CommandInstruction,
  options: RuntimeStepOptions,
): RuntimeStepResult {
  const { name, args } = instruction;
  if (name === "waitClick") {
    return {
      state: {
        ...nextState,
        isWaitingForClick: true,
      },
      event: { type: "waitClick" },
    };
  }

  if (name === "page") {
    return {
      state: {
        ...nextState,
        isWaitingForClick: true,
      },
      event: { type: "page" },
    };
  }

  if (name === "wait") {
    const durationMs = getPositionalNumber(args, 0);
    if (durationMs === undefined) {
      return unsupportedCommand(nextState);
    }

    return {
      state: {
        ...nextState,
        pendingWait: { durationMs },
      },
      event: { type: "wait", durationMs },
    };
  }

  if (name === "stop") {
    return {
      state: {
        ...nextState,
        isStopped: true,
      },
      event: { type: "stop" },
    };
  }

  if (name === DSL_ADD_COMMAND_NAME) {
    const variableName = getNamedString(args, "name");
    const by = getNamedNumber(args, "by");
    if (variableName === undefined || by === undefined) {
      return unsupportedCommand(nextState);
    }

    const current = nextState.variables[variableName];
    if (current !== undefined && typeof current !== "number") {
      return {
        state: nextState,
        event: {
          type: "error",
          code: "state_add_non_number",
          message: `Cannot add to "${variableName}" because the current value is not a number.`,
        },
      };
    }

    const value = (current ?? 0) + by;
    return {
      state: {
        ...nextState,
        variables: {
          ...nextState.variables,
          [variableName]: value,
        },
      },
      event: { type: "state", command: "add", name: variableName, value },
    };
  }

  if (name === "set") {
    const variableName = getNamedString(args, "name");
    const value = getNamedRuntimeValue(args, "value");
    if (variableName === undefined || value === undefined) {
      return unsupportedCommand(nextState);
    }
    return {
      state: {
        ...nextState,
        variables: {
          ...nextState.variables,
          [variableName]: value,
        },
      },
      event: { type: "state", command: "set", name: variableName, value },
    };
  }

  if (name === "inc" || name === "dec") {
    const variableName = getNamedString(args, "name");
    const by = getNamedNumber(args, "by");
    if (variableName === undefined || by === undefined) {
      return unsupportedCommand(nextState);
    }
    const current = nextState.variables[variableName];
    const currentNumber = typeof current === "number" ? current : 0;
    const value = name === "inc" ? currentNumber + by : currentNumber - by;
    return {
      state: {
        ...nextState,
        variables: {
          ...nextState.variables,
          [variableName]: value,
        },
      },
      event: { type: "state", command: name, name: variableName, value },
    };
  }

  if (name === "flag" || name === "unflag") {
    const flagName = getPositionalString(args, 0);
    if (flagName === undefined) {
      return unsupportedCommand(nextState);
    }
    const value = name === "flag";
    return {
      state: {
        ...nextState,
        flags: {
          ...nextState.flags,
          [flagName]: value,
        },
      },
      event: { type: "state", command: name, name: flagName, value },
    };
  }

  if (!isCoreCommandName(name)) {
    const handler = options.commandHandlers?.[name];
    if (handler !== undefined) {
      return handler(nextState, instruction, {
        warn: (code, message) => {
          options.onDiagnostic?.({ severity: "warning", code, message });
        },
      });
    }
  }

  return unsupportedCommand(nextState);
}

function unsupportedCommand(state: RuntimeState): RuntimeStepResult {
  return unsupportedInstruction(state, "CommandInstruction");
}

export function unsupportedInstruction(state: RuntimeState, instructionType: string): RuntimeStepResult {
  return {
    state,
    event: { type: "unsupported", instructionType },
  };
}
