import { TsuzuruGame, type TsuzuruGameProps } from "@tsuzuru/standard-ui-preact";
import { isValidElement, type VNode } from "preact";
import { describe, expect, it } from "vitest";
import scenario from "../scenario/main.tzr";
import { assets } from "../src/assets.js";
import { SoundNovelGame, speakerModes, textSpeedOptions } from "../src/ui/GameRoot.js";

describe("preact-sound-novel example", () => {
  it("exports placeholder visual assets", () => {
    expect(assets.visual?.backgrounds?.rain_room).toMatchObject({
      label: "Rain Room",
      className: "sound-novel-bg sound-novel-bg--rain-room",
    });
    expect(assets.visual?.backgrounds?.dawn_station).toMatchObject({
      label: "Dawn Station",
      className: "sound-novel-bg sound-novel-bg--dawn-station",
    });
  });

  it("imports the long-text scenario through the Vite plugin", () => {
    expect(scenario.type).toBe("CompiledTzrDocument");
    expect(scenario.scenes.start).toBeDefined();
    expect(scenario.scenes.read_page).toBeDefined();
    expect(scenario.scenes.give_book).toBeDefined();
    expect(scenario.scenes.station).toBeDefined();
  });

  it("keeps preview controls focused on supported sound-novel options", () => {
    expect(speakerModes).toEqual(["inline", "block", "hidden"]);
    expect(textSpeedOptions).toEqual([30, 60, 120]);
  });

  it("routes the game through TsuzuruGame novel presentation props", () => {
    const node = expectVNode<TsuzuruGameProps>(
      SoundNovelGame({
        scenario,
        assets,
        speakerMode: "block",
        charactersPerSecond: 120,
      }),
    );

    expect(node.type).toBe(TsuzuruGame);
    expect(node.props.messagePresentation).toEqual({ mode: "novel", speakerMode: "block" });
    expect(node.props.text).toEqual({ reveal: true, charactersPerSecond: 120 });
    expect(node.props.advanceHint).toBe("クリックで進む");
  });
});

function expectVNode<P>(value: unknown): VNode<P> {
  expect(isValidElement(value)).toBe(true);
  if (!isValidElement(value)) {
    throw new Error("expected VNode");
  }
  return value as VNode<P>;
}
