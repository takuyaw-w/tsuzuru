import type { CompiledTzrDocument, RuntimeDiagnostic, RuntimeEvent, RuntimePluginDefinition } from "@tsuzuru/core";
import { createStdAudioCommandHandlers, createStdAudioPlugin } from "@tsuzuru/plugin-std-audio";
import { createStdVisualCommandHandlers, createStdVisualPlugin } from "@tsuzuru/plugin-std-visual";
import { getRenderableRuntimeEvent, type RuntimeSaveData, useRuntime } from "@tsuzuru/preact";
import {
  ChoiceLayer,
  GameShell,
  GameViewport,
  type MessageWindowRenderLineContext,
  RuntimeMessageLayer,
  useTextReveal,
} from "@tsuzuru/standard-ui-preact";
import type { ComponentChildren, ComponentProps } from "preact";
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { AudioLayer } from "./AudioLayer.js";
import { createMessageHistoryEntry, isMessageHistoryEvent, type MessageHistoryEntry } from "./message-history.js";
import { type ExamplePreferences, loadPreferences, savePreferences } from "./preferences.js";
import {
  createInitialReadTrackingState,
  createReadEntryKey,
  isRead,
  isReadTrackableEvent,
  markRead,
  type ReadEntryKey,
  type ReadTrackingState,
} from "./read-tracking.js";
import { deleteSaveSlot, type ExampleSaveSlot, getLatestSaveSlot, loadSaveSlots, saveToSlot } from "./save-storage.js";
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

export function App() {
  const documentResult = useMemo((): DocumentResult => {
    if (!scenarioProject.ok) {
      return { ok: false, message: formatDiagnostics(scenarioProject.errors) };
    }
    return { ok: true, document: scenarioProject.document };
  }, []);
  const [screen, setScreen] = useState<AppScreen>("title");
  const [saveSlots, setSaveSlots] = useState<readonly ExampleSaveSlot[]>(() => loadSaveSlots());
  const [initialSaveData, setInitialSaveData] = useState<RuntimeSaveData | null>(null);
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
  readonly initialSaveData: RuntimeSaveData | null;
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
    () => [createStdVisualPlugin(), createStdAudioPlugin()],
    [],
  );
  const commandHandlers = useMemo(
    () => ({
      ...createStdVisualCommandHandlers(),
      ...createStdAudioCommandHandlers(),
    }),
    [],
  );
  const [diagnostics, setDiagnostics] = useState<readonly RuntimeDiagnostic[]>([]);
  const recordDiagnostic = useCallback((diagnostic: RuntimeDiagnostic) => {
    setDiagnostics((current) => [...current, diagnostic]);
  }, []);
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
  const [autoModeEnabled, setAutoModeEnabled] = useState(false);
  const [lastMessageEvent, setLastMessageEvent] = useState<RuntimeEvent | null>(null);
  const [messageHistory, setMessageHistory] = useState<readonly MessageHistoryEntry[]>([]);
  const [messageHistoryReadKeys, setMessageHistoryReadKeys] = useState<ReadonlyMap<number, ReadEntryKey>>(
    () => new Map(),
  );
  const [readTracking, setReadTracking] = useState<ReadTrackingState>(() => createInitialReadTrackingState());
  const recordedMessageHistoryKeyRef = useRef<string | null>(null);
  const recordedReadTrackingPresentationKeyRef = useRef<string | null>(null);
  const nextMessageHistoryIdRef = useRef(1);
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
  const textReveal = useTextReveal(revealText, {
    enabled: messageLines !== null && preferences.textRevealEnabled,
    charactersPerSecond: preferences.textSpeedCharactersPerSecond,
  });
  const backlogEntries = useMemo<readonly BacklogViewEntry[]>(
    () =>
      messageHistory.map((entry) => {
        const readEntryKey = messageHistoryReadKeys.get(entry.id);
        return {
          ...entry,
          read: readEntryKey !== undefined && isRead(readTracking, readEntryKey),
        };
      }),
    [messageHistory, messageHistoryReadKeys, readTracking],
  );
  const readCount = readTracking.readEntryKeys.size;
  const canAdvanceText =
    visiblePresentationEvent !== null &&
    isMessageEvent(visiblePresentationEvent) &&
    currentRenderableEvent === runtime.visibleEvent &&
    runtime.blockReason === null &&
    !runtime.state.isStopped;
  const canAutoAdvanceText =
    autoModeEnabled &&
    overlay === null &&
    choiceEvent === null &&
    visiblePresentationEvent !== null &&
    isMessageEvent(visiblePresentationEvent) &&
    textReveal.isComplete &&
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
      onSaveSlotsChange(saveToSlot(slotId, runtime.createSaveData()));
      setOverlay(null);
    },
    [onSaveSlotsChange, runtime],
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
      runtime.restoreSaveData(slot.data);
      setOverlay(null);
    },
    [runtime, saveSlots],
  );

  useEffect(() => {
    textReveal.reset();
  }, [presentationKey, textReveal.reset]);

  useEffect(() => {
    if (!canAutoAdvanceText) {
      return;
    }

    const timer = window.setTimeout(() => {
      runtime.step();
    }, AUTO_MODE_ADVANCE_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [canAutoAdvanceText, presentationKey, runtime.step]);

  useEffect(() => {
    if (initialSaveData === null || hasRestoredInitialSaveDataRef.current) {
      return;
    }
    hasRestoredInitialSaveDataRef.current = true;
    runtime.restoreSaveData(initialSaveData);
  }, [initialSaveData, runtime]);

  useEffect(() => {
    if (runtime.visibleEvent !== null && isMessageEvent(runtime.visibleEvent)) {
      setLastMessageEvent(runtime.visibleEvent);
    }
  }, [runtime.visibleEvent]);

  useEffect(() => {
    if (
      !isReadTrackableEvent(runtime.visibleEvent) ||
      recordedReadTrackingPresentationKeyRef.current === presentationKey
    ) {
      return;
    }

    recordedReadTrackingPresentationKeyRef.current = presentationKey;
    const readEntryKey = createReadEntryKey(runtime.visibleEvent);
    setReadTracking((current) => markRead(current, readEntryKey));
  }, [presentationKey, runtime.visibleEvent]);

  useEffect(() => {
    if (!isMessageHistoryEvent(runtime.visibleEvent) || recordedMessageHistoryKeyRef.current === presentationKey) {
      return;
    }

    const entryId = nextMessageHistoryIdRef.current;
    const entry = createMessageHistoryEntry(runtime.visibleEvent, entryId);
    const readEntryKey = createReadEntryKey(runtime.visibleEvent);
    nextMessageHistoryIdRef.current += 1;
    recordedMessageHistoryKeyRef.current = presentationKey;
    setMessageHistory((current) => [...current, entry]);
    setMessageHistoryReadKeys((current) => new Map([...current, [entryId, readEntryKey]]));
  }, [presentationKey, runtime.visibleEvent]);

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
            <AudioLayer runtimeState={runtime.state} />
            <nav className="app__runtime-menu" aria-label="Runtime menu">
              <span className="read-status" aria-label="Read count">
                Read: {readCount}
              </span>
              <button
                type="button"
                aria-pressed={autoModeEnabled}
                onClick={() => setAutoModeEnabled((current) => !current)}
              >
                Auto
              </button>
              <button type="button" onClick={() => setOverlay("save")}>
                Save
              </button>
              <button type="button" onClick={() => setOverlay("load")}>
                Load
              </button>
              <button type="button" onClick={() => setOverlay("backlog")}>
                Backlog
              </button>
              <button type="button" onClick={() => setOverlay("settings")}>
                Settings
              </button>
              <button type="button" onClick={onTitle}>
                Title
              </button>
            </nav>
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

function getMessageLines(event: RuntimeEvent): readonly string[] | null {
  if (!isMessageEvent(event)) {
    return null;
  }
  return event.lines.map((line) => line.text);
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
