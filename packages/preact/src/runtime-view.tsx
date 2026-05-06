import type { RuntimeEvent } from "@tsuzuru/core";
import type { ComponentChildren } from "preact";

export interface RuntimeViewProps {
  readonly event: RuntimeEvent;
  readonly onChoice?: (itemIndex: number) => void;
  readonly onContinue?: () => void;
  readonly onAdvance?: () => void;
  readonly canAdvance?: boolean;
}

export function RuntimeView({
  event,
  onChoice,
  onContinue,
  onAdvance,
  canAdvance = true,
}: RuntimeViewProps): ComponentChildren {
  switch (event.type) {
    case "narration":
      return (
        <AdvanceableMessage className="tzr-runtime-view--narration" onAdvance={onAdvance} canAdvance={canAdvance}>
          {event.lines.map((line, index) => (
            <p key={index}>{line.text}</p>
          ))}
        </AdvanceableMessage>
      );
    case "dialogue":
      return (
        <AdvanceableMessage className="tzr-runtime-view--dialogue" onAdvance={onAdvance} canAdvance={canAdvance}>
          <p className="tzr-runtime-view__speaker">{event.speaker}</p>
          {event.lines.map((line, index) => (
            <p key={index}>{line.text}</p>
          ))}
        </AdvanceableMessage>
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
      return <RuntimeControlMessage label="Waiting for click" buttonLabel="Continue" onContinue={onContinue} />;
    case "page":
      return <RuntimeControlMessage label="Page break" buttonLabel="Continue" onContinue={onContinue} />;
    case "wait":
      return <RuntimeStatusMessage label={`Waiting ${event.durationMs}ms`} />;
    case "scene":
      return <RuntimeStatusMessage label={`Scene: ${event.id}`} />;
    case "pluginCommand":
      return <RuntimeStatusMessage label={`Plugin command: ${event.name}`} />;
    case "unsupported":
      return <RuntimeStatusMessage label={`Unsupported instruction: ${event.instructionType}`} />;
    case "error":
      return <RuntimeStatusMessage label={event.message} />;
    case "end":
      return <RuntimeStatusMessage label="End" />;
    case "stop":
      return <RuntimeStatusMessage label="Stopped" />;
    case "state":
      return <RuntimeStatusMessage label={`${event.command}: ${event.name} = ${String(event.value)}`} />;
    case "jump":
      return <RuntimeStatusMessage label={`Jump scene: ${event.sceneId}`} />;
    case "choiceResolve":
      return <RuntimeStatusMessage label={`Choice: ${event.text}`} />;
    case "if":
      return <RuntimeStatusMessage label={`If: ${event.result ? "true" : "false"} (${event.branch})`} />;
  }
}

interface AdvanceableMessageProps {
  readonly children: ComponentChildren;
  readonly className: string;
  readonly onAdvance: (() => void) | undefined;
  readonly canAdvance: boolean;
}

function AdvanceableMessage({
  children,
  className,
  onAdvance,
  canAdvance,
}: AdvanceableMessageProps): ComponentChildren {
  const isAdvanceable = onAdvance !== undefined && canAdvance;

  return (
    <section
      className={`tzr-runtime-view ${className}${isAdvanceable ? " tzr-runtime-view--advanceable" : ""}`}
      onClick={isAdvanceable ? onAdvance : undefined}
    >
      {children}
      {isAdvanceable ? <p className="tzr-runtime-view__advance-hint">Click to continue</p> : null}
    </section>
  );
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

function RuntimeControlMessage({ label, buttonLabel, onContinue }: RuntimeControlMessageProps): ComponentChildren {
  return (
    <section className="tzr-runtime-view tzr-runtime-view--control">
      <p>{label}</p>
      <button type="button" onClick={onContinue}>
        {buttonLabel}
      </button>
    </section>
  );
}
