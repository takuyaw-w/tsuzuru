import {
  compileTzrProject,
  type Diagnostic,
  type RuntimeDiagnostic,
  type RuntimeDocument,
  type RuntimePluginDefinition,
  type TzrCompileProjectInput,
  type TzrCompileProjectResult,
} from "@tsuzuru/core";
import { createStdAudioCommandHandlers, createStdAudioPlugin, getStdAudioState } from "@tsuzuru/plugin-std-audio";
import { createStdEffectCommandHandlers, createStdEffectPlugin, getStdEffectState } from "@tsuzuru/plugin-std-effect";
import { createStdVisualCommandHandlers, createStdVisualPlugin, getStdVisualState } from "@tsuzuru/plugin-std-visual";
import { useRuntime } from "@tsuzuru/preact";
import type { ComponentChildren, ComponentProps } from "preact";
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { TsuzuruGameAssets } from "./assets.js";
import { joinClassNames } from "./class-name.js";
import { GameShell } from "./GameShell.js";
import { GameViewport, type GameViewportAspectRatio } from "./game-viewport.js";
import { RuntimeMessageLayer } from "./RuntimeMessageLayer.js";
import {
  getRuntimeNovelTextLines,
  RuntimeNovelTextLayer,
  type RuntimeNovelTextSpeakerMode,
} from "./RuntimeNovelTextLayer.js";
import { StatusLayer } from "./StatusLayer.js";
import { StdAudioLayer, type StdAudioLayerDiagnostic } from "./std-audio-layer.js";
import { StdEffectLayer, type StdEffectLayerDiagnostic } from "./std-effect-layer.js";
import { StdVisualLayer } from "./std-visual-layer.js";
import { useTextReveal } from "./useTextReveal.js";

type DivClickHandler = NonNullable<ComponentProps<"div">["onClick"]>;
type DivStyle = Extract<NonNullable<ComponentProps<"div">["style"]>, object>;

export type TsuzuruGameScenario = RuntimeDocument | TzrCompileProjectResult;

export type TsuzuruGameDiagnostic =
  | {
      readonly source: "compile";
      readonly message: string;
      readonly filePath: string;
      readonly line: number;
      readonly column: number;
    }
  | {
      readonly source: "runtime";
      readonly severity: RuntimeDiagnostic["severity"];
      readonly code: RuntimeDiagnostic["code"];
      readonly message: RuntimeDiagnostic["message"];
    }
  | {
      readonly source: "asset";
      readonly severity: "warning";
      readonly code: string;
      readonly message: string;
    }
  | {
      readonly source: "presentation";
      readonly severity: "warning";
      readonly code: string;
      readonly message: string;
    };

export interface TsuzuruGameViewportOptions {
  readonly aspectRatio?: GameViewportAspectRatio | undefined;
  readonly maxWidth?: number | string | undefined;
  readonly className?: string | undefined;
  readonly style?: DivStyle | undefined;
}

export interface TsuzuruGameTextOptions {
  readonly reveal?: boolean | undefined;
  readonly charactersPerSecond?: number | undefined;
}

export type TsuzuruGameMessagePresentationMode = "dialogue" | "novel";

export interface TsuzuruGameMessagePresentationOptions {
  readonly mode?: TsuzuruGameMessagePresentationMode;
  readonly speakerMode?: RuntimeNovelTextSpeakerMode;
}

export interface TsuzuruGameProps {
  readonly scenario: TsuzuruGameScenario;
  readonly assets?: TsuzuruGameAssets | undefined;
  readonly className?: string | undefined;
  readonly viewport?: TsuzuruGameViewportOptions | undefined;
  readonly text?: TsuzuruGameTextOptions | undefined;
  readonly messagePresentation?: TsuzuruGameMessagePresentationMode | TsuzuruGameMessagePresentationOptions | undefined;
  readonly autoStart?: boolean | undefined;
  readonly advanceHint?: string | undefined;
  readonly continueLabel?: string | undefined;
  readonly onDiagnostics?: ((diagnostics: readonly TsuzuruGameDiagnostic[]) => void) | undefined;
}

interface TsuzuruGameRuntimeProps extends Omit<TsuzuruGameProps, "scenario"> {
  readonly document: RuntimeDocument;
}

interface LineRange {
  readonly start: number;
  readonly end: number;
}

const STARTER_PLUGINS: readonly RuntimePluginDefinition[] = [
  createStdVisualPlugin(),
  createStdAudioPlugin(),
  createStdEffectPlugin(),
];

export function defineTsuzuruGameScenario(input: TzrCompileProjectInput): TzrCompileProjectResult {
  return compileTzrProject(input, {
    plugins: STARTER_PLUGINS,
  });
}

export function TsuzuruGame({
  scenario,
  assets,
  className,
  viewport,
  text,
  messagePresentation,
  autoStart,
  advanceHint,
  continueLabel,
  onDiagnostics,
}: TsuzuruGameProps): ComponentChildren {
  if (isCompileResult(scenario) && !scenario.ok) {
    const diagnostics = scenario.errors.map(toCompileDiagnostic);
    return (
      <TsuzuruGameFrame className={className} viewport={viewport}>
        <StatusLayer label={formatCompileDiagnostics(scenario.errors)} />
        <DiagnosticsList diagnostics={diagnostics} onDiagnostics={onDiagnostics} />
      </TsuzuruGameFrame>
    );
  }

  const document = isCompileResult(scenario) ? scenario.document : scenario;
  return (
    <TsuzuruGameRuntime
      document={document}
      {...{
        assets,
        className,
        viewport,
        text,
        messagePresentation,
        autoStart,
        advanceHint,
        continueLabel,
        onDiagnostics,
      }}
    />
  );
}

function TsuzuruGameRuntime({
  document,
  assets,
  className,
  viewport,
  text,
  messagePresentation,
  autoStart = true,
  advanceHint = "Click to continue",
  continueLabel,
  onDiagnostics,
}: TsuzuruGameRuntimeProps): ComponentChildren {
  const plugins = useMemo(() => STARTER_PLUGINS, []);
  const commandHandlers = useMemo(
    () => ({
      ...createStdVisualCommandHandlers(),
      ...createStdAudioCommandHandlers(),
      ...createStdEffectCommandHandlers(),
    }),
    [],
  );
  const [diagnostics, setDiagnostics] = useState<readonly TsuzuruGameDiagnostic[]>([]);
  const assetDiagnosticKeysRef = useRef<Set<string>>(new Set());
  const presentationDiagnosticKeysRef = useRef<Set<string>>(new Set());
  const recordDiagnostic = useCallback((diagnostic: TsuzuruGameDiagnostic) => {
    setDiagnostics((current) => [...current, diagnostic]);
  }, []);
  const recordRuntimeDiagnostic = useCallback(
    (diagnostic: RuntimeDiagnostic) => {
      recordDiagnostic({
        source: "runtime",
        severity: diagnostic.severity,
        code: diagnostic.code,
        message: diagnostic.message,
      });
    },
    [recordDiagnostic],
  );
  const recordAssetDiagnostic = useCallback(
    (diagnostic: StdAudioLayerDiagnostic) => {
      const key = `${diagnostic.code}:${diagnostic.channel}:${diagnostic.assetId}`;
      if (assetDiagnosticKeysRef.current.has(key)) {
        return;
      }
      assetDiagnosticKeysRef.current.add(key);
      recordDiagnostic({
        source: "asset",
        severity: "warning",
        code: key,
        message: diagnostic.message,
      });
    },
    [recordDiagnostic],
  );
  const recordPresentationDiagnostic = useCallback(
    (diagnostic: StdEffectLayerDiagnostic) => {
      const key = `${diagnostic.code}:${diagnostic.event.sequence}:${diagnostic.event.type}`;
      if (presentationDiagnosticKeysRef.current.has(key)) {
        return;
      }
      presentationDiagnosticKeysRef.current.add(key);
      recordDiagnostic({
        source: "presentation",
        severity: "warning",
        code: diagnostic.code,
        message: diagnostic.message,
      });
    },
    [recordDiagnostic],
  );
  const runtime = useRuntime(document, {
    plugins,
    commandHandlers,
    onDiagnostic: recordRuntimeDiagnostic,
    autoStart,
    autoClearWait: true,
    autoStepTransientEvents: true,
  });
  const presentation = useMemo(() => resolveMessagePresentation(messagePresentation), [messagePresentation]);
  const visualState = getStdVisualState(runtime.state);
  const audioState = getStdAudioState(runtime.state);
  const effectState = getStdEffectState(runtime.state);
  const visibleEvent = runtime.visibleEvent;
  const presentationKey = useVisibleEventPresentationKey(visibleEvent);
  const messageLines = useMemo(() => getMessageLines(visibleEvent, presentation), [visibleEvent, presentation]);
  const revealText = messageLines?.join("\n") ?? "";
  const lineRanges = useMemo(() => (messageLines === null ? [] : buildLineRanges(messageLines)), [messageLines]);
  const textReveal = useTextReveal(revealText, {
    enabled: messageLines !== null && (text?.reveal ?? true),
    resetKey: presentationKey,
    ...(text?.charactersPerSecond === undefined ? {} : { charactersPerSecond: text.charactersPerSecond }),
  });
  const canAdvanceText =
    visibleEvent !== null &&
    messageLines !== null &&
    textReveal.isComplete &&
    runtime.blockReason === null &&
    !runtime.state.isStopped;
  const handleAdvanceRequest = useCallback(() => {
    if (visibleEvent?.type === "choice") {
      return;
    }
    if (messageLines !== null && textReveal.isRevealing) {
      textReveal.revealAll();
      return;
    }
    if (runtime.blockReason === "click") {
      runtime.continueClick();
      return;
    }
    if (runtime.blockReason === null && !runtime.state.isStopped) {
      runtime.step();
    }
  }, [messageLines, runtime, textReveal, visibleEvent]);
  const renderMessageLine = useCallback(
    ({ line, lineIndex }: { readonly line: string; readonly lineIndex: number }) => {
      const range = lineRanges[lineIndex];
      if (range === undefined) {
        return line;
      }
      return (
        <span>{textReveal.visibleText.slice(range.start, Math.min(range.end, textReveal.visibleText.length))}</span>
      );
    },
    [lineRanges, textReveal.visibleText],
  );
  const handleSurfaceClick = useCallback<DivClickHandler>(
    (event) => {
      if (isInteractiveTarget(event.target)) {
        return;
      }
      handleAdvanceRequest();
    },
    [handleAdvanceRequest],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isInteractiveTarget(event.target)) {
        return;
      }
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault();
      handleAdvanceRequest();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleAdvanceRequest]);

  useEffect(() => {
    if (onDiagnostics === undefined) {
      return;
    }
    onDiagnostics(diagnostics);
  }, [diagnostics, onDiagnostics]);

  return (
    <TsuzuruGameFrame className={className} viewport={viewport} onClick={handleSurfaceClick}>
      <StdVisualLayer
        background={visualState.background}
        sprites={visualState.sprites}
        {...(assets?.visual?.backgrounds === undefined ? {} : { backgroundAssets: assets.visual.backgrounds })}
        {...(assets?.visual?.sprites === undefined ? {} : { spriteAssets: assets.visual.sprites })}
      />
      <StdAudioLayer
        bgm={audioState.bgm}
        seEvents={audioState.seEvents}
        voiceEvents={audioState.voiceEvents}
        {...(assets?.audio?.bgm === undefined ? {} : { bgmAssets: assets.audio.bgm })}
        {...(assets?.audio?.se === undefined ? {} : { seAssets: assets.audio.se })}
        {...(assets?.audio?.voice === undefined ? {} : { voiceAssets: assets.audio.voice })}
        onDiagnostic={recordAssetDiagnostic}
      />
      <StdEffectLayer
        events={effectState.events}
        nextSequence={effectState.nextSequence}
        onDiagnostic={recordPresentationDiagnostic}
      />
      <div className="tzr-tsuzuru-game__message-layer">
        {visibleEvent === null ? null : presentation.mode === "novel" ? (
          <RuntimeNovelTextLayer
            key={presentationKey}
            event={visibleEvent}
            onChoice={runtime.choose}
            onAdvance={handleAdvanceRequest}
            onContinue={handleAdvanceRequest}
            canAdvance={messageLines === null ? runtime.blockReason === null : canAdvanceText}
            advanceHint={advanceHint}
            speakerMode={presentation.speakerMode}
            {...(messageLines === null ? {} : { renderMessageLine })}
            {...(continueLabel === undefined ? {} : { continueLabel })}
          />
        ) : (
          <RuntimeMessageLayer
            key={presentationKey}
            event={visibleEvent}
            onChoice={runtime.choose}
            onAdvance={handleAdvanceRequest}
            onContinue={handleAdvanceRequest}
            canAdvance={messageLines === null ? runtime.blockReason === null : canAdvanceText}
            advanceHint={advanceHint}
            {...(messageLines === null ? {} : { renderMessageLine })}
            {...(continueLabel === undefined ? {} : { continueLabel })}
          />
        )}
        {runtime.autoStepError === null ? null : <StatusLayer label={runtime.autoStepError} />}
      </div>
      <DiagnosticsList diagnostics={diagnostics} />
    </TsuzuruGameFrame>
  );
}

function TsuzuruGameFrame({
  children,
  className,
  viewport,
  onClick,
}: {
  readonly children: ComponentChildren;
  readonly className?: string | undefined;
  readonly viewport?: TsuzuruGameViewportOptions | undefined;
  readonly onClick?: DivClickHandler | undefined;
}): ComponentChildren {
  return (
    <div className={joinClassNames("tzr-tsuzuru-game", className)}>
      <GameViewport
        maxWidth={viewport?.maxWidth ?? "100vw"}
        className={joinClassNames("tzr-tsuzuru-game__viewport", viewport?.className)}
        {...(viewport?.aspectRatio === undefined ? {} : { aspectRatio: viewport.aspectRatio })}
        {...(viewport?.style === undefined ? {} : { style: viewport.style })}
      >
        <GameShell className="tzr-tsuzuru-game__shell">
          <div className="tzr-tsuzuru-game__interaction-surface" onClick={onClick}>
            {children}
          </div>
        </GameShell>
      </GameViewport>
    </div>
  );
}

function DiagnosticsList({
  diagnostics,
  onDiagnostics,
}: {
  readonly diagnostics: readonly TsuzuruGameDiagnostic[];
  readonly onDiagnostics?: ((diagnostics: readonly TsuzuruGameDiagnostic[]) => void) | undefined;
}): ComponentChildren {
  useEffect(() => {
    onDiagnostics?.(diagnostics);
  }, [diagnostics, onDiagnostics]);

  if (diagnostics.length === 0) {
    return null;
  }

  return (
    <ul className="tzr-tsuzuru-game__diagnostics" aria-label="Tsuzuru diagnostics">
      {diagnostics.map((diagnostic, index) => (
        <li key={`${diagnostic.source}:${diagnostic.message}:${index}`}>{diagnostic.message}</li>
      ))}
    </ul>
  );
}

function useVisibleEventPresentationKey(event: Parameters<typeof getMessageLines>[0]): string {
  const keyRef = useRef<{
    readonly event: Parameters<typeof getMessageLines>[0];
    readonly sequence: number;
  }>({ event: null, sequence: 0 });

  if (keyRef.current.event !== event) {
    keyRef.current = {
      event,
      sequence: keyRef.current.sequence + 1,
    };
  }

  return `${keyRef.current.sequence}:${event === null ? "none" : event.type}`;
}

interface ResolvedTsuzuruGameMessagePresentation {
  readonly mode: TsuzuruGameMessagePresentationMode;
  readonly speakerMode: RuntimeNovelTextSpeakerMode;
}

function resolveMessagePresentation(
  messagePresentation: TsuzuruGameProps["messagePresentation"],
): ResolvedTsuzuruGameMessagePresentation {
  if (messagePresentation === undefined) {
    return { mode: "dialogue", speakerMode: "inline" };
  }
  if (typeof messagePresentation === "string") {
    return { mode: messagePresentation, speakerMode: "inline" };
  }
  const speakerMode = messagePresentation.speakerMode ?? "inline";
  return {
    mode: messagePresentation.mode ?? (messagePresentation.speakerMode === undefined ? "dialogue" : "novel"),
    speakerMode,
  };
}

function getMessageLines(
  event: RuntimeDocumentEvent | null,
  presentation: ResolvedTsuzuruGameMessagePresentation,
): readonly string[] | null {
  if (event?.type !== "narration" && event?.type !== "dialogue") {
    return null;
  }
  if (presentation.mode === "novel") {
    return getRuntimeNovelTextLines(event, presentation.speakerMode);
  }
  return event.lines.map((line) => line.text);
}

type RuntimeDocumentEvent = NonNullable<ReturnType<typeof useRuntime>["visibleEvent"]>;

function buildLineRanges(lines: readonly string[]): readonly LineRange[] {
  const ranges: LineRange[] = [];
  let start = 0;
  for (const line of lines) {
    const end = start + line.length;
    ranges.push({ start, end });
    start = end + 1;
  }
  return ranges;
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest(
      ".tzr-message-window, .tzr-novel-text-window, .tzr-choice-layer, .tzr-status-layer, button, a, input, select, textarea",
    ) !== null
  );
}

function isCompileResult(value: TsuzuruGameScenario): value is TzrCompileProjectResult {
  return typeof value === "object" && value !== null && "ok" in value && typeof value.ok === "boolean";
}

function toCompileDiagnostic(diagnostic: Diagnostic): TsuzuruGameDiagnostic {
  return {
    source: "compile",
    message: diagnostic.message,
    filePath: diagnostic.filePath,
    line: diagnostic.line,
    column: diagnostic.column,
  };
}

function formatCompileDiagnostics(diagnostics: readonly Diagnostic[]): string {
  const first = diagnostics[0];
  if (first === undefined) {
    return "Scenario failed to load.";
  }

  return `${first.filePath}:${first.line}:${first.column} ${first.message}`;
}
