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
    <Screen className="preact-basic-title-screen" aria-label="Title">
      <div className="preact-basic-title-screen__art" aria-hidden="true">
        <span className="preact-basic-title-screen__art-sun" />
        <span className="preact-basic-title-screen__art-platform" />
        <span className="preact-basic-title-screen__art-rail preact-basic-title-screen__art-rail--front" />
        <span className="preact-basic-title-screen__art-rail preact-basic-title-screen__art-rail--back" />
      </div>
      <div className="preact-basic-title-screen__content">
        <div className="preact-basic-title-screen__copy">
          <p className="preact-basic-title-screen__eyebrow">Tsuzuru</p>
          <h1 className="preact-basic-title-screen__title">Preact Basic</h1>
          <p className="preact-basic-title-screen__subtitle">夕暮れの駅から始まる、小さな分岐のサンプル。</p>
        </div>
        <div className="preact-basic-title-screen__menu">
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
