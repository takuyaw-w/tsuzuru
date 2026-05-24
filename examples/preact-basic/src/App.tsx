import type {
  CompiledTzrDocument,
  RuntimeDiagnostic,
  RuntimeEvent,
  RuntimePluginDefinition,
  RuntimeState,
} from "@tsuzuru/core";
import {
  createStdAudioCommandHandlers,
  createStdAudioPlugin,
  getStdAudioState,
  prepareStdAudioStateForSnapshot,
} from "@tsuzuru/plugin-std-audio";
import { createStdCameraCommandHandlers, createStdCameraPlugin } from "@tsuzuru/plugin-std-camera";
import {
  createStdEffectCommandHandlers,
  createStdEffectPlugin,
  getStdEffectState,
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
import { createStdVisualCommandHandlers, createStdVisualPlugin, getStdVisualState } from "@tsuzuru/plugin-std-visual";
import { createRuntimeSaveDataFromState, getRenderableRuntimeEvent, useRuntime } from "@tsuzuru/preact";
import {
  createInitialReadTrackingState,
  createReadEntryKey,
  createReadEntryKeyFromText,
  createStandardGameStorageFromConfig,
  DEFAULT_STANDARD_GAME_PREFERENCES,
  isRead,
  isReadTrackableEvent,
  markRead,
  parseReadTrackingStorageData as parseStandardReadTrackingStorageData,
  STANDARD_GAME_TEXT_SPEED_OPTIONS,
  type StandardGamePreferences,
  type StandardReadEntryKey,
  type StandardReadTrackableEvent,
  type StandardReadTrackingState,
  type StandardReadTrackingStorageData,
  type StandardRuntimeGameStoragePreset,
  type StandardRuntimeSaveData,
  type StandardRuntimeSavePayload,
  type StandardSaveSlot,
  type StandardSaveSlotDefinition,
  serializeReadTrackingState as serializeStandardReadTrackingState,
} from "@tsuzuru/standard-game-storage";
import {
  ChoiceLayer,
  createAudioAssetsWithVolume,
  GameShell,
  GameViewport,
  type MessageHistoryEntry,
  type MessageWindowRenderLineContext,
  RuntimeControlBar,
  RuntimeMessageLayer,
  StdAudioRuntimeLayer,
  type StdCameraFocusOffsetResolver,
  StdCameraRuntimeLayer,
  StdEffectLayer,
  StdParticleRuntimeLayer,
  StdVisualRuntimeLayer,
  type TextRevealCharacterEvent,
  useAutoMode,
  useMessageHistory,
  useTextReveal,
} from "@tsuzuru/standard-ui-preact";
import type { ComponentChildren, ComponentProps } from "preact";
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { assets } from "../assets.js";
import scenario from "../scenario/main.tzr";
import tsuzuruConfig, { projectIdentity } from "../tsuzuru.config.js";
import { BacklogScreen, type BacklogViewEntry } from "./screens/BacklogScreen.js";
import { GalleryScreen } from "./screens/GalleryScreen.js";
import { LoadScreen } from "./screens/LoadScreen.js";
import { SaveScreen } from "./screens/SaveScreen.js";
import { SettingsScreen } from "./screens/SettingsScreen.js";
import { TitleScreen } from "./screens/TitleScreen.js";

type DivClickHandler = NonNullable<ComponentProps<"div">["onClick"]>;
type AppScreen = "title" | "runtime" | "load" | "settings" | "backlog" | "gallery";
type RuntimeOverlay = "save" | "load" | "settings" | "backlog" | null;

const AUTO_MODE_ADVANCE_DELAY_MS = 1200;
const SKIP_MODE_ADVANCE_DELAY_MS = 120;
const TEXT_SOUND_MIN_INTERVAL_MS = 45;

export const gameStorage = requireStandardRuntimeStorage(
  createStandardGameStorageFromConfig<StandardRuntimeSavePayload, RetainedMessageEvent>(tsuzuruConfig),
);

const storageConfig = tsuzuruConfig.storage;

export const TEXT_SPEED_OPTIONS = storageConfig?.preferences?.textSpeedOptions ?? STANDARD_GAME_TEXT_SPEED_OPTIONS;
export type TextSpeedCharactersPerSecond = (typeof TEXT_SPEED_OPTIONS)[number];

export interface ExamplePreferences extends StandardGamePreferences {
  readonly textSpeedCharactersPerSecond: TextSpeedCharactersPerSecond;
}

export const DEFAULT_EXAMPLE_PREFERENCES = {
  ...DEFAULT_STANDARD_GAME_PREFERENCES,
  ...storageConfig?.preferences?.defaults,
} as ExamplePreferences;

export type RetainedMessageEvent = Extract<RuntimeEvent, { readonly type: "narration" | "dialogue" }>;
export type ExampleSaveData = StandardRuntimeSaveData<StandardRuntimeSavePayload, RetainedMessageEvent>;
export type ExampleSaveSlot = StandardSaveSlot<ExampleSaveData>;
export type ExampleSaveSlotDefinition = StandardSaveSlotDefinition;
export type ReadTrackableEvent = StandardReadTrackableEvent;
export type ReadEntryKey = StandardReadEntryKey;
export type ReadTrackingStorageData = StandardReadTrackingStorageData;
export type ReadTrackingState = StandardReadTrackingState;

export const SAVE_SLOT_DEFINITIONS = gameStorage.slotDefinitions;

export {
  createInitialReadTrackingState,
  createReadEntryKey,
  createReadEntryKeyFromText,
  isRead,
  isReadTrackableEvent,
  markRead,
};

export const createExampleSaveData = gameStorage.runtimeSaveAdapter.createData;
export const getExampleSaveDataSavedAt = gameStorage.runtimeSaveAdapter.getSavedAt;
export const isExampleSaveData = gameStorage.runtimeSaveAdapter.isData;

export function loadPreferences(): ExamplePreferences {
  return gameStorage.preferences.load() as ExamplePreferences;
}

export function savePreferences(preferences: ExamplePreferences): ExamplePreferences {
  return gameStorage.preferences.save(preferences) as ExamplePreferences;
}

export function normalizePreferences(value: unknown): ExamplePreferences {
  return gameStorage.preferences.normalize(value) as ExamplePreferences;
}

export function loadReadTrackingState(): ReadTrackingState {
  return gameStorage.readTracking.load();
}

export function saveReadTrackingState(state: ReadTrackingState): ReadTrackingState {
  return gameStorage.readTracking.save(state);
}

export function serializeReadTrackingState(state: ReadTrackingState): ReadTrackingStorageData {
  return serializeStandardReadTrackingState(state, { project: projectIdentity });
}

export function parseReadTrackingStorageData(value: unknown): ReadTrackingState | null {
  return parseStandardReadTrackingStorageData(value, { project: projectIdentity });
}

export function loadSaveSlots(): readonly ExampleSaveSlot[] {
  return gameStorage.saves.loadSlots();
}

export function saveToSlot(slotId: string, data: ExampleSaveData): readonly ExampleSaveSlot[] {
  return gameStorage.saves.saveToSlot(slotId, data);
}

export function deleteSaveSlot(slotId: string): readonly ExampleSaveSlot[] {
  return gameStorage.saves.deleteSlot(slotId);
}

export function getLatestSaveSlot(slots: readonly ExampleSaveSlot[]): ExampleSaveSlot | null {
  return gameStorage.saves.getLatestSlot(slots);
}

export function parseExampleSaveData(value: unknown, createdAt?: string): ExampleSaveData | null {
  return gameStorage.runtimeSaveAdapter.parseData(value, {
    project: projectIdentity,
    ...(createdAt === undefined ? {} : { savedAt: createdAt }),
  });
}

function requireStandardRuntimeStorage(
  storage: StandardRuntimeGameStoragePreset<StandardRuntimeSavePayload, RetainedMessageEvent> | null | object,
): StandardRuntimeGameStoragePreset<StandardRuntimeSavePayload, RetainedMessageEvent> {
  if (storage === null || !("runtimeSaveAdapter" in storage)) {
    throw new Error("examples/preact-basic requires standard runtime storage to be enabled in tsuzuru.config.ts.");
  }
  return storage as StandardRuntimeGameStoragePreset<StandardRuntimeSavePayload, RetainedMessageEvent>;
}

export function App() {
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

  if (screen === "runtime") {
    return (
      <RuntimeApp
        document={scenario}
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
          slotDefinitions={SAVE_SLOT_DEFINITIONS}
          onLoad={handleTitleLoad}
          onDelete={handleDeleteSaveSlot}
          onBack={() => setScreen("title")}
        />
      ) : screen === "settings" ? (
        <SettingsScreen
          preferences={preferences}
          textSpeedOptions={TEXT_SPEED_OPTIONS}
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
  const audioState = getStdAudioState(runtime.state);
  const effectState = getStdEffectState(runtime.state);
  const visualState = getStdVisualState(runtime.state);
  const hasRestoredInitialSaveDataRef = useRef(false);
  const restoreVisualTransitionTimerRef = useRef<number | undefined>(undefined);
  const [visualTransitionsEnabled, setVisualTransitionsEnabled] = useState(true);
  const [overlay, setOverlay] = useState<RuntimeOverlay>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const overlayPreviousFocusRef = useRef<Element | null>(null);
  const openOverlay = useCallback((nextOverlay: Exclude<RuntimeOverlay, null>) => {
    overlayPreviousFocusRef.current = globalThis.document.activeElement;
    setOverlay(nextOverlay);
  }, []);
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
  const bgmAssets = useMemo(
    () => createAudioAssetsWithVolume(assets.audio.bgm, preferences.bgmVolume),
    [preferences.bgmVolume],
  );
  const seAssets = useMemo(
    () => createAudioAssetsWithVolume(assets.audio.se, preferences.seVolume),
    [preferences.seVolume],
  );
  const voiceAssets = useMemo(
    () => createAudioAssetsWithVolume(assets.audio.voice, preferences.voiceVolume),
    [preferences.voiceVolume],
  );
  const resolveCameraFocusOffset = useCallback<StdCameraFocusOffsetResolver>((focusTarget, context) => {
    const position = context.visualState?.sprites[focusTarget]?.position;
    switch (position) {
      case "left":
        return { x: 160 };
      case "right":
        return { x: -160 };
      case "center":
      case undefined:
        return { x: 0 };
    }
  }, []);
  const suppressVisualTransitionsForRestore = useCallback(() => {
    if (restoreVisualTransitionTimerRef.current !== undefined) {
      window.clearTimeout(restoreVisualTransitionTimerRef.current);
    }
    setVisualTransitionsEnabled(false);
    restoreVisualTransitionTimerRef.current = window.setTimeout(() => {
      restoreVisualTransitionTimerRef.current = undefined;
      setVisualTransitionsEnabled(true);
    }, 0);
  }, []);
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
      onSaveSlotsChange(
        saveToSlot(
          slotId,
          createExampleSaveData(
            createRuntimeSaveDataFromState(runtime.state, runtime.visibleEvent, {
              prepares: [prepareStdAudioStateForSnapshot, prepareStdEffectStateForSnapshot],
            }),
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
      suppressVisualTransitionsForRestore();
      runtime.restoreSaveData(slot.data.runtime);
      setLastMessageEvent(slot.data.retainedMessageEvent);
      setOverlay(null);
    },
    [runtime, saveSlots, suppressVisualTransitionsForRestore],
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
      if (restoreVisualTransitionTimerRef.current !== undefined) {
        window.clearTimeout(restoreVisualTransitionTimerRef.current);
      }
    };
  }, [textSoundPlayer]);

  useEffect(() => {
    if (initialSaveData === null || hasRestoredInitialSaveDataRef.current) {
      return;
    }
    hasRestoredInitialSaveDataRef.current = true;
    suppressVisualTransitionsForRestore();
    runtime.restoreSaveData(initialSaveData.runtime);
    setLastMessageEvent(initialSaveData.retainedMessageEvent);
  }, [initialSaveData, runtime, suppressVisualTransitionsForRestore]);

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
      if (overlay !== null) {
        return;
      }
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
  }, [handleAdvanceRequest, overlay]);

  useEffect(() => {
    if (overlay === null) {
      if (overlayPreviousFocusRef.current instanceof HTMLElement) {
        overlayPreviousFocusRef.current.focus();
      }
      overlayPreviousFocusRef.current = null;
      return;
    }

    overlayPreviousFocusRef.current ??= globalThis.document.activeElement;
    const animationFrame = window.requestAnimationFrame(() => {
      const focusTarget = getFirstFocusableElement(overlayRef.current) ?? overlayRef.current;
      focusTarget?.focus();
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [overlay]);

  return (
    <main className="app">
      <GameViewport aspectRatio="16:9" className="app__viewport" maxWidth="100vw">
        <GameShell className="app__shell">
          <div className="tzr-tsuzuru-game__interaction-surface" onClick={handleViewportClick}>
            <StdCameraRuntimeLayer
              runtimeState={runtime.state}
              visualState={visualState}
              resolveFocusOffset={resolveCameraFocusOffset}
            >
              <StdVisualRuntimeLayer
                runtimeState={runtime.state}
                backgroundAssets={assets.visual.backgrounds}
                spriteAssets={assets.visual.sprites}
                transitions={{ enabled: visualTransitionsEnabled }}
              />
            </StdCameraRuntimeLayer>
            <StdParticleRuntimeLayer runtimeState={runtime.state} />
            <StdAudioRuntimeLayer
              audioState={audioState}
              bgmAssets={bgmAssets}
              seAssets={seAssets}
              voiceAssets={voiceAssets}
              statusPanelClassName="tzr-std-audio-status-panel--overlay"
            />
            <StdEffectLayer
              events={effectState.events}
              nextSequence={effectState.nextSequence}
              targetSelectors={{
                screen: ".tzr-tsuzuru-game__interaction-surface",
                message: ".tzr-tsuzuru-game__message-layer",
                sprites: ".tzr-tsuzuru-game__sprite-layer",
              }}
            />
            <RuntimeControlBar
              className="app__runtime-menu"
              ariaLabel="Runtime menu"
              readCount={readCount}
              autoModeEnabled={autoMode.enabled}
              skipModeEnabled={skipModeEnabled}
              onToggleAutoMode={autoMode.toggle}
              onToggleSkipMode={() => setSkipModeEnabled((current) => !current)}
              onSave={() => openOverlay("save")}
              onLoad={() => openOverlay("load")}
              onBacklog={() => openOverlay("backlog")}
              onSettings={() => openOverlay("settings")}
              onTitle={onTitle}
            />
            <div className="tzr-tsuzuru-game__message-layer">
              {canStart ? null : choiceEvent !== null ? (
                <>
                  <ChoiceLayer
                    className="tzr-choice-layer--above-message"
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
              <div
                ref={overlayRef}
                className="app__overlay"
                role="dialog"
                aria-label={`${formatRuntimeOverlayLabel(overlay)} screen`}
                aria-modal="true"
                tabIndex={-1}
                onKeyDown={(event) => {
                  event.stopPropagation();
                  if ((event.key === "Enter" || event.key === " ") && event.target === event.currentTarget) {
                    event.preventDefault();
                    return;
                  }
                  if (event.key === "Tab") {
                    trapFocusInOverlay(event.currentTarget, event);
                  }
                  if (event.key === "Escape") {
                    setOverlay(null);
                  }
                }}
              >
                {overlay === "save" ? (
                  <SaveScreen
                    slots={saveSlots}
                    slotDefinitions={SAVE_SLOT_DEFINITIONS}
                    onSave={handleSaveToSlot}
                    onDelete={handleDeleteSaveSlot}
                    onBack={() => setOverlay(null)}
                  />
                ) : overlay === "load" ? (
                  <LoadScreen
                    slots={saveSlots}
                    slotDefinitions={SAVE_SLOT_DEFINITIONS}
                    onLoad={handleLoadFromSlot}
                    onDelete={handleDeleteSaveSlot}
                    onBack={() => setOverlay(null)}
                  />
                ) : overlay === "backlog" ? (
                  <BacklogScreen entries={backlogEntries} onBack={() => setOverlay(null)} />
                ) : (
                  <SettingsScreen
                    preferences={preferences}
                    textSpeedOptions={TEXT_SPEED_OPTIONS}
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
      ".tzr-screen, .app__runtime-menu, .tzr-message-window, .tzr-choice-layer, button, a, input, select, textarea",
    ) !== null
  );
}

function isKeyboardHandledTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest(".tzr-screen, .tzr-message-window, .tzr-choice-layer, button, a, input, select, textarea") !== null
  );
}

function getFirstFocusableElement(root: HTMLElement | null): HTMLElement | null {
  return getFocusableElements(root)[0] ?? null;
}

function getFocusableElements(root: HTMLElement | null): readonly HTMLElement[] {
  if (root === null) {
    return [];
  }
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hasAttribute("disabled") && element.tabIndex >= 0);
}

function trapFocusInOverlay(root: HTMLElement, event: Pick<KeyboardEvent, "preventDefault" | "shiftKey">): void {
  const focusableElements = getFocusableElements(root);
  if (focusableElements.length === 0) {
    event.preventDefault();
    root.focus();
    return;
  }

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  const activeElement = globalThis.document.activeElement;

  if (activeElement === root || !(activeElement instanceof Node) || !root.contains(activeElement)) {
    event.preventDefault();
    (event.shiftKey ? lastElement : firstElement)?.focus();
    return;
  }

  if (event.shiftKey && activeElement === firstElement) {
    event.preventDefault();
    lastElement?.focus();
    return;
  }

  if (!event.shiftKey && activeElement === lastElement) {
    event.preventDefault();
    firstElement?.focus();
  }
}

function formatRuntimeOverlayLabel(overlay: Exclude<RuntimeOverlay, null>): string {
  switch (overlay) {
    case "save":
      return "Save";
    case "load":
      return "Load";
    case "settings":
      return "Settings";
    case "backlog":
      return "Backlog";
  }
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
  return createReadEntryKeyFromText(
    entry.kind === "dialogue"
      ? {
          kind: "dialogue",
          speaker: entry.speakerName ?? "",
          text: entry.text,
        }
      : {
          kind: "narration",
          text: entry.text,
        },
  );
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
