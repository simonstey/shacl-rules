# Backlog — open items for a future session

Consolidated list of known bugs, deferred features, packaging follow-ups, and
tech debt across the `srl-engine` extraction and the SRL-alignment work. Each
item states **what**, **where**, **why it's deferred**, and **how to address
it**, so a future session can pick any one up cold.

Status legend: 🐞 bug/defect · 🚧 deferred feature · 📦 packaging/release ·
🧹 tech debt · ✅ resolved.

> **Resolved sweep (2026-07-16, branch `chore/srl-engine-cleanups`):** B1, B2,
> B3, E1 (double-dot part), T1, T3, T4, P1, P2, P3, and P4 (CI) are all fixed —
> see the ✅ markers below. What remains open: the RDF-1.2 language features
> (F1–F6), the `bad-04` undeclared-prefix negative (deliberate UX choice), and
> the Changesets/UMD release opt-ins (P4 remainder).

---

## 🐞 Bugs & behavioral defects

### B1 — `ExecutorOptions.includeBaseTriples` is inert ✅ RESOLVED
- **Fixed:** removed the dead option from `ExecutorOptions` + `DEFAULT_OPTIONS`
  (option b). No consumer set it; callers concatenate `baseTriples` +
  `inferredTriples` (documented recipe in `docs/GUIDE.md`). Regression test in
  `test/smoke.test.ts` asserts base triples stay out of `inferredTriples`.

### B2 — `NOT`-body requires a `.` before an inline `FILTER` ✅ RESOLVED
- **Fixed:** `bodyBasicSeq` now mirrors `bodyPattern1`'s optional-dot handling
  (disjoint-first-set `MANY`/`OR`), so `NOT { ?x ?y ?o FILTER(...) }` parses.
  W3C fixture `syntax-rule-elements-filter-03` de-skipped and passing.

### B3 — `validateSRL` bundled the stratification check into `isValid` ✅ RESOLVED
- **Fixed:** split the verdict. `ValidationResult.isWellFormed` reports §4.2
  conformance **ignoring** stratification; stratification errors carry
  `category: 'stratification'`. `isValid` stays the all-errors run-gate the
  playground uses. Fixtures test reads `isWellFormed` for wellformed-kind
  entries. `wellformed-03`/`wellformed-04` de-skipped and passing.

---

## 🚧 Deferred language features (RDF-1.2 & extended paths)

**Status: still deferred — these are 6 distinct feature projects, not bugs.**
63 W3C syntax fixtures are `.skip`-listed (`test/fixtures.test.ts` →
`KNOWN_DIVERGENT`). Each family needs the full syntax stack (`tokens.ts` →
`parser.ts` → `ast.ts` → `executor.ts`/evaluator → `validator.ts` →
`monaco/srl-language.ts`) **and** engine semantics. F1–F3 additionally require
RDF-star / quoted-triple term support that the engine's term model
(`RDFTerm` = iri/literal/blankNode/variable) and pinned `n3@^1.26` do not
provide — a store-layer prerequisite. Each warrants its own
brainstorm→plan→implement cycle.

| Feature | Construct | ~Fixtures |
| --- | --- | --- |
| **F1** | RDF-1.2 reified triples `<< … >>` + reifier `~` | reification-01..08, data-16..19, template-13..15, pattern-13..15 |
| **F2** | RDF-1.2 triple terms `<<( … )>>` | rule-terms-13, data-20, template-16, pattern-16 |
| **F3** | RDF-1.2 annotation blocks `{| … |}` | reification-04/06/07, data-11..14, template-08..12, pattern-08..12 |
| **F4** | RDF collections `( … )` | template-17..23, pattern-17..23 |
| **F5** | Blank-node syntax `[]` / property lists `[ … ]` | rule-terms-08, rule-elements-not-03, stratification-05, template-24..27, pattern-24..27 |
| **F6** | Extended property paths `*` `+` `?` `|` and negated sets `!` | (no isolated fixtures; README "Not Yet Implemented") |

> Prerequisite for F1–F3: RDF-star support in the store + term layer (quoted
> triples as first-class terms). This is the gating dependency, larger than the
> syntax work itself.

---

## 🚧 Extension: `FOR ?v IN <shape>` shape-targeting clause ✅ X1–X6 DONE

X1–X6 implemented + merged (see design/plan under `docs/superpowers/`). The
in-house SHACL Core subset lives in `packages/srl-engine/src/shapes/`. Two
follow-on correctness fixes and one recursion enhancement landed during the
post-merge review sweep:
- value-node set semantics (dedup for cardinality over converging paths),
- temporal (`xsd:date`/`dateTime`) value-range comparison,
- validator stratification of targeted rules (T4, below),
- recursive nested property paths (T3, below).

**X7 — RDF/SRL surface + Monaco** — still deferred (out of engine scope):
- **RDF surface:** `srl:targetShape` + `srl:focusVar` (rule→shape) / `sh:rule`
  (shape→rule). srl-engine has no RDF-SRL parser; text-SRL `FOR` is the shipped
  surface.
- **Monaco:** `FOR`/`IN` highlighting/hover/completion **now shipped in the
  playground** (`apps/playground/src/lib/monaco/srl-language.ts`) alongside the
  runnable FOR examples + Data/Shapes editor tabs. The remaining X7 item is only
  the RDF-SRL surface.

---

## 🧹 Tech debt (surfaced during FOR feature implementation)

### T3 — `inversePath` did not recurse into nested paths ✅ RESOLVED
- **Fixed:** `valueNodesViaPath` + a new `inverseValueNodesViaPath` are mutually
  recursive, so `inversePath(inversePath(…))` folds to forward, and
  `inversePath(sequence(…))` reverses + inverts each step — matching py-srl's
  bidirectional `evaluate_path`. Regression tests in `test/shapes.test.ts`.

### T4 — `validateSRL` did not check stratification of targeted rules ✅ RESOLVED
- **Fixed:** `isStratifiable` takes optional `targetedRules` + `shapesStore`;
  `validateSRL` resolves the shapes graph and threads it + `ruleSet.targetedRules`
  through `checkAstSemantics`. A cyclic shape-gate is now caught at validation,
  not only at execution. Regression test in `test/shape-targeting.test.ts`.

---

## 🐞 Pre-existing edge cases (Turtle-leniency negatives)

### E1 — Lenient lexer accepted some malformed negatives ✅ PARTIAL
- **Fixed (double-dot):** `syntax-data-bad-09/10/11` each end in `. .` (an empty
  statement). A token-level check now rejects two consecutive `.` separators
  (a bare `Dot` is only ever a separator, so adjacency is unambiguously invalid
  — no false-negative risk). All three de-skipped and passing.
- **Not fixed (deliberate) — `syntax-rule-bad-04`:** uses prefix `:` with no
  `PREFIX` line. An undeclared prefix is intentionally a **warning**, not an
  error, so the playground doesn't flag prefixes typed before their `PREFIX`
  line. Promoting to an error would reject this negative but degrade mid-edit
  UX; no positive fixture relies on the leniency. Kept skipped, documented in
  `KNOWN_DIVERGENT`.

---

## 🐞 Pre-existing engine bug (uncovered during code review) ✅ RESOLVED

### Arithmetic operator precedence + unary `+`/`-` in `ast.ts`
- **Fixed:** the expression builder paired binary operators with operands by
  "is any token of this type before the operand," so `a + b - c` folded as
  `(a+b)+c` (`10 + 5 - 3` → 18) and unary `+`/`-` guards (`!primaryNode`, never
  true) dropped the sign. Operators are now ordered by source offset and paired
  positionally; unary prefix tokens select the operator directly. 8 regression
  tests in `test/arithmetic.test.ts`. (Pre-existing, unrelated to FOR.)

---

## 📦 Packaging & release follow-ups

### P1 — Per-condition CJS types in `exports` map ✅ RESOLVED
- **Fixed:** `exports["."]` now uses `import`/`require` conditions each with its
  own `types` (`dist/index.d.ts` for ESM, `dist/index.d.cts` for CJS), so a
  `require()` consumer under `node16`/`nodenext` resolves the CJS declarations.

### P2 — `prepublishOnly` gate ✅ RESOLVED
- **Fixed:** `"prepublishOnly": "npm run typecheck && npm run lint && npm run test && npm run build"`
  — a publish can never ship a stale, lint-dirty, or broken build.

### P3 — Engine `lint` script ✅ RESOLVED
- **Fixed:** added a minimal flat ESLint config (`eslint.config.mjs`,
  `@eslint/js` + `typescript-eslint`, both hoisted at root) + a `lint` script
  linting `src/`. Wired into `prepublishOnly` and CI.

### P4 — CI, Changesets, UMD bundle
- **CI ✅ RESOLVED:** `.github/workflows/ci.yml` runs engine
  typecheck/lint/test/build + playground build/lint on PR + push to main
  (mirrors `deploy.yml`'s lockfile-removal install workaround for the
  cross-platform rollup native dep).
- **Changesets (§3) 🚧 / UMD IIFE bundle (§4) 🚧 — still deferred:** opt-in
  release infra, not needed until the first npm publish. Follow `RELEASING.md`
  §3/§4 when the need arises.

---

## 🧹 Tech debt

### T1 — Unused imports / `prefer-const` in engine source ✅ RESOLVED
- **Fixed (via P3 lint):** dropped unused imports (`NamedNode` in
  `expression-evaluator.ts`, `TargetedRule` in `validator.ts`), renamed the
  unused `expandDeclarations` `prefixes` param to `_prefixes`, removed a useless
  regex escape. `npm -w srl-engine run lint` is clean (0 errors).

### T2 — `KNOWN_DIVERGENT` skip-list is the deferred-feature source of truth ✅ IN SYNC
- **Kept in sync this sweep:** de-skipped `syntax-rule-elements-filter-03` (B2),
  `wellformed-03`/`04` (B3), and `syntax-data-bad-09/10/11` (E1) — 6 total. The
  remaining 63 skips are the F1–F6 RDF-1.2 features + `bad-04` (deliberate). A
  shrinking skip-list remains the progress metric.

---

## Where these are also referenced

- **How-To Guide** `packages/srl-engine/docs/GUIDE.md` — B1/B2/B3, F1–F6 from
  the consumer's perspective.
- **Publishing guide** `packages/srl-engine/PUBLISHING.md` — P1, P2.
- **RELEASING.md** (repo root) — P1, P4 (CI done; Changesets/UMD open).
- **Test skip-list** `packages/srl-engine/test/fixtures.test.ts`
  (`KNOWN_DIVERGENT`) — F1–F6 + `bad-04` with per-fixture reasons.
- **`FOR ?v IN <shape>` spec + reference impl** `../py-srl/docs/for-in-shape-clause.md`
  — X1–X7.
