interface TitleScreenProps {
  readonly onStart: () => void;
  readonly onLoad: () => void;
  readonly onSettings: () => void;
  readonly onBacklog: () => void;
  readonly onGallery: () => void;
}

export function TitleScreen({ onStart, onLoad, onSettings, onBacklog, onGallery }: TitleScreenProps) {
  return (
    <section className="screen screen--title" aria-label="Title">
      <div className="screen__content">
        <p className="screen__eyebrow">Tsuzuru</p>
        <h1 className="screen__title">DSL v2 Basic</h1>
        <div className="screen__actions">
          <button type="button" className="screen__button screen__button--primary" onClick={onStart}>
            Start
          </button>
          <button type="button" className="screen__button" disabled>
            Continue
          </button>
          <button type="button" className="screen__button" onClick={onLoad}>
            Load
          </button>
          <button type="button" className="screen__button" onClick={onSettings}>
            Settings
          </button>
          <button type="button" className="screen__button" onClick={onBacklog}>
            Backlog
          </button>
          <button type="button" className="screen__button" onClick={onGallery}>
            Gallery
          </button>
        </div>
      </div>
    </section>
  );
}
