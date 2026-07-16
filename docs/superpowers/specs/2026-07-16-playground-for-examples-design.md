# Design: FOR ?v IN <shape> examples + playground extension support

**Date:** 2026-07-16
**Status:** Approved design — ready for implementation planning
**Depends on:** the merged `FOR ?v IN <shape>` engine feature (design `2026-07-16-for-in-shape-clause-design.md`; engine ships `buildAST(code, {extensions})`, `executeRules(rs, data, {extensions, shapesGraph, shapesStore})`, `validateSRL(code, {extensions, shapesGraph, shapesStore})`).

---

## 1. Goal

Add a set of runnable `FOR ?v IN <shape>` examples to the Next.js playground
(`apps/playground`). Because the playground is the deferred **X7** surface — it
currently passes neither the `extensions` flag nor a shapes graph to the engine —
this also requires wiring the opt-in extension through the playground so the
examples actually validate, run, and show inferred triples (not just appear as
text).

## 2. Why this is more than "add examples"

Investigation of the current playground:
- `useValidation` calls `validateSRL(code)` — no `extensions` → a `FOR` clause is
  reported invalid ("opt-in extension").
- `useRuleExecution` calls `buildAST(srlCode)` + `executeRules(rs, rdfData, {maxIterations})`
  — no `extensions`, no shapes graph → targeted rules can't parse or evaluate.
- The `Example` type has only `srlCode` + `rdfData` — no shapes-graph field.
- The UI has two Monaco editors (Data / Rules) — no shapes surface.
- Monaco's SRL keyword list (`srl-language.ts`) has `IN` but **not** `FOR` — the
  keyword won't highlight, hover, or autocomplete.

So FOR examples require making the extension reachable end-to-end in the app.

## 3. Decisions (user-confirmed)

- **Shapes input:** a dedicated **Shapes editor**, placed as a **second tab inside
  the Data panel** (`[Data] [Shapes]`), sharing one editor slot. Both are Turtle
  graphs; reuse the existing generic `RDFEditor`.
- **Extension mode:** **always on** — pass `{ extensions: true }` to validate +
  execute unconditionally, and always send the Shapes editor content as the shapes
  graph. Spec-conformant documents are unaffected (no `FOR` ⇒ empty
  `targetedRules` ⇒ identical behavior). No header toggle.
- **Example scenarios:** all four groups — core targeting, conformance
  constraints, logical + cross-rule, and IF..THEN / chained gates (~8 examples).
- **Tab state** lives in `Playground` (lifted), not baked into `ResizablePanels`,
  keeping the panel component generic.

## 4. Component changes

### 4.1 `apps/playground/src/lib/examples/examples.ts`
- Add `shapesGraph?: string` to the `Example` interface.
- Add `'shape-targeting'` to `ExampleCategory` and an `exampleCategories` entry:
  name "Shape Targeting (FOR … IN)", description e.g. "Rules tied to a SHACL shape
  — fire only for the shape's conforming target focus nodes (opt-in extension)".
- Append ~8 examples (see §6).

### 4.2 `apps/playground/src/components/Playground.tsx`
- New state: `shapesGraph` (string), `activeDataTab: 'data' | 'shapes'`.
- Default shapes graph: a short SHACL comment/skeleton so the tab isn't empty.
- The `leftPanel` passed to `ResizablePanels` becomes a small tabbed wrapper:
  a `[Data] [Shapes]` tab strip (styled like the existing right-panel tabs) above
  a single `RDFEditor` whose `value`/`onChange` switch on `activeDataTab`.
- `handleSelectExample` sets `shapesGraph` from `example.shapesGraph ?? DEFAULT_SHAPES`.
  No auto tab-switch (keeps focus on the rules). The Shapes tab MAY show a small
  dot/indicator when its content is non-default so users notice a shape was loaded,
  but that indicator is optional polish, not required.
- `handleRunRules` passes `shapesGraph` to `execute`.
- The `validate(srlCode)` effect passes `shapesGraph` too (see 4.4 note).

### 4.3 `apps/playground/src/components/RDFEditor.tsx`
- No change — reused as-is for the Shapes editor (generic Turtle editor).
- **Rendering choice:** a SINGLE `RDFEditor` instance in the left panel whose
  `value`/`onChange` are bound to the active tab (`activeDataTab === 'data' ?
  {rdfData, setRdfData} : {shapesGraph, setShapesGraph}`). Per-tab editor
  focus/scroll preservation is not required. One instance keeps Monaco mounts
  minimal and avoids a second dynamic import.

### 4.4 `apps/playground/src/lib/validation/useValidation.ts`
- `validate(code)` → `validate(code, shapesGraph?)`; call
  `validateSRL(code, { extensions: true, shapesGraph })`.
- Note: well-formedness is AST-only, so `shapesGraph` is currently unused by the
  validator — but passing it is forward-compatible and harmless, and `extensions:
  true` is the load-bearing change (lets `FOR` validate as well-formed instead of
  being rejected).

### 4.5 `apps/playground/src/lib/rules/useRuleExecution.ts`
- `execute(srlCode, rdfData)` → `execute(srlCode, rdfData, shapesGraph?)`.
- `buildAST(srlCode, { extensions: true })`.
- `executeRules(parsedRuleSet, rdfData, { maxIterations: 100, extensions: true, shapesGraph })`.
- Backward-compatible: non-FOR examples parse/run identically (extensions:true with
  no FOR clause is a no-op; no shapes graph needed).

### 4.6 `apps/playground/src/lib/monaco/srl-language.ts`
- Add `"FOR"` to the `keywords` array (next to `IN`).
- Add a `FOR` entry to `keywordDocs` (hover): description "Targets a rule to a SHACL
  shape (opt-in extension). The rule fires once per conforming focus node, with the
  focus variable pre-bound.", syntax `FOR ?var IN <shape>`.
- Add `"FOR"` to the completion keyword list, and optionally a `FOR … IN`
  snippet-style completion (`FOR ?${1:this} IN ${2:shape}`).

## 5. Backward compatibility

- Every existing (non-FOR) example must validate + run + infer exactly as before.
  `extensions: true` only *enables* the FOR clause; it does not change plain-rule
  parsing/evaluation (verified by the engine's 140 pre-existing tests staying green
  under the same flag).
- The Shapes tab defaults to a harmless skeleton and is ignored by non-FOR
  examples (no targeted rules ⇒ shapes graph never consulted).

## 6. The example set (~8, category `shape-targeting`)

Each example carries `srlCode` + `rdfData` + `shapesGraph`. All use
`PREFIX ex: <http://example.org/>` / `sh:` consistently.

1. **Adult gate (canonical)** — `sh:targetClass ex:Person` + property shape
   `sh:path ex:age ; sh:minCount 1 ; sh:minInclusive 18`. Data: Alice 30, Bob 10.
   FOR rule infers `ex:status ex:adult`; only Alice qualifies.
2. **Target kinds** — one shape per target: `sh:targetNode`,
   `sh:targetSubjectsOf`, `sh:targetObjectsOf` — show which focus nodes each
   selects.
3. **Datatype + nodeKind gate** — shape requires `sh:datatype xsd:string` /
   `sh:nodeKind sh:IRI`; FOR rule fires only for conforming nodes.
4. **Pattern / in / hasValue** — shape with `sh:pattern` (e.g. a code format) and
   `sh:in (…)` / `sh:hasValue`; gate filters accordingly.
5. **Cardinality gate** — `sh:minCount` / `sh:maxCount` on a property; FOR rule
   fires only for nodes with the right count.
6. **Logical shapes** — `sh:or` / `sh:not` (and mention `sh:and`/`sh:xone`): a
   node conforms via one branch; FOR rule targets it.
7. **Sees inferred membership** — a plain rule infers `ex:age` for a node; the FOR
   rule's shape reads `ex:age`, so the stratification gate makes it fire *after*
   the inference. Demonstrates the closed-gate ordering.
8. **IF..THEN + chained gates** — the `IF { } THEN ex:r FOR ?v IN shape { }`
   surface form; plus a second targeted rule whose head feeds the first shape's
   read predicate (chained targeted gates in different strata).

Content is adapted from the engine's ported oracle tests
(`packages/srl-engine/test/shape-targeting.test.ts`) and the GUIDE worked example,
so behavior is known-correct.

## 7. Verification

- `npm -w playground run build` — Next production build = full TS typecheck +
  static export; must pass with 0 errors.
- `npm run dev` smoke: load EACH new `shape-targeting` example → confirm it
  validates (green), Run Rules produces the expected inferred triples, and the
  Shapes tab shows the shape. Spot-check 2–3 pre-existing (non-FOR) examples still
  work (backward compat).
- Confirm `FOR` highlights in the SRL editor and its hover doc appears.

## 8. Out of scope

- Syntax-diagram panel changes — the `forClause` production already flows through
  the engine's `getGrammarRuleNames`/serialized grammar; nothing to add.
- Shapes-graph file upload / URL persistence — `FileUpload` stays data/rules only.
- A header extensions toggle (decided: always on).
- Editing DESIGN.md tokens or the visual system.
- Shapes-aware validation messages (engine well-formedness is AST-only today).

## 9. Risks / watch-items

- **Monaco global theme:** the Shapes editor is another `RDFEditor`, which already
  shares the `srl-dark`/`srl-light` themes — no new theme surface, no clobber risk
  (per CLAUDE.md's global-theme gotcha).
- **Responsive layout:** tabs inside the existing left panel avoid the axis-flip
  rework CLAUDE.md warns about (no new PanelGroup, no third column). The tab strip
  must use single-line `className` strings (CLAUDE.md hydration gotcha).
- **Static export:** `output: "export"` — everything stays client-side; the Shapes
  editor is dynamically imported `ssr:false` like the others.
- **Example correctness:** shapes must stay within the engine's supported SHACL
  Core subset (support matrix) or `loadShape` throws at run time (surfaced as an
  execution error). Draw shapes from the known-passing oracle fixtures.
