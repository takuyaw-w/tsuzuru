import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
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
  type RuntimeInitialStateOptions,
  type RuntimeSnapshot,
  type RuntimeState,
  type RuntimeStepOptions,
} from "@tsuzuru/core";
import {
  createRuntimeSaveData,
  restoreRuntimeSnapshotForView,
  type RuntimeSaveData,
} from "./runtime-save.js";

export interface UseRuntimeOptions {
  readonly plugins?: RuntimeInitialStateOptions["plugins"];
  readonly commandHandlers?: RuntimeStepOptions["commandHandlers"];
  readonly onDiagnostic?: RuntimeStepOptions["onDiagnostic"];
  readonly autoClearWait?: boolean;
  readonly autoStepTransientEvents?: boolean;
  readonly autoStepMaxSteps?: number;
}

export interface UseRuntimeResult {
  readonly state: RuntimeState;
  readonly event: RuntimeEvent | null;
  readonly visibleEvent: RuntimeEvent | null;
  readonly step: () => void;
  readonly continueClick: () => void;
  readonly choose: (itemIndex: number) => void;
  readonly reset: () => void;
  readonly createSnapshot: () => RuntimeSnapshot;
  readonly restoreSnapshot: (snapshot: RuntimeSnapshot) => void;
  readonly createSaveData: () => RuntimeSaveData;
  readonly restoreSaveData: (saveData: RuntimeSaveData) => void;
  readonly blockReason: RuntimeBlockReason | null;
  readonly isBlocked: boolean;
  readonly autoStepError: string | null;
}

export function useRuntime(document: CompiledTzrDocument, options: UseRuntimeOptions = {}): UseRuntimeResult {
  const pluginsRef = useRef(options.plugins);
  pluginsRef.current = options.plugins;
  const [state, setState] = useState<RuntimeState>(() => createInitialState(document, options.plugins));
  const [event, setEvent] = useState<RuntimeEvent | null>(null);
  const [visibleEvent, setVisibleEvent] = useState<RuntimeEvent | null>(null);
  const autoClearWait = options.autoClearWait ?? true;
  const autoStepTransientEvents = options.autoStepTransientEvents ?? false;
  const autoStepMaxSteps = options.autoStepMaxSteps ?? 1000;
  const commandHandlers = options.commandHandlers;
  const onDiagnostic = options.onDiagnostic;
  const [autoStepCount, setAutoStepCount] = useState(0);
  const [autoStepError, setAutoStepError] = useState<string | null>(null);

  const stepOptions = useMemo<RuntimeStepOptions>(
    () => ({
      ...(commandHandlers === undefined ? {} : { commandHandlers }),
      ...(onDiagnostic === undefined ? {} : { onDiagnostic }),
    }),
    [commandHandlers, onDiagnostic],
  );

  const stepFrom = useCallback(
    (nextState: RuntimeState) => {
      const result = stepRuntime(document, nextState, stepOptions);
      setState(result.state);
      setEvent(result.event);
      const nextVisibleEvent = getRenderableRuntimeEvent(result.event);
      if (nextVisibleEvent !== null) {
        setVisibleEvent(nextVisibleEvent);
      }
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
      const nextVisibleEvent = getRenderableRuntimeEvent(result.event);
      if (nextVisibleEvent !== null) {
        setVisibleEvent(nextVisibleEvent);
      }
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
      const nextVisibleEvent = getRenderableRuntimeEvent(result.event);
      if (nextVisibleEvent !== null) {
        setVisibleEvent(nextVisibleEvent);
      }
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
        if (resolved.event.type === "error") {
          setEvent(resolved.event);
          setVisibleEvent(resolved.event);
          return resolved.state;
        }

        const result = stepRuntime(document, resolved.state, stepOptions);
        setEvent(result.event);
        const nextVisibleEvent = getRenderableRuntimeEvent(result.event);
        if (nextVisibleEvent !== null) {
          setVisibleEvent(nextVisibleEvent);
        }
        return result.state;
      });
    },
    [document, stepOptions],
  );

  const reset = useCallback(() => {
    const initialState = createInitialState(document, pluginsRef.current);
    setState(initialState);
    setEvent(null);
    setVisibleEvent(null);
    setAutoStepCount(0);
    setAutoStepError(null);
  }, [document, pluginsRef]);

  const createSnapshot = useCallback(() => createRuntimeSnapshot(state), [state]);

  const restoreSnapshot = useCallback((snapshot: RuntimeSnapshot) => {
    const result = restoreRuntimeSnapshotForView(document, snapshot, stepOptions);
    setState(result.state);
    setEvent(result.event);
    setVisibleEvent(result.event === null ? null : getRenderableRuntimeEvent(result.event));
    setAutoStepCount(0);
    setAutoStepError(null);
  }, [document, stepOptions]);

  const createSaveData = useCallback(
    () => createRuntimeSaveData(createRuntimeSnapshot(state), visibleEvent),
    [state, visibleEvent],
  );

  const restoreSaveData = useCallback((saveData: RuntimeSaveData) => {
    setState(restoreRuntimeState(saveData.snapshot));
    setEvent(saveData.event);
    setVisibleEvent(saveData.event);
    setAutoStepCount(0);
    setAutoStepError(null);
  }, []);

  useEffect(() => {
    reset();
  }, [reset]);

  useEffect(() => {
    const waitDurationMs = getAutoClearWaitDuration(event, state, autoClearWait);
    if (waitDurationMs === null) {
      return;
    }

    const timer = window.setTimeout(() => {
      stepFrom(clearWait(state));
    }, waitDurationMs);

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
    visibleEvent,
    step,
    continueClick,
    choose,
    reset,
    createSnapshot,
    restoreSnapshot,
    createSaveData,
    restoreSaveData,
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
    case "error":
      return false;
    default:
      return assertNever(event);
  }
}

export function isRenderableRuntimeEvent(event: RuntimeEvent): boolean {
  return getRenderableRuntimeEvent(event) !== null;
}

export function getRenderableRuntimeEvent(event: RuntimeEvent): RuntimeEvent | null {
  switch (event.type) {
    case "narration":
    case "dialogue":
    case "choice":
    case "waitClick":
    case "page":
    case "wait":
    case "stop":
    case "end":
    case "unsupported":
    case "error":
      return event;
    case "if":
      return event.event === undefined ? null : getRenderableRuntimeEvent(event.event);
    case "scene":
    case "label":
    case "state":
    case "jump":
    case "pluginCommand":
      return null;
    default:
      return assertNever(event);
  }
}

export function getAutoClearWaitDuration(
  event: RuntimeEvent | null,
  state: RuntimeState,
  autoClearWait: boolean,
): number | null {
  if (!autoClearWait || event === null || state.pendingWait === null) {
    return null;
  }

  const renderableEvent = getRenderableRuntimeEvent(event);
  return renderableEvent?.type === "wait" ? state.pendingWait.durationMs : null;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled runtime event: ${JSON.stringify(value)}`);
}

function createInitialState(
  document: CompiledTzrDocument,
  plugins: RuntimeInitialStateOptions["plugins"],
): RuntimeState {
  return createInitialRuntimeState(document, plugins === undefined ? {} : { plugins });
}

/**
 * @deprecated Use isAutoSteppableRuntimeEvent instead.
 */
export function isTransientRuntimeEvent(event: RuntimeEvent): boolean {
  return isAutoSteppableRuntimeEvent(event);
}
