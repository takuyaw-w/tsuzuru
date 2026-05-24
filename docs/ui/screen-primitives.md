# Screen Primitives

`@tsuzuru/standard-ui-preact` provides Screen primitives for building project-specific screens such as title menus, settings, save/load, backlog, gallery, and custom in-game overlays.

These primitives are not complete title/settings/save/load/backlog screens. They are building blocks for project-specific screens.

## Included Primitives

- `Screen`
- `ScreenPanel`
- `ScreenHeading`
- `ScreenText`
- `ScreenActions`
- `ScreenButton`
- `ScreenField`
- `ScreenList`
- `ScreenListItem`
- `ScreenBadge`

`ScreenHost` remains responsible for active-screen lookup and registry rendering. Screen primitives are responsible only for the layout and controls inside a screen.

## Import

```tsx
import {
  Screen,
  ScreenActions,
  ScreenBadge,
  ScreenButton,
  ScreenField,
  ScreenHeading,
  ScreenList,
  ScreenListItem,
  ScreenPanel,
  ScreenText,
} from "@tsuzuru/standard-ui-preact";
import "@tsuzuru/standard-ui-preact/style.css";
```

## Basic Composition

```tsx
export function SettingsScreen({ onBack }: { readonly onBack: () => void }) {
  return (
    <Screen aria-label="Settings">
      <ScreenPanel>
        <ScreenHeading eyebrow="System">Settings</ScreenHeading>
        <ScreenText>Adjust the project-specific settings for this game.</ScreenText>
        <ScreenField
          label="Text reveal"
          controlId="text-reveal-control"
          hint="Reveal message text over time."
          hintId="text-reveal-hint"
        >
          <input id="text-reveal-control" type="checkbox" aria-describedby="text-reveal-hint" />
        </ScreenField>
        <ScreenActions>
          <ScreenButton onClick={onBack}>Back</ScreenButton>
        </ScreenActions>
      </ScreenPanel>
    </Screen>
  );
}
```

`Screen` renders a `section` and forwards native section props. Give each screen an accessible name with `aria-label` or `aria-labelledby`.

`ScreenButton` renders a native `button` and always sets `type="button"` so it does not accidentally submit a surrounding form. It forwards normal button props except `type`.

`ScreenField` renders a field wrapper with a visible label. Pass `controlId` and give the child control the same `id` to associate the visible label with the control. When a hint explains the control, pass a stable `hintId` and connect the child control with `aria-describedby`.

## Lists

Use `ScreenList` and `ScreenListItem` for save slots, load slots, backlog entries, or other repeated screen rows.

```tsx
export function BacklogScreen({ entries }: { readonly entries: readonly string[] }) {
  return (
    <Screen aria-label="Backlog">
      <ScreenPanel>
        <ScreenHeading>Backlog</ScreenHeading>
        <ScreenList ordered>
          {entries.map((entry, index) => (
            <ScreenListItem key={index}>
              <ScreenBadge>Read</ScreenBadge>
              <p>{entry}</p>
            </ScreenListItem>
          ))}
        </ScreenList>
      </ScreenPanel>
    </Screen>
  );
}
```

`ScreenList` renders `ul` by default. Use `ordered` for `ol`, such as chronological backlog entries. `ScreenListItem` renders `li`.

## Styling

Plain CSS is the styling API. Import the package stylesheet:

```ts
import "@tsuzuru/standard-ui-preact/style.css";
```

The package owns `.tzr-screen*` class names and treats them as stable styling hooks. Prefer CSS custom properties for theme, spacing, and sizing adjustments.

Common screen variables include:

```css
:root {
  --tzr-standard-ui-screen-padding: clamp(20px, 5vw, 56px);
  --tzr-standard-ui-screen-panel-width: min(420px, 100%);
  --tzr-standard-ui-screen-panel-padding: clamp(18px, 3vw, 30px);
  --tzr-standard-ui-screen-panel-bg: rgba(8, 10, 13, 0.76);
  --tzr-standard-ui-screen-heading-color: #fff8e8;
  --tzr-standard-ui-screen-text-color: rgba(255, 250, 240, 0.72);
  --tzr-standard-ui-screen-button-min-height: 40px;
  --tzr-standard-ui-screen-button-padding: 10px 14px;
}
```

Project-specific CSS should stay in the app or example. Title art, save-slot metadata typography, backlog row details, and game-specific layout should use project-owned class names, not new generic `.screen*` classes.

## Overlay Responsibility

Screen primitives do not manage modal focus, Escape handling, focus restoration, screen stacks, or runtime blocking. Those policies depend on the host app: which overlays exist, whether opening one pauses story advancement, how close actions work, and how focus should return.

For runtime overlays, the app should provide dialog semantics and keyboard policy around the screen content. `examples/preact-basic` demonstrates one approach: the overlay wrapper owns `role="dialog"`, `aria-modal`, focus movement, Tab trapping, Escape close, and background advance suppression.

Do not put save/load storage types, settings models, backlog read tracking, or gallery unlock state into `@tsuzuru/standard-ui-preact`. Keep those contracts in project code or storage/runtime packages, then compose them with these primitives.
