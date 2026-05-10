import {
  clearWait,
  createInitialRuntimeState,
  getRuntimeBlockReason,
  isRuntimeBlocked,
  type RuntimeBlockReason,
  type RuntimeDocument,
  type RuntimeEvent,
  type RuntimeInitialStateOptions,
  type RuntimeState,
  type RuntimeStepOptions,
  resolveChoice,
  stepRuntime,
} from "@tsuzuru/core";

export interface TsuzuruHtmlRuntimeControllerOptions {
  readonly plugins?: RuntimeInitialStateOptions["plugins"];
  readonly commandHandlers?: RuntimeStepOptions["commandHandlers"];
  readonly onDiagnostic?: RuntimeStepOptions["onDiagnostic"];
  readonly autoClearWait?: boolean;
  readonly autoStepTransientEvents?: boolean;
  readonly autoStepMaxSteps?: number;
  readonly setTimeout?: TsuzuruHtmlSetTimeout;
  readonly clearTimeout?: TsuzuruHtmlClearTimeout;
}

export type TsuzuruHtmlSetTimeout = (handler: () => void, timeoutMs: number) => unknown;

export type TsuzuruHtmlClearTimeout = (timerId: unknown) => void;

export interface TsuzuruHtmlRuntimeController {
  readonly step: () => void;
  readonly choose: (itemIndex: number) => void;
  readonly reset: () => void;
  readonly destroy: () => void;
  readonly getState: () => RuntimeState;
  readonly getEvent: () => RuntimeEvent | null;
  readonly getVisibleEvent: () => RuntimeEvent | null;
  readonly getBlockReason: () => RuntimeBlockReason | null;
  readonly isBlocked: () => boolean;
  readonly isDestroyed: () => boolean;
  readonly getAutoStepError: () => string | null;
}

export function createTsuzuruHtmlRuntimeController(
  document: RuntimeDocument,
  options: TsuzuruHtmlRuntimeControllerOptions = {},
): TsuzuruHtmlRuntimeController {
  return new RuntimeController(document, options);
}

export function getTsuzuruHtmlVisibleRuntimeEvent(event: RuntimeEvent | null): RuntimeEvent | null {
  if (event === null) {
    return null;
  }

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
      return event.event === undefined ? null : getTsuzuruHtmlVisibleRuntimeEvent(event.event);
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

export function isTsuzuruHtmlAutoSteppableRuntimeEvent(event: RuntimeEvent): boolean {
  switch (event.type) {
    case "scene":
    case "state":
    case "jump":
    case "choiceResolve":
      return true;
    case "if":
      return event.event === undefined || isTsuzuruHtmlAutoSteppableRuntimeEvent(event.event);
    case "pluginCommand":
      // Plugin commands are currently non-blocking in core. A future plugin
      // blocking contract should be routed through this branch.
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

class RuntimeController implements TsuzuruHtmlRuntimeController {
  private state: RuntimeState;
  private event: RuntimeEvent | null = null;
  private visibleEvent: RuntimeEvent | null = null;
  private destroyed = false;
  private waitTimer: unknown | null = null;
  private autoStepError: string | null = null;

  public constructor(
    private readonly document: RuntimeDocument,
    private readonly options: TsuzuruHtmlRuntimeControllerOptions,
  ) {
    this.state = createInitialState(document, options.plugins);
  }

  public step(): void {
    if (this.destroyed || isRuntimeBlocked(this.state) || this.state.isStopped) {
      return;
    }

    this.clearWaitTimer();
    this.autoStepError = null;
    this.stepFrom(this.state);
  }

  public choose(itemIndex: number): void {
    if (this.destroyed || this.state.pendingChoice === null) {
      return;
    }

    this.clearWaitTimer();
    this.autoStepError = null;
    const resolved = resolveChoice(this.document, this.state, itemIndex);

    if (resolved.event.type === "error") {
      this.applyStepResult(resolved);
      return;
    }

    this.stepFrom(resolved.state);
  }

  public reset(): void {
    if (this.destroyed) {
      return;
    }

    this.clearWaitTimer();
    this.state = createInitialState(this.document, this.options.plugins);
    this.event = null;
    this.visibleEvent = null;
    this.autoStepError = null;
  }

  public destroy(): void {
    if (this.destroyed) {
      return;
    }

    this.clearWaitTimer();
    this.destroyed = true;
  }

  public getState(): RuntimeState {
    return this.state;
  }

  public getEvent(): RuntimeEvent | null {
    return this.event;
  }

  public getVisibleEvent(): RuntimeEvent | null {
    return this.visibleEvent;
  }

  public getBlockReason(): RuntimeBlockReason | null {
    return getRuntimeBlockReason(this.state);
  }

  public isBlocked(): boolean {
    return this.getBlockReason() !== null;
  }

  public isDestroyed(): boolean {
    return this.destroyed;
  }

  public getAutoStepError(): string | null {
    return this.autoStepError;
  }

  private stepFrom(nextState: RuntimeState): void {
    if (this.destroyed) {
      return;
    }

    this.applyStepResult(stepRuntime(this.document, nextState, this.createStepOptions()));
    this.drainAutoSteppableEvents();
    this.scheduleAutoClearWait();
  }

  private applyStepResult(result: { readonly state: RuntimeState; readonly event: RuntimeEvent }): void {
    this.state = result.state;
    this.event = result.event;

    const nextVisibleEvent = getTsuzuruHtmlVisibleRuntimeEvent(result.event);
    if (nextVisibleEvent !== null) {
      this.visibleEvent = nextVisibleEvent;
    }
  }

  private drainAutoSteppableEvents(): void {
    if (this.options.autoStepTransientEvents !== true) {
      return;
    }

    const maxSteps = this.options.autoStepMaxSteps ?? 1000;
    let count = 0;

    while (
      this.event !== null &&
      isTsuzuruHtmlAutoSteppableRuntimeEvent(this.event) &&
      !isRuntimeBlocked(this.state) &&
      !this.state.isStopped
    ) {
      if (count >= maxSteps) {
        this.autoStepError = `Auto-step stopped after ${maxSteps} consecutive runtime events.`;
        return;
      }

      count += 1;
      this.applyStepResult(stepRuntime(this.document, this.state, this.createStepOptions()));
    }

    this.autoStepError = null;
  }

  private scheduleAutoClearWait(): void {
    this.clearWaitTimer();

    if (this.options.autoClearWait === false || this.event === null || this.state.pendingWait === null) {
      return;
    }

    const visibleEvent = getTsuzuruHtmlVisibleRuntimeEvent(this.event);
    if (visibleEvent?.type !== "wait") {
      return;
    }

    this.waitTimer = this.getSetTimeout()(() => {
      this.waitTimer = null;
      if (this.destroyed) {
        return;
      }
      this.stepFrom(clearWait(this.state));
    }, this.state.pendingWait.durationMs);
  }

  private clearWaitTimer(): void {
    if (this.waitTimer === null) {
      return;
    }

    this.getClearTimeout()(this.waitTimer);
    this.waitTimer = null;
  }

  private createStepOptions(): RuntimeStepOptions {
    return {
      ...(this.options.commandHandlers === undefined ? {} : { commandHandlers: this.options.commandHandlers }),
      ...(this.options.onDiagnostic === undefined ? {} : { onDiagnostic: this.options.onDiagnostic }),
    };
  }

  private getSetTimeout(): TsuzuruHtmlSetTimeout {
    return this.options.setTimeout ?? globalThis.setTimeout.bind(globalThis);
  }

  private getClearTimeout(): TsuzuruHtmlClearTimeout {
    return (
      this.options.clearTimeout ??
      ((timerId: unknown) => {
        globalThis.clearTimeout(timerId as ReturnType<typeof globalThis.setTimeout>);
      })
    );
  }
}

function createInitialState(document: RuntimeDocument, plugins: RuntimeInitialStateOptions["plugins"]): RuntimeState {
  return createInitialRuntimeState(document, plugins === undefined ? {} : { plugins });
}

function assertNever(value: never): never {
  throw new Error(`Unhandled runtime event: ${JSON.stringify(value)}`);
}
