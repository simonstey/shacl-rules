# Extract SRL engine into a standalone library — design

**Date:** 2026-07-15
**Status:** Approved (brainstorming)

## Goal

Split the SRL rule engine (lexer/parser, AST, execution, validation, stratification)
from the Next.js playground UI so the engine can be published as a standalone
Node.js / TypeScript library (`srl-engine`). The playground continues to work,
consuming the engine as a workspace package.

## Decisions (locked)

| Decision | Choice |
|----------|--------|
| Repo layout | **Monorepo, npm workspaces** — `packages/*` + `apps/*` |
| Package name | **`srl-engine`** (unscoped) |
| Build tool | **tsup** (esbuild wrapper → ESM + CJS + `.d.ts`) |
| Public API | **Curated facade + types** — high-level entry points + every symbol the app imports; internals stay unexported |
| Tests | **Vitest + vendored W3C `data-shapes` rules fixtures** (first automated test runner for this code) |

## The clean seam

The pure logic already imports **only** `chevrotain`, `n3`, and its own siblings —
zero React / monaco / DOM. Verified by grepping imports across `src/lib`.

- **Pure → package:** `srl/{tokens,parser,ast}`, `rules/{pattern-matcher,expression-evaluator,executor,stratifier}`, `validation/validator`.
- **UI-coupled → stays in app:** all `components/`, `app/`, `monaco/`, `examples/` (playground content, imports nothing from lib), and the 3 React hooks `useMediaQuery`, `useValidation`, `useRuleExecution` (thin wrappers that call the engine).

The hooks are thin: `useValidation` calls `validateSRL`; `useRuleExecution` calls
`buildAST` + `executeRules`. Extraction = move the pure files, leave the hooks in
the app importing from `srl-engine`.

## Section 1 — Repo structure

```
shacl-rules/
├─ package.json            # workspaces root: ["packages/*","apps/*"], private; retains `overrides`
├─ packages/
│  └─ srl-engine/          # published npm package "srl-engine"
│     ├─ src/
│     │  ├─ srl/           # tokens, parser, ast  (moved verbatim via git mv)
│     │  ├─ rules/         # pattern-matcher, expression-evaluator, executor, stratifier
│     │  ├─ validation/    # validator.ts only (hook left behind in app)
│     │  └─ index.ts       # curated facade
│     ├─ test/
│     │  ├─ fixtures/      # vendored W3C rules subset + manifests
│     │  ├─ fixtures.test.ts
│     │  └─ smoke.test.ts
│     ├─ package.json
│     ├─ tsconfig.json
│     ├─ tsup.config.ts
│     ├─ vitest.config.ts
│     └─ README.md
└─ apps/
   └─ playground/          # current Next app, moved wholesale
      ├─ src/
      │  ├─ app/  components/
      │  └─ lib/           # KEEPS: monaco/, examples/, useMediaQuery, useValidation, useRuleExecution
      ├─ next.config.ts    # + transpilePackages: ['srl-engine']
      └─ package.json      # deps: "srl-engine": "*"
```

- Moves use `git mv` to preserve blame/history.
- `CLAUDE.md` / `DESIGN.md` / `PRODUCT.md` / `.impeccable/` stay at root (govern the whole repo). Root `CLAUDE.md` gets a monorepo-layout update.
- `RELEASING.md` (new, root) documents the out-of-scope manual steps (see Section 4).

## Section 2 — `srl-engine` package config

**`packages/srl-engine/package.json`** (essentials):

```jsonc
{
  "name": "srl-engine",
  "version": "0.1.0",
  "description": "SHACL 1.2 Rules (SRL) parser, validator, and inference engine",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  },
  "files": ["dist"],
  "sideEffects": false,
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": { "chevrotain": "^11.0.3", "n3": "^1.26.0" },
  "devDependencies": { "tsup": "^8", "vitest": "^2", "typescript": "^5", "@types/n3": "^1.26.1" }
}
```

- `chevrotain` / `n3` become runtime deps of the **package** (removed from the app's direct deps; the app gets them transitively via the workspace link).
- `"type": "module"` + dual `exports` → both `import` and `require()` work; `sideEffects: false` enables tree-shaking.
- **chevrotain stays at v11** (per CLAUDE.md — v12 only drops lodash-es; the vuln is handled by the root `overrides`). The `overrides` block **stays at the root** package.json (npm applies overrides workspace-wide).

**`tsup.config.ts`:** `entry: ['src/index.ts']`, `format: ['esm','cjs']`, `dts: true`, `clean: true`, `sourcemap: true`, `external: ['chevrotain','n3']`.

**Facade `src/index.ts`** — re-exports the public entry points plus every symbol the 7 app components import today, so the app compiles unchanged except for the import path:

```ts
// Language front end
export { buildAST } from './srl/ast';
export { parseSRL, getSerializedGrammar, getGrammarRuleNames } from './srl/parser';
export type { ParseResult, GrammarRuleInfo } from './srl/parser';
export type { RuleSet, Rule, TriplePattern, Expression, /* …all AST types… */ } from './srl/ast';
export { SRLLexer, allTokens } from './srl/tokens';

// Engine
export { executeRules, expandDeclarations, formatTripleForDisplay } from './rules/executor';
export type { ExecutionResult, InferredTriple, RuleInfo, ExecutorOptions } from './rules/executor';
export { stratifyRules, isStratifiable } from './rules/stratifier';
export { /* pattern-matcher helpers the validator/app need */ } from './rules/pattern-matcher';

// Validation
export { validateSRL } from './validation/validator';
export type { ValidationMessage, ValidationResult } from './validation/validator';
```

Internal-only symbols (`parserInstance` singleton, `joinSolutions`, `walkExpression`,
`setCurrentStore` / `setCurrentNow`) stay unexported.

## Section 3 — App rewiring, tests, migration mechanics

### Import swaps (mechanical)
- `useValidation.ts`: `import { validateSRL } from './validator'` → `from 'srl-engine'`; delete local `validator.ts` (moved).
- `useRuleExecution.ts`: `buildAST` / `executeRules` → `from 'srl-engine'`.
- `validation/index.ts` barrel: re-export `ValidationMessage` / `ValidationResult` from `srl-engine`; keep `useValidation` local.
- Components (`InferredTriplesPanel`, `SyntaxBreakdown`, `SyntaxDiagramPanel`, `SRLEditor`, `ValidationPanel`): repoint their `@/lib/{srl,rules,validation}` imports to `srl-engine`.
- `next.config.ts`: add `transpilePackages: ['srl-engine']` so Next compiles the workspace TS source in dev without a pre-built `dist`.

### monaco/srl-language.ts
Stays in the app (monaco-typed). It hardcodes keyword/builtin/token lists mirroring
the grammar; per CLAUDE.md these are kept in sync manually. Add a comment pointing at
the engine grammar as the source of truth. Do **not** import engine internals for it.

### Tests (`packages/srl-engine/test/`)
- **Vendor a subset** of W3C `data-shapes` rules fixtures from `py-srl/…/tests/rules/`
  into `test/fixtures/` (syntax + wellformed + stratification + eval, with their
  `manifest.ttl` Positive/Negative types). Copied in — **not** a live dependency on the
  sibling checkout (a published lib can't reach a sibling repo).
- `fixtures.test.ts`: parse each manifest; run `validateSRL` (syntax / wellformed /
  stratification cases) and `executeRules` (eval cases); assert pass/fail matches the
  manifest's expected type. Known-deferred RDF-1.2 fixtures + the 4 Turtle-leniency
  false-positives are `.skip`-listed with an explaining comment (matches prior manual
  verification: 87 pass, 64 deferred, 4 edge cases).
- `smoke.test.ts`: assert each public facade export is defined + one happy-path
  parse→validate→execute.
- `vitest.config.ts`: node environment, no DOM.

### Migration order
1. Scaffold workspaces root + empty `packages/srl-engine` + `apps/playground`.
2. `git mv` app files into `apps/playground/`; `git mv` pure lib files into `packages/srl-engine/src/`.
3. Write package.json / tsconfig / tsup / vitest / index.ts; add engine deps; retain root `overrides`.
4. Rewire app imports + `transpilePackages`.
5. `npm install` (workspace link), then verify:
   - `npm -w srl-engine run build` (tsup emits `dist` + `.d.ts`)
   - `npm -w srl-engine test` (vitest green)
   - `npm -w playground run build` (Next typecheck + build clean)
   - `npm -w playground run lint`
6. Vendor fixtures + finalize tests.
7. Docs: root `CLAUDE.md` monorepo layout; new `packages/srl-engine/README.md` (install + API); app `README.md` note; `RELEASING.md`.

## Section 4 — Out of scope (deferred) → documented in `RELEASING.md`

These are **not** implemented now but MUST be written up as a manual step-by-step
guide in a new root `RELEASING.md`:

- **Publishing to npm** — `npm login`, version bump, `npm -w srl-engine publish` (unscoped public), verifying the tarball contents (`npm pack --dry-run`), the `prepublishOnly` build gate.
- **CI workflow** — a GitHub Actions sketch: install → build engine → test engine → build app → lint, on PR.
- **Release tooling (changesets)** — how to add and use `@changesets/cli` for versioning + changelog if desired later.
- **Browser / UMD bundle** — how to add a tsup `iife`/`umd` format + `globalName` if a `<script>`-tag consumer is ever needed.
- **Scoping the package later** — how to rename to `@owner/srl-engine` and the `--access public` implication.

The build config + `files` field make the package **publish-ready**; the actual
`npm publish` is a deliberate later manual step.

## Verification (no bundler surprises)

The pure files import only chevrotain + n3, confirmed by grep. tsup marks both
external, so `dist` is small and dependency-light. Success = all four workspace
commands in step 5 pass, matching today's clean `npm run build` / `npm run lint`.
