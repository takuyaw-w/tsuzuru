import {
  Screen,
  ScreenBadge,
  ScreenButton,
  ScreenHeading,
  ScreenList,
  ScreenListItem,
  ScreenPanel,
} from "@tsuzuru/standard-ui-preact";

export interface BacklogViewEntry {
  readonly id: number;
  readonly kind: "narration" | "dialogue";
  readonly speakerName: string | null;
  readonly text: string;
  readonly read: boolean;
}

interface BacklogScreenProps {
  readonly entries: readonly BacklogViewEntry[];
  readonly onBack: () => void;
}

export function BacklogScreen({ entries, onBack }: BacklogScreenProps) {
  return (
    <Screen aria-label="Backlog">
      <ScreenPanel>
        <ScreenHeading>Backlog</ScreenHeading>
        <div className="backlog">
          {entries.length === 0 ? (
            <p className="backlog__empty">No backlog yet.</p>
          ) : (
            <ScreenList ordered className="backlog__list">
              {entries.map((entry) => (
                <ScreenListItem key={entry.id} className="backlog__entry">
                  <div className="backlog__entry-header">
                    {entry.kind === "dialogue" && entry.speakerName !== null ? (
                      <p className="backlog__speaker">{entry.speakerName}</p>
                    ) : (
                      <p className="backlog__speaker">Narration</p>
                    )}
                    {entry.read ? <ScreenBadge>Read</ScreenBadge> : null}
                  </div>
                  <p className="backlog__text">{entry.text}</p>
                </ScreenListItem>
              ))}
            </ScreenList>
          )}
        </div>
        <ScreenButton onClick={onBack}>Back</ScreenButton>
      </ScreenPanel>
    </Screen>
  );
}
