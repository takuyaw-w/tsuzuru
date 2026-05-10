export interface HtmlBasicBacklogEntry {
  readonly id: number;
  readonly kind: "narration" | "dialogue";
  readonly speakerName: string | null;
  readonly text: string;
}

export type HtmlBasicBacklogRuntimeEvent =
  | {
      readonly type: "narration";
      readonly lines: readonly { readonly text: string }[];
    }
  | {
      readonly type: "dialogue";
      readonly speaker: string;
      readonly lines: readonly { readonly text: string }[];
    }
  | { readonly type: Exclude<string, "narration" | "dialogue"> };

export function createHtmlBasicBacklogEntry(
  event: HtmlBasicBacklogRuntimeEvent | null,
  id: number,
  speakerNames: Readonly<Record<string, string>> = {},
): HtmlBasicBacklogEntry | null {
  if (!isBacklogEvent(event)) {
    return null;
  }

  const text = event.lines.map((line) => line.text).join("\n");
  if (event.type === "narration") {
    return { id, kind: "narration", speakerName: null, text };
  }

  return {
    id,
    kind: "dialogue",
    speakerName: speakerNames[event.speaker] ?? event.speaker,
    text,
  };
}

function isBacklogEvent(
  event: HtmlBasicBacklogRuntimeEvent | null,
): event is Extract<HtmlBasicBacklogRuntimeEvent, { readonly type: "narration" | "dialogue" }> {
  return event?.type === "narration" || event?.type === "dialogue";
}
