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

It does not install dependencies, initialize git, prompt for options, or select
templates yet.
