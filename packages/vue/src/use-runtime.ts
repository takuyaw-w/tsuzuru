import {
  clearClickWait,
  clearWait,
  createInitialRuntimeState,
  createRuntimeSnapshot,
  getRuntimeBlockReason,
  isRuntimeBlocked,
  type RuntimeBlockReason,
  type RuntimeDocument,
  type RuntimeEvent,
  type RuntimeInitialStateOptions,
  type RuntimeSnapshot,
  type RuntimeState,
  type RuntimeStepOptions,
  resolveChoice,
  restoreRuntimeState,
  stepRuntime,
} from "@tsuzuru/core";
import {
  type ComputedRef,
  computed,
  type DeepReadonly,
  getCurrentInstance,
  getCurrentScope,
  onScopeDispose,
  onUnmounted,
  readonly,
  ref,
  type ShallowRef,
  shallowRef,
  type WatchStopHandle,
  watch,
} from "vue";
import { createRuntimeSaveDataFromState, type RuntimeSaveData, restoreRuntimeSnapshotForView } from "./runtime-save.js";

export interface UseRuntimeOptions {
  readonly plugins?: RuntimeInitialStateOptions["plugins"];
  readonly commandHandlers?: RuntimeStepOptions["commandHandlers"];
  readonly onDiagnostic?: RuntimeStepOptions["onDiagnostic"];
  readonly autoStart?: boolean;
  readonly autoClearWait?: boolean;
  readonly autoStepTransientEvents?: boolean;
  readonly autoStepMaxSteps?: number;
}

export interface UseRuntimeResult {
  readonly state: DeepReadonly<ShallowRef<RuntimeState>>;
  readonly event: DeepReadonly<ShallowRef<RuntimeEvent | null>>;
  readonly visibleEvent: DeepReadonly<ShallowRef<RuntimeEvent | null>>;
  readonly step: () => void;
  readonly continueClick: () => void;
  readonly choose: (itemIndex: number) => void;
  readonly reset: () => void;
  readonly destroy: () => void;
  readonly createSnapshot: () => RuntimeSnapshot;
  readonly restoreSnapshot: (snapshot: RuntimeSnapshot) => void;
  readonly createSaveData: () => RuntimeSaveData;
  readonly restoreSaveData: (saveData: RuntimeSaveData) => void;
  readonly blockReason: ComputedRef<RuntimeBlockReason | null>;
  readonly isBlocked: ComputedRef<boolean>;
  readonly autoStepError: DeepReadonly<ShallowRef<string | null>>;
}

export function useRuntime(document: RuntimeDocument, options: UseRuntimeOptions = {}): UseRuntimeResult {
  const plugins = shallowRef(options.plugins);
  const state = shallowRef<RuntimeState>(createInitialState(document, options.plugins));
  const event = shallowRef<RuntimeEvent | null>(null);
  const visibleEvent = shallowRef<RuntimeEvent | null>(null);
  const hasAutoStarted = ref(false);
  const autoStepCount = ref(0);
  const autoStepError = shallowRef<string | null>(null);
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const stopHandles: WatchStopHandle[] = [];
  let destroyed = false;

  const autoStart = options.autoStart ?? false;
  const autoClearWait = options.autoClearWait ?? true;
  const autoStepTransientEvents = options.autoStepTransientEvents ?? false;
  const autoStepMaxSteps = options.autoStepMaxSteps ?? 1000;

  function getStepOptions(): RuntimeStepOptions {
    return {
      ...(options.commandHandlers === undefined ? {} : { commandHandlers: options.commandHandlers }),
      ...(options.onDiagnostic === undefined ? {} : { onDiagnostic: options.onDiagnostic }),
    };
  }

  function schedule(callback: () => void, delayMs: number): ReturnType<typeof setTimeout> {
    const timer = setTimeout(() => {
      timers.delete(timer);
      callback();
    }, delayMs);
    timers.add(timer);
    return timer;
  }

  function clearScheduled(timer: ReturnType<typeof setTimeout>): void {
    clearTimeout(timer);
    timers.delete(timer);
  }

  function resetAutoStep(): void {
    autoStepCount.value = 0;
    autoStepError.value = null;
  }

  function applyStepResult(result: ReturnType<typeof stepRuntime>): void {
    state.value = result.state;
    event.value = result.event;
    const nextVisibleEvent = getRenderableRuntimeEvent(result.event);
    if (nextVisibleEvent !== null) {
      visibleEvent.value = nextVisibleEvent;
    }
  }

  function stepFrom(nextState: RuntimeState): void {
    applyStepResult(stepRuntime(document, nextState, getStepOptions()));
  }

  function step(): void {
    resetAutoStep();
    if (isRuntimeBlocked(state.value) || state.value.isStopped) {
      return;
    }

    stepFrom(state.value);
  }

  function continueClick(): void {
    resetAutoStep();
    if (getRuntimeBlockReason(state.value) !== "click") {
      return;
    }

    stepFrom(clearClickWait(state.value));
  }

  function choose(itemIndex: number): void {
    resetAutoStep();
    if (state.value.pendingChoice === null) {
      return;
    }

    const resolved = resolveChoice(document, state.value, itemIndex);
    if (resolved.event.type === "error") {
      state.value = resolved.state;
      event.value = resolved.event;
      visibleEvent.value = resolved.event;
      return;
    }

    stepFrom(resolved.state);
  }

  function reset(): void {
    state.value = createInitialState(document, plugins.value);
    event.value = null;
    visibleEvent.value = null;
    hasAutoStarted.value = false;
    resetAutoStep();
  }

  function createSnapshot(): RuntimeSnapshot {
    return createRuntimeSnapshot(state.value);
  }

  function restoreSnapshot(snapshot: RuntimeSnapshot): void {
    const result = restoreRuntimeSnapshotForView(document, snapshot, getStepOptions());
    state.value = result.state;
    event.value = result.event;
    visibleEvent.value = result.event === null ? null : getRenderableRuntimeEvent(result.event);
    resetAutoStep();
  }

  function createSaveData(): RuntimeSaveData {
    return createRuntimeSaveDataFromState(state.value, visibleEvent.value);
  }

  function restoreSaveData(saveData: RuntimeSaveData): void {
    state.value = restoreRuntimeState(saveData.snapshot);
    event.value = saveData.event;
    visibleEvent.value = saveData.event;
    resetAutoStep();
  }

  function destroy(): void {
    if (destroyed) {
      return;
    }

    destroyed = true;
    for (const stop of stopHandles.splice(0)) {
      stop();
    }
    for (const timer of timers) {
      clearTimeout(timer);
    }
    timers.clear();
  }

  stopHandles.push(
    watch(
      [state, event, visibleEvent],
      () => {
        if (
          !autoStart ||
          hasAutoStarted.value ||
          event.value !== null ||
          visibleEvent.value !== null ||
          isRuntimeBlocked(state.value) ||
          state.value.isStopped
        ) {
          return;
        }

        hasAutoStarted.value = true;
        step();
      },
      { immediate: true },
    ),
  );

  stopHandles.push(
    watch(
      [event, state],
      (_value, _oldValue, onCleanup) => {
        const waitDurationMs = getAutoClearWaitDuration(event.value, state.value, autoClearWait);
        if (waitDurationMs === null) {
          return;
        }

        const timer = schedule(() => {
          stepFrom(clearWait(state.value));
        }, waitDurationMs);
        onCleanup(() => clearScheduled(timer));
      },
      { immediate: true },
    ),
  );

  stopHandles.push(
    watch(
      [autoStepCount, event, state],
      (_value, _oldValue, onCleanup) => {
        if (
          !autoStepTransientEvents ||
          event.value === null ||
          !isAutoSteppableRuntimeEvent(event.value) ||
          isRuntimeBlocked(state.value) ||
          state.value.isStopped
        ) {
          return;
        }

        if (autoStepCount.value >= autoStepMaxSteps) {
          autoStepError.value = `Auto-step stopped after ${autoStepMaxSteps} consecutive runtime events.`;
          return;
        }

        const timer = schedule(() => {
          autoStepCount.value += 1;
          stepFrom(state.value);
        }, 0);
        onCleanup(() => clearScheduled(timer));
      },
      { immediate: true },
    ),
  );

  stopHandles.push(
    watch(event, () => {
      if (event.value === null || isAutoSteppableRuntimeEvent(event.value)) {
        return;
      }

      resetAutoStep();
    }),
  );

  if (getCurrentInstance() !== null) {
    onUnmounted(destroy);
  } else if (getCurrentScope() !== undefined) {
    onScopeDispose(destroy);
  }

  const blockReason = computed(() => getRuntimeBlockReason(state.value));
  const blocked = computed(() => blockReason.value !== null);

  return {
    state: readonly(state),
    event: readonly(event),
    visibleEvent: readonly(visibleEvent),
    step,
    continueClick,
    choose,
    reset,
    destroy,
    createSnapshot,
    restoreSnapshot,
    createSaveData,
    restoreSaveData,
    blockReason,
    isBlocked: blocked,
    autoStepError: readonly(autoStepError),
  };
}

export const useTsuzuruRuntime = useRuntime;

export function isAutoSteppableRuntimeEvent(event: RuntimeEvent): boolean {
  switch (event.type) {
    case "scene":
    case "state":
    case "jump":
    case "choiceResolve":
      return true;
    case "if":
      return event.event === undefined || isAutoSteppableRuntimeEvent(event.event);
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
    case "state":
    case "jump":
    case "choiceResolve":
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

function createInitialState(document: RuntimeDocument, plugins: RuntimeInitialStateOptions["plugins"]): RuntimeState {
  return createInitialRuntimeState(document, plugins === undefined ? {} : { plugins });
}

/**
 * @deprecated Use isAutoSteppableRuntimeEvent instead.
 */
export function isTransientRuntimeEvent(event: RuntimeEvent): boolean {
  return isAutoSteppableRuntimeEvent(event);
}
