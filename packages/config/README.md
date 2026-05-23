# @tsuzuru/config

Project configuration helpers for Tsuzuru.

## Usage

```ts
import { defineTsuzuruConfig } from "@tsuzuru/config";

export default defineTsuzuruConfig({
  project: {
    id: "example.my-game",
    version: "1",
  },
  scenario: {
    entry: "scenario/main.tzr",
    files: ["scenario/**/*.tzr"],
  },
  storage: {
    enabled: true,
    slots: 3,
    saves: "standard-runtime",
  },
});
```

The package currently provides types and `defineTsuzuruConfig()`. It does not
load files, expand globs, or validate projects by itself.

`project.id` and `project.version` are optional project identity metadata.
Applications can use them for save compatibility checks. Treat them as stable
once released, because changing either value can make existing saves
incompatible.

`storage` is a declarative config block. It describes standard storage intent
for packages such as `@tsuzuru/standard-game-storage`; it must not contain
`localStorage` objects, parser functions, runtime instances, or UI policy.
`storage.enabled` can disable standard storage setup, `storage.prefix` overrides
the generated key namespace, `storage.slots` controls the slot count or slot
definitions, and `storage.saves: "standard-runtime"` opts into the standard
runtime save adapter. Applications still decide when to save, when to load, and
which screens or controls expose those actions.
