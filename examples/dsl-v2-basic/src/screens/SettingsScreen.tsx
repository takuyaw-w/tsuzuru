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
          <VolumePreferenceField
            label="BGM volume"
            value={preferences.bgmVolume}
            onChange={(bgmVolume) => {
              onChangePreferences({
                ...preferences,
                bgmVolume,
              });
            }}
          />
          <VolumePreferenceField
            label="SE volume"
            value={preferences.seVolume}
            onChange={(seVolume) => {
              onChangePreferences({
                ...preferences,
                seVolume,
              });
            }}
          />
          <VolumePreferenceField
            label="Voice volume"
            value={preferences.voiceVolume}
            onChange={(voiceVolume) => {
              onChangePreferences({
                ...preferences,
                voiceVolume,
              });
            }}
          />
        </div>
        <button type="button" className="screen__button" onClick={onBack}>
          Back
        </button>
      </div>
    </section>
  );
}

interface VolumePreferenceFieldProps {
  readonly label: string;
  readonly value: number;
  readonly onChange: (value: number) => void;
}

function VolumePreferenceField({ label, value, onChange }: VolumePreferenceFieldProps) {
  return (
    <label className="settings__field">
      <span className="settings__label">{label}</span>
      <input
        type="range"
        className="settings__control"
        aria-label={label}
        min="0"
        max="1"
        step="0.05"
        value={value}
        onChange={(event) => {
          onChange(event.currentTarget.valueAsNumber);
        }}
      />
      <span className="settings__hint">{Math.round(value * 100)}%</span>
    </label>
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
