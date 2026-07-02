# 0010 create-tsuzuru Package

Status: accepted, amended.

Tsuzuru will ship a dedicated `create-tsuzuru` package for project scaffolding.
The package owns its templates under `packages/create-tsuzuru/templates` so a
published generator does not depend on repository-only example paths.

Initial behavior is intentionally small, with template selection now limited to
bundled templates:

- `create-tsuzuru <project-name>` creates one project from the `basic` template.
- `--template basic` and `--template preact` both select the existing Preact
  template.
- `--template html` was removed after the framework-free HTML adapter route was
  reverted. It now returns an unknown template error.
- The generated project includes `tsuzuru.config.ts`.
- The generated project wires `tsuzuru check` into `check:scenario` and
  `build`.
- `package.json` uses publishable semver dependencies instead of
  `workspace:*`.

Title, settings, load, backlog, and gallery remain host TSX screens. `.tzr`
files stay focused on scenario content, branching, jumps, choices, and
presentation commands.

Out of scope for the first package:

- interactive prompts
- automatic install
- package manager detection
- git initialization
- remote templates
- overwrite options
- publish and provenance work
- Vite plugin work
- `tsuzuru dev` and `tsuzuru build`
- Vue template work; Vue support is out of the initial v0.x official scope
