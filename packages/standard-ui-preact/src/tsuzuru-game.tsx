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
import {
  createStdVisualCommandHandlers,
  createStdVisualPlugin,
  getStdVisualState,
  type StdVisualSpritePosition,
} from "@tsuzuru/plugin-std-visual";
import { useRuntime } from "@tsuzuru/preact";
import type { ComponentChildren, ComponentProps } from "preact";
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { joinClassNames } from "./class-name.js";
import { GameShell } from "./GameShell.js";
import { GameViewport, type GameViewportAspectRatio } from "./game-viewport.js";
import { RuntimeMessageLayer } from "./RuntimeMessageLayer.js";
import { StatusLayer } from "./StatusLayer.js";
import { useTextReveal } from "./useTextReveal.js";

type DivClickHandler = NonNullable<ComponentProps<"div">["onClick"]>;
type DivStyle = Extract<NonNullable<ComponentProps<"div">["style"]>, object>;

export type TsuzuruGameScenario = RuntimeDocument | TzrCompileProjectResult;

export type TsuzuruGameImageAsset =
  | string
  | {
      readonly src?: string;
      readonly label?: string;
      readonly alt?: string;
      readonly className?: string;
    };

export type TsuzuruGameAudioAsset =
  | string
  | {
      readonly src: string;
      readonly volume?: number;
    };

export interface TsuzuruGameAssets {
  readonly visual?: {
    readonly backgrounds?: Readonly<Record<string, TsuzuruGameImageAsset>>;
    readonly sprites?: Readonly<Record<string, TsuzuruGameImageAsset>>;
  };
  readonly audio?: {
    readonly bgm?: Readonly<Record<string, TsuzuruGameAudioAsset>>;
    readonly se?: Readonly<Record<string, TsuzuruGameAudioAsset>>;
    readonly voice?: Readonly<Record<string, TsuzuruGameAudioAsset>>;
  };
}

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

export interface TsuzuruGameProps {
  readonly scenario: TsuzuruGameScenario;
  readonly assets?: TsuzuruGameAssets | undefined;
  readonly className?: string | undefined;
  readonly viewport?: TsuzuruGameViewportOptions | undefined;
  readonly text?: TsuzuruGameTextOptions | undefined;
  readonly autoStart?: boolean | undefined;
  readonly advanceHint?: string | undefined;
  readonly continueLabel?: string | undefined;
  readonly onDiagnostics?: ((diagnostics: readonly TsuzuruGameDiagnostic[]) => void) | undefined;
}

interface TsuzuruGameRuntimeProps extends Omit<TsuzuruGameProps, "scenario"> {
  readonly document: RuntimeDocument;
}

interface ResolvedImageAsset {
  readonly src?: string;
  readonly label: string;
  readonly alt: string;
  readonly className?: string;
}

interface ResolvedAudioAsset {
  readonly src: string;
  readonly volume?: number;
}

interface OneShotAudioEvent {
  readonly assetId: string;
  readonly sequence: number;
}

interface LineRange {
  readonly start: number;
  readonly end: number;
}

const STARTER_PLUGINS: readonly RuntimePluginDefinition[] = [createStdVisualPlugin(), createStdAudioPlugin()];
const AUDIO_MISSING_DIAGNOSTIC_CODE = "standardUi.audioAssetMissing";
const AUDIO_PLAYBACK_DIAGNOSTIC_CODE = "standardUi.audioPlaybackFailed";

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
      {...{ assets, className, viewport, text, autoStart, advanceHint, continueLabel, onDiagnostics }}
    />
  );
}

function TsuzuruGameRuntime({
  document,
  assets,
  className,
  viewport,
  text,
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
    }),
    [],
  );
  const [diagnostics, setDiagnostics] = useState<readonly TsuzuruGameDiagnostic[]>([]);
  const assetDiagnosticKeysRef = useRef<Set<string>>(new Set());
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
    (key: string, message: string) => {
      if (assetDiagnosticKeysRef.current.has(key)) {
        return;
      }
      assetDiagnosticKeysRef.current.add(key);
      recordDiagnostic({
        source: "asset",
        severity: "warning",
        code: key,
        message,
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
  const visualState = getStdVisualState(runtime.state);
  const audioState = getStdAudioState(runtime.state);
  const visibleEvent = runtime.visibleEvent;
  const presentationKey = useVisibleEventPresentationKey(visibleEvent);
  const messageLines = useMemo(() => getMessageLines(visibleEvent), [visibleEvent]);
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

  useBgmAudio(audioState.bgm?.assetId, assets?.audio?.bgm, recordAssetDiagnostic);
  useOneShotAudioEvents(audioState.seEvents, assets?.audio?.se, "SE", recordAssetDiagnostic);
  useOneShotAudioEvents(audioState.voiceEvents, assets?.audio?.voice, "Voice", recordAssetDiagnostic);

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
      <VisualLayer
        sprites={visualState.sprites}
        {...(visualState.background?.assetId === undefined
          ? {}
          : { backgroundAssetId: visualState.background.assetId })}
        {...(assets?.visual?.backgrounds === undefined ? {} : { backgroundAssets: assets.visual.backgrounds })}
        {...(assets?.visual?.sprites === undefined ? {} : { spriteAssets: assets.visual.sprites })}
      />
      <div className="tzr-tsuzuru-game__message-layer">
        {visibleEvent === null ? null : (
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

function VisualLayer({
  backgroundAssetId,
  sprites,
  backgroundAssets,
  spriteAssets,
}: {
  readonly backgroundAssetId?: string | undefined;
  readonly sprites: Readonly<Record<string, { readonly position: StdVisualSpritePosition }>>;
  readonly backgroundAssets?: Readonly<Record<string, TsuzuruGameImageAsset>> | undefined;
  readonly spriteAssets?: Readonly<Record<string, TsuzuruGameImageAsset>> | undefined;
}): ComponentChildren {
  return (
    <div className="tzr-tsuzuru-game__visual-layer" aria-hidden="true">
      {backgroundAssetId === undefined ? (
        <div className="tzr-tsuzuru-game__background tzr-tsuzuru-game__background--empty" />
      ) : (
        <ImageAsset
          assetId={backgroundAssetId}
          asset={resolveImageAsset(backgroundAssets, backgroundAssetId)}
          baseClassName="tzr-tsuzuru-game__background"
          placeholderClassName="tzr-tsuzuru-game__background-placeholder"
        />
      )}
      <div className="tzr-tsuzuru-game__sprite-layer">
        {Object.entries(sprites).map(([assetId, sprite]) => (
          <ImageAsset
            key={assetId}
            assetId={assetId}
            asset={resolveImageAsset(spriteAssets, assetId)}
            baseClassName={joinClassNames("tzr-tsuzuru-game__sprite", `tzr-tsuzuru-game__sprite--${sprite.position}`)}
            placeholderClassName="tzr-tsuzuru-game__sprite-placeholder"
          />
        ))}
      </div>
    </div>
  );
}

function ImageAsset({
  assetId,
  asset,
  baseClassName,
  placeholderClassName,
}: {
  readonly assetId: string;
  readonly asset: ResolvedImageAsset;
  readonly baseClassName: string;
  readonly placeholderClassName: string;
}): ComponentChildren {
  if (asset.src !== undefined) {
    return (
      <img
        className={joinClassNames(baseClassName, asset.className)}
        src={asset.src}
        alt={asset.alt}
        draggable={false}
      />
    );
  }

  return (
    <div className={joinClassNames(baseClassName, placeholderClassName, asset.className)} aria-label={assetId}>
      <span className="tzr-tsuzuru-game__asset-label">{asset.label}</span>
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

function useBgmAudio(
  assetId: string | undefined,
  assets: Readonly<Record<string, TsuzuruGameAudioAsset>> | undefined,
  recordAssetDiagnostic: (key: string, message: string) => void,
): void {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current?.pause();
    audioRef.current = null;

    if (assetId === undefined) {
      return;
    }

    const resolved = resolveAudioAsset(assets, assetId);
    if (resolved === null) {
      recordAssetDiagnostic(`${AUDIO_MISSING_DIAGNOSTIC_CODE}:BGM:${assetId}`, `Missing BGM audio asset "${assetId}".`);
      return;
    }
    if (typeof Audio === "undefined") {
      return;
    }

    const audio = new Audio(resolved.src);
    audio.loop = true;
    audio.volume = resolved.volume ?? 1;
    audioRef.current = audio;
    void audio.play().catch(() => {
      recordAssetDiagnostic(
        `${AUDIO_PLAYBACK_DIAGNOSTIC_CODE}:BGM:${assetId}`,
        `BGM playback was blocked or failed: ${assetId}.`,
      );
    });

    return () => {
      audio.pause();
    };
  }, [assetId, assets, recordAssetDiagnostic]);
}

function useOneShotAudioEvents(
  events: readonly OneShotAudioEvent[],
  assets: Readonly<Record<string, TsuzuruGameAudioAsset>> | undefined,
  kind: "SE" | "Voice",
  recordAssetDiagnostic: (key: string, message: string) => void,
): void {
  const lastSequenceRef = useRef(0);

  useEffect(() => {
    const maxSequence = events.reduce((current, event) => Math.max(current, event.sequence), 0);
    if (maxSequence < lastSequenceRef.current) {
      lastSequenceRef.current = 0;
    }

    for (const event of events) {
      if (event.sequence <= lastSequenceRef.current) {
        continue;
      }

      const resolved = resolveAudioAsset(assets, event.assetId);
      if (resolved === null) {
        recordAssetDiagnostic(
          `${AUDIO_MISSING_DIAGNOSTIC_CODE}:${kind}:${event.assetId}`,
          `Missing ${kind} audio asset "${event.assetId}".`,
        );
        continue;
      }

      playOneShotAudio(resolved, kind, event.assetId, recordAssetDiagnostic);
    }

    lastSequenceRef.current = maxSequence;
  }, [assets, events, kind, recordAssetDiagnostic]);
}

function playOneShotAudio(
  asset: ResolvedAudioAsset,
  kind: "SE" | "Voice",
  assetId: string,
  recordAssetDiagnostic: (key: string, message: string) => void,
): void {
  if (typeof Audio === "undefined") {
    return;
  }

  const audio = new Audio(asset.src);
  audio.volume = asset.volume ?? 1;
  void audio.play().catch(() => {
    recordAssetDiagnostic(
      `${AUDIO_PLAYBACK_DIAGNOSTIC_CODE}:${kind}:${assetId}`,
      `${kind} playback was blocked or failed: ${assetId}.`,
    );
  });
}

function resolveImageAsset(
  assets: Readonly<Record<string, TsuzuruGameImageAsset>> | undefined,
  assetId: string,
): ResolvedImageAsset {
  const asset = assets?.[assetId];
  if (asset === undefined) {
    return { label: assetId, alt: assetId };
  }
  if (typeof asset === "string") {
    return { src: asset, label: assetId, alt: "" };
  }
  return {
    ...(asset.src === undefined ? {} : { src: asset.src }),
    label: asset.label ?? assetId,
    alt: asset.alt ?? "",
    ...(asset.className === undefined ? {} : { className: asset.className }),
  };
}

function resolveAudioAsset(
  assets: Readonly<Record<string, TsuzuruGameAudioAsset>> | undefined,
  assetId: string,
): ResolvedAudioAsset | null {
  const asset = assets?.[assetId];
  if (asset === undefined) {
    return null;
  }
  if (typeof asset === "string") {
    return { src: asset };
  }
  return {
    src: asset.src,
    ...(asset.volume === undefined ? {} : { volume: asset.volume }),
  };
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

function getMessageLines(event: RuntimeDocumentEvent | null): readonly string[] | null {
  if (event?.type !== "narration" && event?.type !== "dialogue") {
    return null;
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
    target.closest(".tzr-message-window, .tzr-choice-layer, .tzr-status-layer, button, a, input, select, textarea") !==
      null
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
