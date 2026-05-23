interface SaveScreenProps {
  readonly slots: readonly SaveScreenSlot[];
  readonly slotDefinitions: readonly SaveSlotDefinition[];
  readonly onSave: (slotId: string) => void;
  readonly onDelete: (slotId: string) => void;
  readonly onBack: () => void;
}

interface SaveScreenSlot {
  readonly id: string;
  readonly savedAt: string;
}

interface SaveSlotDefinition {
  readonly id: string;
  readonly label: string;
}

export function SaveScreen({ slots, slotDefinitions, onSave, onDelete, onBack }: SaveScreenProps) {
  return (
    <section className="screen" aria-label="Save">
      <div className="screen__content screen__content--panel">
        <h1 className="screen__heading">Save</h1>
        <div className="save-slots">
          {slotDefinitions.map((definition) => {
            const slot = slots.find((candidate) => candidate.id === definition.id) ?? null;
            return (
              <section key={definition.id} className="save-slot" aria-label={definition.label}>
                <div className="save-slot__meta">
                  <h2 className="save-slot__label">{definition.label}</h2>
                  <p className="save-slot__status">{slot === null ? "Empty" : formatSavedAt(slot.savedAt)}</p>
                </div>
                <div className="save-slot__actions">
                  <button
                    type="button"
                    className="screen__button"
                    aria-label={`Save ${definition.label}`}
                    onClick={() => onSave(definition.id)}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className="screen__button"
                    disabled={slot === null}
                    aria-label={`Delete ${definition.label}`}
                    onClick={() => onDelete(definition.id)}
                  >
                    Delete
                  </button>
                </div>
              </section>
            );
          })}
        </div>
        <div className="screen__actions">
          <button type="button" className="screen__button" onClick={onBack}>
            Back
          </button>
        </div>
      </div>
    </section>
  );
}

function formatSavedAt(savedAt: string): string {
  const date = new Date(savedAt);
  if (Number.isNaN(date.getTime())) {
    return savedAt;
  }
  return date.toLocaleString();
}
