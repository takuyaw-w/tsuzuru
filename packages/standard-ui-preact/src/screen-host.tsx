import type { ComponentChildren } from "preact";
import { joinClassNames } from "./class-name.js";

export type ScreenComponentProps<TParams = unknown> = {
  readonly params: TParams | undefined;
  readonly onClose: () => void;
};

export type ScreenComponent<TParams = unknown> = (props: ScreenComponentProps<TParams>) => ComponentChildren;

export type ActiveScreen<TParams = unknown> = {
  readonly id: string;
  readonly params?: TParams;
};

export type ScreenRegistry = Record<string, ScreenComponent>;

export type ScreenHostProps = {
  readonly activeScreen: ActiveScreen | null;
  readonly screens: ScreenRegistry;
  readonly onClose: () => void;
  readonly className?: string;
};

export function ScreenHost({ activeScreen, screens, onClose, className }: ScreenHostProps): ComponentChildren {
  if (activeScreen === null) {
    return null;
  }

  const Screen = screens[activeScreen.id];

  return (
    <div className={joinClassNames("tzr-screen-host", className)}>
      <div className="tzr-screen-host__backdrop" />
      <div className="tzr-screen-host__surface">
        {Screen === undefined ? (
          FallbackScreen({ screenId: activeScreen.id, onClose })
        ) : (
          <Screen params={activeScreen.params} onClose={onClose} />
        )}
      </div>
    </div>
  );
}

function FallbackScreen({ screenId, onClose }: { readonly screenId: string; readonly onClose: () => void }) {
  return (
    <div className="tzr-screen-host__fallback">
      <div className="tzr-screen-host__fallback-title">Unknown screen</div>
      <p className="tzr-screen-host__fallback-message">No screen is registered for "{screenId}".</p>
      <button className="tzr-screen-host__fallback-button" type="button" onClick={onClose}>
        Close
      </button>
    </div>
  );
}
