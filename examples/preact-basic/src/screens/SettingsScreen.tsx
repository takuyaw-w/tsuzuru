import { Screen } from "@tsuzuru/standard-ui-preact";

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

type SettingsTab = "text" | "sound";
type TextSpeedCharactersPerSecond = 30 | 60 | 120;

const SETTINGS_TABS = [
  { id: "text", label: "Text" },
  { id: "sound", label: "Sound" },
] as const satisfies readonly { readonly id: SettingsTab; readonly label: string }[];

export function SettingsScreen({
  preferences,
  textSpeedOptions,
  onChangePreferences,
  onBack,
}: SettingsScreenProps) {
  return (
    <Screen className="settings-screen" aria-label="Settings">
      <div className="settings-screen__backdrop" aria-hidden="true" />
      <section className="settings-config" aria-label="CONFIG">
        <header className="settings-config__header">
          <p className="settings-config__eyebrow">Tsuzuru</p>
          <h1 className="settings-config__title">CONFIG</h1>
        </header>

        {SETTINGS_TABS.map((tab, index) => (
          <input
            key={tab.id}
            id={`settings-tab-${tab.id}`}
            className="settings-config__tab-input"
            type="radio"
            name="settings-tab"
            defaultChecked={index === 0}
          />
        ))}

        <div className="settings-config__panel">
          <nav className="settings-config__tabs" aria-label="Config categories">
            {SETTINGS_TABS.map((tab) => (
              <label
                key={tab.id}
                className="settings-config__tab"
                htmlFor={`settings-tab-${tab.id}`}
              >
                {tab.label}
              </label>
            ))}
          </nav>

          <div className="settings-config__content">
            <div className="settings-config__section settings-config__section--text" aria-label="Text settings">
              <ToggleSetting
                label="Text reveal"
                description="Display message text with a gradual reveal."
                checked={preferences.textRevealEnabled}
                onChange={(textRevealEnabled) => {
                  onChangePreferences({ ...preferences, textRevealEnabled });
                }}
              />
              <SegmentedSetting
                label="Text speed"
                value={preferences.textSpeedCharactersPerSecond}
                options={textSpeedOptions}
                getLabel={formatTextSpeedLabel}
                onChange={(textSpeedCharactersPerSecond) => {
                  onChangePreferences({ ...preferences, textSpeedCharactersPerSecond });
                }}
              />
            </div>
            <div className="settings-config__section settings-config__section--sound" aria-label="Sound settings">
              <ToggleSetting
                label="Text sound"
                description="Play short blips while message text appears."
                checked={preferences.textSoundEnabled}
                onChange={(textSoundEnabled) => {
                  onChangePreferences({ ...preferences, textSoundEnabled });
                }}
              />
              <VolumeSetting
                label="Text sound volume"
                controlId="settings-text-sound-volume-control"
                value={preferences.textSoundVolume}
                onChange={(textSoundVolume) => {
                  onChangePreferences({ ...preferences, textSoundVolume });
                }}
              />
              <VolumeSetting
                label="BGM volume"
                controlId="settings-bgm-volume-control"
                value={preferences.bgmVolume}
                onChange={(bgmVolume) => {
                  onChangePreferences({ ...preferences, bgmVolume });
                }}
              />
              <VolumeSetting
                label="SE volume"
                controlId="settings-se-volume-control"
                value={preferences.seVolume}
                onChange={(seVolume) => {
                  onChangePreferences({ ...preferences, seVolume });
                }}
              />
              <VolumeSetting
                label="Voice volume"
                controlId="settings-voice-volume-control"
                value={preferences.voiceVolume}
                onChange={(voiceVolume) => {
                  onChangePreferences({ ...preferences, voiceVolume });
                }}
              />
            </div>
          </div>
        </div>

        <footer className="settings-config__footer">
          <p className="settings-config__status">Preferences are saved automatically.</p>
          <button type="button" className="settings-config__back-button" onClick={onBack}>
            Back
          </button>
        </footer>
      </section>
    </Screen>
  );
}

interface ToggleSettingProps {
  readonly label: string;
  readonly description: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
}

function ToggleSetting({ label, description, checked, onChange }: ToggleSettingProps) {
  return (
    <div className="settings-config__item">
      <div className="settings-config__item-copy">
        <p className="settings-config__item-label">{label}</p>
        <p className="settings-config__item-description">{description}</p>
      </div>
      <div className="settings-config__toggle-group" role="group" aria-label={label}>
        <button
          type="button"
          className="settings-config__choice-button"
          aria-pressed={checked}
          onClick={() => onChange(true)}
        >
          On
        </button>
        <button
          type="button"
          className="settings-config__choice-button"
          aria-pressed={!checked}
          onClick={() => onChange(false)}
        >
          Off
        </button>
      </div>
    </div>
  );
}

interface SegmentedSettingProps<T extends string | number> {
  readonly label: string;
  readonly value: T;
  readonly options: readonly T[];
  readonly getLabel: (value: T) => string;
  readonly onChange: (value: T) => void;
}

function SegmentedSetting<T extends string | number>({
  label,
  value,
  options,
  getLabel,
  onChange,
}: SegmentedSettingProps<T>) {
  return (
    <div className="settings-config__item">
      <div className="settings-config__item-copy">
        <p className="settings-config__item-label">{label}</p>
        <p className="settings-config__item-description">Choose how quickly each message appears.</p>
      </div>
      <div className="settings-config__segmented" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className="settings-config__choice-button"
            aria-pressed={option === value}
            onClick={() => onChange(option)}
          >
            {getLabel(option)}
          </button>
        ))}
      </div>
    </div>
  );
}

interface VolumeSettingProps {
  readonly label: string;
  readonly controlId: string;
  readonly value: number;
  readonly onChange: (value: number) => void;
}

function VolumeSetting({ label, controlId, value, onChange }: VolumeSettingProps) {
  const percentage = `${Math.round(value * 100)}%`;
  return (
    <div className="settings-config__item settings-config__item--slider">
      <label className="settings-config__item-label" htmlFor={controlId}>
        {label}
      </label>
      <div className="settings-config__slider-row">
        <input
          id={controlId}
          className="settings-config__slider"
          type="range"
          aria-valuetext={percentage}
          min="0"
          max="1"
          step="0.05"
          value={value}
          onChange={(event) => {
            onChange(event.currentTarget.valueAsNumber);
          }}
        />
        <span className="settings-config__value">{percentage}</span>
      </div>
    </div>
  );
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
