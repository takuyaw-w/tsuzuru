interface LoadScreenProps {
  readonly onBack: () => void;
}

export function LoadScreen({ onBack }: LoadScreenProps) {
  return (
    <section className="screen" aria-label="Load">
      <div className="screen__content screen__content--panel">
        <h1 className="screen__heading">Load</h1>
        <p className="screen__text">Save data is not implemented in this example.</p>
        <div className="screen__actions">
          <button type="button" className="screen__button" disabled>
            Slot 1
          </button>
          <button type="button" className="screen__button" onClick={onBack}>
            Back
          </button>
        </div>
      </div>
    </section>
  );
}
