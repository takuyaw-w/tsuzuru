# create-tsuzuru

Minimal project generator for Tsuzuru.

After publish, the intended usage is:

```sh
pnpm create tsuzuru my-game
cd my-game
pnpm dev
```

The default template is a Vite + Preact novel game starter. The same template
is also available as `preact`:

```sh
pnpm create tsuzuru my-game --template basic
pnpm create tsuzuru my-game --template preact
```

Before the matching Tsuzuru packages are published to npm, installing a
generated project outside this monorepo can fail because the template uses
publishable semver dependencies.

Before publish, run it from this monorepo:

```sh
pnpm --filter create-tsuzuru build
node packages/create-tsuzuru/dist/src/index.js my-game
cd my-game
pnpm install
pnpm check:scenario
pnpm dev
```

The generator supports:

- `create-tsuzuru <project-name>`
- `create-tsuzuru <project-name> --template basic`
- `create-tsuzuru <project-name> --template preact`
- the bundled `basic` template
- copying files into a new directory
- replacing the `package.json` name placeholder
- Vite projects with `tsuzuru.config.ts`
- queryless `.tzr` imports through `@tsuzuru/vite-plugin`
- a title screen that starts the compiled scenario

The `basic` and `preact` template names both generate the same starter. It
opens on a title screen, then Start enters a 16:9 game view powered by
`@tsuzuru/standard-ui-preact`. Load and Config are visible placeholders, not
implemented screens. The generated `tsuzuru.config.ts` already includes a
declarative `storage` block and the template depends on
`@tsuzuru/standard-game-storage`, but actual Save / Load / Settings screens and
runtime save timing remain application code.

Generated projects are intended to start from:

- `scenario/main.tzr`
- `public/assets/images/`
- `public/assets/audio/`

The removed `html` template is no longer available. Passing `--template html`
returns an unknown template error. Passing `--template vue` also returns an
unknown template error. Tsuzuru Core remains framework-neutral, but the
official v0.x generator path is the Preact-based JSX template.

The generated project keeps these scripts:

```json
{
  "dev": "pnpm install --prefer-offline && vite",
  "build": "tsuzuru check && vite build",
  "check:scenario": "tsuzuru check",
  "typecheck": "tsc -p tsconfig.json --noEmit",
  "preview": "vite preview"
}
```

The generated `dev` script runs `pnpm install --prefer-offline` first so the
published pnpm create flow can go straight to `pnpm dev`. The generator itself
does not initialize git or prompt for options.
