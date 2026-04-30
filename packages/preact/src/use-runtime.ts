import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import {
  clearClickWait,
  clearWait,
  createInitialRuntimeState,
  getRuntimeBlockReason,
  isRuntimeBlocked,
  resolveChoice,
  stepRuntime,
  type CompiledTzrDocument,
  type RuntimeBlockReason,
  type RuntimeEvent,
  type RuntimeState,
  type RuntimeStepOptions,
} from "@tsuzuru/core";

export interface UseRuntimeOptions {
  readonly commandHandlers?: RuntimeStepOptions["commandHandlers"];
  readonly autoClearWait?: boolean;
  readonly autoStepTransientEvents?: boolean;
}

export interface UseRuntimeResult {
  readonly state: RuntimeState;
  readonly event: RuntimeEvent | null;
  readonly step: () => void;
  readonly continueClick: () => void;
  readonly choose: (itemIndex: number) => void;
  readonly reset: () => void;
  readonly blockReason: RuntimeBlockReason | null;
  readonly isBlocked: boolean;
}

export function useRuntime(document: CompiledTzrDocument, options: UseRuntimeOptions = {}): UseRuntimeResult {
  const [state, setState] = useState<RuntimeState>(() => createInitialRuntimeState(document));
  const [event, setEvent] = useState<RuntimeEvent | null>(null);
  const autoClearWait = options.autoClearWait ?? true;
  const autoStepTransientEvents = options.autoStepTransientEvents ?? false;
  const commandHandlers = options.commandHandlers;

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
  }, [document]);

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
      !isTransientRuntimeEvent(event) ||
      isRuntimeBlocked(state) ||
      state.isStopped
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      stepFrom(state);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [autoStepTransientEvents, event, state, stepFrom]);

  const blockReason = getRuntimeBlockReason(state);

  return {
    state,
    event,
    step,
    continueClick,
    choose,
    reset,
    blockReason,
    isBlocked: blockReason !== null,
  };
}

export function isTransientRuntimeEvent(event: RuntimeEvent): boolean {
  switch (event.type) {
    case "scene":
    case "label":
    case "state":
    case "jump":
    case "if":
    case "pluginCommand":
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
  }
}
