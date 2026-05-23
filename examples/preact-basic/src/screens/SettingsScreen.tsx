interface SettingsScreenProps {
  readonly preferences: SettingsPreferences;
  readonly textSpeedOptions: readonly TextSpeedCharactersPerSecond[];
  readonly onChangePreferences: (preferences: SettingsPreferences) => void;
  readonly onBack: () => void;
}

interface SettingsPreferences {
  readonly textRevealEnabled: boolean;
  readonly textSpeedCharactersPerSecond: TextSpeedCharactersPerSecond;
  readonly textSoundEnabled: boolean;
  readonly textSoundVolume: number;
  readonly bgmVolume: number;
  readonly seVolume: number;
  readonly voiceVolume: number;
}

type TextSpeedCharactersPerSecond = 30 | 60 | 120;

export function SettingsScreen({ preferences, textSpeedOptions, onChangePreferences, onBack }: SettingsScreenProps) {
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
                  textSpeedCharactersPerSecond: parseTextSpeedCharactersPerSecond(
                    event.currentTarget.value,
                    textSpeedOptions,
                  ),
                });
              }}
            >
              {textSpeedOptions.map((value) => (
                <option key={value} value={value}>
                  {formatTextSpeedLabel(value)}
                </option>
              ))}
            </select>
          </label>
          <VolumePreferenceField
            label="Text sound volume"
            value={preferences.textSoundVolume}
            onChange={(textSoundVolume) => {
              onChangePreferences({
                ...preferences,
                textSoundVolume,
              });
            }}
          />
          <label className="settings__field">
            <span className="settings__label">Text sound</span>
            <input
              type="checkbox"
              className="settings__control"
              aria-label="Text sound"
              checked={preferences.textSoundEnabled}
              onChange={(event) => {
                onChangePreferences({
                  ...preferences,
                  textSoundEnabled: event.currentTarget.checked,
                });
              }}
            />
            <span className="settings__hint">Play short blips during text reveal.</span>
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

function parseTextSpeedCharactersPerSecond(
  value: string,
  textSpeedOptions: readonly TextSpeedCharactersPerSecond[],
): TextSpeedCharactersPerSecond {
  const parsedValue = Number(value);
  return textSpeedOptions.includes(parsedValue as TextSpeedCharactersPerSecond)
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
