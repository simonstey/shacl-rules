# SRL Engine Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the SRL rule engine (lexer/parser, AST, execution, validation, stratification) from the Next.js playground into a standalone, publishable `srl-engine` workspace package, leaving the playground working as a workspace app that consumes it.

**Architecture:** Convert the single-package repo into an npm workspaces monorepo. `packages/srl-engine` holds the pure logic (imports only `chevrotain` + `n3`), built with tsup into dual ESM/CJS + `.d.ts`, tested with Vitest against vendored W3C `data-shapes` rules fixtures. `apps/playground` holds the current Next.js app (components, monaco glue, React hooks, examples), rewired to import the engine from `srl-engine` instead of `@/lib/*`.

**Tech Stack:** TypeScript 5, npm workspaces, tsup (esbuild), Vitest, chevrotain v11, n3, Next.js 16 / React 19 (app only).

## Global Constraints

- **chevrotain stays at v11** — do NOT bump to v12 (per CLAUDE.md; v12 only drops `lodash-es`, the vuln is covered by root `overrides`).
- **Root `package.json` retains its `overrides` block** (`dompurify`, `lodash-es`, `postcss`) — npm applies overrides workspace-wide from the root only.
- **Engine package imports ONLY `chevrotain`, `n3`, and its own siblings** — no React, no monaco, no `window`/`document`. Any such import is a plan failure.
- **Package name is `srl-engine`** (unscoped), version `0.1.0`, published later manually (see `RELEASING.md`).
- **Moves use `git mv`** to preserve blame/history.
- **No test runner existed before** — Vitest is introduced by this plan. Engine tests run against `src` (Vitest uses esbuild; no build needed before `test`).
- **Windows environment** — commands are given for PowerShell (primary). `npm -w <name> run <script>` targets a workspace.
- Facade principle: `packages/srl-engine/src/index.ts` re-exports every symbol the 7 app components import today, plus the public engine entry points; internal helpers (`getParserInstance`/`parserInstance`, `joinSolutions`, `setCurrentStore`/`getCurrentStore`/`setCurrentNow`, `ASTBuilder`, `SRLParser`) stay unexported.

---

## File Structure

**Created:**
- `packages/srl-engine/package.json` — engine package manifest (deps: chevrotain, n3).
- `packages/srl-engine/tsconfig.json` — engine typecheck config.
- `packages/srl-engine/tsup.config.ts` — dual ESM/CJS + dts build.
- `packages/srl-engine/vitest.config.ts` — node-env test config.
- `packages/srl-engine/src/index.ts` — curated facade.
- `packages/srl-engine/README.md` — install + API docs.
- `packages/srl-engine/test/smoke.test.ts` — facade happy-path tests.
- `packages/srl-engine/test/fixtures.test.ts` — manifest-driven W3C fixture suite.
- `packages/srl-engine/test/fixtures/rules/**` — vendored W3C `data-shapes` rules fixtures.
- `apps/playground/package.json` — app manifest (deps: next/react/monaco/…, + `srl-engine`).
- `RELEASING.md` — manual guide for the out-of-scope items (publish, CI, changesets, UMD, scoping).

**Moved (git mv):**
- Whole current app → `apps/playground/` (Task 2), then the pure lib files → `packages/srl-engine/src/` (Task 3).

**Modified:**
- Root `package.json` — becomes workspaces root.
- `.gitignore` — de-root ignore paths so they match under `apps/playground/`.
- App hooks/barrels/components — repoint `@/lib/*` engine imports to `srl-engine` (Task 4).
- `apps/playground/next.config.ts` — add `transpilePackages: ['srl-engine']`.
- Root `CLAUDE.md` — monorepo layout note.

---

## Task 1: Workspace skeleton + engine package config

Stand up the monorepo and the `srl-engine` package with a trivial facade, so the engine builds and typechecks in isolation before any real code moves.

**Files:**
- Modify: `package.json` (root)
- Create: `packages/srl-engine/package.json`
- Create: `packages/srl-engine/tsconfig.json`
- Create: `packages/srl-engine/tsup.config.ts`
- Create: `packages/srl-engine/vitest.config.ts`
- Create: `packages/srl-engine/src/index.ts` (temporary trivial content)

**Interfaces:**
- Produces: workspace `srl-engine` resolvable via `npm -w srl-engine`; build script emitting `packages/srl-engine/dist/`.

- [ ] **Step 1: Convert root `package.json` to a private workspaces root**

Replace the current root `package.json` with (keep the existing `overrides` verbatim):

```jsonc
{
  "name": "shacl-rules-monorepo",
  "version": "0.1.0",
  "private": true,
  "workspaces": ["packages/*", "apps/*"],
  "overrides": {
    "dompurify": "^3.4.12",
    "lodash-es": "^4.18.1",
    "postcss": "^8.5.10"
  }
}
```

(The current root `dependencies`/`devDependencies`/`scripts` move to `apps/playground/package.json` in Task 2 — they are preserved there, not lost.)

- [ ] **Step 2: Create the engine package manifest**

Create `packages/srl-engine/package.json`:

```jsonc
{
  "name": "srl-engine",
  "version": "0.1.0",
  "description": "SHACL 1.2 Rules (SRL) parser, validator, and inference engine",
  "license": "MIT",
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
  "files": ["dist", "README.md"],
  "sideEffects": false,
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "chevrotain": "^11.0.3",
    "n3": "^1.26.0"
  },
  "devDependencies": {
    "@types/n3": "^1.26.1",
    "tsup": "^8.3.5",
    "typescript": "^5",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 3: Create the engine tsconfig**

Create `packages/srl-engine/tsconfig.json`:

```jsonc
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "noEmit": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "test"]
}
```

- [ ] **Step 4: Create the tsup build config**

Create `packages/srl-engine/tsup.config.ts`:

```ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ['chevrotain', 'n3'],
});
```

- [ ] **Step 5: Create the Vitest config**

Create `packages/srl-engine/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
```

- [ ] **Step 6: Create a temporary trivial facade**

Create `packages/srl-engine/src/index.ts`:

```ts
export const SRL_ENGINE_VERSION = '0.1.0';
```

- [ ] **Step 7: Install workspaces**

Run: `npm install`
Expected: completes; creates a symlink for `srl-engine` in `node_modules`. Verify with:
Run: `npm ls -w srl-engine --depth=0`
Expected: prints `srl-engine@0.1.0`.

- [ ] **Step 8: Build the engine in isolation**

Run: `npm -w srl-engine run build`
Expected: emits `packages/srl-engine/dist/index.js`, `dist/index.cjs`, `dist/index.d.ts` with no errors.

- [ ] **Step 9: Commit**

```bash
git add package.json packages/srl-engine/
git commit -m "chore: scaffold srl-engine workspace package"
```

---

## Task 2: Move the app into `apps/playground`

Relocate the entire current Next.js app under `apps/playground/` — still self-contained, still importing its own `src/lib/*` — and confirm it builds and lints unchanged. This isolates the "did the move break anything" question from the "did extraction break anything" question.

**Files:**
- Move: `src/` → `apps/playground/src/`
- Move: `next.config.ts`, `next-env.d.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `public/` → `apps/playground/`
- Create: `apps/playground/package.json`
- Modify: `.gitignore`

**Interfaces:**
- Produces: a buildable app at `apps/playground` (workspace name `playground`) that still resolves `@/lib/*` internally.

- [ ] **Step 1: Create the app workspace directory and move the app tree**

```bash
mkdir -p apps/playground
git mv src apps/playground/src
git mv public apps/playground/public
git mv next.config.ts apps/playground/next.config.ts
git mv tsconfig.json apps/playground/tsconfig.json
git mv eslint.config.mjs apps/playground/eslint.config.mjs
git mv postcss.config.mjs apps/playground/postcss.config.mjs
```

(`next-env.d.ts` is gitignored and regenerates; do not move it. `tsconfig.tsbuildinfo` is gitignored; ignore it.)

- [ ] **Step 2: Create the app package manifest**

Create `apps/playground/package.json` (the old root scripts/deps, plus the `srl-engine` dependency; drop `chevrotain`/`n3` from direct deps — they now come via `srl-engine`):

```jsonc
{
  "name": "playground",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint"
  },
  "dependencies": {
    "@monaco-editor/react": "^4.7.0",
    "n3": "^1.26.0",
    "next": "16.2.10",
    "react": "19.2.0",
    "react-dom": "19.2.0",
    "react-resizable-panels": "^3.0.6",
    "shacl-engine": "^1.0.2",
    "srl-engine": "*"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/n3": "^1.26.1",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "babel-plugin-react-compiler": "1.0.0",
    "eslint": "^9",
    "eslint-config-next": "16.2.10",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```

> Note: `n3` is kept as a direct app dep because app components (e.g. `InferredTriplesPanel`) use `n3` `Quad`/term types directly via re-exported engine types; keeping it explicit avoids relying on hoisting. `chevrotain` is removed — only the engine uses it.

- [ ] **Step 3: De-root the `.gitignore` paths**

The root `.gitignore` uses leading-slash paths (`/node_modules`, `/.next/`, `/out/`) that now only match the repo root. Edit `.gitignore` so build artifacts are ignored anywhere. Replace these lines:

```
/node_modules
```
with
```
node_modules/
```

Replace:
```
# next.js
/.next/
/out/
```
with
```
# next.js
.next/
out/
```

Replace:
```
# production
/build
```
with
```
# production
build/
```

Leave `/CLAUDE.md` and `/plans` rooted (they stay at repo root).

- [ ] **Step 4: Reinstall to link the new app workspace**

Run: `npm install`
Expected: completes; `playground` and `srl-engine` both listed as workspaces. Verify:
Run: `npm ls -ws --depth=0`
Expected: shows `playground@0.1.0` and `srl-engine@0.1.0`.

- [ ] **Step 5: Build the app (still using its own `src/lib`)**

Run: `npm -w playground run build`
Expected: Next build completes; static export to `apps/playground/out/`. No TypeScript errors.

- [ ] **Step 6: Lint the app**

Run: `npm -w playground run lint`
Expected: same result as before the move (0 errors; the known pre-existing warnings in `executor.ts`/`expression-evaluator.ts`/`ast.ts` are acceptable — do NOT treat pre-existing warnings as failures).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: move Next.js app into apps/playground workspace"
```

---

## Task 3: Extract the pure engine files + write the real facade

Move the pure logic out of the app into `packages/srl-engine/src/`, then write the curated facade. Verified by the **engine** build + typecheck (the app is intentionally broken until Task 4).

**Files:**
- Move: `apps/playground/src/lib/srl/{tokens,parser,ast}.ts` → `packages/srl-engine/src/srl/`
- Move: `apps/playground/src/lib/rules/{pattern-matcher,expression-evaluator,executor,stratifier}.ts` → `packages/srl-engine/src/rules/`
- Move: `apps/playground/src/lib/validation/validator.ts` → `packages/srl-engine/src/validation/`
- Replace: `packages/srl-engine/src/index.ts` (real facade)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces (public facade — exact names later tasks and the app rely on):
  - values: `buildAST`, `parseSRL`, `getSerializedGrammar`, `getGrammarRuleNames`, `SRLLexer`, `allTokens`, `executeRules`, `expandDeclarations`, `formatTripleForDisplay`, `stratifyRules`, `isStratifiable`, `isRunOnce`, `hasAssignment`, `headHasBlankNode`, `validateSRL`, `quadToString`, `termToString`, `triplePatternToString`, `PatternMatcher`, `getPatternVariables`, `isTriplePattern`, `isVariable`, `isRDFTerm`, `termsEqual`, `n3TermToRDFTerm`, `termToN3`
  - types: `RuleSet`, `Rule`, `RuleHead`, `RuleBody`, `TriplePattern`, `BodyElement`, `FilterElement`, `AssignmentElement`, `NegationElement`, `RDFTerm`, `IRITerm`, `LiteralTerm`, `BlankNodeTerm`, `VariableTerm`, `TransitiveDeclaration`, `SymmetricDeclaration`, `InverseDeclaration`, `Declaration`, `DataBlock`, `PrefixDeclaration`, `BaseDeclaration`, `Expression`, `BinaryOperator`, `UnaryOperator`, `PathExpression`, `PathIRI`, `PathSequence`, `PathInverse`, `SourceLocation`, `ParseResult`, `GrammarRuleInfo`, `ExecutionResult`, `InferredTriple`, `RuleInfo`, `ExecutorOptions`, `StratifiedRule`, `StratificationLayer`, `StratificationCheck`, `ValidationMessage`, `ValidationResult`, `SolutionMapping`, `EvalResult`

- [ ] **Step 1: Move the pure files (git mv)**

```bash
mkdir -p packages/srl-engine/src/srl packages/srl-engine/src/rules packages/srl-engine/src/validation
git mv apps/playground/src/lib/srl/tokens.ts packages/srl-engine/src/srl/tokens.ts
git mv apps/playground/src/lib/srl/parser.ts packages/srl-engine/src/srl/parser.ts
git mv apps/playground/src/lib/srl/ast.ts packages/srl-engine/src/srl/ast.ts
git mv apps/playground/src/lib/rules/pattern-matcher.ts packages/srl-engine/src/rules/pattern-matcher.ts
git mv apps/playground/src/lib/rules/expression-evaluator.ts packages/srl-engine/src/rules/expression-evaluator.ts
git mv apps/playground/src/lib/rules/executor.ts packages/srl-engine/src/rules/executor.ts
git mv apps/playground/src/lib/rules/stratifier.ts packages/srl-engine/src/rules/stratifier.ts
git mv apps/playground/src/lib/validation/validator.ts packages/srl-engine/src/validation/validator.ts
```

The moved files' internal relative imports (`../srl/ast`, `./pattern-matcher`, etc.) are unchanged by the move because the relative tree structure (`srl/`, `rules/`, `validation/`) is preserved. Do NOT edit their import paths.

- [ ] **Step 2: Delete the now-empty engine barrels left in the app**

The old barrel files re-exported the moved modules. `src/lib/srl/index.ts`, `src/lib/rules/index.ts`, and `src/lib/validation/index.ts` will be rebuilt in Task 4 (validation keeps the hook). For now, delete the two fully-moved barrels:

```bash
git rm apps/playground/src/lib/srl/index.ts
git rm apps/playground/src/lib/rules/index.ts
```

(Leave `apps/playground/src/lib/validation/index.ts` — it re-exports the hook too; rebuilt in Task 4.)

- [ ] **Step 3: Write the real facade**

Replace `packages/srl-engine/src/index.ts` with:

```ts
// srl-engine — SHACL 1.2 Rules (SRL) parser, validator, and inference engine.
// Curated public API. Internal helpers (parserInstance, joinSolutions,
// setCurrentStore/Now, ASTBuilder, SRLParser) are intentionally not exported.

// ── Language front end ──────────────────────────────────────────────
export { buildAST } from './srl/ast';
export {
  parseSRL,
  getSerializedGrammar,
  getGrammarRuleNames,
  type ParseResult,
  type GrammarRuleInfo,
} from './srl/parser';
export { SRLLexer, allTokens } from './srl/tokens';
export type {
  SourceLocation,
  RDFTerm,
  IRITerm,
  LiteralTerm,
  BlankNodeTerm,
  VariableTerm,
  TriplePattern,
  FilterElement,
  AssignmentElement,
  NegationElement,
  BodyElement,
  RuleHead,
  RuleBody,
  Rule,
  TransitiveDeclaration,
  SymmetricDeclaration,
  InverseDeclaration,
  Declaration,
  DataBlock,
  PrefixDeclaration,
  BaseDeclaration,
  RuleSet,
  BinaryOperator,
  UnaryOperator,
  PathExpression,
  PathIRI,
  PathSequence,
  PathInverse,
  Expression,
} from './srl/ast';

// ── Engine ──────────────────────────────────────────────────────────
export {
  executeRules,
  expandDeclarations,
  formatTripleForDisplay,
  type ExecutionResult,
  type InferredTriple,
  type RuleInfo,
  type ExecutorOptions,
} from './rules/executor';
export {
  stratifyRules,
  isStratifiable,
  isRunOnce,
  hasAssignment,
  headHasBlankNode,
  type StratifiedRule,
  type StratificationLayer,
  type StratificationCheck,
} from './rules/stratifier';
export {
  PatternMatcher,
  getPatternVariables,
  isTriplePattern,
  isVariable,
  isRDFTerm,
  termsEqual,
  n3TermToRDFTerm,
  termToN3,
  quadToString,
  termToString,
  triplePatternToString,
  type SolutionMapping,
} from './rules/pattern-matcher';
export type { EvalResult } from './rules/expression-evaluator';

// ── Validation ──────────────────────────────────────────────────────
export {
  validateSRL,
  type ValidationMessage,
  type ValidationResult,
} from './validation/validator';
```

- [ ] **Step 4: Typecheck the engine**

Run: `npm -w srl-engine run typecheck`
Expected: no errors. (If an export name in the facade doesn't exist, `tsc` fails here — cross-check against the `Produces` list.)

- [ ] **Step 5: Build the engine**

Run: `npm -w srl-engine run build`
Expected: emits `dist/index.js`, `dist/index.cjs`, `dist/index.d.ts`. Confirm the `.d.ts` contains the exported type names (e.g. `RuleSet`, `ExecutionResult`).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(srl-engine): extract pure engine modules + curated facade"
```

---

## Task 4: Rewire the app to consume `srl-engine`

Repoint every app import that used to reach the moved files at `srl-engine`, rebuild the validation barrel around the surviving hook, add `transpilePackages`, and confirm the app builds + lints green again.

**Files:**
- Modify: `apps/playground/src/lib/validation/useValidation.ts`
- Modify: `apps/playground/src/lib/rules/useRuleExecution.ts`
- Create: `apps/playground/src/lib/validation/index.ts` (rebuild)
- Modify: `apps/playground/src/components/InferredTriplesPanel.tsx`
- Modify: `apps/playground/src/components/SyntaxBreakdown.tsx`
- Modify: `apps/playground/src/components/SyntaxDiagramPanel.tsx`
- Modify: `apps/playground/src/components/Playground.tsx`
- Modify: `apps/playground/next.config.ts`

**Interfaces:**
- Consumes: the Task 3 facade (`srl-engine`).

- [ ] **Step 1: Rewire `useValidation.ts`**

In `apps/playground/src/lib/validation/useValidation.ts`, change line 2 from:

```ts
import { validateSRL, ValidationResult } from './validator';
```
to:
```ts
import { validateSRL, type ValidationResult } from 'srl-engine';
```

- [ ] **Step 2: Rewire `useRuleExecution.ts`**

In `apps/playground/src/lib/rules/useRuleExecution.ts`, change lines 4–5 from:

```ts
import { buildAST, RuleSet } from '../srl/ast';
import { executeRules, ExecutionResult } from '../rules/executor';
```
to:
```ts
import { buildAST, executeRules, type RuleSet, type ExecutionResult } from 'srl-engine';
```

- [ ] **Step 3: Rebuild the validation barrel**

Overwrite `apps/playground/src/lib/validation/index.ts` with:

```ts
export type { ValidationMessage, ValidationResult } from 'srl-engine';
export { useValidation } from './useValidation';
```

- [ ] **Step 4: Rewire the components**

`InferredTriplesPanel.tsx` line 4 — from:
```ts
import { InferredTriple, RuleInfo, ExecutionResult, formatTripleForDisplay } from '@/lib/rules/executor';
```
to:
```ts
import { formatTripleForDisplay, type InferredTriple, type RuleInfo, type ExecutionResult } from 'srl-engine';
```

`SyntaxBreakdown.tsx` line 4 — from:
```ts
import { parseSRL, ParseResult } from '@/lib/srl/parser';
```
to:
```ts
import { parseSRL, type ParseResult } from 'srl-engine';
```

`SyntaxDiagramPanel.tsx` line 5 — from:
```ts
import { getSerializedGrammar, getGrammarRuleNames, GrammarRuleInfo } from '@/lib/srl/parser';
```
to:
```ts
import { getSerializedGrammar, getGrammarRuleNames, type GrammarRuleInfo } from 'srl-engine';
```

`Playground.tsx` line 16 — from:
```ts
import { RuleInfo, InferredTriple } from '@/lib/rules/executor';
```
to:
```ts
import { type RuleInfo, type InferredTriple } from 'srl-engine';
```

(Leave `Playground.tsx` lines 8–10 unchanged: `Example` from `@/lib/examples`, `useValidation` from `@/lib/validation`, `useRuleExecution` from `@/lib/rules/useRuleExecution` all stay app-local. Leave `SRLEditor.tsx` line 7 `ValidationMessage from '@/lib/validation'` and `ValidationPanel.tsx` line 3 `ValidationResult from '@/lib/validation'` unchanged — the rebuilt barrel re-exports those from `srl-engine`.)

- [ ] **Step 5: Add `transpilePackages` to the Next config**

In `apps/playground/next.config.ts`, add `transpilePackages: ['srl-engine']` to the config object:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: "export",
  transpilePackages: ["srl-engine"],
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
```

- [ ] **Step 6: Confirm no dangling `@/lib` engine imports remain**

Run: `npm -w srl-engine run build` (ensure `dist` exists so a production `next build` can resolve the package via `exports`).
Then search for leftover deep imports of moved modules:
Run (Grep tool or): `grep -rnE "@/lib/(srl|rules/(executor|pattern-matcher|expression-evaluator|stratifier))|from './validator'" apps/playground/src`
Expected: no matches.

- [ ] **Step 7: Build the app**

Run: `npm -w playground run build`
Expected: Next build completes, no TS errors. (Dev mode reads engine `src` via `transpilePackages`; production `next build` resolves the built `dist` through the package `exports` map — either way this must pass.)

- [ ] **Step 8: Lint the app**

Run: `npm -w playground run lint`
Expected: 0 errors (pre-existing warnings acceptable).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor(playground): consume srl-engine instead of local lib"
```

---

## Task 5: Facade smoke tests

Prove the published API works when imported as a package: every public export is defined, and a rule round-trips parse → validate → execute.

**Files:**
- Create: `packages/srl-engine/test/smoke.test.ts`

**Interfaces:**
- Consumes: the `srl-engine` facade (imported by relative path `../src/index` so tests run against source).

- [ ] **Step 1: Write the smoke test**

Create `packages/srl-engine/test/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  buildAST,
  parseSRL,
  validateSRL,
  executeRules,
  stratifyRules,
  SRLLexer,
  formatTripleForDisplay,
} from '../src/index';

const RULES = `PREFIX : <http://example/>

RULE { :x :q ?o } WHERE { :s :p ?o }`;

const DATA = `PREFIX : <http://example/>

:s :p :o .`;

describe('srl-engine facade', () => {
  it('exports the core entry points as callables', () => {
    for (const fn of [buildAST, parseSRL, validateSRL, executeRules, stratifyRules, formatTripleForDisplay]) {
      expect(typeof fn).toBe('function');
    }
    expect(SRLLexer).toBeDefined();
  });

  it('parses a well-formed ruleset without errors', () => {
    const parsed = parseSRL(RULES);
    expect(parsed.errors).toHaveLength(0);
  });

  it('validates a well-formed ruleset as valid', () => {
    const result = validateSRL(RULES);
    expect(result.isValid).toBe(true);
  });

  it('builds an AST with one rule', () => {
    const ast = buildAST(RULES);
    expect(ast.rules).toHaveLength(1);
  });

  it('executes and infers the expected triple', () => {
    const ast = buildAST(RULES);
    const result = executeRules(ast, DATA);
    const inferred = result.inferredTriples.map(t => t.quadString);
    // :x :q :o
    expect(inferred.some(s => s.includes('/q') && s.endsWith('<http://example/o>'))).toBe(true);
  });

  it('flags an unbound head variable as invalid', () => {
    const bad = `PREFIX : <http://example/>

RULE { :x :q ?missing } WHERE { :s :p ?o }`;
    const result = validateSRL(bad);
    expect(result.isValid).toBe(false);
  });
});
```

- [ ] **Step 2: Run the smoke test — expect PASS**

Run: `npm -w srl-engine test`
Expected: all smoke tests pass. (If the inferred-triple assertion is too loose/tight, adjust the matcher to the actual `quadToString` format — inspect one `result.inferredTriples[0].quadString` and match its shape; do NOT weaken it to `expect(true)`.)

- [ ] **Step 3: Commit**

```bash
git add packages/srl-engine/test/smoke.test.ts
git commit -m "test(srl-engine): add facade smoke tests"
```

---

## Task 6: W3C fixture regression suite

Vendor the W3C `data-shapes` rules fixtures and run them manifest-driven, asserting each entry's pass/fail matches its declared Positive/Negative type. Since the extraction is a pure move, results must match the prior manual verification (≈87 pass); genuine mismatches on non-deferred fixtures indicate a regression and must be investigated, not skipped.

**Files:**
- Create: `packages/srl-engine/test/fixtures/rules/{syntax,wellformed,stratification,eval}/**` (copied from py-srl)
- Create: `packages/srl-engine/test/fixtures.test.ts`

**Interfaces:**
- Consumes: `validateSRL`, `buildAST`, `executeRules` from the facade; `n3` `Parser`/`Store` for reading manifests, data, and results.

- [ ] **Step 1: Vendor the fixture tree**

Copy the four fixture subdirectories (with their `manifest.ttl`) from the py-srl checkout into the package. From the repo root:

```bash
SRC="F:/Projects/shacl/py-srl/tests/shacl12-test-suite/tests/rules"
DEST="packages/srl-engine/test/fixtures/rules"
mkdir -p "$DEST"
cp -r "$SRC/syntax" "$DEST/syntax"
cp -r "$SRC/wellformed" "$DEST/wellformed"
cp -r "$SRC/stratification" "$DEST/stratification"
cp -r "$SRC/eval" "$DEST/eval"
```

Add a provenance note file `packages/srl-engine/test/fixtures/SOURCE.md`:

```markdown
# Vendored fixtures

Copied from the W3C `w3c/data-shapes` SHACL 1.2 Rules test suite
(via py-srl `tests/shacl12-test-suite/tests/rules/`) on 2026-07-15.
Upstream: https://github.com/w3c/data-shapes
License: W3C test-suite license (see upstream). Do not edit; re-vendor to update.
```

- [ ] **Step 2: Write the manifest-driven runner**

Create `packages/srl-engine/test/fixtures.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Parser, Store, type Quad } from 'n3';
import { validateSRL, buildAST, executeRules } from '../src/index';

const HERE = dirname(fileURLToPath(import.meta.url));
const RULES_DIR = join(HERE, 'fixtures', 'rules');

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const SRT = 'http://www.w3.org/ns/shacl-rules-test#';
const MF = 'http://www.w3.org/2001/sw/DataAccess/tests/test-manifest#';

// Known-divergent fixtures: constructs deferred from this engine (RDF-1.2 rich
// terms — reification/`<< >>`/collections) or accepted-by-Turtle-leniency
// negative cases. Keyed by "<subdir>/<srl-filename>" with a reason. These are
// reported as `it.skip`, NOT failures. Built empirically in Step 4.
const KNOWN_DIVERGENT: Record<string, string> = {
  // filled in Step 4, e.g.:
  // 'syntax/syntax-reification-01.srl': 'RDF-1.2 reification — deferred',
};

interface SyntaxEntry {
  kind: 'syntax' | 'wellformed' | 'stratification';
  file: string;          // absolute path to .srl
  rel: string;           // "<subdir>/<filename>"
  positive: boolean;     // true = must be accepted, false = must be rejected
}

interface EvalEntry {
  kind: 'eval';
  name: string;
  ruleset: string;       // absolute path
  data: string;          // absolute path
  result: string;        // absolute path
}

function parseTtl(text: string): Quad[] {
  return new Parser().parse(text);
}

function objVal(quads: Quad[], subj: string, pred: string): string | undefined {
  return quads.find(q => q.subject.value === subj && q.predicate.value === pred)?.object.value;
}

// Read a syntax/wellformed/stratification manifest → entries.
function readSyntaxManifest(subdir: string, kind: SyntaxEntry['kind']): SyntaxEntry[] {
  const dir = join(RULES_DIR, subdir);
  const quads = parseTtl(readFileSync(join(dir, 'manifest.ttl'), 'utf8'));
  const entries: SyntaxEntry[] = [];
  for (const q of quads) {
    if (q.predicate.value !== RDF_TYPE || !q.object.value.startsWith(SRT)) continue;
    const type = q.object.value.slice(SRT.length);
    if (!type.includes('Syntax') && !type.includes('WellFormedness') && !type.includes('Stratification')) continue;
    const action = objVal(quads, q.subject.value, MF + 'action');
    if (!action) continue;
    const filename = action.split('/').pop()!;
    entries.push({
      kind,
      file: join(dir, filename),
      rel: `${subdir}/${filename}`,
      positive: type.startsWith('RulesPositive'),
    });
  }
  return entries;
}

// Read the eval manifest → entries (nested blank node holds ruleset/data).
function readEvalManifest(): EvalEntry[] {
  const dir = join(RULES_DIR, 'eval');
  const quads = parseTtl(readFileSync(join(dir, 'manifest.ttl'), 'utf8'));
  const entries: EvalEntry[] = [];
  for (const q of quads) {
    if (q.predicate.value !== RDF_TYPE || q.object.value !== SRT + 'RulesEvalTest') continue;
    const subj = q.subject.value;
    const actionNode = quads.find(a => a.subject.value === subj && a.predicate.value === MF + 'action')?.object.value;
    const resultRel = objVal(quads, subj, MF + 'result');
    if (!actionNode || !resultRel) continue;
    const ruleset = objVal(quads, actionNode, SRT + 'ruleset');
    const data = objVal(quads, actionNode, SRT + 'data');
    if (!ruleset || !data) continue;
    entries.push({
      kind: 'eval',
      name: subj.split(/[#/]/).pop() || subj,
      ruleset: join(dir, ruleset.split('/').pop()!),
      data: join(dir, data.split('/').pop()!),
      result: join(dir, resultRel.split('/').pop()!),
    });
  }
  return entries;
}

function quadKey(q: Quad): string {
  return `${q.subject.value}|${q.predicate.value}|${q.object.value}|${(q.object as { datatypeString?: string }).datatypeString ?? ''}`;
}

const syntaxEntries = [
  ...readSyntaxManifest('syntax', 'syntax'),
  ...readSyntaxManifest('wellformed', 'wellformed'),
  ...readSyntaxManifest('stratification', 'stratification'),
];

describe('W3C rules syntax / wellformed / stratification fixtures', () => {
  for (const e of syntaxEntries) {
    const reason = KNOWN_DIVERGENT[e.rel];
    const run = reason ? it.skip : it;
    run(`${e.rel} (${e.positive ? 'positive' : 'negative'})`, () => {
      const src = readFileSync(e.file, 'utf8');
      const result = validateSRL(src);
      // Positive → must validate clean; Negative → must produce an error.
      expect(result.isValid).toBe(e.positive);
    });
  }
});

describe('W3C rules evaluation fixtures', () => {
  for (const e of readEvalManifest()) {
    const reason = KNOWN_DIVERGENT[`eval/${e.name}`];
    const run = reason ? it.skip : it;
    run(e.name, () => {
      const rules = readFileSync(e.ruleset, 'utf8');
      const data = readFileSync(e.data, 'utf8');
      const expected = new Store(parseTtl(readFileSync(e.result, 'utf8')));
      const base = new Store(parseTtl(data));

      const ast = buildAST(rules);
      const exec = executeRules(ast, data);

      // Expected inferred = results graph minus the base data graph.
      const baseKeys = new Set(base.getQuads(null, null, null, null).map(quadKey));
      const expectedInferred = expected
        .getQuads(null, null, null, null)
        .filter(q => !baseKeys.has(quadKey(q)))
        .map(quadKey)
        .sort();
      const actualInferred = exec.inferredTriples
        .map(t => t.quad)
        .filter(q => !baseKeys.has(quadKey(q)))
        .map(quadKey)
        .sort();

      expect(actualInferred).toEqual(expectedInferred);
    });
  }
});
```

- [ ] **Step 3: Run the suite — observe results**

Run: `npm -w srl-engine test`
Expected: the smoke suite passes; the fixture suite reports a mix of pass/fail. Record which fixtures FAIL.

- [ ] **Step 4: Triage failures and populate `KNOWN_DIVERGENT`**

For each FAILING fixture, classify it:

- **Deferred construct** (the `.srl` uses RDF-1.2 reification `<< >>`/`<<( )>>`, collections `( )`/`[ ]`, annotation `{| |}`, or an extended path `*`/`+`/`?`/`|`; or a negative case the lenient Turtle tokenizer accepts): add an entry to `KNOWN_DIVERGENT` keyed by `"<subdir>/<filename>"` (or `"eval/<name>"`) with a one-line reason. Inspect the file contents to confirm the construct before adding.
- **Genuine regression** (a fixture that the engine handled before this extraction now behaves differently): STOP. The extraction was supposed to be behavior-preserving. Diff the moved file against git history (`git log --oneline -- <path>`) and fix the move, do NOT paper over it with a skip.

The expected steady state matches prior manual verification: roughly **87 syntax/wellformed/stratification fixtures passing**, the RDF-1.2 group skipped, and **all eval fixtures passing**. After populating the skip-list, re-run:

Run: `npm -w srl-engine test`
Expected: 0 failures; skipped = the `KNOWN_DIVERGENT` entries.

- [ ] **Step 5: Typecheck the test (catch n3 type drift)**

Run: `npm -w srl-engine run typecheck`
Expected: no errors. (If the `datatypeString` cast on `object` mismatches the installed `@types/n3`, simplify `quadKey` to drop the datatype segment rather than fighting the types — literal value + predicate + subject is sufficient discrimination for these ground fixtures.)

- [ ] **Step 6: Commit**

```bash
git add packages/srl-engine/test/
git commit -m "test(srl-engine): add W3C data-shapes rules fixture suite"
```

---

## Task 7: Docs — engine README, RELEASING guide, CLAUDE.md, app README

Document the package for consumers and write the manual guide for every out-of-scope operation.

**Files:**
- Create: `packages/srl-engine/README.md`
- Create: `RELEASING.md` (repo root)
- Modify: `CLAUDE.md` (repo root)
- Modify: `apps/playground/README.md` (the moved `README.md` — add a monorepo pointer)

**Interfaces:** none (docs only).

- [ ] **Step 1: Write the engine README**

Create `packages/srl-engine/README.md`:

```markdown
# srl-engine

Parser, validator, and inference engine for **SHACL 1.2 Rules** written in
**SRL (Shape Rules Language)**. Pure TypeScript; depends only on
[`chevrotain`](https://chevrotain.io) (lexer/parser) and
[`n3`](https://github.com/rdfjs/N3.js) (RDF store). No DOM, no framework.

## Install

```bash
npm install srl-engine
```

## Usage

```ts
import { buildAST, validateSRL, executeRules } from 'srl-engine';

const srl = `PREFIX : <http://example/>
RULE { :x :q ?o } WHERE { :s :p ?o }`;

const data = `PREFIX : <http://example/>
:s :p :o .`;

// 1. Validate (lexer/parser errors + §4.2 well-formedness + stratification)
const report = validateSRL(srl);
if (!report.isValid) throw new Error(report.messages[0].message);

// 2. Build the typed RuleSet AST
const ruleSet = buildAST(srl);

// 3. Run the rules against RDF data → inferred triples with provenance
const result = executeRules(ruleSet, data);
for (const t of result.inferredTriples) {
  console.log(t.quadString, '←', t.sourceRule.name);
}
```

## API

| Export | Purpose |
|--------|---------|
| `parseSRL(text)` | Lex + CST parse; returns `{ tokens, cst, errors }`. |
| `buildAST(text)` | Parse and walk the CST into a typed `RuleSet`. |
| `validateSRL(text)` | Full diagnostics: lexer/parser, well-formedness (§4.2), stratification. |
| `executeRules(ruleSet, rdfData, options?)` | Fixed-point inference; returns inferred triples + provenance. |
| `stratifyRules(rules)` / `isStratifiable(rules)` | Open/closed dependency stratification. |
| `expandDeclarations(decls, prefixes)` | Rewrite `TRANSITIVE`/`SYMMETRIC`/`INVERSE` into rules. |
| `formatTripleForDisplay(quad, prefixes)` | Prefix-collapsed S/P/O strings for UIs. |

All AST, result, and validation types are exported. See `src/index.ts` for the
complete surface.

## Scope

Implements the current W3C SHACL 1.2 Rules surface syntax and semantics.
**Deferred:** RDF-1.2 rich terms (reification `<< >>`/`<<( )>>`, collections
`( )`/`[ ]`, annotations `{| |}`) and extended property paths (`*`/`+`/`?`/`|`,
negated property sets). Built-ins are restricted to the spec `[121]` set.

## Development

```bash
npm -w srl-engine run build       # tsup → dist/ (ESM + CJS + .d.ts)
npm -w srl-engine test            # vitest (facade smoke + W3C fixtures)
npm -w srl-engine run typecheck   # tsc --noEmit
```

Releasing to npm: see [`../../RELEASING.md`](../../RELEASING.md).
```

- [ ] **Step 2: Write the RELEASING guide (out-of-scope manual steps)**

Create `RELEASING.md` at the repo root:

```markdown
# Releasing & operational guide (`srl-engine`)

Manual, deliberately-not-automated steps. The package is publish-*ready*
(build config + `files` field are in place); everything below is a conscious
manual action.

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
```

- [ ] **Step 3: Update the root CLAUDE.md layout note**

In `CLAUDE.md`, under the "What this is" section, add a monorepo note. Insert after the first paragraph of "## What this is":

```markdown
### Monorepo layout

This is an npm-workspaces monorepo:

- `packages/srl-engine/` — the standalone, publishable engine (lexer/parser, AST,
  execution, validation, stratification). Pure TS; depends only on `chevrotain` +
  `n3`. Public API via `packages/srl-engine/src/index.ts`; tests (Vitest + vendored
  W3C fixtures) in `packages/srl-engine/test/`.
- `apps/playground/` — the Next.js playground UI. Imports the engine from
  `srl-engine` (not `@/lib/*`). Holds the Monaco glue, React hooks, and examples.

Commands run per workspace: `npm -w srl-engine <script>` / `npm -w playground <script>`.
The paths in the sections below (`src/lib/...`) now live under
`packages/srl-engine/src/` (engine modules) or `apps/playground/src/` (UI). The
`overrides` block lives in the ROOT package.json (npm applies it workspace-wide).
Release steps: see `RELEASING.md`.
```

- [ ] **Step 4: Add a pointer to the app README**

At the top of `apps/playground/README.md` (the moved `README.md`), insert:

```markdown
> **Monorepo note:** this is the playground app. The SRL parser/validator/engine
> lives in the sibling package [`srl-engine`](../../packages/srl-engine/) and is
> imported as `srl-engine`. See the repo-root `RELEASING.md` for publishing.

```

- [ ] **Step 5: Verify docs don't break the build (no code change) and commit**

Run: `npm -w srl-engine test && npm -w playground run build`
Expected: both green (sanity check nothing regressed).

```bash
git add -A
git commit -m "docs: engine README, RELEASING guide, monorepo notes"
```

---

## Self-Review

**Spec coverage:**
- Monorepo workspaces layout → Task 1, 2. ✓
- Package `srl-engine`, tsup dual build, `exports` map → Task 1. ✓
- Curated facade exporting everything the app imports → Task 3 (Interfaces list cross-checked against the grep of app imports). ✓
- chevrotain v11 pin + root `overrides` retained → Global Constraints, Task 1 Step 1. ✓
- Pure files move; hooks/monaco/examples stay in app → Task 3 (moves), Task 4 (hooks rewired, not moved). ✓
- `transpilePackages` → Task 4 Step 5. ✓
- Vitest + vendored W3C fixtures, deferred `.skip`-listed → Task 5 (smoke), Task 6 (fixtures + `KNOWN_DIVERGENT`). ✓
- Out-of-scope items documented in RELEASING.md → Task 7 Step 2. ✓
- Docs (CLAUDE.md, engine README, app README) → Task 7. ✓

**Placeholder scan:** `KNOWN_DIVERGENT` is intentionally empty-at-first with an explicit empirical population step (Task 6 Step 4) and a triage rule — not a vague TODO. No "implement later"/"add error handling" placeholders. All code steps show real code.

**Type consistency:** Facade export names in Task 3 match the grep'd source exports (`getPatternVariables`, `isTriplePattern`, `stratifyRules`, `isStratifiable`, `formatTripleForDisplay`, `ParseResult`, `GrammarRuleInfo`, `ExecutionResult`, `InferredTriple`, `RuleInfo`, `ValidationMessage`, `ValidationResult`). App-side import rewrites in Task 4 pull only names present in the facade. Test imports in Tasks 5–6 (`buildAST`, `parseSRL`, `validateSRL`, `executeRules`, `stratifyRules`, `SRLLexer`, `formatTripleForDisplay`) are all in the facade.

**Sequencing:** engine green after Tasks 1/3/5/6; app green after Tasks 2/4. The only intentionally-broken span is between Task 3 (files moved out) and Task 4 (app rewired) — its gate is the *engine* build, and Task 4's gate restores the app.
