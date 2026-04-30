import type { RuntimeEvent } from "@tsuzuru/core";
import type { ComponentChildren } from "preact";

export interface RuntimeViewProps {
  readonly event: RuntimeEvent;
  readonly onChoice?: (itemIndex: number) => void;
  readonly onContinue?: () => void;
}

export function RuntimeView({ event, onChoice, onContinue }: RuntimeViewProps): ComponentChildren {
  switch (event.type) {
    case "narration":
      return (
        <section className="tzr-runtime-view tzr-runtime-view--narration">
          {event.lines.map((line, index) => (
            <p key={index}>{line.text}</p>
          ))}
        </section>
      );
    case "dialogue":
      return (
        <section className="tzr-runtime-view tzr-runtime-view--dialogue">
          <p className="tzr-runtime-view__speaker">{event.speaker}</p>
          {event.lines.map((line, index) => (
            <p key={index}>{line.text}</p>
          ))}
        </section>
      );
    case "choice":
      return (
        <section className="tzr-runtime-view tzr-runtime-view--choice">
          <p className="tzr-runtime-view__question">{event.question}</p>
          <ol className="tzr-runtime-view__choices">
            {event.items.map((item, index) => (
              <li key={index}>
                <button type="button" onClick={() => onChoice?.(index)}>
                  {item.text}
                </button>
              </li>
            ))}
          </ol>
        </section>
      );
    case "waitClick":
      return (
        <RuntimeControlMessage label="Waiting for click" buttonLabel="Continue" onContinue={onContinue} />
      );
    case "page":
      return <RuntimeControlMessage label="Page break" buttonLabel="Continue" onContinue={onContinue} />;
    case "wait":
      return <RuntimeStatusMessage label={`Waiting ${event.durationMs}ms`} />;
    case "scene":
      return <RuntimeStatusMessage label={`Scene: ${event.id}`} />;
    case "label":
      return <RuntimeStatusMessage label={`Label: ${event.id}`} />;
    case "pluginCommand":
      return <RuntimeStatusMessage label={`Plugin command: ${event.name}`} />;
    case "unsupported":
      return <RuntimeStatusMessage label={`Unsupported instruction: ${event.instructionType}`} />;
    case "end":
      return <RuntimeStatusMessage label="End" />;
    case "stop":
      return <RuntimeStatusMessage label="Stopped" />;
    case "state":
      return <RuntimeStatusMessage label={`${event.command}: ${event.name} = ${String(event.value)}`} />;
    case "jump":
      return <RuntimeStatusMessage label={`Jump: #${event.label}`} />;
    case "if":
      return <RuntimeStatusMessage label={`If: ${event.result ? "true" : "false"} (${event.branch})`} />;
  }
}

interface RuntimeStatusMessageProps {
  readonly label: string;
}

function RuntimeStatusMessage({ label }: RuntimeStatusMessageProps): ComponentChildren {
  return <p className="tzr-runtime-view tzr-runtime-view--status">{label}</p>;
}

interface RuntimeControlMessageProps {
  readonly label: string;
  readonly buttonLabel: string;
  readonly onContinue: (() => void) | undefined;
}

function RuntimeControlMessage({
  label,
  buttonLabel,
  onContinue,
}: RuntimeControlMessageProps): ComponentChildren {
  return (
    <section className="tzr-runtime-view tzr-runtime-view--control">
      <p>{label}</p>
      <button type="button" onClick={onContinue}>
        {buttonLabel}
      </button>
    </section>
  );
}
