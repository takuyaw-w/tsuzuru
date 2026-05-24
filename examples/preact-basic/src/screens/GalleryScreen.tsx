import { Screen, ScreenButton, ScreenHeading, ScreenPanel } from "@tsuzuru/standard-ui-preact";

interface GalleryScreenProps {
  readonly onBack: () => void;
}

export function GalleryScreen({ onBack }: GalleryScreenProps) {
  return (
    <Screen aria-label="Gallery">
      <ScreenPanel>
        <ScreenHeading>Gallery</ScreenHeading>
        <div className="gallery-grid">
          <ScreenButton className="gallery-item" disabled>
            CG 1
          </ScreenButton>
          <ScreenButton className="gallery-item" disabled>
            CG 2
          </ScreenButton>
          <ScreenButton className="gallery-item" disabled>
            CG 3
          </ScreenButton>
        </div>
        <ScreenButton onClick={onBack}>Back</ScreenButton>
      </ScreenPanel>
    </Screen>
  );
}
