# @tsuzuru/cli

Command line tools for checking Tsuzuru projects.

## Usage

```sh
tsuzuru check
```

`tsuzuru check` loads `tsuzuru.config.ts` from the current directory, collects
configured `.tzr` files, and validates the scenario project with
`@tsuzuru/core`.

The CLI does not provide `tsuzuru dev` or `tsuzuru build` yet.
