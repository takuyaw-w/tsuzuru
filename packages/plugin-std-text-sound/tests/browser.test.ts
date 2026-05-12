import { describe, expect, it } from "vitest";
import { createStdTextSoundPlayer } from "../src/browser.js";

describe("createStdTextSoundPlayer", () => {
  it("reports unavailable AudioContext as a non-fatal playback error", () => {
    const errors: unknown[] = [];
    const player = createStdTextSoundPlayer({
      onError: (error) => {
        errors.push(error);
      },
    });

    expect(() => {
      player.play({ type: "tone", note: "C5", duration: "short" }, { minIntervalMs: 0 });
    }).not.toThrow();
    expect(errors).toHaveLength(1);

    player.destroy();
  });
});
