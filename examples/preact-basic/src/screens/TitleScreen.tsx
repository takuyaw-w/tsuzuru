interface TitleScreenProps {
  readonly onStart: () => void;
  readonly onContinue: () => void;
  readonly onLoad: () => void;
  readonly onSettings: () => void;
  readonly onBacklog: () => void;
  readonly onGallery: () => void;
  readonly canContinue: boolean;
}

export function TitleScreen({
  onStart,
  onContinue,
  onLoad,
  onSettings,
  onBacklog,
  onGallery,
  canContinue,
}: TitleScreenProps) {
  return (
    <section className="screen screen--title" aria-label="Title">
      <div className="screen__title-art" aria-hidden="true">
        <span className="screen__title-art-sun" />
        <span className="screen__title-art-platform" />
        <span className="screen__title-art-rail screen__title-art-rail--front" />
        <span className="screen__title-art-rail screen__title-art-rail--back" />
      </div>
      <div className="screen__content screen__content--title">
        <div className="screen__title-copy">
          <p className="screen__eyebrow">Tsuzuru</p>
          <h1 className="screen__title">Preact Basic</h1>
          <p className="screen__subtitle">夕暮れの駅から始まる、小さな分岐のサンプル。</p>
        </div>
        <div className="screen__title-menu">
          <div className="screen__actions screen__actions--primary">
            <button type="button" className="screen__button screen__button--primary" onClick={onStart}>
              Start
            </button>
            <button type="button" className="screen__button" disabled={!canContinue} onClick={onContinue}>
              Continue
            </button>
          </div>
          <div className="screen__actions screen__actions--secondary">
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
      </div>
    </section>
  );
}
