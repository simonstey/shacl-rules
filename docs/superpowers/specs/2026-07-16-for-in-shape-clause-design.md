# Design: `FOR ?v IN <shape>` shape-targeting clause in srl-engine

**Date:** 2026-07-16
**Status:** Approved design — ready for implementation planning
**Backlog item:** extends `docs/BACKLOG.md` → "Extension: `FOR ?v IN <shape>` shape-targeting clause" (X1–X7)

---

## 1. Goal

Implement the opt-in `FOR ?v IN <shape>` rule-to-shape targeting clause **end-to-end**
in the `srl-engine` package: text-SRL parsing, AST, execution (conformance-gated
inference), stratification gate, and validation. The clause ties a rule to a SHACL
shape so it fires **only for the shape's conforming target focus nodes**, with an
author-named focus variable pre-bound to each node.

The feature is **off by default**, reachable only behind an `extensions` flag. With
the flag off, the parser rejects `FOR` and the engine refuses to evaluate targeted
rules, so a spec-conformant SRL document is byte-for-byte unaffected. This mirrors
py-srl's `extensions=True` gating exactly.

Reference: `../py-srl/docs/for-in-shape-clause.md` (spec proposal + reference
implementation writeup). This design is the srl-engine (TypeScript) realization of
that document.

## 2. Key decision: port from py-srl, not the playground

The task began as "reuse the SHACL engine from `shacl-playground/apps/web/src/`."
Investigation showed that repo's SHACL Core conformance is **not in-house code** —
`engine/core.ts` delegates to the third-party `rdf-validate-shacl` npm package
(`new SHACLValidator(shapes).validate(data)`), plus a Comunica pass for `sh:sparql`.
Only ~120 lines are locally authored (Turtle→Store parse helpers, report
normalization); the rest (Comunica SPARQL ~400 lines, SHACL 1.2 node-expressions
~340 lines) is unrelated to what `FOR` needs.

**Decision (user-confirmed): build an in-house SHACL Core subset with no new
dependencies.** srl-engine's identity is "pure TS, depends only on `chevrotain` +
`n3`" — adding `rdf-validate-shacl` + the `@rdfjs/*` tree would break that promise.

Consequently the **donor is py-srl**, whose `src/srl/shapes/` (model 137 + targets 71
+ validate 327 ≈ 535 lines of pure Python) is the exact `FOR` reference
implementation, hand-rolled and bounded to a "query-shaped" SHACL Core subset
(for-in-shape-clause.md §3.6). We port that to TypeScript over the n3 `Store`. The
playground contributes only cheap, reusable *patterns* (the Turtle-parse helper
shape, the normalized-result record) — not its conformance engine.

The port is close to mechanical: py-srl's `validate.py` uses only rdflib graph
queries (`graph.objects`, `graph.value`, `Collection`), each with an n3 `Store`
equivalent (`store.getQuads`, a manual `rdf:first`/`rdf:rest` walk). No algorithmic
redesign — an RDF-library translation plus reuse of the engine's existing
`evaluatePath` for SHACL property paths.

## 3. New subsystem: `packages/srl-engine/src/shapes/`

A self-contained SHACL 1.2 Core subset over the n3 `Store`, ported from py-srl.

| File | Ports (py-srl) | Responsibility |
|------|----------------|----------------|
| `model.ts` | `model.py` | `NodeShape` / `PropertyShape` / `Constraint` types; `loadShape(store, iri)`; `UnsupportedShapeFeatureError`; the three support sets `TARGET_PREDS` / `NODE_CONSTRAINTS` / `PROP_CONSTRAINTS` |
| `targets.ts` | `targets.py` | `focusNodes(shape, dataStore, shapesStore)` — targetClass (transitive `rdfs:subClassOf`), targetNode, targetSubjectsOf, targetObjectsOf, targetWhere, `sh:shape` |
| `validate.ts` | `validate.py` | `conforms(node, shape, dataStore, shapesStore)` + `checkConstraint` — the full constraint surface |
| `rdf-helpers.ts` | (rdflib built-ins) | `rdfList` (walk `rdf:first`/`rdf:rest`; n3 has no `Collection`), `pyValue` (literal→JS value for numeric compare), value-based `TermSet`/dedup helpers (n3 `Term`s need `.value`/type comparison, not identity) |
| `index.ts` | `__init__.py` | barrel exports |

### 3.1 Support surface (full port — user-confirmed)

Port the **entire** py-srl subset, so py-srl's own tests become the correctness
oracle verbatim. Per `../py-srl/docs/shacl-core-support-matrix.md`:

- **Targets:** `sh:targetClass`, `sh:targetNode`, `sh:targetSubjectsOf`,
  `sh:targetObjectsOf`, `sh:targetWhere`, `sh:shape`.
- **Value-type:** `sh:class`, `sh:datatype`, `sh:nodeKind`.
- **Cardinality:** `sh:minCount`, `sh:maxCount`.
- **Range:** `sh:minInclusive`, `sh:maxInclusive`, `sh:minExclusive`, `sh:maxExclusive`.
- **String:** `sh:minLength`, `sh:maxLength`, `sh:pattern` (+ `sh:flags`),
  `sh:languageIn`, `sh:uniqueLang`.
- **Value:** `sh:hasValue`, `sh:in`.
- **Logical:** `sh:and`, `sh:or`, `sh:not`, `sh:xone`.
- **Shape-based:** `sh:node`, `sh:property`, `sh:path`.
- **1.2 additions:** `sh:someValue`, `sh:rootClass`, `sh:subsetOf`, `sh:memberShape`,
  `sh:minListLength`, `sh:maxListLength`, `sh:uniqueMembers`, `sh:reifierShape`,
  `sh:reificationRequired` (best-effort, as in py-srl).

Anything outside these sets raises `UnsupportedShapeFeatureError` at shape-load time
(never silently ignored — a dropped constraint would mis-scope the rule).

### 3.2 Reuse of existing engine code

SHACL property paths (`sh:path` with `sh:inversePath` / RDF-list sequences) convert
into the engine's existing `PathExpression` AST and evaluate through
`pattern-matcher.ts`'s `evaluatePath` / `evaluateInversePath`. This mirrors py-srl
reusing `engine/solutions.evaluate_path`, and avoids a second path evaluator.
`_shaclPathToAst` (ported) does the SHACL-RDF-path → `PathExpression` conversion.

## 4. Syntax-stack changes

### 4.1 `tokens.ts`
Add `export const For = keyword('For', 'FOR');` in the keyword block (after
`Inverse`) and insert `For` into `allTokens` in the keyword region right after
`Inverse` (order among keywords is not priority-sensitive since all keywords share
the `(?![\w:-])` boundary). `In` already exists (used by relational `IN`) — reused
as-is. The
`keyword()` factory's `(?![\w:-])` boundary lookahead means `FOR` won't mis-lex the
prefix of an identifier/prefixed-name.

### 4.2 `parser.ts`
- New production: `forClause = FOR variable IN iriRef` (uses existing `variable`,
  `iriRef`).
- `rule1`: insert `OPTION(() => SUBRULE(forClause))` **after** the existing
  optional naming-IRI, before `headTemplate`.
- `rule2`: add `OPTION(iriRef)` then `OPTION(forClause)` before `headTemplate`
  (base spec rule2 has no naming IRI; see §4.4 for how the bare-IRI case is gated).
- Add `forClause` to `RULE_CATEGORIES` (syntax-diagram grouping) under `'rules'`.

The parser **always** accepts the clause grammatically (Chevrotain builds one static
grammar at construction — there is no runtime grammar toggle). Gating happens in the
AST layer (§4.4), mirroring py-srl, which parses then rejects.

### 4.3 `ast.ts`
- New type `TargetedRule` that **wraps** a `Rule` (does not subclass — all existing
  rule machinery runs on `.rule`):
  ```ts
  interface TargetedRule {
    type: 'targetedRule';
    rule: Rule;
    focusVar: string;
    shape: string;              // resolved shape IRI
    direction: 'rule-to-shape'; // only surface expressed in text SRL
    location?: SourceLocation;
  }
  ```
- `RuleSet` gains `targetedRules: TargetedRule[]`, kept **separate** from spec-pure
  `rules: Rule[]` (matches py-srl `RuleSet.targeted_rules`).
- `buildAST(code, options?: { extensions?: boolean })`. The `ASTBuilder` carries the
  flag. `buildRule` detects a `forClause` child; when present it builds the wrapped
  `Rule` and returns a `TargetedRule`; `visitRuleSet` routes `TargetedRule`s into
  `targetedRules`.
- **Gating:** an `ExtensionError` (new, exported) is thrown by `buildAST` when
  `extensions` is off and either (a) a `forClause` is present, or (b) a `rule2`
  carries a naming IRI without a `forClause` (see §4.4). Existing single-arg
  `buildAST(code)` callers keep working (extensions defaults off).

### 4.4 rule2 naming-IRI gating (user-confirmed: reject when off)
The grammar accepts `iri? forClause?` on rule2, but keeping non-extension mode
strictly spec-shaped (base spec rule2 has no naming IRI): `buildAST` throws
`ExtensionError` if a rule2 has a naming IRI while `extensions` is off. With
extensions on, a rule2 naming IRI is allowed (needed to name a targeted `IF..THEN`
rule). rule1's existing optional IRI is unaffected.

## 5. Engine wiring

### 5.1 `executor.ts`
- `ExecutorOptions` gains:
  - `extensions?: boolean` (default false)
  - `shapesGraph?: string` (SHACL Turtle text) **and** `shapesStore?: Store` —
    **accept both** (user-confirmed). `shapesStore` wins if both given; otherwise
    `shapesGraph` is parsed to a Store internally (consistent with `rdfData` being a
    string). If a rule set has targeted rules but no shapes input, that's an error
    collected into `ExecutionResult.errors`.
- `executeRules(ruleSet, rdfData, options)` also reads `ruleSet.targetedRules`.
- New `applyTargetedRule(tr, store, shapesStore)`:
  1. `shape = loadShape(shapesStore, tr.shape)`
  2. `candidates = focusNodes(shape, store, shapesStore)`
  3. for each `node` where `conforms(node, shape, store, shapesStore)`: seed
     `evaluateElements(tr.rule.body.elements, [{ [tr.focusVar]: node }], store)`,
     then instantiate `tr.rule.head` per solution — same dedup / provenance path as
     `applyRule`.
- Targeted rules get their own `RuleInfo` entries (provenance grouping in results).
- Run-once vs general classification of the **wrapped** rule is honored: a targeted
  rule whose wrapped rule `isRunOnce` fires once in its stratum; else it iterates.
  Realized via the stratifier's new `targeted[]` layer slot (§5.2).
- `ExtensionError` from `buildAST`/targeted evaluation is caught into `errors`, never
  thrown out of `executeRules` (consistent with existing error handling).

### 5.2 `stratifier.ts`
- New `shapeReferencedPredicates(shape): Set<string>` (port) — the target predicates
  a shape reads (`rdf:type` for targetClass/`sh:class`; the predicate for
  targetSubjectsOf/targetObjectsOf) plus every property shape's simple-path IRI and
  its `sh:class` reads.
- `StratificationLayer` gains `targeted: TargetedStratRule[]`.
- `stratifyRules(rules, targetedRules?, shapesStore?)`: when targeted rules are
  present, build combined edges — targeted rules become extra vertices, and a
  **closed** gate edge is added from each targeted rule to any rule whose head can
  assert a predicate the shape reads (or whose head predicate is a variable). This
  places the targeted rule strictly above those rules, freezing `F(shape)` for its
  stratum (the termination guarantee — see for-in-shape-clause.md §3.4). A cyclic
  gate dependency throws the existing `StratificationError`.
- Existing `stratifyRules(rules)` single-arg call sites are unaffected (extra params
  optional; no targeted rules ⇒ identical behavior).

### 5.3 `validator.ts`
- `validateSRL(code, options?: { extensions?: boolean; shapesGraph?: string; shapesStore?: Store })`.
- `buildAST` is called with `{ extensions }`; an `ExtensionError` surfaces as an
  error message (the existing try/catch around `buildAST` already degrades builder
  errors to diagnostics — extends naturally).
- `checkWellFormedSequence` is refactored to accept an initial bound set `v0`
  (already does). Each targeted rule's wrapped rule is validated with
  `v0 = { focusVar }` (the focus var is bound at seed time); every other §4.2
  condition unchanged. Base rules keep `v0 = ∅`.
- Stratification check extends to pass `targetedRules` + shapes store when present.

## 6. Public API (`index.ts`)
Export: `loadShape`, `focusNodes`, `conforms`, `NodeShape`, `PropertyShape`,
`Constraint`, `UnsupportedShapeFeatureError`, `ExtensionError`, and the `TargetedRule`
type. `buildAST`/`executeRules`/`validateSRL` signatures gain their optional options
(backward-compatible).

## 7. Out of scope (deferred to backlog X7)
- **RDF/SRL surface** (`srl:targetShape` + `srl:focusVar`, shape→rule `sh:rule`):
  srl-engine has no RDF-SRL parser; text-SRL `FOR` is the minimal first step.
- **Monaco** highlighting/hover/completion for `FOR`/`IN` and any shapes-graph editor
  UI: lives in `apps/playground`, not this package.

## 8. Phased delivery (user-confirmed: full port, phased commits)

Each phase builds green with its slice of the ported tests.

| Phase | Delivers | Green gate |
|-------|----------|-----------|
| **0** | tokens + grammar + `TargetedRule` AST + `ExtensionError` gating (incl. rule2 IRI rule) | parse `FOR` → AST; rejected when extensions off |
| **1** | `rdf-helpers.ts` + `model.ts` (`loadShape`, support sets) + `targets.ts` (`focusNodes`) + empty-shape `conforms` | focus-node selection tests |
| **2** | `validate.ts` value-type / cardinality / range / string constraints | those constraint tests |
| **3** | logical (and/or/not/xone) + shape-based (node/someValue/property/path incl. `_shaclPathToAst`) + rootClass/subsetOf | logical + shape tests |
| **4** | 1.2 list family (memberShape/min/maxListLength/uniqueMembers) + languageIn/uniqueLang/in/hasValue + reifier best-effort | full support-matrix parity (drift test) |
| **5** | executor seed + stratifier gate + validator basis + `index.ts` exports | port `test_shape_targeting.py` end-to-end |
| **6** | docs (README, GUIDE, BACKLOG update marking X1–X6 done), examples | `npm -w srl-engine build` + full suite green |

**Correctness oracle:** port py-srl `tests/test_shape_targeting.py` (7 tests, incl.
conforming-focus-only firing, extension-off rejection, inferred-target-membership
via the gate, chained targeted gates) and `test_support_matrix.py` (drift test) to
Vitest under `packages/srl-engine/test/`. Behavior is pinned to the reference
implementation.

## 9. Risks / watch-items
- **n3 term identity:** n3 `Term`s aren't reference-unique; all set/dedup logic must
  compare by `termType` + `.value` (+ datatype/lang for literals). `rdf-helpers.ts`
  centralizes this. (py-srl gets this free from rdflib term hashing.)
- **RDF lists:** n3 has no `Collection`; `rdfList` must walk `rdf:first`/`rdf:rest`
  to `rdf:nil` defensively (non-list node ⇒ `[]`, matching py-srl).
- **`extensions` threading:** the flag crosses parse → AST → execute → validate. A
  single optional field on each entry point, defaulting off, keeps every existing
  call site working. Verify no existing test regresses (they all run extensions-off).
- **n3 version:** engine uses `n3@^1.26`; the playground uses `n3@^2`. We stay on the
  engine's pinned n3 — no bump. Port targets only `Store.getQuads` + `DataFactory`,
  stable across both.
- **No test runner gap:** the engine package *does* have Vitest (unlike the
  playground app), so ported tests run under `npm -w srl-engine test`.
