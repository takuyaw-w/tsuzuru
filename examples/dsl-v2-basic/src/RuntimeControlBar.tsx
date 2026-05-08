interface RuntimeControlBarProps {
  readonly readCount: number;
  readonly autoModeEnabled: boolean;
  readonly skipModeEnabled: boolean;
  readonly onToggleAutoMode: () => void;
  readonly onToggleSkipMode: () => void;
  readonly onOpenSave: () => void;
  readonly onOpenLoad: () => void;
  readonly onOpenBacklog: () => void;
  readonly onOpenSettings: () => void;
  readonly onTitle: () => void;
}

export function RuntimeControlBar({
  readCount,
  autoModeEnabled,
  skipModeEnabled,
  onToggleAutoMode,
  onToggleSkipMode,
  onOpenSave,
  onOpenLoad,
  onOpenBacklog,
  onOpenSettings,
  onTitle,
}: RuntimeControlBarProps) {
  return (
    <nav className="app__runtime-menu" aria-label="Runtime menu">
      <span className="read-status" aria-label="Read count">
        Read: {readCount}
      </span>
      <button type="button" aria-pressed={autoModeEnabled} onClick={onToggleAutoMode}>
        Auto
      </button>
      <button type="button" aria-pressed={skipModeEnabled} onClick={onToggleSkipMode}>
        Skip
      </button>
      <button type="button" onClick={onOpenSave}>
        Save
      </button>
      <button type="button" onClick={onOpenLoad}>
        Load
      </button>
      <button type="button" onClick={onOpenBacklog}>
        Backlog
      </button>
      <button type="button" onClick={onOpenSettings}>
        Settings
      </button>
      <button type="button" onClick={onTitle}>
        Title
      </button>
    </nav>
  );
}
