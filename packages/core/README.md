# @tsuzuru/core

Core parser, compiler, project compiler, and runtime primitives for Tsuzuru.

## DSL v2 example

```tzr
title "Example"

scene start:
  narration:
    Hello.
  end
```

## Usage

```ts
import { compileTzrProject, parseTzr, stepRuntime } from "@tsuzuru/core";
```

Core does not read files, touch the DOM, load assets, or depend on Preact. Hosts
provide scenario sources and plugin command handlers.
