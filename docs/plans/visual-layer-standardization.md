# Visual Layer Standardization Plan

## Status

Step 1 and Step 2 are complete. Step 3 is implemented in
`StdVisualLayer`; Step 4 remains blocked on camera composition.

This document records the responsibility split for
`examples/preact-basic/src/VisualLayer.tsx` before moving any more visual
presentation code into `@tsuzuru/standard-ui-preact`.

The goal is not to move the current example component wholesale. The current
component combines std-visual rendering, std-camera presentation, transition
animation, save/load restore behavior, and example-specific placeholder art.
Those responsibilities need separate boundaries before implementation.

## Current Responsibilities

`examples/preact-basic/src/VisualLayer.tsx` currently does all of the following:

- Reads `stdVisual` plugin state with `getStdVisualState(runtimeState)`.
- Reads `stdCamera` plugin state with `getStdCameraState(runtimeState)`.
- Renders the full visual surface and a transformable camera wrapper.
- Renders the current background.
- Temporarily renders the previous background during background transitions.
- Converts std-visual background transition metadata to CSS classes and
  variables.
- Suppresses background transition replay after save/load restore through
  `backgroundAnimationSuppression`.
- Renders visible sprites and maps sprite positions to DOM placement.
- Converts sprite show transition metadata to CSS classes and variables.
- Converts std-camera state to CSS transform variables.
- Resolves camera focus target offsets from current sprite positions.
- Reads example-local `assets.visual.backgrounds` and `assets.visual.sprites`.
- Renders example-specific placeholder background DOM such as sun, platform,
  rails, and sign labels.
- Renders example-specific placeholder sprite DOM such as head, body, and name.
- Provides class names used by example CSS, Playwright tests, and
  `StdEffectLayer` target selectors.

This makes it an integration component, not a reusable standard UI primitive.

## Responsibility Split

### Move To `standard-ui-preact`

These are reusable enough to standardize:

- Basic background rendering from `StdVisualBackground | null`.
- Basic sprite rendering from `StdVisualSprites`.
- Asset map based rendering using the existing `TsuzuruGameImageAsset` /
  `resolveImageAsset` contract.
- Generic placeholder rendering with labels for missing assets.
- Stable `tzr-` prefixed visual class names.
- Sprite list keys.
- A thin `StdVisualRuntimeLayer` that reads only `stdVisual` from
  `RuntimeState` and delegates to `StdVisualLayer`.

`StdVisualRuntimeLayer` should be optional convenience, similar in spirit to
`StdParticleRuntimeLayer`, but narrower than the current example
`VisualLayer`.

### Move To `standard-ui-preact` With Care

These can be standardized, but should be opt-in or staged:

- Background entrance/update transitions derived from
  `StdVisualBackground.transition`.
- Sprite show transitions derived from `StdVisualSprite.transition`.
- CSS classes and CSS variables for transition duration, direction, and color.
- A host-controlled suppression mechanism for restore flows.

The first transition pass should support only state that is recoverable from
durable std-visual state:

- `bg ... with ...` background changes.
- `show ... with ...` sprite entrance transitions.

Exit transitions for `hide`, `clearBg`, and `clearSprites` should stay out of
the first pass because the current std-visual state removes those targets
immediately. A generic renderer cannot animate an exiting target that no
longer exists unless runtime events or plugin state are extended.

### Keep In `examples/preact-basic`

These should remain example-owned:

- `backgroundAnimationSuppression` wiring from save/load restore flows until a
  generic host API exists.
- Example-specific background art placeholders: sun, platform, rails, signs.
- Example-specific sprite body/head/name placeholder DOM.
- Example-specific colors, layout density, and visual style.
- Playwright selectors that assert example story flow and save/load behavior.
- `StdEffectLayer` target selector wiring for the example DOM.
- Any demo-specific asset class naming under `assets.ts`.

### Split Into A Separate Camera Layer

Camera should not be folded into `StdVisualLayer`.

`@tsuzuru/plugin-std-camera` owns durable renderer-neutral camera state:
`x`, `y`, `zoom`, `focusTarget`, and `transition`. Rendering that state requires
a DOM hierarchy and a policy for mapping `focusTarget` to coordinates. The
current example uses a simple sprite-position heuristic and hard-coded
horizontal offsets. That is useful demo code, but not a universal standard
policy.

Future camera work should be a separate task:

- `StdCameraLayer` accepts `StdCameraState` and wraps children.
- `StdCameraRuntimeLayer` reads `stdCamera` from `RuntimeState` and delegates.
- Focus target resolution is configurable, for example via
  `resolveFocusOffset` or a target-to-rect map.
- Camera CSS variables are standard, but target coordinate policy is host-owned.

## Recommended APIs

### `StdVisualLayer`

Keep `StdVisualLayer` state-oriented and renderer-only:

```tsx
<StdVisualLayer
  background={visualState.background}
  sprites={visualState.sprites}
  backgroundAssets={assets.visual.backgrounds}
  spriteAssets={assets.visual.sprites}
/>
```

Possible transition options:

```ts
export interface StdVisualLayerProps {
  readonly background?: StdVisualBackground | null | undefined;
  readonly sprites?: StdVisualSprites | undefined;
  readonly backgroundAssets?: Readonly<Record<string, TsuzuruGameImageAsset>> | undefined;
  readonly spriteAssets?: Readonly<Record<string, TsuzuruGameImageAsset>> | undefined;
  readonly transitions?: boolean | StdVisualTransitionOptions | undefined;
  readonly className?: string | undefined;
}
```

`transitions` should default conservatively. If enabled by default, restore
suppression must be documented and tested before release.

### `StdVisualRuntimeLayer`

If added, keep it thin and std-visual-only:

```tsx
<StdVisualRuntimeLayer
  runtimeState={runtime.state}
  backgroundAssets={assets.visual.backgrounds}
  spriteAssets={assets.visual.sprites}
/>
```

This component should:

- Call `getStdVisualState(runtimeState)`.
- Pass `background` and `sprites` to `StdVisualLayer`.
- Not import or read `@tsuzuru/plugin-std-camera`.
- Not know about save/load, restore suppression, effects, particles, or
  example placeholders.

### `StdCameraLayer`

Camera should be designed separately:

```tsx
<StdCameraLayer
  cameraState={cameraState}
  resolveFocusOffset={(targetId, visualState) => ({ x: 0, y: 0 })}
>
  <StdVisualLayer ... />
</StdCameraLayer>
```

or:

```tsx
<StdCameraRuntimeLayer
  runtimeState={runtime.state}
  visualState={visualState}
  resolveFocusOffset={resolveFocusOffset}
>
  <StdVisualLayer ... />
</StdCameraRuntimeLayer>
```

The exact API should be decided in a later camera-specific task.

## Transition Boundary

Background transition metadata already belongs to
`@tsuzuru/plugin-std-visual`. Rendering is still the UI layer's job.

Standard UI should eventually render these effects with CSS classes and CSS
variables:

- `fade`
- `pageTurn`
- `blurFade`
- `slide`
- `wipeLeft`
- `wipeRight`

It should treat `cut` and non-positive durations as non-animated.

Sprite transitions should initially support only:

- `fade`
- `dissolve`

The implementation should not block runtime progression. Scenario authors must
continue using `wait` when script timing must align with visual duration.

Restore behavior needs explicit handling. Because transition metadata is
durable state, restoring a snapshot can contain the same transition metadata
that originally animated. A standard layer must not replay an animation just
because saved state contains that metadata. The first implementation should
either:

- provide a host-controlled suppression key, or
- skip initial mount animations by default and animate only subsequent asset
  changes.

## Asset Presentation Boundary

`standard-ui-preact` should keep the generic `TsuzuruGameImageAsset` model:

- string asset path
- object asset with `src`, `label`, `alt`, and `className`
- missing asset fallback to a label placeholder

Do not move the example's station/platform/sun/rail scene DOM or character
placeholder body/head DOM into the package. Those are demo art, not reusable
standard presentation.

If richer placeholders are needed later, add override hooks rather than
hard-coding a house style:

```ts
renderBackgroundPlaceholder?: (assetId: string) => ComponentChildren;
renderSpritePlaceholder?: (assetId: string, sprite: StdVisualSprite) => ComponentChildren;
```

Do not add these until there is a concrete caller.

## Recommended Migration Plan

### Step 1: Document The Split

This plan is the first step. No implementation should move the existing
example `VisualLayer` wholesale.

### Step 2: Add `StdVisualRuntimeLayer`

Add a thin runtime bridge in `standard-ui-preact`:

- reads `getStdVisualState(runtimeState)`
- passes state and asset maps to `StdVisualLayer`
- exports public props and component
- adds package tests

No camera. No save/load suppression. No example placeholder art.

Implemented as `StdVisualRuntimeLayer`.

### Step 3: Add Minimal Transition Rendering To `StdVisualLayer`

Extend `StdVisualLayer` to render:

- background previous/current layers for durable background transition metadata
- sprite show transition classes
- CSS variables for duration, direction, and color

Add package unit tests for:

- no animation on `cut`
- no animation on same asset
- previous background layer cleanup
- class and variable generation
- sprite transition keys/classes
- reduced-motion CSS behavior

Implemented in `StdVisualLayer` with transitions enabled by default and
`animateOnInitialMount` disabled by default. The implementation skips durable
transition replay on initial mount, skips same-background updates, and treats
`cut` / non-positive durations as non-animated. It does not add a host
suppression API yet because initial-mount and asset-change detection cover the
standard layer's restore risk without widening the public surface.

### Step 4: Rewire `examples/preact-basic` Around Package Primitives

Keep the example `VisualLayer` temporarily, but make it thinner:

- use `StdVisualLayer` or `StdVisualRuntimeLayer` for background/sprite DOM
- keep example-specific placeholder styling through asset maps and CSS
- keep save/load transition suppression in the example
- keep Playwright behavior assertions

This step should preserve selectors intentionally or update tests in the same
change.

Not implemented yet. The example `VisualLayer` still owns std-camera
composition, focus offsets, and example selectors used by `StdEffectLayer` and
Playwright tests. Deleting it before Step 5 would drop camera behavior.

### Step 5: Design Camera Separately

Add a separate camera design document or decision before implementation:

- `StdCameraLayer`
- `StdCameraRuntimeLayer`
- focus resolution policy
- DOM hierarchy with visual/effect/particle layers
- interaction with `StdEffectLayer` target selectors

### Step 6: Remove Example Local `VisualLayer`

Only after transitions and camera composition have package-level tests and a
stable API should `examples/preact-basic/src/VisualLayer.tsx` be deleted.

## Grill-Me Results

The main objections are valid and should constrain the design:

- Moving `VisualLayer` as-is would move app/demo composition into
  `standard-ui-preact`.
- Camera focus currently uses example-specific coordinate policy; standardizing
  it inside `StdVisualLayer` would make that policy implicit and hard to
  replace.
- Background transition rendering and save/load restore suppression are related
  but not the same concern. They need a clear host API.
- Transition standardization can flatten project-specific style if it tries to
  own all animation style. The package should provide restrained defaults and
  class/CSS-variable hooks.
- `create-tsuzuru` benefits most from `StdVisualLayer` rendering the transition
  metadata already present in starter scenarios. It does not benefit from
  forcing camera or the preact-basic demo DOM into the starter.
- `examples/preact-basic` should remain a richer integration demo and should
  keep testing save/load, interaction, and real scenario flow even after package
  primitives improve.

## Next Implementation Task

The safest next task is:

```txt
Add StdVisualRuntimeLayer to @tsuzuru/standard-ui-preact.

Scope:
- runtimeState -> getStdVisualState(runtimeState)
- pass background/sprites/assets/className to StdVisualLayer
- public export and package files
- unit tests
- no camera
- no transition behavior changes beyond existing StdVisualLayer behavior
- no preact-basic VisualLayer deletion
```

After that, tackle transition rendering as a separate task with explicit
restore-suppression behavior.
