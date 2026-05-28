import { Screen, TitleScreen as StandardTitleScreen, type TitleScreenAction } from "@tsuzuru/standard-ui-preact";

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
  const titleActions = [
    { label: "Start", onSelect: onStart },
    { label: "Continue", onSelect: onContinue, disabled: !canContinue },
    { label: "Load", onSelect: onLoad },
    { label: "Settings", onSelect: onSettings },
    { label: "Backlog", onSelect: onBacklog },
    { label: "Gallery", onSelect: onGallery },
  ] satisfies readonly TitleScreenAction[];

  return (
    <Screen className="preact-basic-title-screen" aria-label="Title">
      <div className="preact-basic-title-screen__art" aria-hidden="true">
        <span className="preact-basic-title-screen__art-sun" />
        <span className="preact-basic-title-screen__art-platform" />
        <span className="preact-basic-title-screen__art-rail preact-basic-title-screen__art-rail--front" />
        <span className="preact-basic-title-screen__art-rail preact-basic-title-screen__art-rail--back" />
      </div>
      <StandardTitleScreen
        className="preact-basic-title-screen__standard"
        title="Preact Basic"
        subtitle="放課後の駅から始まる、小さな分岐のノベルゲーム。"
        description="夕暮れ、旧校舎、忘れられたノート。短い寄り道が、白紙のページを少しだけ動かしていく。"
        actions={titleActions}
        footer="放課後の栞"
      />
    </Screen>
  );
}
