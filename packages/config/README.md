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
});
```

The package currently provides types and `defineTsuzuruConfig()`. It does not
load files, expand globs, or validate projects by itself.

`project.id` and `project.version` are optional project identity metadata.
Applications can use them for save compatibility checks. Treat them as stable
once released, because changing either value can make existing saves
incompatible.
