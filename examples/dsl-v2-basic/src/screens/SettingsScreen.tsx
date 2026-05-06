interface SettingsScreenProps {
  readonly onBack: () => void;
}

export function SettingsScreen({ onBack }: SettingsScreenProps) {
  return (
    <section className="screen" aria-label="Settings">
      <div className="screen__content screen__content--panel">
        <h1 className="screen__heading">Settings</h1>
        <label className="screen__toggle">
          <input type="checkbox" defaultChecked />
          Auto clear waits
        </label>
        <label className="screen__toggle">
          <input type="checkbox" defaultChecked />
          Text reveal
        </label>
        <button type="button" className="screen__button" onClick={onBack}>
          Back
        </button>
      </div>
    </section>
  );
}
