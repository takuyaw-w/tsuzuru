interface BacklogScreenProps {
  readonly onBack: () => void;
}

export function BacklogScreen({ onBack }: BacklogScreenProps) {
  return (
    <section className="screen" aria-label="Backlog">
      <div className="screen__content screen__content--panel">
        <h1 className="screen__heading">Backlog</h1>
        <p className="screen__text">Backlog storage is not implemented in this example.</p>
        <button type="button" className="screen__button" onClick={onBack}>
          Back
        </button>
      </div>
    </section>
  );
}
