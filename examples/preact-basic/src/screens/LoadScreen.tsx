import {
  Screen,
  ScreenActions,
  ScreenButton,
  ScreenHeading,
  ScreenList,
  ScreenListItem,
  ScreenPanel,
} from "@tsuzuru/standard-ui-preact";

interface LoadScreenProps {
  readonly slots: readonly LoadScreenSlot[];
  readonly slotDefinitions: readonly SaveSlotDefinition[];
  readonly onLoad: (slotId: string) => void;
  readonly onDelete: (slotId: string) => void;
  readonly onBack: () => void;
}

interface LoadScreenSlot {
  readonly id: string;
  readonly savedAt: string;
}

interface SaveSlotDefinition {
  readonly id: string;
  readonly label: string;
}

export function LoadScreen({ slots, slotDefinitions, onLoad, onDelete, onBack }: LoadScreenProps) {
  return (
    <Screen aria-label="Load">
      <ScreenPanel>
        <ScreenHeading>Load</ScreenHeading>
        <ScreenList className="save-slots">
          {slotDefinitions.map((definition) => {
            const slot = slots.find((candidate) => candidate.id === definition.id) ?? null;
            return (
              <ScreenListItem key={definition.id} className="save-slot" aria-label={definition.label}>
                <div className="save-slot__meta">
                  <h2 className="save-slot__label">{definition.label}</h2>
                  <p className="save-slot__status">{slot === null ? "Empty" : formatSavedAt(slot.savedAt)}</p>
                </div>
                <ScreenActions columns={2} className="save-slot__actions">
                  <ScreenButton
                    disabled={slot === null}
                    aria-label={`Load ${definition.label}`}
                    onClick={() => onLoad(definition.id)}
                  >
                    Load
                  </ScreenButton>
                  <ScreenButton
                    disabled={slot === null}
                    aria-label={`Delete ${definition.label}`}
                    onClick={() => onDelete(definition.id)}
                  >
                    Delete
                  </ScreenButton>
                </ScreenActions>
              </ScreenListItem>
            );
          })}
        </ScreenList>
        <ScreenActions>
          <ScreenButton onClick={onBack}>Back</ScreenButton>
        </ScreenActions>
      </ScreenPanel>
    </Screen>
  );
}

function formatSavedAt(savedAt: string): string {
  const date = new Date(savedAt);
  if (Number.isNaN(date.getTime())) {
    return savedAt;
  }
  return date.toLocaleString();
}
