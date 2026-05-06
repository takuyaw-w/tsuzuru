interface GalleryScreenProps {
  readonly onBack: () => void;
}

export function GalleryScreen({ onBack }: GalleryScreenProps) {
  return (
    <section className="screen" aria-label="Gallery">
      <div className="screen__content screen__content--panel">
        <h1 className="screen__heading">Gallery</h1>
        <div className="screen__gallery-grid">
          <button type="button" className="screen__gallery-item" disabled>
            CG 1
          </button>
          <button type="button" className="screen__gallery-item" disabled>
            CG 2
          </button>
          <button type="button" className="screen__gallery-item" disabled>
            CG 3
          </button>
        </div>
        <button type="button" className="screen__button" onClick={onBack}>
          Back
        </button>
      </div>
    </section>
  );
}
