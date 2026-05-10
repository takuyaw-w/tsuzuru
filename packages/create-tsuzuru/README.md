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

The default template is the existing Vite + Preact `basic` template. The same
template is also available as `preact`:

```sh
pnpm create tsuzuru my-game --template basic
pnpm create tsuzuru my-game --template preact
```

For a framework-free project that uses plain HTML and Vanilla DOM through
`@tsuzuru/html`, use:

```sh
pnpm create tsuzuru my-game --template html
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

The generator supports:

- `create-tsuzuru <project-name>`
- `create-tsuzuru <project-name> --template basic`
- `create-tsuzuru <project-name> --template preact`
- `create-tsuzuru <project-name> --template html`
- the bundled `basic` and `html` templates
- copying files into a new directory
- replacing the `package.json` name placeholder
- Vite projects with `tsuzuru.config.ts`
- scenario files that use top-level `include "./path.tzr"` and `jump sceneName`

The `basic` and `preact` template names both generate the existing Vite +
Preact project. It includes host TSX screens for title, load, settings, backlog,
and gallery.

The `html` template does not use Preact, React, Vue, TSX, or JSX. Common editing
targets in generated HTML projects are:

- `index.html`
- `assets.ts`
- `scenario/**/*.tzr`
- `src/screens/*.html`
- `src/style.css`
- `public/assets`

The HTML template keeps source scenarios in `scenario/`, screen fragments in
`src/screens/`, the asset ID table in `assets.ts`, and real browser assets under
`public/assets/`.

The generated project keeps these scripts:

```json
{
  "dev": "vite",
  "build": "tsuzuru check && vite build",
  "check:scenario": "tsuzuru check",
  "preview": "vite preview"
}
```

It does not install dependencies, initialize git, or prompt for options.
