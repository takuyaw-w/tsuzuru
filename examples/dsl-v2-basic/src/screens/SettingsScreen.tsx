import type { ExamplePreferences, TextSpeedCharactersPerSecond } from "../preferences.js";
import { TEXT_SPEED_OPTIONS } from "../preferences.js";

interface SettingsScreenProps {
  readonly preferences: ExamplePreferences;
  readonly onChangePreferences: (preferences: ExamplePreferences) => void;
  readonly onBack: () => void;
}

export function SettingsScreen({ preferences, onChangePreferences, onBack }: SettingsScreenProps) {
  return (
    <section className="screen" aria-label="Settings">
      <div className="screen__content screen__content--panel">
        <h1 className="screen__heading">Settings</h1>
        <div className="settings">
          <label className="settings__field">
            <span className="settings__label">Text reveal</span>
            <input
              type="checkbox"
              className="settings__control"
              aria-label="Text reveal"
              checked={preferences.textRevealEnabled}
              onChange={(event) => {
                onChangePreferences({
                  ...preferences,
                  textRevealEnabled: event.currentTarget.checked,
                });
              }}
            />
            <span className="settings__hint">Reveal message text over time.</span>
          </label>
          <label className="settings__field">
            <span className="settings__label">Text speed</span>
            <select
              className="settings__control"
              aria-label="Text speed"
              value={preferences.textSpeedCharactersPerSecond}
              onChange={(event) => {
                onChangePreferences({
                  ...preferences,
                  textSpeedCharactersPerSecond: parseTextSpeedCharactersPerSecond(event.currentTarget.value),
                });
              }}
            >
              {TEXT_SPEED_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {formatTextSpeedLabel(value)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button type="button" className="screen__button" onClick={onBack}>
          Back
        </button>
      </div>
    </section>
  );
}

function parseTextSpeedCharactersPerSecond(value: string): TextSpeedCharactersPerSecond {
  const parsedValue = Number(value);
  return TEXT_SPEED_OPTIONS.includes(parsedValue as TextSpeedCharactersPerSecond)
    ? (parsedValue as TextSpeedCharactersPerSecond)
    : 60;
}

function formatTextSpeedLabel(charactersPerSecond: TextSpeedCharactersPerSecond): string {
  if (charactersPerSecond === 30) {
    return "Slow";
  }
  if (charactersPerSecond === 120) {
    return "Fast";
  }
  return "Normal";
}
