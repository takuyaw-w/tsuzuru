import type { ComponentChildren } from "preact";
import { joinClassNames } from "./class-name.js";

export interface RuntimeControlBarLabels {
  readonly read: string;
  readonly auto: string;
  readonly skip: string;
  readonly save: string;
  readonly load: string;
  readonly backlog: string;
  readonly settings: string;
  readonly title: string;
}

export interface RuntimeControlBarDisabledState {
  readonly auto: boolean;
  readonly skip: boolean;
  readonly save: boolean;
  readonly load: boolean;
  readonly backlog: boolean;
  readonly settings: boolean;
  readonly title: boolean;
}

export interface RuntimeControlBarHiddenState {
  readonly read: boolean;
  readonly auto: boolean;
  readonly skip: boolean;
  readonly save: boolean;
  readonly load: boolean;
  readonly backlog: boolean;
  readonly settings: boolean;
  readonly title: boolean;
}

export interface RuntimeControlBarProps {
  readonly readCount?: number | undefined;
  readonly autoModeEnabled?: boolean | undefined;
  readonly skipModeEnabled?: boolean | undefined;
  readonly onToggleAutoMode?: (() => void) | undefined;
  readonly onToggleSkipMode?: (() => void) | undefined;
  readonly onSave?: (() => void) | undefined;
  readonly onLoad?: (() => void) | undefined;
  readonly onBacklog?: (() => void) | undefined;
  readonly onSettings?: (() => void) | undefined;
  readonly onTitle?: (() => void) | undefined;
  readonly labels?: Partial<RuntimeControlBarLabels> | undefined;
  readonly disabled?: Partial<RuntimeControlBarDisabledState> | undefined;
  readonly hidden?: Partial<RuntimeControlBarHiddenState> | undefined;
  readonly className?: string | undefined;
  readonly ariaLabel?: string | undefined;
}

const DEFAULT_RUNTIME_CONTROL_BAR_LABELS = {
  read: "Read",
  auto: "Auto",
  skip: "Skip",
  save: "Save",
  load: "Load",
  backlog: "Backlog",
  settings: "Settings",
  title: "Title",
} satisfies RuntimeControlBarLabels;

export function RuntimeControlBar({
  readCount,
  autoModeEnabled = false,
  skipModeEnabled = false,
  onToggleAutoMode,
  onToggleSkipMode,
  onSave,
  onLoad,
  onBacklog,
  onSettings,
  onTitle,
  labels,
  disabled,
  hidden,
  className,
  ariaLabel = "Runtime controls",
}: RuntimeControlBarProps): ComponentChildren {
  const resolvedLabels = { ...DEFAULT_RUNTIME_CONTROL_BAR_LABELS, ...labels };

  return (
    <nav className={joinClassNames("tzr-runtime-control-bar", className)} aria-label={ariaLabel}>
      {readCount === undefined || hidden?.read === true ? null : (
        <span className="tzr-runtime-control-bar__status" aria-label={`${resolvedLabels.read} count`}>
          {resolvedLabels.read}: {readCount}
        </span>
      )}
      <div className="tzr-runtime-control-bar__actions">
        <ControlButton
          hidden={hidden?.auto}
          disabled={disabled?.auto === true || onToggleAutoMode === undefined}
          active={autoModeEnabled}
          onClick={onToggleAutoMode}
        >
          {resolvedLabels.auto}
        </ControlButton>
        <ControlButton
          hidden={hidden?.skip}
          disabled={disabled?.skip === true || onToggleSkipMode === undefined}
          active={skipModeEnabled}
          onClick={onToggleSkipMode}
        >
          {resolvedLabels.skip}
        </ControlButton>
        <ControlButton
          hidden={hidden?.save}
          disabled={disabled?.save === true || onSave === undefined}
          onClick={onSave}
        >
          {resolvedLabels.save}
        </ControlButton>
        <ControlButton
          hidden={hidden?.load}
          disabled={disabled?.load === true || onLoad === undefined}
          onClick={onLoad}
        >
          {resolvedLabels.load}
        </ControlButton>
        <ControlButton
          hidden={hidden?.backlog}
          disabled={disabled?.backlog === true || onBacklog === undefined}
          onClick={onBacklog}
        >
          {resolvedLabels.backlog}
        </ControlButton>
        <ControlButton
          hidden={hidden?.settings}
          disabled={disabled?.settings === true || onSettings === undefined}
          onClick={onSettings}
        >
          {resolvedLabels.settings}
        </ControlButton>
        <ControlButton
          hidden={hidden?.title}
          disabled={disabled?.title === true || onTitle === undefined}
          onClick={onTitle}
        >
          {resolvedLabels.title}
        </ControlButton>
      </div>
    </nav>
  );
}

function ControlButton({
  active,
  disabled,
  hidden,
  onClick,
  children,
}: {
  readonly active?: boolean | undefined;
  readonly disabled: boolean;
  readonly hidden?: boolean | undefined;
  readonly onClick?: (() => void) | undefined;
  readonly children: ComponentChildren;
}): ComponentChildren {
  if (hidden === true) {
    return null;
  }

  const activeProps = active === undefined ? {} : { "aria-pressed": active };

  return (
    <button
      type="button"
      className={joinClassNames(
        "tzr-runtime-control-bar__button",
        active === true ? "tzr-runtime-control-bar__button--active" : undefined,
      )}
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      {...activeProps}
    >
      {children}
    </button>
  );
}
