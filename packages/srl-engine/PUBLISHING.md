# Publishing `srl-engine` to npm — step-by-step

A detailed, do-this-then-that walkthrough for publishing the package to
[npmjs.com](https://www.npmjs.com). For the broader operational context (CI,
changesets, browser bundle, scoping) see the repo-root
[`RELEASING.md`](../../RELEASING.md); this file is the focused publish
procedure.

> **Audience:** whoever owns the npm release. Assumes Node ≥ 18 and npm ≥ 9
> (workspaces + `-w` flag). Run every command **from the repo root** unless
> noted.

---

## Overview

```
0. One-time setup        → npm account, 2FA, name availability
1. Pre-flight            → clean tree, tests, build, typecheck
2. Harden the manifest   → prepublishOnly gate, exports types, metadata
3. Dry-run the tarball   → npm pack --dry-run, inspect contents
4. Choose a version      → semver + 0.x rules
5. Publish               → npm publish --access public (+ 2FA OTP)
6. Verify                → install the published package in a scratch dir
7. Post-publish          → git tag, GitHub release, dep-range switch
```

Skip nothing on the **first** publish. Steps 0 and 2 are one-time; later
releases start at Step 1.

---

## Step 0 — One-time setup

1. **npm account.** Create one at <https://www.npmjs.com/signup> if needed.
2. **Enable 2FA for authorization** (Account → Two-Factor Authentication →
   "Authorization and Publishing"). npm will prompt for a one-time code on every
   publish. Strongly recommended for any public package.
3. **Log in on this machine:**
   ```bash
   npm login
   npm whoami            # confirm you're logged in as the right user
   ```
4. **Confirm the name is available (or yours):**
   ```bash
   npm view srl-engine
   ```
   - `npm ERR! 404` → the name is free, you can publish it.
   - Returns metadata you own → fine, you're updating your package.
   - Returns metadata you DON'T own → the name is taken; you must scope it
     (`@your-user/srl-engine`) — see [RELEASING.md §5](../../RELEASING.md) and
     Step 4's note below.

---

## Step 1 — Pre-flight checks

Publishing ships whatever is in `dist/`. Make sure the working tree is clean and
everything passes **before** you build the artifact you'll upload.

```bash
git status                       # should be clean (or only intended changes)
git rev-parse --abbrev-ref HEAD  # know which branch/commit you're releasing

npm -w srl-engine run typecheck  # tsc --noEmit — 0 errors
npm -w srl-engine test           # vitest — smoke + W3C fixtures green
npm -w srl-engine run build      # tsup → dist/ (ESM + CJS + .d.ts + .d.cts)
```

Confirm the build emitted the four artifacts the manifest points at:

```bash
ls packages/srl-engine/dist
# expect: index.js  index.cjs  index.d.ts  index.d.cts  (+ .map files)
```

If any check fails, stop and fix it — do not publish a broken build.

---

## Step 2 — Harden the package manifest (first publish only)

Open `packages/srl-engine/package.json` and make these edits once.

### 2a. Add a `prepublishOnly` safety gate

So a publish can never ship a stale or broken build:

```jsonc
"scripts": {
  "build": "tsup",
  "test": "vitest run",
  "typecheck": "tsc --noEmit",
  "prepublishOnly": "npm run typecheck && npm run test && npm run build"
}
```

`npm publish` runs `prepublishOnly` automatically, so the tarball is always
built from passing, type-checked source.

### 2b. Tighten the `exports` map for CJS type resolution

tsup emits `dist/index.d.cts` for the CommonJS build, but the current manifest
only advertises the ESM `.d.ts`. Under `moduleResolution: node16`/`nodenext`, a
`require()` consumer should get the CJS declarations. Update `exports`:

```jsonc
"exports": {
  ".": {
    "import": { "types": "./dist/index.d.ts",  "default": "./dist/index.js" },
    "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
  }
},
```

(Keep the top-level `"main"`, `"module"`, `"types"` fields as-is for older
tooling that ignores `exports`.)

### 2c. Fill in publish metadata

Add the fields npm surfaces on the package page (skip any that already exist):

```jsonc
"license": "MIT",
"author": "Simon Steyskal",
"repository": {
  "type": "git",
  "url": "git+https://github.com/simonstey/shacl-rules.git",
  "directory": "packages/srl-engine"
},
"homepage": "https://github.com/simonstey/shacl-rules/tree/main/packages/srl-engine#readme",
"bugs": "https://github.com/simonstey/shacl-rules/issues",
"keywords": ["shacl", "shacl-rules", "srl", "rdf", "inference", "rules", "n3", "reasoner"]
```

> `"files": ["dist", "README.md"]` is already set — the tarball ships only the
> build output + README, not `src/`, `test/`, or fixtures. Verify in Step 3.

After editing, re-run `npm -w srl-engine run typecheck` to be safe, and commit
the manifest change:

```bash
git add packages/srl-engine/package.json
git commit -m "chore(srl-engine): harden manifest for first npm publish"
```

---

## Step 3 — Dry-run the tarball

**Never publish blind.** Inspect exactly what npm would upload:

```bash
npm -w srl-engine pack --dry-run
```

Read the file list. It must contain **only**:

```
package.json
README.md
dist/index.js         dist/index.js.map
dist/index.cjs        dist/index.cjs.map
dist/index.d.ts       dist/index.d.cts
```

Red flags → stop and fix `"files"` / `.npmignore`:
- `src/**`, `test/**`, `test/fixtures/**` present → you'd ship source + the
  vendored W3C fixtures. Not intended.
- `dist/` missing → you forgot to build (Step 1).
- `node_modules/**` present → misconfiguration.

Optionally produce the actual tarball to open it:

```bash
npm -w srl-engine pack           # writes srl-engine-<version>.tgz
tar -tf srl-engine-*.tgz         # list contents
rm srl-engine-*.tgz              # clean up — don't commit it
```

---

## Step 4 — Choose a version

The package starts at `0.1.0`. Semver, with the pre-1.0 convention that the
API may still move:

| Change | Command | 0.x meaning |
|--------|---------|-------------|
| Bug fix, no API change | `npm -w srl-engine version patch` | 0.1.0 → 0.1.1 |
| New feature / additive API | `npm -w srl-engine version minor` | 0.1.0 → 0.2.0 |
| Breaking API change | `npm -w srl-engine version major` | 0.1.0 → 1.0.0 (leaving 0.x) |

For the **first** publish, `0.1.0` is already set — you can skip the bump and
publish as-is, or run `npm -w srl-engine version 0.1.0 --allow-same-version` to
create the git tag.

`npm version` bumps `package.json` **and** creates a `v<version>` git commit +
tag (run it on a clean tree). Push the tag afterward (Step 7).

> **If the name was taken (Step 0):** change `"name"` to `@your-user/srl-engine`
> first. Scoped packages default to *private* — you MUST pass `--access public`
> in Step 5 (already in the command below). Also update the playground's
> dependency key from `srl-engine` to the scoped name.

---

## Step 5 — Publish

```bash
npm -w srl-engine publish --access public
```

- `--access public` is **required** for a scoped package and harmless for an
  unscoped one — always include it so a later rename doesn't silently publish
  private.
- `prepublishOnly` (Step 2a) runs first: typecheck → test → build. If any fails,
  the publish aborts. Good.
- With 2FA enabled, npm prompts for a one-time code (`Enter OTP:`) — type the
  code from your authenticator.

Success looks like:

```
+ srl-engine@0.1.0
```

---

## Step 6 — Verify the published package

Install it fresh, outside the monorepo, and confirm it imports and runs:

```bash
cd $(mktemp -d)                  # a throwaway directory
npm init -y >/dev/null
npm install srl-engine

node --input-type=module -e "
  import { validateSRL, buildAST, executeRules } from 'srl-engine';
  const srl = 'PREFIX : <http://example/>\nRULE { :x :q ?o } WHERE { :s :p ?o }';
  const data = 'PREFIX : <http://example/>\n:s :p :o .';
  console.log('valid:', validateSRL(srl).isValid);
  const r = executeRules(buildAST(srl), data);
  console.log('inferred:', r.inferredTriples.map(t => t.quadString));
"
# → valid: true
# → inferred: [ '<http://example/x> <http://example/q> <http://example/o>' ]
```

Also sanity-check the published page: <https://www.npmjs.com/package/srl-engine>
(README rendered, version correct, no stray files in the "Code" tab).

For a CommonJS consumer:

```bash
node -e "const { validateSRL } = require('srl-engine'); console.log(validateSRL('PREFIX : <http://x/>\nRULE { :a :b :c } WHERE { :a :b :c }').isValid)"
```

---

## Step 7 — Post-publish

1. **Push the version tag** (created by `npm version`):
   ```bash
   git push origin HEAD --follow-tags
   ```
2. **Create a GitHub release** for `v0.1.0` (optional but recommended) with a
   short changelog. If you adopt Changesets later, this becomes automated — see
   [RELEASING.md §3](../../RELEASING.md).
3. **Dependency range** — while the playground stays in this monorepo, keep its
   dependency as `"srl-engine": "*"` so it always builds against local source.
   Only pin a published range (`^0.1.0`) if you split the app into its own repo.

---

## Unpublishing / mistakes

- Within **72 hours** you can `npm unpublish srl-engine@0.1.0` (npm restricts
  unpublish after that window and blocks re-using the same version number).
- Prefer **`npm deprecate srl-engine@0.1.0 "message"`** over unpublish for a
  released version — it warns installers without breaking anyone who depends on
  it.
- To pull a bad `latest` tag, publish a fixed patch (`0.1.1`) rather than
  unpublishing.

---

## Quick checklist

```
[ ] npm whoami shows the right account, 2FA on
[ ] git tree clean, on the release commit
[ ] typecheck + test + build all green
[ ] dist/ has index.{js,cjs,d.ts,d.cts}
[ ] prepublishOnly gate present (first publish)
[ ] exports map has per-condition types (first publish)
[ ] npm pack --dry-run shows ONLY dist/ + README.md + package.json
[ ] version chosen (semver)
[ ] npm publish --access public  (OTP entered)
[ ] verified via fresh install in a scratch dir
[ ] git tag pushed, GitHub release drafted
```
