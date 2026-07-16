# Backlog — open items for a future session

Consolidated list of known bugs, deferred features, packaging follow-ups, and
tech debt across the `srl-engine` extraction and the SRL-alignment work. Each
item states **what**, **where**, **why it's deferred**, and **how to address
it**, so a future session can pick any one up cold.

Status legend: 🐞 bug/defect · 🚧 deferred feature · 📦 packaging/release ·
🧹 tech debt.

---

## 🐞 Bugs & behavioral defects

### B1 — `ExecutorOptions.includeBaseTriples` is inert
- **Where:** `packages/srl-engine/src/rules/executor.ts` — declared in the
  `ExecutorOptions` interface (line ~50) and in `DEFAULT_OPTIONS` (line ~55),
  but the value is never read anywhere in `executeRules`.
- **Effect:** Setting `includeBaseTriples: true` does nothing — `inferredTriples`
  always excludes base graph triples. Misleading to consumers who set it.
- **Fix options:** (a) implement it — when `true`, include the `G0` base triples
  in `inferredTriples` (or add a separate `outputTriples` accessor); or
  (b) remove the dead option from the interface + defaults and document that
  callers concatenate `baseTriples` + `inferredTriples` themselves (the current
  documented recipe in `docs/GUIDE.md` §12). Prefer (b) unless a consumer needs
  it — smaller API surface. Whichever: add a test in
  `packages/srl-engine/test/`.

### B2 — `NOT`-body requires a `.` before an inline `FILTER`
- **Where:** parser grammar for the restricted `NOT { … }` body
  (`packages/srl-engine/src/srl/parser.ts` — the negation/`bodyBasic`
  production).
- **Effect:** `NOT { ?x ?y ?o FILTER(isURI(?s)) }` fails to parse
  ("Expecting token RBrace but found FILTER"); it only parses with a separating
  dot: `NOT { ?x ?y ?o . FILTER(isURI(?s)) }`. The top-level body already makes
  the dot optional after a pattern; the `NOT` body is stricter than the spec
  grammar.
- **Evidence:** W3C fixture `syntax-rule-elements-filter-03.srl` is `.skip`-listed
  in `packages/srl-engine/test/fixtures.test.ts` (`KNOWN_DIVERGENT`) for exactly
  this reason.
- **Fix:** mirror the optional-dot handling from the main body production into
  the `NOT`-body production, then remove that fixture from `KNOWN_DIVERGENT` and
  confirm it passes.

### B3 — `validateSRL` bundles the stratification check into `isValid`
- **Where:** `packages/srl-engine/src/validation/validator.ts` —
  `checkAstSemantics` runs both §4.2 well-formedness AND the stratification
  check, folding both into the single `isValid` verdict.
- **Effect:** A rule set that is well-formed per §4.2 but **non-stratifiable**
  (e.g. a `SET` self-cycle) reports `isValid: false`. Correct for the
  playground ("can't run this"), but the W3C test suite treats well-formedness
  and stratification as **separate** categories, and a library consumer may want
  §4.2 well-formedness independently of stratifiability.
- **Evidence:** fixtures `wellformed-03.srl`, `wellformed-04.srl` are
  `.skip`-listed for this granularity mismatch.
- **Fix:** split the verdict — e.g. return distinct message categories or add a
  `checkWellFormedness`-only entry point separate from the stratification check,
  and let `validateSRL` compose them. Then de-skip the two fixtures (they should
  pass a §4.2-only check). Coordinate with any playground code that relies on
  the combined verdict.

---

## 🚧 Deferred language features (RDF-1.2 & extended paths)

These parse to **errors** today — deliberately out of scope for the initial
alignment. 63 W3C syntax fixtures are `.skip`-listed for these constructs
(`packages/srl-engine/test/fixtures.test.ts` → `KNOWN_DIVERGENT`). Implementing
any one means touching the full syntax stack: `tokens.ts` → `parser.ts` →
`ast.ts` → `executor.ts`/evaluator → `validator.ts` → `monaco/srl-language.ts`
(see the "Adding SRL syntax" checklist in the root `CLAUDE.md`).

### F1 — RDF-1.2 reified triples `<< … >>` and reifier `~`
- Fixtures: `syntax-reification-01..08`, `syntax-data-16..19`,
  `syntax-template-13..15`, `syntax-pattern-13..15`.

### F2 — RDF-1.2 triple terms `<<( … )>>`
- Fixtures: `syntax-rule-terms-13`, `syntax-data-20`, `syntax-template-16`,
  `syntax-pattern-16`.

### F3 — RDF-1.2 annotation blocks `{| … |}`
- Fixtures: `syntax-reification-04/06/07`, `syntax-data-11..14`,
  `syntax-template-08..12`, `syntax-pattern-08..12`.

### F4 — RDF collections `( … )`
- Fixtures: `syntax-template-17..23`, `syntax-pattern-17..23`.

### F5 — Blank-node syntax `[]` and property lists `[ … ]`
- Fixtures: `syntax-rule-terms-08`, `syntax-rule-elements-not-03`,
  `stratification-05`, `syntax-template-24..27`, `syntax-pattern-24..27`.

### F6 — Extended property paths `*` `+` `?` `|` and negated property sets `!`
- Currently only sequence (`/`) and inverse (`^`) paths are supported (spec
  §88–91 subset). No fixtures isolate these in the vendored set, but they're on
  the README "Not Yet Implemented" list and the path evaluator
  (`pattern-matcher.ts`) only handles iri/sequence/inverse.

> When implementing a feature, also decide the **engine semantics** (how the new
> term/path evaluates against the N3 store), not just parsing. RDF-1.2 rich
> terms need N3 quoted-triple / RDF-star support in the store layer.

---

## 🚧 Extension: `FOR ?v IN <shape>` shape-targeting clause

**Source of truth:** `../py-srl/docs/for-in-shape-clause.md` (reference
implementation + spec-proposal writeup). This is an **opt-in extension, NOT
part of W3C SHACL 1.2 Rules** — py-srl gates it behind `--extensions`/`-x`
(`SRLParser(extensions=True)` / `RuleEngine(..., extensions=True)`); with the
flag off the parser rejects `FOR` and the engine raises `ExtensionError`, so a
spec-conformant document is byte-for-byte unaffected. Any srl-engine port must
preserve that same off-by-default gating.

**What the clause does:** ties a single rule to a SHACL **shape** so the rule
fires **only for the shape's conforming target focus nodes**, with an
author-named focus variable pre-bound to each node. Both rule forms accept it as
a rule-level prefix (never a body element):

```sparql
RULE ex:r FOR ?this IN ex:AdultShape { ?this ex:status ex:adult }
WHERE { ?this ex:age ?a . FILTER(?a >= 18) }

IF { ?this ex:age ?a } THEN ex:r FOR ?this IN ex:AdultShape { ?this ex:status ex:adult }
```

Formal semantics (§3.3 of the source doc): the ordinary spec rule seeds the body
with `SEQ0 = { μ0 }` (one empty mapping, fires once globally); a targeted rule
instead seeds `SEQ0 = { {v ↦ n} : n ∈ F(shape) }` where `F(shape)` is the shape's
**conforming** focus nodes. Everything downstream (body matching, FILTER, NOT,
SET, head instantiation) is the standard machinery on the wrapped rule. The one
new premise reduces to a virtual body element `TARGET(v, s)`.

**Why deferred:** srl-engine currently has **no SHACL shapes machinery at all**
— no shapes-graph input, no target selection, no conformance. Grepping the
engine source for `targetClass`/`focusVar`/`conforms`/`NodeShape` returns
nothing. This is a new subsystem plus a full-stack syntax addition, not a
localized change. It also decides an open API question (how the shapes graph is
supplied to `executeRules`/`validateSRL`).

**Architectural note (port ≠ copy):** py-srl splices `grammar-ext.lark` over an
untouched base grammar (Lark). srl-engine's parser is **Chevrotain**
(`parser.ts` builds one static grammar at class-construction time) — there is
**no overlay/splice mechanism**. The `ForClause` must be inlined as an optional
production inside `rule1`/`rule2` and gated at parse time behind an `extensions`
option, not layered over the base grammar.

Implementing touches the full syntax stack (per the "Adding SRL syntax"
checklist in the root `CLAUDE.md`) **plus a new shapes module**. Sub-items:

### X1 — New SHACL-Core-subset shapes subsystem (the main lift)
- **Where (new):** `packages/srl-engine/src/shapes/` — port py-srl's
  `src/srl/shapes/` (`load_shape`, `focusNodes`, `conforms`) to operate over the
  N3 `Store` the engine already uses.
- **What:** an in-house, intentionally partial SHACL 1.2 Core subset — no
  external validator dep. Supported targets per the source doc §3.6:
  `sh:targetClass`, `sh:targetNode`, `sh:targetSubjectsOf`, `sh:targetObjectsOf`,
  plus the 1.2 additions `sh:targetWhere` and `sh:shape`. Supported constraints
  are the query-shaped ones (triple-pattern + FILTER + path, plus COUNT/GROUP BY
  for counts/`sh:xone`/uniqueness). The cut is **not** the monotone boundary:
  non-monotone constraints (`sh:not`, `sh:maxCount`, `sh:xone`, `sh:uniqueLang`,
  `sh:maxListLength`, `sh:uniqueMembers`) are admitted because termination comes
  from the stratification gate (X4), not monotonicity. Excluded outright (raise
  an `UnsupportedShapeFeatureError` at load time — never silently ignore, or the
  rule mis-scopes): `sh:sparql`, `sh:closed`, `sh:qualifiedValueShape`, the
  property-pair constraints, `sh:entailment`, `sh:deactivated`.
- **How:** consult py-srl `docs/shacl-core-support-matrix.md` and
  `src/srl/shapes/model.py` (`_TARGET_PREDS` / `_NODE_CONSTRAINTS` /
  `_PROP_CONSTRAINTS`) for the authoritative supported sets. Port test coverage
  alongside (`tests/test_shape_targeting.py`).

### X2 — Tokens + grammar (`FOR`/`IN`, gated)
- **Where:** `packages/srl-engine/src/srl/tokens.ts` (new `For` / `In`
  keywords, correct priority slot in `allTokens` — keywords precede
  `Identifier`); `parser.ts` `rule1`/`rule2` (optional
  `ForClause ::= 'FOR' Var 'IN' iri`); add `for_clause`/targeting to
  `RULE_CATEGORIES`.
- **What:** production `[NEW] ForClause ::= 'FOR' Var 'IN' iri`, made optional in
  `[12'] Rule1 ::= 'RULE' iri? ForClause? HeadTemplate 'WHERE' BodyPattern` and
  `[13'] Rule2 ::= 'IF' BodyPattern 'THEN' iri? ForClause? HeadTemplate`. Body
  grammar untouched.
- **Gotcha:** Chevrotain builds its grammar once; the `extensions` gate can't be
  a grammar toggle. Parse the optional clause always, then **reject it in a
  post-parse pass when `extensions` is off** (mirrors py-srl's `ExtensionError`).

### X3 — AST representation
- **Where:** `packages/srl-engine/src/srl/ast.ts` (`buildAST` CST-visitor + new
  type); `RuleSet` (`ast.ts:118`); export from `index.ts`.
- **What:** mirror py-srl's `TargetedRule(rule, focusVar, shape, direction)` —
  **wrap, don't subclass** `Rule`, so all existing rule machinery runs on
  `.rule`. Keep targeted rules separate from spec-pure rules (py-srl uses
  `RuleSet.targeted_rules` vs `RuleSet.rules`); add the analogous field to the TS
  `RuleSet` and export the new type from the barrel.

### X4 — Executor: seed + shapes-graph plumbing + stratifier gate
- **Where:** `packages/srl-engine/src/rules/executor.ts` (`executeRules`,
  `executor.ts:238`; `ExecutorOptions`); `stratifier.ts` (`stratifyRules`,
  `stratifier.ts:275`).
- **What (eval):** for each targeted rule — `loadShape` → `focusNodes(shape)` →
  keep those that `conforms` → seed `{focusVar ↦ node}` as the body's initial
  solution mapping → run the wrapped rule once per conforming node. Plumb the
  shapes graph in via a new `ExecutorOptions` field (decide: separate N3 `Store`,
  or Turtle string parsed internally).
- **What (stratify):** add a **closed** gate edge (same class as NOT/SET/blank-node
  deps) from each targeted rule to any rule whose head can assert a predicate the
  shape *reads* (its target predicates + its constraints' predicates — py-srl's
  `shape_referenced_predicates`). Places the targeted rule strictly above those
  rules, so `F(shape)` is frozen for the targeted stratum (this is what secures
  termination without needing monotone `conforms`). A cyclic shape-gate
  dependency throws the existing closed-cycle error (`StratificationError`).

### X5 — Validator: well-formedness basis + gating
- **Where:** `packages/srl-engine/src/validation/validator.ts`
  (`checkAstSemantics`, `validator.ts:306`; `validateSRL`, `validator.ts:335`).
- **What:** validate the wrapped rule with initial bound-variable set
  `V₀ = { focusVar }` (the focus var is bound at seed time) — every other §4.2
  condition is unchanged (base case is `V₀ = ∅`). Surface the extensions-off
  rejection and any shape-load / unsupported-feature errors as validation
  messages. Needs the same shapes-graph input as the executor (X4).

### X6 — Extensions gating flag (off by default)
- **What:** thread an `extensions` boolean through the public parse / validate /
  execute API, defaulting **false**, so a spec-conformant document is unaffected
  and the `FOR` clause is only reachable when explicitly enabled. Mirrors
  py-srl's `extensions=True`. This is the cross-cutting concern that X2, X4, X5
  all consult.

### X7 — RDF/SRL surface + Monaco (defer / out-of-engine)
- **RDF surface:** py-srl also accepts the attachment from an RDF shapes graph in
  both directions (`srl:targetShape` + `srl:focusVar` for rule→shape;
  `sh:rule`/`srl:rule` for shape→rule), normalizing both to one AST. srl-engine
  has no RDF-SRL parser today; defer this surface — the text-SRL `FOR` clause is
  the minimal first step.
- **Monaco:** highlighting/hover/completion for `FOR`/`IN` lives in
  `apps/playground/src/lib/monaco/srl-language.ts` and a shapes-graph editor is a
  playground UI concern — **out of the srl-engine package's scope**, tracked
  separately if/when the playground exposes the extension.

---

## 🐞 Pre-existing edge cases (Turtle-leniency negatives)

### E1 — Lenient lexer accepts some malformed negative fixtures
- **Where:** the Chevrotain lexer / Turtle tokenizing is more permissive than
  the spec on a few malformed inputs, so 3–4 W3C **negative** syntax tests
  (which should be rejected) validate as OK.
- **Evidence:** `syntax-rule-bad-04` (undeclared prefix not rejected),
  `syntax-data-bad-09` (`"xyx"^^:datatype.` + double-dot), `syntax-data-bad-10`
  (`1.` number/dot ambiguity) — `.skip`-listed in `KNOWN_DIVERGENT`.
- **Why deferred:** pre-existing tokenizer leniency (noted in root `CLAUDE.md`
  gotchas), not a regression from the extraction. Tightening risks
  false-negatives on valid input.
- **Fix:** tighten the specific lexer patterns / add a post-parse ground-term
  check, verifying the 3 fixtures flip to correctly-rejected without breaking
  the ~85 passing positive fixtures.

---

## 📦 Packaging & release follow-ups

### P1 — Tighten `exports` map with per-condition CJS types
- **Where:** `packages/srl-engine/package.json` `exports`.
- **What:** tsup emits `dist/index.d.cts`, but `exports` only advertises the ESM
  `.d.ts` at the top level. Under `moduleResolution: node16`/`nodenext`, a
  `require()` consumer should resolve the CJS declarations.
- **Fix:** the per-condition form documented in `packages/srl-engine/PUBLISHING.md`
  Step 2b and `RELEASING.md` §1. Do this **before the first npm publish**.

### P2 — Add a `prepublishOnly` gate
- **Where:** `packages/srl-engine/package.json` scripts.
- **What:** no gate currently guards `npm publish`; a stale/broken `dist/` could
  be shipped. Add `"prepublishOnly": "npm run typecheck && npm run test && npm run build"`.
- Detailed in `PUBLISHING.md` Step 2a.

### P3 — No engine `lint` script
- **Where:** `packages/srl-engine/package.json`.
- **What:** the engine package has `build`/`test`/`typecheck` but no `lint`.
  ESLint is configured for the app (`apps/playground`), not the package. The
  lint-debt items below (T1) therefore aren't caught by any CI on the engine.
- **Fix:** add a flat ESLint config + `"lint"` script to the engine package,
  wire it into the CI sketch (see P4), and clear T1.

### P4 — CI, Changesets, UMD bundle not set up
- **Where:** documented-but-not-implemented in `RELEASING.md` §2 (GitHub Actions
  CI), §3 (Changesets versioning), §4 (browser/UMD IIFE bundle).
- **Why deferred:** out of scope for the extraction; each is an opt-in.
- **Fix:** follow the respective `RELEASING.md` section when the need arises.
  CI (§2) is the highest-value first step — it would have caught the phantom-dep
  bug that the final review found manually.

---

## 🧹 Tech debt

### T1 — Unused imports / `prefer-const` in engine source
- **Where (pre-existing, noted in root `CLAUDE.md`):**
  - `packages/srl-engine/src/rules/executor.ts` — unused n3 / token imports.
  - `packages/srl-engine/src/rules/expression-evaluator.ts` — unused imports.
  - `packages/srl-engine/src/srl/ast.ts` — a `prefer-const` opportunity.
- **Status:** warnings only (0 errors) when linted; harmless but noisy. Not
  currently linted at all (see P3 — engine has no lint script).
- **Fix:** once P3 adds engine linting, remove the unused imports and fix the
  `prefer-const`. Small, low-risk cleanup.

### T2 — `KNOWN_DIVERGENT` skip-list is the deferred-feature source of truth
- **Where:** `packages/srl-engine/test/fixtures.test.ts`.
- **Note:** as features F1–F6 / edge cases E1 / bugs B2, B3 are addressed, remove
  the corresponding entries from `KNOWN_DIVERGENT` and confirm the fixtures pass.
  Keep this file and this backlog in sync — a shrinking skip-list is the
  progress metric.

---

## Where these are also referenced

- **How-To Guide** `packages/srl-engine/docs/GUIDE.md` §13 (Gotchas) — B1, B2,
  B3, F1–F6 from the consumer's perspective.
- **Publishing guide** `packages/srl-engine/PUBLISHING.md` — P1, P2.
- **RELEASING.md** (repo root) — P1, P4.
- **PR #2 description** — B2, B3, P1 called out under "backlog surfaced".
- **Test skip-list** `packages/srl-engine/test/fixtures.test.ts`
  (`KNOWN_DIVERGENT`) — F1–F6, E1, B2, B3 with per-fixture reasons.
- **`FOR ?v IN <shape>` spec + reference impl** `../py-srl/docs/for-in-shape-clause.md`
  — X1–X7 (clause semantics, SHACL-Core subset, stratification gate).
