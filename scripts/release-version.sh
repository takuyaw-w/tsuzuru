#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:-}"

if [[ -z "$VERSION" ]]; then
  echo "Usage: pnpm release:version <version>"
  echo "Example: pnpm release:version 0.6.0"
  exit 1
fi

if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]]; then
  echo "Invalid version: $VERSION"
  echo "Expected semver-like version, e.g. 0.6.0 or 0.6.0-alpha.1"
  exit 1
fi

CURRENT_BRANCH="$(git branch --show-current)"

if [[ "$CURRENT_BRANCH" != "main" ]]; then
  echo "Release must be run from main. Current branch: $CURRENT_BRANCH"
  exit 1
fi

git fetch origin --tags

git pull --ff-only

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is not clean."
  git status --short
  exit 1
fi

TAG="v$VERSION"

if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "Tag already exists locally: $TAG"
  exit 1
fi

if git ls-remote --tags origin "refs/tags/$TAG" | grep -q "$TAG"; then
  echo "Tag already exists on origin: $TAG"
  exit 1
fi

node <<NODE
const fs = require("node:fs");

const version = "$VERSION";

const files = [
  "package.json",
  "packages/core/package.json",
  "packages/preact/package.json",
  "packages/plugin-std-visual/package.json",
  "packages/plugin-std-audio/package.json",
  "packages/standard-ui-preact/package.json",
  "examples/preact-basic/package.json",
];

for (const file of files) {
  if (!fs.existsSync(file)) {
    throw new Error(\`Missing package.json: \${file}\`);
  }

  const json = JSON.parse(fs.readFileSync(file, "utf8"));
  json.version = version;
  fs.writeFileSync(file, \`\${JSON.stringify(json, null, 2)}\n\`);
  console.log(\`updated \${file} -> \${version}\`);
}
NODE

echo "Running verification..."
rtk pnpm test
rtk pnpm typecheck

git add \
  package.json \
  packages/*/package.json \
  examples/*/package.json

git commit -m "chore: bump version to $VERSION"

git tag -a "$TAG" -m "$TAG"

git push origin main
git push origin "$TAG"

echo "Released $TAG"
