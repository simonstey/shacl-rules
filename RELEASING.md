# Releasing & operational guide (`srl-engine`)

Manual, deliberately-not-automated steps. The package is publish-*ready*
(build config + `files` field are in place); everything below is a conscious
manual action.

> **For the full step-by-step publish walkthrough** (one-time setup, pre-flight,
> manifest hardening, dry-run, versioning, verify, post-publish, unpublish),
> see [`packages/srl-engine/PUBLISHING.md`](packages/srl-engine/PUBLISHING.md).
> This section is the condensed reference.

## 1. Publish to npm

Prerequisites: an npm account with publish rights to the (unscoped) name
`srl-engine`. Confirm the name is free/owned: `npm view srl-engine`.

```bash
# from repo root
npm login                              # once per machine
npm -w srl-engine run build            # produce dist/
npm -w srl-engine pack --dry-run       # inspect the tarball contents
# → verify it contains ONLY dist/** and README.md (per package.json "files")
```

Bump the version, then publish:

```bash
npm -w srl-engine version patch        # or minor / major
npm -w srl-engine publish --access public
```

- **Before first publish, tighten the `exports` map for strict CJS consumers.** tsup emits `dist/index.d.cts`; add per-condition types so `require()` under `moduleResolution: node16/nodenext` resolves CJS-oriented declarations:
  ```jsonc
  ".": {
    "import": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
    "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
  }
  ```

Recommended safety gate — add a `prepublishOnly` script to
`packages/srl-engine/package.json` so a publish can never ship a stale/broken
build:

```jsonc
"scripts": {
  "prepublishOnly": "npm run typecheck && npm run test && npm run build"
}
```

After publishing, the playground can switch its dependency from the workspace
link (`"srl-engine": "*"`) to a fixed range (`"srl-engine": "^0.1.0"`) if you
ever split the app into its own repo; while it stays in this monorepo, keep `*`
so it always uses the local source.

## 2. GitHub Actions CI

Create `.github/workflows/ci.yml`:

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm -w srl-engine run typecheck
      - run: npm -w srl-engine test
      - run: npm -w srl-engine run build
      - run: npm -w playground run build
      - run: npm -w playground run lint
```

`npm ci` at the root installs all workspaces. The engine is built before the
app step so `next build` can resolve the package `exports` map.

## 3. Versioning with Changesets (optional)

If you want changelog + coordinated version bumps later:

```bash
npm install -D @changesets/cli
npx changeset init
```

Workflow: `npx changeset` (describe the change, pick bump level) → commit the
generated markdown → at release time `npx changeset version` (writes versions +
CHANGELOG) → `npx changeset publish`.

## 4. Browser / UMD bundle

The default build is ESM + CJS for Node/bundler consumers. To also ship a
`<script>`-tag global, add an IIFE format to `tsup.config.ts`:

```ts
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs', 'iife'],
  globalName: 'SRLEngine',
  dts: true,
  clean: true,
  sourcemap: true,
  // For a self-contained browser bundle, do NOT mark chevrotain/n3 external:
  // external: [],
});
```

The IIFE build must bundle `chevrotain` + `n3` (remove them from `external`),
which makes it large — only do this if a no-bundler browser consumer needs it.

## 5. Scoping the package name later

To move from `srl-engine` to `@owner/srl-engine`:

1. Change `"name"` in `packages/srl-engine/package.json` to `@owner/srl-engine`.
2. Scoped packages are private by default on npm — publish with
   `npm -w @owner/srl-engine publish --access public`.
3. Update the playground dependency key to the new name.
