import { Screen, ScreenButton, ScreenField, ScreenHeading, ScreenPanel } from "@tsuzuru/standard-ui-preact";

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

export function SettingsScreen({
  preferences,
  textSpeedOptions,
  onChangePreferences,
  onBack,
}: SettingsScreenProps) {
  return (
    <Screen aria-label="Settings">
      <ScreenPanel>
        <ScreenHeading>Settings</ScreenHeading>
        <div className="settings">
          <ScreenField
            label="Text reveal"
            controlId="settings-text-reveal-control"
            hint="Reveal message text over time."
            hintId="settings-text-reveal-hint"
          >
            <input
              id="settings-text-reveal-control"
              type="checkbox"
              aria-describedby="settings-text-reveal-hint"
              checked={preferences.textRevealEnabled}
              onChange={(event) => {
                onChangePreferences({
                  ...preferences,
                  textRevealEnabled: event.currentTarget.checked,
                });
              }}
            />
          </ScreenField>
          <ScreenField label="Text speed" controlId="settings-text-speed-control">
            <select
              id="settings-text-speed-control"
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
          </ScreenField>
          <VolumePreferenceField
            label="Text sound volume"
            controlId="settings-text-sound-volume-control"
            value={preferences.textSoundVolume}
            hintId="settings-text-sound-volume-hint"
            onChange={(textSoundVolume) => {
              onChangePreferences({
                ...preferences,
                textSoundVolume,
              });
            }}
          />
          <ScreenField
            label="Text sound"
            controlId="settings-text-sound-control"
            hint="Play short blips during text reveal."
            hintId="settings-text-sound-hint"
          >
            <input
              id="settings-text-sound-control"
              type="checkbox"
              aria-describedby="settings-text-sound-hint"
              checked={preferences.textSoundEnabled}
              onChange={(event) => {
                onChangePreferences({
                  ...preferences,
                  textSoundEnabled: event.currentTarget.checked,
                });
              }}
            />
          </ScreenField>
          <VolumePreferenceField
            label="BGM volume"
            controlId="settings-bgm-volume-control"
            value={preferences.bgmVolume}
            hintId="settings-bgm-volume-hint"
            onChange={(bgmVolume) => {
              onChangePreferences({
                ...preferences,
                bgmVolume,
              });
            }}
          />
          <VolumePreferenceField
            label="SE volume"
            controlId="settings-se-volume-control"
            value={preferences.seVolume}
            hintId="settings-se-volume-hint"
            onChange={(seVolume) => {
              onChangePreferences({
                ...preferences,
                seVolume,
              });
            }}
          />
          <VolumePreferenceField
            label="Voice volume"
            controlId="settings-voice-volume-control"
            value={preferences.voiceVolume}
            hintId="settings-voice-volume-hint"
            onChange={(voiceVolume) => {
              onChangePreferences({
                ...preferences,
                voiceVolume,
              });
            }}
          />
        </div>
        <ScreenButton onClick={onBack}>Back</ScreenButton>
      </ScreenPanel>
    </Screen>
  );
}

interface VolumePreferenceFieldProps {
  readonly label: string;
  readonly controlId: string;
  readonly value: number;
  readonly hintId: string;
  readonly onChange: (value: number) => void;
}

function VolumePreferenceField({ label, controlId, value, hintId, onChange }: VolumePreferenceFieldProps) {
  const percentage = `${Math.round(value * 100)}%`;
  return (
    <ScreenField label={label} controlId={controlId} hint={percentage} hintId={hintId}>
      <input
        id={controlId}
        type="range"
        aria-describedby={hintId}
        aria-valuetext={percentage}
        min="0"
        max="1"
        step="0.05"
        value={value}
        onChange={(event) => {
          onChange(event.currentTarget.valueAsNumber);
        }}
      />
    </ScreenField>
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
