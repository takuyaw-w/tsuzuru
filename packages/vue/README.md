# @tsuzuru/vue

Vue 3 runtime adapter for Tsuzuru.

This package connects `@tsuzuru/core` runtime documents to Vue Composition API
state. It does not own scenario semantics, standard UI components, asset
resolution, or browser storage.

```ts
import { useRuntime } from "@tsuzuru/vue";

const runtime = useRuntime(document, {
  plugins,
  commandHandlers,
  autoStart: true,
  autoClearWait: true,
  autoStepTransientEvents: true,
});
```

## Public API

- `useRuntime`
- `useTsuzuruRuntime`
- `RuntimeView`
- `TsuzuruRuntimeView`
- `getRenderableRuntimeEvent`
- `isRenderableRuntimeEvent`
- `isTransientRuntimeEvent`
- `isAutoSteppableRuntimeEvent`
- `getAutoClearWaitDuration`
- `createRuntimeSaveData`
- `createRuntimeSaveDataFromState`
- `restoreRuntimeSnapshotForView`
- `isRuntimeSaveData`
- `RuntimeSaveData`

`RuntimeView` is a small convenience component. Full visual novel UI layers are
expected to live in an app or a future standard UI package.

`createRuntimeSaveDataFromState(state, event, { prepares })` converts a
`RuntimeState` into Vue `RuntimeSaveData` after applying optional core
`RuntimeSnapshotPrepare` functions. It is an adapter-level save-data helper only;
scenario identity, save slot envelopes, storage, and migration remain host or
example responsibilities.
