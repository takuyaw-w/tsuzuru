# create-tsuzuru

Minimal project generator for Tsuzuru.

After publish, the intended usage is:

```sh
pnpm create tsuzuru my-game
cd my-game
pnpm install
pnpm check:scenario
pnpm dev
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

The first generator scope supports only:

- `create-tsuzuru <project-name>`
- the bundled `basic` template
- copying files into a new directory
- replacing the `package.json` name placeholder
- a Vite + Preact project with `tsuzuru.config.ts`
- scenario files that use top-level `include "./path.tzr"` and `jump sceneName`
- host TSX screens for title, load, settings, backlog, and gallery

The generated project keeps these scripts:

```json
{
  "dev": "vite",
  "build": "tsuzuru check && vite build",
  "check:scenario": "tsuzuru check",
  "preview": "vite preview"
}
```

It does not install dependencies, initialize git, prompt for options, or select
templates yet.
