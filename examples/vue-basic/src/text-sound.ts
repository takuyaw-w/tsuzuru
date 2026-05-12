import { assets } from "../assets.js";
import type { ExamplePreferences } from "./preferences.js";

const TEXT_SOUND_MIN_INTERVAL_MS = 45;
const TEXT_SOUND_SKIPPED_CHARACTERS = new Set("。、，．,.!?！？;；:：…・\"'「」『』（）()[]【】");

type TextSoundProfile = (typeof assets.textSound)[keyof typeof assets.textSound];

export interface TextSoundCharacterEvent {
  readonly character: string;
  readonly index: number;
  readonly text: string;
}

export interface TextSoundPlaybackOptions {
  readonly assetId: string | null;
  readonly preferences: ExamplePreferences;
}

export function createTextSoundPlayer(onNotice: (message: string) => void): {
  readonly playCharacter: (event: TextSoundCharacterEvent, options: TextSoundPlaybackOptions) => void;
} {
  let audioContext: AudioContext | null = null;
  let lastPlayedAt = 0;
  const noticedKeys = new Set<string>();

  function addNotice(key: string, message: string, detail?: unknown): void {
    if (noticedKeys.has(key)) {
      return;
    }
    noticedKeys.add(key);
    onNotice(message);
    if (detail === undefined) {
      console.warn(message);
    } else {
      console.warn(message, detail);
    }
  }

  return {
    playCharacter(event, options) {
      if (!options.preferences.textRevealEnabled || !options.preferences.textSoundEnabled || options.assetId === null) {
        return;
      }
      if (!shouldPlayTextSoundForCharacter(event.character)) {
        return;
      }

      const now = performance.now();
      if (now - lastPlayedAt < TEXT_SOUND_MIN_INTERVAL_MS) {
        return;
      }
      lastPlayedAt = now;

      const profile = assets.textSound[options.assetId as keyof typeof assets.textSound];
      if (profile === undefined) {
        addNotice(`textSound:missing-map:${options.assetId}`, `Text sound asset is not mapped: ${options.assetId}`);
        return;
      }

      void playTextSoundTone(profile, options.preferences.textSoundVolume);
    },
  };

  async function playTextSoundTone(profile: TextSoundProfile, volume: number): Promise<void> {
    if (typeof AudioContext === "undefined") {
      addNotice("textSound:audio-context-unavailable", "Text sound skipped because AudioContext is unavailable.");
      return;
    }

    try {
      const context = audioContext ?? new AudioContext();
      audioContext = context;
      if (context.state === "suspended") {
        await context.resume();
      }

      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime;
      const durationSeconds = profile.durationMs / 1000;
      const outputVolume = Math.max(0, Math.min(volume, 1));

      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(profile.frequencyHz, now);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(outputVolume * 0.18, now + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSeconds);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + durationSeconds);
    } catch (error) {
      addNotice("textSound:playback-failed", "Text sound playback was blocked or failed.", error);
    }
  }
}

function shouldPlayTextSoundForCharacter(character: string): boolean {
  return character.trim().length > 0 && !TEXT_SOUND_SKIPPED_CHARACTERS.has(character);
}
