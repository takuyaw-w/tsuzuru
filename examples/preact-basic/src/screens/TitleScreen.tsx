import { Screen, ScreenActions, ScreenButton } from "@tsuzuru/standard-ui-preact";

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
    <Screen className="screen--title" aria-label="Title">
      <div className="screen__title-art" aria-hidden="true">
        <span className="screen__title-art-sun" />
        <span className="screen__title-art-platform" />
        <span className="screen__title-art-rail screen__title-art-rail--front" />
        <span className="screen__title-art-rail screen__title-art-rail--back" />
      </div>
      <div className="screen__title-content">
        <div className="screen__title-copy">
          <p className="screen__eyebrow">Tsuzuru</p>
          <h1 className="screen__title">Preact Basic</h1>
          <p className="screen__subtitle">夕暮れの駅から始まる、小さな分岐のサンプル。</p>
        </div>
        <div className="screen__title-menu">
          <ScreenActions>
            <ScreenButton variant="primary" onClick={onStart}>
              Start
            </ScreenButton>
            <ScreenButton disabled={!canContinue} onClick={onContinue}>
              Continue
            </ScreenButton>
          </ScreenActions>
          <ScreenActions columns={2}>
            <ScreenButton onClick={onLoad}>Load</ScreenButton>
            <ScreenButton onClick={onSettings}>Settings</ScreenButton>
            <ScreenButton onClick={onBacklog}>Backlog</ScreenButton>
            <ScreenButton onClick={onGallery}>Gallery</ScreenButton>
          </ScreenActions>
        </div>
      </div>
    </Screen>
  );
}
