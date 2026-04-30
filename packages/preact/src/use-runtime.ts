import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import {
  clearClickWait,
  clearWait,
  createInitialRuntimeState,
  createRuntimeSnapshot,
  getRuntimeBlockReason,
  isRuntimeBlocked,
  resolveChoice,
  restoreRuntimeState,
  stepRuntime,
  type CompiledTzrDocument,
  type RuntimeBlockReason,
  type RuntimeEvent,
  type RuntimeSnapshot,
  type RuntimeState,
  type RuntimeStepOptions,
} from "@tsuzuru/core";

export interface UseRuntimeOptions {
  readonly commandHandlers?: RuntimeStepOptions["commandHandlers"];
  readonly autoClearWait?: boolean;
  readonly autoStepTransientEvents?: boolean;
  readonly autoStepMaxSteps?: number;
}

export interface UseRuntimeResult {
  readonly state: RuntimeState;
  readonly event: RuntimeEvent | null;
  readonly step: () => void;
  readonly continueClick: () => void;
  readonly choose: (itemIndex: number) => void;
  readonly reset: () => void;
  readonly createSnapshot: () => RuntimeSnapshot;
  readonly restoreSnapshot: (snapshot: RuntimeSnapshot) => void;
  readonly blockReason: RuntimeBlockReason | null;
  readonly isBlocked: boolean;
  readonly autoStepError: string | null;
}

export function useRuntime(document: CompiledTzrDocument, options: UseRuntimeOptions = {}): UseRuntimeResult {
  const [state, setState] = useState<RuntimeState>(() => createInitialRuntimeState(document));
  const [event, setEvent] = useState<RuntimeEvent | null>(null);
  const autoClearWait = options.autoClearWait ?? true;
  const autoStepTransientEvents = options.autoStepTransientEvents ?? false;
  const autoStepMaxSteps = options.autoStepMaxSteps ?? 1000;
  const commandHandlers = options.commandHandlers;
  const [autoStepCount, setAutoStepCount] = useState(0);
  const [autoStepError, setAutoStepError] = useState<string | null>(null);

  const stepOptions = useMemo<RuntimeStepOptions>(
    () => (commandHandlers === undefined ? {} : { commandHandlers }),
    [commandHandlers],
  );

  const stepFrom = useCallback(
    (nextState: RuntimeState) => {
      const result = stepRuntime(document, nextState, stepOptions);
      setState(result.state);
      setEvent(result.event);
    },
    [document, stepOptions],
  );

  const step = useCallback(() => {
    setAutoStepCount(0);
    setAutoStepError(null);
    setState((currentState) => {
      if (isRuntimeBlocked(currentState) || currentState.isStopped) {
        return currentState;
      }

      const result = stepRuntime(document, currentState, stepOptions);
      setEvent(result.event);
      return result.state;
    });
  }, [document, stepOptions]);

  const continueClick = useCallback(() => {
    setAutoStepCount(0);
    setAutoStepError(null);
    setState((currentState) => {
      if (getRuntimeBlockReason(currentState) !== "click") {
        return currentState;
      }

      const result = stepRuntime(document, clearClickWait(currentState), stepOptions);
      setEvent(result.event);
      return result.state;
    });
  }, [document, stepOptions]);

  const choose = useCallback(
    (itemIndex: number) => {
      setAutoStepCount(0);
      setAutoStepError(null);
      setState((currentState) => {
        if (currentState.pendingChoice === null) {
          return currentState;
        }

        const resolved = resolveChoice(document, currentState, itemIndex);
        const result = stepRuntime(document, resolved.state, stepOptions);
        setEvent(result.event);
        return result.state;
      });
    },
    [document, stepOptions],
  );

  const reset = useCallback(() => {
    const initialState = createInitialRuntimeState(document);
    setState(initialState);
    setEvent(null);
    setAutoStepCount(0);
    setAutoStepError(null);
  }, [document]);

  const createSnapshot = useCallback(() => createRuntimeSnapshot(state), [state]);

  const restoreSnapshot = useCallback((snapshot: RuntimeSnapshot) => {
    setState(restoreRuntimeState(snapshot));
    setEvent(null);
    setAutoStepCount(0);
    setAutoStepError(null);
  }, []);

  useEffect(() => {
    reset();
  }, [reset]);

  useEffect(() => {
    if (!autoClearWait || event?.type !== "wait" || state.pendingWait === null) {
      return;
    }

    const timer = window.setTimeout(() => {
      stepFrom(clearWait(state));
    }, state.pendingWait.durationMs);

    return () => window.clearTimeout(timer);
  }, [autoClearWait, event, state, stepFrom]);

  useEffect(() => {
    if (
      !autoStepTransientEvents ||
      event === null ||
      !isAutoSteppableRuntimeEvent(event) ||
      isRuntimeBlocked(state) ||
      state.isStopped
    ) {
      return;
    }

    if (autoStepCount >= autoStepMaxSteps) {
      setAutoStepError(`Auto-step stopped after ${autoStepMaxSteps} consecutive runtime events.`);
      return;
    }

    const timer = window.setTimeout(() => {
      setAutoStepCount((currentCount) => currentCount + 1);
      stepFrom(state);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [autoStepCount, autoStepMaxSteps, autoStepTransientEvents, event, state, stepFrom]);

  useEffect(() => {
    if (event === null || isAutoSteppableRuntimeEvent(event)) {
      return;
    }

    setAutoStepCount(0);
    setAutoStepError(null);
  }, [event]);

  const blockReason = getRuntimeBlockReason(state);

  return {
    state,
    event,
    step,
    continueClick,
    choose,
    reset,
    createSnapshot,
    restoreSnapshot,
    blockReason,
    isBlocked: blockReason !== null,
    autoStepError,
  };
}

export function isAutoSteppableRuntimeEvent(event: RuntimeEvent): boolean {
  switch (event.type) {
    case "scene":
    case "label":
    case "state":
    case "jump":
      return true;
    case "if":
      return event.event === undefined || isAutoSteppableRuntimeEvent(event.event);
    case "pluginCommand":
      // Plugin commands are currently non-blocking. A future plugin API can add
      // explicit blocking metadata and route that decision through this branch.
      return true;
    case "narration":
    case "dialogue":
    case "choice":
    case "waitClick":
    case "page":
    case "wait":
    case "stop":
    case "end":
    case "unsupported":
      return false;
    default:
      return assertNever(event);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled runtime event: ${JSON.stringify(value)}`);
}

/**
 * @deprecated Use isAutoSteppableRuntimeEvent instead.
 */
export function isTransientRuntimeEvent(event: RuntimeEvent): boolean {
  return isAutoSteppableRuntimeEvent(event);
}
