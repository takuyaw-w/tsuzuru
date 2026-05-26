interface TitleScreenProps {
  readonly title: string;
  readonly subtitle: string;
  readonly onStart: () => void;
}

export function TitleScreen({ title, subtitle, onStart }: TitleScreenProps) {
  return (
    <main className="sound-novel-app">
      <section className="sound-novel-title" aria-label="Title">
        <div className="sound-novel-title__scene" aria-hidden="true">
          <span className="sound-novel-title__window" />
          <span className="sound-novel-title__book" />
          <span className="sound-novel-title__rain sound-novel-title__rain--near" />
          <span className="sound-novel-title__rain sound-novel-title__rain--far" />
        </div>

        <div className="sound-novel-title__copy">
          <p className="sound-novel-title__eyebrow">Tsuzuru Sound Novel Preview</p>
          <h1>{title}</h1>
          <p className="sound-novel-title__subtitle">{subtitle}</p>
          <button type="button" className="sound-novel-button sound-novel-button--primary" onClick={onStart}>
            Start
          </button>
        </div>
      </section>
    </main>
  );
}
