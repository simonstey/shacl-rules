# `srl-engine` examples

Runnable, self-contained scripts demonstrating the engine. Each imports
`srl-engine` **by package name** (not a relative path), so they double as real
consumer code.

## Running them

The examples import the built package, so build once first:

```bash
# from the repo root
npm -w srl-engine run build
```

Then run any example with plain Node (they are ESM `.mjs`, no TS runner needed):

```bash
node packages/srl-engine/examples/01-basic-inference.mjs
```

Or, from inside `packages/srl-engine/`:

```bash
npm run build
node examples/01-basic-inference.mjs
```

> Why build first? The scripts `import … from 'srl-engine'`, which npm resolves
> through the workspace symlink to the package's `dist/`. Without a build there
> is no `dist/` to resolve. (If you prefer to skip the build while hacking, you
> can instead import from `../src/index.ts` via a TS runner such as
> `tsx`, but the `.mjs` + build path needs no extra tooling.)

## The examples

| File | Shows |
|------|-------|
| [`01-basic-inference.mjs`](01-basic-inference.mjs) | The core pipeline: validate → buildAST → executeRules; reading `inferredTriples`. |
| [`02-transitive-and-declarations.mjs`](02-transitive-and-declarations.mjs) | `TRANSITIVE` closure + postfix `(:p) SYMMETRIC`; grouping output by source rule; `formatTripleForDisplay`. |
| [`03-negation-and-set.mjs`](03-negation-and-set.mjs) | `NOT { … }` closed-world guard + `SET(?v := CONCAT(…))` computed value. |
| [`04-property-paths.mjs`](04-property-paths.mjs) | Sequence (`/`) and inverse (`^`) property paths, plus a `FILTER`. |
| [`05-validation-diagnostics.mjs`](05-validation-diagnostics.mjs) | `validateSRL` on valid + invalid input; error vs warning; message positions. |
| [`06-data-blocks-and-provenance.mjs`](06-data-blocks-and-provenance.mjs) | `DATA { … }` seeding, per-triple provenance, assembling the full output graph. |

Each script prints its expected output as a trailing comment.

## Learning path

Read them in order — they build up from a single rule (01) through declarations
(02), negation + assignment (03), paths (04), diagnostics (05), to provenance
and full-graph assembly (06). For the concepts behind them, see the
[How-To Guide](../docs/GUIDE.md); for the API surface, the
[package README](../README.md).
