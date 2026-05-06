# @tsuzuru/config

Project configuration helpers for Tsuzuru.

## Usage

```ts
import { defineTsuzuruConfig } from "@tsuzuru/config";

export default defineTsuzuruConfig({
  scenario: {
    entry: "scenario/main.tzr",
    files: ["scenario/**/*.tzr"],
  },
});
```

The package currently provides types and `defineTsuzuruConfig()`. It does not
load files, expand globs, or validate projects by itself.
