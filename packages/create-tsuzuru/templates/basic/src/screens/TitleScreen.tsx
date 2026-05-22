interface TitleScreenProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly onStart: () => void;
}

export function TitleScreen({ title, subtitle, onStart }: TitleScreenProps) {
  return (
    <main className="starter-app">
      <section className="starter-title-screen" aria-label="Title">
        <div className="starter-title-screen__scene" aria-hidden="true">
          <span className="starter-title-screen__sun" />
          <span className="starter-title-screen__window starter-title-screen__window--left" />
          <span className="starter-title-screen__window starter-title-screen__window--right" />
          <span className="starter-title-screen__desk" />
        </div>

        <div className="starter-title-screen__panel">
          <p className="starter-title-screen__eyebrow">Tsuzuru Starter</p>
          <h1>{title}</h1>
          {subtitle === undefined ? null : <p className="starter-title-screen__subtitle">{subtitle}</p>}
          <p className="starter-title-screen__description">
            まずは scenario/main.tzr を編集して、背景や立ち絵は public/assets に置いてください。
          </p>

          <div className="starter-title-screen__actions" aria-label="Title menu">
            <button
              type="button"
              className="starter-title-screen__button starter-title-screen__button--primary"
              onClick={onStart}
            >
              Start
            </button>
            <button type="button" className="starter-title-screen__button" disabled>
              Load <span>Coming soon</span>
            </button>
            <button type="button" className="starter-title-screen__button" disabled>
              Config <span>Coming soon</span>
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
