import {
  createStdHotspotCommandHandlers,
  createStdHotspotPlugin,
  getStdHotspotState,
} from "@tsuzuru/plugin-std-hotspot";
import { createStdVisualCommandHandlers, createStdVisualPlugin } from "@tsuzuru/plugin-std-visual";
import { useRuntime } from "@tsuzuru/preact";
import {
  GameShell,
  GameViewport,
  RuntimeMessageLayer,
  StdHotspotRuntimeLayer,
  StdVisualRuntimeLayer,
  type TsuzuruGameAssets,
  type TsuzuruGameScenario,
} from "@tsuzuru/standard-ui-preact";
import type { ComponentChildren, ComponentProps } from "preact";
import { useCallback, useMemo } from "preact/hooks";

type DivClickHandler = NonNullable<ComponentProps<"div">["onClick"]>;

interface GameRootProps {
  readonly scenario: TsuzuruGameScenario;
  readonly assets: TsuzuruGameAssets;
  readonly onTitle: () => void;
}

export function GameRoot({ scenario, assets, onTitle }: GameRootProps): ComponentChildren {
  if ("ok" in scenario && !scenario.ok) {
    return <main className="hotspot-app">Scenario compile failed.</main>;
  }

  const document = "ok" in scenario ? scenario.document : scenario;
  const plugins = useMemo(() => [createStdVisualPlugin(), createStdHotspotPlugin()], []);
  const commandHandlers = useMemo(
    () => ({
      ...createStdVisualCommandHandlers(),
      ...createStdHotspotCommandHandlers(),
    }),
    [],
  );
  const runtime = useRuntime(document, {
    plugins,
    commandHandlers,
    autoStart: true,
    autoStepTransientEvents: true,
  });
  const hotspotState = getStdHotspotState(runtime.state);

  const advance = useCallback(() => {
    if (runtime.visibleEvent?.type === "choice") {
      return;
    }
    if (hotspotState.waiting) {
      return;
    }
    if (runtime.blockReason === "click") {
      runtime.continueClick();
      return;
    }
    if (runtime.blockReason === null && !runtime.state.isStopped) {
      runtime.step();
    }
  }, [hotspotState.waiting, runtime]);

  const handleSurfaceClick = useCallback<DivClickHandler>(
    (event) => {
      if (isInteractiveTarget(event.target)) {
        return;
      }
      advance();
    },
    [advance],
  );

  return (
    <main className="hotspot-app hotspot-game-root">
      <GameViewport
        className="hotspot-game-root__viewport"
        aspectRatio="16:9"
        maxWidth="min(100vw, calc(100dvh * 16 / 9))"
      >
        <GameShell className="hotspot-game-root__shell">
          <div className="hotspot-game-root__surface" onClick={handleSurfaceClick}>
            <StdVisualRuntimeLayer
              runtimeState={runtime.state}
              backgroundAssets={assets.visual?.backgrounds}
              spriteAssets={assets.visual?.sprites}
            />
            <StdHotspotRuntimeLayer runtime={runtime} />
            {runtime.visibleEvent === null ? null : (
              <div
                className={
                  hotspotState.waiting
                    ? "hotspot-game-root__message hotspot-game-root__message--hotspot-waiting"
                    : "hotspot-game-root__message"
                }
              >
                <RuntimeMessageLayer
                  event={runtime.visibleEvent}
                  onChoice={runtime.choose}
                  onAdvance={advance}
                  onContinue={runtime.continueClick}
                  canAdvance={!hotspotState.waiting}
                  continueLabel="Continue"
                  advanceHint={hotspotState.waiting ? "気になる場所をクリック" : "クリックで進む"}
                />
              </div>
            )}
          </div>
        </GameShell>
      </GameViewport>
      <nav className="hotspot-game-root__menu" aria-label="Game menu">
        <button type="button" onClick={onTitle}>
          Title
        </button>
      </nav>
    </main>
  );
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }
  return target.closest("button, a, input, select, textarea") !== null;
}
