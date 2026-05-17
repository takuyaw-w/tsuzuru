import {
  type CompiledTzrDocument,
  createRuntimeSnapshot,
  prepareRuntimeStateForSnapshot,
  type RuntimeDiagnostic,
  type RuntimeEvent,
  type RuntimePluginDefinition,
  type RuntimeState,
} from "@tsuzuru/core";
import {
  createStdAudioCommandHandlers,
  createStdAudioPlugin,
  prepareStdAudioStateForSnapshot,
} from "@tsuzuru/plugin-std-audio";
import { createStdCameraCommandHandlers, createStdCameraPlugin } from "@tsuzuru/plugin-std-camera";
import {
  createStdEffectCommandHandlers,
  createStdEffectPlugin,
  prepareStdEffectStateForSnapshot,
} from "@tsuzuru/plugin-std-effect";
import { createStdParticleCommandHandlers, createStdParticlePlugin } from "@tsuzuru/plugin-std-particle";
import { createStdSystemCommandHandlers, createStdSystemPlugin } from "@tsuzuru/plugin-std-system";
import {
  createStdTextSoundCommandHandlers,
  createStdTextSoundPlugin,
  getStdTextSoundState,
  type ResolveStdTextSoundProfileContext,
  resolveStdTextSoundProfile,
  type StdTextSoundState,
  shouldPlayStdTextSoundCharacter,
} from "@tsuzuru/plugin-std-text-sound";
import { createStdTextSoundPlayer, type StdTextSoundPlayer } from "@tsuzuru/plugin-std-text-sound/browser";
import { createStdVisualCommandHandlers, createStdVisualPlugin } from "@tsuzuru/plugin-std-visual";
import { createRuntimeSaveData, getRenderableRuntimeEvent, useRuntime } from "@tsuzuru/preact";
import {
  ChoiceLayer,
  GameShell,
  GameViewport,
  type MessageHistoryEntry,
  type MessageWindowRenderLineContext,
  RuntimeMessageLayer,
  type TextRevealCharacterEvent,
  useAutoMode,
  useMessageHistory,
  useTextReveal,
} from "@tsuzuru/standard-ui-preact";
import type { ComponentChildren, ComponentProps } from "preact";
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { assets } from "../assets.js";
import { AudioLayer } from "./AudioLayer.js";
import { EffectLayer } from "./EffectLayer.js";
import { ParticleLayer } from "./ParticleLayer.js";
import { type ExamplePreferences, loadPreferences, savePreferences } from "./preferences.js";
import { RuntimeControlBar } from "./RuntimeControlBar.js";
import {
  createReadEntryKey,
  isRead,
  isReadTrackableEvent,
  loadReadTrackingState,
  markRead,
  type ReadEntryKey,
  type ReadTrackingState,
  saveReadTrackingState,
} from "./read-tracking.js";
import {
  createExampleSaveData,
  deleteSaveSlot,
  type ExampleSaveData,
  type ExampleSaveSlot,
  getLatestSaveSlot,
  loadSaveSlots,
  type RetainedMessageEvent,
  saveToSlot,
} from "./save-storage.js";
import { scenarioProject } from "./scenario.js";
import { BacklogScreen, type BacklogViewEntry } from "./screens/BacklogScreen.js";
import { GalleryScreen } from "./screens/GalleryScreen.js";
import { LoadScreen } from "./screens/LoadScreen.js";
import { SaveScreen } from "./screens/SaveScreen.js";
import { SettingsScreen } from "./screens/SettingsScreen.js";
import { TitleScreen } from "./screens/TitleScreen.js";
import { VisualLayer } from "./VisualLayer.js";

type DocumentResult =
  | { readonly ok: true; readonly document: CompiledTzrDocument }
  | { readonly ok: false; readonly message: string };
type DivClickHandler = NonNullable<ComponentProps<"div">["onClick"]>;
type AppScreen = "title" | "runtime" | "load" | "settings" | "backlog" | "gallery";
type RuntimeOverlay = "save" | "load" | "settings" | "backlog" | null;

const AUTO_MODE_ADVANCE_DELAY_MS = 1200;
const SKIP_MODE_ADVANCE_DELAY_MS = 120;
const TEXT_SOUND_MIN_INTERVAL_MS = 45;

export function App() {
  const documentResult = useMemo((): DocumentResult => {
    if (!scenarioProject.ok) {
      return { ok: false, message: formatDiagnostics(scenarioProject.errors) };
    }
    return { ok: true, document: scenarioProject.document };
  }, []);
  const [screen, setScreen] = useState<AppScreen>("title");
  const [saveSlots, setSaveSlots] = useState<readonly ExampleSaveSlot[]>(() => loadSaveSlots());
  const [initialSaveData, setInitialSaveData] = useState<ExampleSaveData | null>(null);
  const [preferences, setPreferences] = useState<ExamplePreferences>(() => loadPreferences());
  const latestSaveSlot = useMemo(() => getLatestSaveSlot(saveSlots), [saveSlots]);
  const handleChangePreferences = useCallback((next: ExamplePreferences) => {
    setPreferences(savePreferences(next));
  }, []);
  const handleStart = useCallback(() => {
    setInitialSaveData(null);
    setScreen("runtime");
  }, []);
  const handleContinue = useCallback(() => {
    if (latestSaveSlot === null) {
      return;
    }
    setInitialSaveData(latestSaveSlot.data);
    setScreen("runtime");
  }, [latestSaveSlot]);
  const handleTitleLoad = useCallback(
    (slotId: string) => {
      const slot = saveSlots.find((candidate) => candidate.id === slotId);
      if (slot === undefined) {
        return;
      }
      setInitialSaveData(slot.data);
      setScreen("runtime");
    },
    [saveSlots],
  );
  const handleDeleteSaveSlot = useCallback((slotId: string) => {
    setSaveSlots(deleteSaveSlot(slotId));
  }, []);

  if (!documentResult.ok) {
    return <pre className="app app--error">{documentResult.message}</pre>;
  }

  if (screen === "runtime") {
    return (
      <RuntimeApp
        document={documentResult.document}
        initialSaveData={initialSaveData}
        saveSlots={saveSlots}
        preferences={preferences}
        onSaveSlotsChange={setSaveSlots}
        onChangePreferences={handleChangePreferences}
        onTitle={() => setScreen("title")}
      />
    );
  }

  return (
    <ScreenFrame>
      {screen === "title" ? (
        <TitleScreen
          onStart={handleStart}
          onContinue={handleContinue}
          onLoad={() => setScreen("load")}
          onSettings={() => setScreen("settings")}
          onBacklog={() => setScreen("backlog")}
          onGallery={() => setScreen("gallery")}
          canContinue={latestSaveSlot !== null}
        />
      ) : screen === "load" ? (
        <LoadScreen
          slots={saveSlots}
          onLoad={handleTitleLoad}
          onDelete={handleDeleteSaveSlot}
          onBack={() => setScreen("title")}
        />
      ) : screen === "settings" ? (
        <SettingsScreen
          preferences={preferences}
          onChangePreferences={handleChangePreferences}
          onBack={() => setScreen("title")}
        />
      ) : screen === "backlog" ? (
        <BacklogScreen entries={[]} onBack={() => setScreen("title")} />
      ) : (
        <GalleryScreen onBack={() => setScreen("title")} />
      )}
    </ScreenFrame>
  );
}

interface RuntimeAppProps {
  readonly document: CompiledTzrDocument;
  readonly initialSaveData: ExampleSaveData | null;
  readonly saveSlots: readonly ExampleSaveSlot[];
  readonly preferences: ExamplePreferences;
  readonly onSaveSlotsChange: (slots: readonly ExampleSaveSlot[]) => void;
  readonly onChangePreferences: (preferences: ExamplePreferences) => void;
  readonly onTitle: () => void;
}

function ScreenFrame({ children }: { readonly children: ComponentChildren }) {
  return (
    <main className="app">
      <GameViewport aspectRatio="16:9" className="app__viewport" maxWidth="100vw">
        <GameShell className="app__shell">{children}</GameShell>
      </GameViewport>
    </main>
  );
}

function RuntimeApp({
  document,
  initialSaveData,
  saveSlots,
  preferences,
  onSaveSlotsChange,
  onChangePreferences,
  onTitle,
}: RuntimeAppProps) {
  const plugins = useMemo<readonly RuntimePluginDefinition[]>(
    () => [
      createStdVisualPlugin(),
      createStdAudioPlugin(),
      createStdTextSoundPlugin(),
      createStdEffectPlugin(),
      createStdCameraPlugin(),
      createStdParticlePlugin(),
      createStdSystemPlugin(),
    ],
    [],
  );
  const commandHandlers = useMemo(
    () => ({
      ...createStdVisualCommandHandlers(),
      ...createStdAudioCommandHandlers(),
      ...createStdTextSoundCommandHandlers(),
      ...createStdEffectCommandHandlers(),
      ...createStdCameraCommandHandlers(),
      ...createStdParticleCommandHandlers(),
      ...createStdSystemCommandHandlers(),
    }),
    [],
  );
  const [diagnostics, setDiagnostics] = useState<readonly RuntimeDiagnostic[]>([]);
  const textSoundNoticeKeysRef = useRef<Set<string>>(new Set());
  const recordDiagnostic = useCallback((diagnostic: RuntimeDiagnostic) => {
    setDiagnostics((current) => [...current, diagnostic]);
  }, []);
  const recordTextSoundNotice = useCallback(
    (code: string, message: string, detail?: unknown) => {
      if (textSoundNoticeKeysRef.current.has(code)) {
        return;
      }
      textSoundNoticeKeysRef.current.add(code);
      recordDiagnostic({ severity: "warning", code, message });
      if (detail === undefined) {
        console.warn(message);
      } else {
        console.warn(message, detail);
      }
    },
    [recordDiagnostic],
  );
  const textSoundPlayer = useMemo(
    () =>
      createStdTextSoundPlayer({
        defaultMinIntervalMs: TEXT_SOUND_MIN_INTERVAL_MS,
        onError: (error) => {
          recordTextSoundNotice(
            "example.textSound.playbackFailed",
            "Text sound playback was blocked or failed.",
            error,
          );
        },
      }),
    [recordTextSoundNotice],
  );
  const runtime = useRuntime(document, {
    plugins,
    commandHandlers,
    onDiagnostic: recordDiagnostic,
    autoStart: initialSaveData === null,
    autoClearWait: true,
    autoStepTransientEvents: true,
  });
  const hasRestoredInitialSaveDataRef = useRef(false);
  const [overlay, setOverlay] = useState<RuntimeOverlay>(null);
  const [skipModeEnabled, setSkipModeEnabled] = useState(false);
  const [lastMessageEvent, setLastMessageEvent] = useState<RuntimeEvent | null>(null);
  const [readTracking, setReadTracking] = useState<ReadTrackingState>(() => loadReadTrackingState());
  const recordedSkipReadCheckPresentationKeyRef = useRef<string | null>(null);
  const [currentMessageWasPreviouslyRead, setCurrentMessageWasPreviouslyRead] = useState(false);
  const visiblePresentationEvent = toExamplePresentationEvent(runtime.visibleEvent);
  const choiceEvent = runtime.visibleEvent?.type === "choice" ? runtime.visibleEvent : null;
  const retainedMessageEvent = runtime.visibleEvent?.type === "wait" ? lastMessageEvent : null;
  const presentationKey = useVisibleEventPresentationKey(runtime.visibleEvent);
  const currentRenderableEvent = runtime.event === null ? null : getRenderableRuntimeEvent(runtime.event);
  const messageLines = useMemo(
    () => (visiblePresentationEvent === null ? null : getMessageLines(visiblePresentationEvent)),
    [visiblePresentationEvent],
  );
  const revealText = messageLines?.join("\n") ?? "";
  const lineRanges = useMemo(() => (messageLines === null ? [] : buildLineRanges(messageLines)), [messageLines]);
  const playTextSoundForCharacter = useTextSoundPlayback(
    runtime.state,
    visiblePresentationEvent,
    preferences,
    textSoundPlayer,
  );
  const textReveal = useTextReveal(revealText, {
    enabled: messageLines !== null && preferences.textRevealEnabled,
    charactersPerSecond: preferences.textSpeedCharactersPerSecond,
    resetKey: presentationKey,
    onCharacterReveal: playTextSoundForCharacter,
  });
  const messageHistory = useMessageHistory({
    event: runtime.visibleEvent,
    eventKey: presentationKey,
  });
  const messageHistoryReadKeys = useMemo<ReadonlyMap<number, ReadEntryKey>>(
    () =>
      new Map(
        messageHistory.entries.map((entry) => [entry.id, createReadEntryKeyFromMessageHistoryEntry(entry)] as const),
      ),
    [messageHistory.entries],
  );
  const backlogEntries = useMemo<readonly BacklogViewEntry[]>(
    () =>
      messageHistory.entries.map((entry) => {
        const readEntryKey = messageHistoryReadKeys.get(entry.id);
        return {
          ...entry,
          read: readEntryKey !== undefined && isRead(readTracking, readEntryKey),
        };
      }),
    [messageHistory.entries, messageHistoryReadKeys, readTracking],
  );
  const readCount = readTracking.readEntryKeys.size;
  const canAdvanceText =
    visiblePresentationEvent !== null &&
    isMessageEvent(visiblePresentationEvent) &&
    currentRenderableEvent === runtime.visibleEvent &&
    runtime.blockReason === null &&
    !runtime.state.isStopped;
  const canAutoAdvanceText =
    !skipModeEnabled &&
    overlay === null &&
    choiceEvent === null &&
    visiblePresentationEvent !== null &&
    isMessageEvent(visiblePresentationEvent) &&
    textReveal.isComplete &&
    canAdvanceText &&
    runtime.blockReason === null &&
    !runtime.state.isStopped;
  const autoMode = useAutoMode({
    canAdvance: canAutoAdvanceText,
    onAdvance: runtime.step,
    delayMs: AUTO_MODE_ADVANCE_DELAY_MS,
  });
  const canSkipAdvanceText =
    skipModeEnabled &&
    overlay === null &&
    choiceEvent === null &&
    visiblePresentationEvent !== null &&
    isMessageEvent(visiblePresentationEvent) &&
    currentMessageWasPreviouslyRead &&
    canAdvanceText &&
    runtime.blockReason === null &&
    !runtime.state.isStopped;
  const canStart =
    runtime.visibleEvent === null && runtime.event === null && runtime.blockReason === null && !runtime.state.isStopped;
  const handleAdvanceRequest = useCallback(() => {
    if (choiceEvent !== null) {
      return;
    }
    if (messageLines !== null) {
      if (textReveal.isRevealing) {
        textReveal.revealAll();
        return;
      }
      if (canAdvanceText) {
        runtime.step();
      }
      return;
    }
    if (canStart) {
      runtime.step();
    }
  }, [canAdvanceText, canStart, choiceEvent, messageLines, runtime, textReveal.isRevealing, textReveal.revealAll]);
  const handleViewportClick = useCallback<DivClickHandler>(
    (event) => {
      if (isInteractiveClickTarget(event.target)) {
        return;
      }
      handleAdvanceRequest();
    },
    [handleAdvanceRequest],
  );
  const renderMessageLine = useCallback(
    ({ line, lineIndex }: MessageWindowRenderLineContext) => {
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
  const handleSaveToSlot = useCallback(
    (slotId: string) => {
      const saveReadyState = prepareRuntimeStateForSnapshot(runtime.state, [
        prepareStdAudioStateForSnapshot,
        prepareStdEffectStateForSnapshot,
      ]);
      const snapshot = createRuntimeSnapshot(saveReadyState);
      onSaveSlotsChange(
        saveToSlot(
          slotId,
          createExampleSaveData(
            createRuntimeSaveData(snapshot, runtime.visibleEvent),
            getRetainedMessageForSave(lastMessageEvent),
          ),
        ),
      );
      setOverlay(null);
    },
    [lastMessageEvent, onSaveSlotsChange, runtime],
  );
  const handleDeleteSaveSlot = useCallback(
    (slotId: string) => {
      onSaveSlotsChange(deleteSaveSlot(slotId));
    },
    [onSaveSlotsChange],
  );
  const handleLoadFromSlot = useCallback(
    (slotId: string) => {
      const slot = saveSlots.find((candidate) => candidate.id === slotId);
      if (slot === undefined) {
        return;
      }
      runtime.restoreSaveData(slot.data.runtime);
      setLastMessageEvent(slot.data.retainedMessageEvent);
      setOverlay(null);
    },
    [runtime, saveSlots],
  );

  useEffect(() => {
    if (!canSkipAdvanceText) {
      return;
    }

    if (textReveal.isRevealing) {
      textReveal.revealAll();
      return;
    }

    if (!textReveal.isComplete) {
      return;
    }

    const timer = window.setTimeout(() => {
      runtime.step();
    }, SKIP_MODE_ADVANCE_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    canSkipAdvanceText,
    presentationKey,
    runtime.step,
    textReveal.isComplete,
    textReveal.isRevealing,
    textReveal.revealAll,
  ]);

  useEffect(() => {
    return () => {
      textSoundPlayer.destroy();
    };
  }, [textSoundPlayer]);

  useEffect(() => {
    if (initialSaveData === null || hasRestoredInitialSaveDataRef.current) {
      return;
    }
    hasRestoredInitialSaveDataRef.current = true;
    runtime.restoreSaveData(initialSaveData.runtime);
    setLastMessageEvent(initialSaveData.retainedMessageEvent);
  }, [initialSaveData, runtime]);

  useEffect(() => {
    if (runtime.visibleEvent !== null && isMessageEvent(runtime.visibleEvent)) {
      setLastMessageEvent(runtime.visibleEvent);
    }
  }, [runtime.visibleEvent]);

  useEffect(() => {
    if (recordedSkipReadCheckPresentationKeyRef.current === presentationKey) {
      return;
    }

    recordedSkipReadCheckPresentationKeyRef.current = presentationKey;

    if (!isReadTrackableEvent(runtime.visibleEvent)) {
      setCurrentMessageWasPreviouslyRead(false);
      return;
    }

    const readEntryKey = createReadEntryKey(runtime.visibleEvent);
    setCurrentMessageWasPreviouslyRead(isRead(readTracking, readEntryKey));
    setReadTracking((current) => saveReadTrackingState(markRead(current, readEntryKey)));
  }, [presentationKey, readTracking, runtime.visibleEvent]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isKeyboardHandledTarget(event.target)) {
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

  return (
    <main className="app">
      <GameViewport aspectRatio="16:9" className="app__viewport" maxWidth="100vw">
        <GameShell className="app__shell">
          <div className="app__interaction-surface" onClick={handleViewportClick}>
            <VisualLayer runtimeState={runtime.state} />
            <ParticleLayer runtimeState={runtime.state} />
            <AudioLayer runtimeState={runtime.state} preferences={preferences} />
            <EffectLayer runtimeState={runtime.state} />
            <RuntimeControlBar
              readCount={readCount}
              autoModeEnabled={autoMode.enabled}
              skipModeEnabled={skipModeEnabled}
              onToggleAutoMode={autoMode.toggle}
              onToggleSkipMode={() => setSkipModeEnabled((current) => !current)}
              onOpenSave={() => setOverlay("save")}
              onOpenLoad={() => setOverlay("load")}
              onOpenBacklog={() => setOverlay("backlog")}
              onOpenSettings={() => setOverlay("settings")}
              onTitle={onTitle}
            />
            <div className="app__message-layer">
              {canStart ? null : choiceEvent !== null ? (
                <>
                  <ChoiceLayer
                    className="app__choice-layer"
                    question={choiceEvent.question}
                    choices={choiceEvent.items.map((item) => ({ text: item.text }))}
                    onChoice={runtime.choose}
                  />
                  {lastMessageEvent === null ? null : (
                    <RuntimeMessageLayer
                      key={getRuntimeEventTextKey(lastMessageEvent)}
                      className="app__retained-message"
                      event={lastMessageEvent}
                      canAdvance={false}
                    />
                  )}
                </>
              ) : retainedMessageEvent !== null ? (
                <RuntimeMessageLayer
                  key={getRuntimeEventTextKey(retainedMessageEvent)}
                  className="app__retained-message"
                  event={retainedMessageEvent}
                  canAdvance={false}
                />
              ) : visiblePresentationEvent === null ? null : (
                <RuntimeMessageLayer
                  key={presentationKey}
                  event={visiblePresentationEvent}
                  onAdvance={handleAdvanceRequest}
                  {...(messageLines === null ? {} : { renderMessageLine })}
                  canAdvance={canAdvanceText}
                />
              )}
            </div>
            {overlay === null ? null : (
              <div className="app__overlay">
                {overlay === "save" ? (
                  <SaveScreen
                    slots={saveSlots}
                    onSave={handleSaveToSlot}
                    onDelete={handleDeleteSaveSlot}
                    onBack={() => setOverlay(null)}
                  />
                ) : overlay === "load" ? (
                  <LoadScreen
                    slots={saveSlots}
                    onLoad={handleLoadFromSlot}
                    onDelete={handleDeleteSaveSlot}
                    onBack={() => setOverlay(null)}
                  />
                ) : overlay === "backlog" ? (
                  <BacklogScreen entries={backlogEntries} onBack={() => setOverlay(null)} />
                ) : (
                  <SettingsScreen
                    preferences={preferences}
                    onChangePreferences={onChangePreferences}
                    onBack={() => setOverlay(null)}
                  />
                )}
              </div>
            )}
          </div>
        </GameShell>
      </GameViewport>
      {runtime.autoStepError === null ? null : <p className="app__runtime-error">{runtime.autoStepError}</p>}
      {diagnostics.length === 0 ? null : (
        <ul className="app__diagnostics">
          {diagnostics.map((diagnostic, index) => (
            <li key={`${diagnostic.code}:${index}`}>{diagnostic.message}</li>
          ))}
        </ul>
      )}
    </main>
  );
}

function useVisibleEventPresentationKey(event: RuntimeEvent | null): string {
  const keyRef = useRef<{
    readonly event: RuntimeEvent | null;
    readonly sequence: number;
  }>({ event: null, sequence: 0 });

  if (keyRef.current.event !== event) {
    keyRef.current = {
      event,
      sequence: keyRef.current.sequence + 1,
    };
  }

  return `${keyRef.current.sequence}:${event === null ? "none" : getRuntimeEventTextKey(event)}`;
}

interface LineRange {
  readonly start: number;
  readonly end: number;
}

function isInteractiveClickTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest(
      ".screen, .app__runtime-menu, .tzr-message-window, .tzr-choice-layer, button, a, input, select, textarea",
    ) !== null
  );
}

function isKeyboardHandledTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest(".screen, .tzr-message-window, .tzr-choice-layer, button, a, input, select, textarea") !== null
  );
}

function toExamplePresentationEvent(event: RuntimeEvent | null): RuntimeEvent | null {
  if (event?.type === "wait") {
    return null;
  }
  return event;
}

function isMessageEvent(
  event: RuntimeEvent,
): event is Extract<RuntimeEvent, { readonly type: "narration" | "dialogue" }> {
  return event.type === "narration" || event.type === "dialogue";
}

function getRetainedMessageForSave(event: RuntimeEvent | null): RetainedMessageEvent | null {
  if (event === null || !isMessageEvent(event)) {
    return null;
  }
  return event;
}

function getMessageLines(event: RuntimeEvent): readonly string[] | null {
  if (!isMessageEvent(event)) {
    return null;
  }
  return event.lines.map((line) => line.text);
}

function createReadEntryKeyFromMessageHistoryEntry(entry: MessageHistoryEntry): ReadEntryKey {
  if (entry.kind === "dialogue") {
    return `dialogue:${entry.speakerName ?? ""}:${entry.text}`;
  }
  return `narration:${entry.text}`;
}

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

function useTextSoundPlayback(
  runtimeState: RuntimeState,
  visibleEvent: RuntimeEvent | null,
  preferences: ExamplePreferences,
  player: StdTextSoundPlayer,
): (event: TextRevealCharacterEvent) => void {
  const textSoundState = getExampleTextSoundState(runtimeState);
  const textSoundContext = getExampleTextSoundContext(visibleEvent);
  const profile =
    textSoundContext === null ? null : resolveStdTextSoundProfile(assets.textSound, textSoundState, textSoundContext);

  return useCallback(
    (event: TextRevealCharacterEvent) => {
      if (!preferences.textRevealEnabled || !preferences.textSoundEnabled || profile === null) {
        return;
      }
      if (!shouldPlayStdTextSoundCharacter(event.character)) {
        return;
      }

      player.play(profile, {
        minIntervalMs: TEXT_SOUND_MIN_INTERVAL_MS,
        volume: preferences.textSoundVolume,
      });
    },
    [player, preferences.textRevealEnabled, preferences.textSoundEnabled, preferences.textSoundVolume, profile],
  );
}

function getExampleTextSoundState(runtimeState: RuntimeState): StdTextSoundState {
  try {
    return getStdTextSoundState(runtimeState);
  } catch {
    return { overrideProfileId: null };
  }
}

function getExampleTextSoundContext(event: RuntimeEvent | null): ResolveStdTextSoundProfileContext | null {
  if (event?.type === "narration") {
    return { kind: "narration" };
  }
  if (event?.type === "dialogue") {
    return { kind: "dialogue", speakerId: event.speaker };
  }
  return null;
}

function getRuntimeEventTextKey(event: RuntimeEvent): string {
  if (event.type === "narration" || event.type === "dialogue") {
    return event.lines.map((line) => line.text).join("\u0000");
  }
  if (event.type === "choice") {
    return event.items.map((item) => item.text).join("\u0000");
  }
  return "";
}

interface DiagnosticLike {
  readonly message: string;
}

function formatDiagnostics(diagnostics: readonly DiagnosticLike[]): string {
  return diagnostics.map((diagnostic) => diagnostic.message).join("\n");
}
