import type { MessageHistoryEntry } from "../message-history.js";

interface BacklogScreenProps {
  readonly entries: readonly MessageHistoryEntry[];
  readonly onBack: () => void;
}

export function BacklogScreen({ entries, onBack }: BacklogScreenProps) {
  return (
    <section className="screen" aria-label="Backlog">
      <div className="screen__content screen__content--panel">
        <h1 className="screen__heading">Backlog</h1>
        <div className="backlog">
          {entries.length === 0 ? (
            <p className="backlog__empty">No backlog yet.</p>
          ) : (
            <ol className="backlog__list">
              {entries.map((entry) => (
                <li key={entry.id} className="backlog__entry">
                  {entry.kind === "dialogue" && entry.speakerName !== null ? (
                    <p className="backlog__speaker">{entry.speakerName}</p>
                  ) : null}
                  <p className="backlog__text">{entry.text}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
        <button type="button" className="screen__button" onClick={onBack}>
          Back
        </button>
      </div>
    </section>
  );
}
