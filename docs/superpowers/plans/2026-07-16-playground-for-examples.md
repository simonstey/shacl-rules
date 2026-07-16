# Playground FOR Examples + Extension Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add runnable `FOR ?v IN <shape>` examples to the Next.js playground, wiring the opt-in SHACL-shape-targeting extension through validation, execution, a Shapes editor tab, and Monaco highlighting.

**Architecture:** The playground is the deferred X7 surface — it currently passes neither the engine's `extensions` flag nor a shapes graph. Enable the extension **always-on** (safe: no `FOR` clause ⇒ empty `targetedRules` ⇒ identical behavior), add a Shapes Turtle editor as a second tab in the Data panel, add a `shapesGraph` field to examples, and append ~8 FOR examples drawn from the engine's known-correct oracle tests.

**Tech Stack:** Next.js 16 (App Router, static export), React 19, TypeScript, Monaco (`@monaco-editor/react`), `react-resizable-panels`, `srl-engine` (workspace dependency).

## Global Constraints

- **No test runner exists for the app** (per root `CLAUDE.md`). Per-task verification is `npm -w playground run build` (a Next production build = full TypeScript typecheck + static export). The final task adds a manual `npm run dev` smoke of each example. There is no failing-test-first cycle for app code.
- **Extension is always-on:** pass `{ extensions: true }` to `validateSRL`, `buildAST`, and `executeRules` unconditionally. This must NOT change behavior for non-FOR examples (verified: engine's 140 pre-existing tests pass under the same flag).
- **Backward compatibility:** every existing (non-FOR) example must still validate, run, and infer exactly as before.
- **Import the engine from `srl-engine`** (the workspace package), never `@/lib/*` — the app consumes the published engine surface.
- **Monaco's active theme is GLOBAL** — the Shapes editor reuses `RDFEditor` (already on `srl-dark`/`srl-light`); do not give it a different theme.
- **`className` strings must be single-line** — multi-line template literals cause React 19 hydration mismatches (root `CLAUDE.md` gotcha).
- **Static export** (`output: "export"`): everything stays client-side; Monaco editors are dynamically imported `ssr: false`.
- **Shapes in examples must stay within the engine's supported SHACL Core subset** (`packages/srl-engine/docs/shacl-core-support-matrix.md`) or `loadShape` throws at run time. Draw shapes from known-passing oracle content.
- **Commit after every task.** Work on a feature branch, not `main`.
- SHACL namespace: `http://www.w3.org/ns/shacl#`. Example namespace: `http://example.org/` (prefix `ex:`).

---

## File Structure

**Modified:**
- `apps/playground/src/lib/examples/examples.ts` — `Example.shapesGraph?` field, `'shape-targeting'` category + `exampleCategories` entry, ~8 new examples.
- `apps/playground/src/lib/validation/useValidation.ts` — `validate(code, shapesGraph?)` → `validateSRL(code, { extensions: true, shapesGraph })`.
- `apps/playground/src/lib/rules/useRuleExecution.ts` — `execute(srl, rdf, shapesGraph?)` → `buildAST(srl, {extensions:true})` + `executeRules(..., { extensions:true, shapesGraph })`.
- `apps/playground/src/components/Playground.tsx` — `shapesGraph` + `activeDataTab` state, tabbed Data/Shapes left panel, thread shapesGraph into validate + execute, load `example.shapesGraph`.
- `apps/playground/src/lib/monaco/srl-language.ts` — add `FOR` to keywords, hover docs, completions.

**Not modified** (confirmed sufficient as-is):
- `RDFEditor.tsx` — generic Turtle editor, reused for Shapes.
- `ExamplesSidebar.tsx` — iterates `exampleCategories` keys, so a new category auto-renders.
- `ResizablePanels.tsx` — stays generic; the tab wrapper is built in `Playground` and passed as `leftPanel`.

---

## Task 1: Example schema + FOR example set

**Files:**
- Modify: `apps/playground/src/lib/examples/examples.ts`

**Interfaces:**
- Produces: `Example.shapesGraph?: string`; `ExampleCategory` gains `'shape-targeting'`; `exampleCategories['shape-targeting']`; ~8 new `Example` entries with `category: 'shape-targeting'`.

- [ ] **Step 1: Add the `shapesGraph` field + category**

In `apps/playground/src/lib/examples/examples.ts`, add `shapesGraph` to the interface:

```ts
export interface Example {
  id: string;
  title: string;
  description: string;
  category: ExampleCategory;
  srlCode: string;
  rdfData?: string;
  /** SHACL shapes graph (Turtle) for FOR ?v IN <shape> examples (opt-in extension). */
  shapesGraph?: string;
}
```

Add the category to the union (append after `'string-functions'`):

```ts
export type ExampleCategory =
  | 'basic-inference'
  | 'transitive'
  | 'symmetric'
  | 'negation'
  | 'assignment'
  | 'path-expressions'
  | 'string-functions'
  | 'shape-targeting';
```

Add the `exampleCategories` entry (append inside the object, after `'string-functions'`):

```ts
  'shape-targeting': {
    name: 'Shape Targeting (FOR … IN)',
    description: 'Rules tied to a SHACL shape — fire only for the shape\'s conforming focus nodes (opt-in extension)',
  },
```

- [ ] **Step 2: Append the 8 shape-targeting examples**

Append these entries to the `examples` array (before the closing `];`). Each is self-contained and drawn from the engine's supported subset.

```ts
  // Shape Targeting Examples (opt-in FOR ?v IN <shape> extension)
  {
    id: 'adult-gate',
    title: 'Adult Status Gate',
    description: 'Fire only for ex:Person nodes conforming to AdultShape (age ≥ 18)',
    category: 'shape-targeting',
    srlCode: `PREFIX ex: <http://example.org/>

# Fires once per conforming focus node, with ?this pre-bound.
RULE ex:adultStatus FOR ?this IN ex:AdultShape
  { ?this ex:status ex:adult }
WHERE
  { ?this ex:age ?a }`,
    rdfData: `@prefix ex:  <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

ex:Alice rdf:type ex:Person ; ex:age 30 .
ex:Bob   rdf:type ex:Person ; ex:age 10 .`,
    shapesGraph: `@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix ex: <http://example.org/> .

# Alice (30) conforms; Bob (10) fails sh:minInclusive.
ex:AdultShape a sh:NodeShape ;
  sh:targetClass ex:Person ;
  sh:property [ sh:path ex:age ; sh:minCount 1 ; sh:minInclusive 18 ] .`,
  },
  {
    id: 'target-kinds',
    title: 'Target Kinds',
    description: 'targetSubjectsOf selects the subjects of a given predicate',
    category: 'shape-targeting',
    srlCode: `PREFIX ex: <http://example.org/>

# ex:AuthorShape targets subjects of ex:wrote — everyone who wrote something.
RULE ex:markAuthor FOR ?p IN ex:AuthorShape
  { ?p ex:role ex:author }
WHERE
  { ?p ex:wrote ?work }`,
    rdfData: `@prefix ex: <http://example.org/> .

ex:Ada ex:wrote ex:Notes .
ex:Grace ex:wrote ex:Compiler .
ex:Reader ex:read ex:Notes .`,
    shapesGraph: `@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix ex: <http://example.org/> .

# Focus nodes = subjects of any ex:wrote triple.
ex:AuthorShape a sh:NodeShape ;
  sh:targetSubjectsOf ex:wrote .`,
  },
  {
    id: 'datatype-nodekind-gate',
    title: 'Datatype & NodeKind Gate',
    description: 'Conform only when a property has the required datatype / node kind',
    category: 'shape-targeting',
    srlCode: `PREFIX ex: <http://example.org/>

# Fires only for products whose ex:sku is an IRI and ex:name is a string.
RULE ex:validProduct FOR ?p IN ex:ProductShape
  { ?p ex:status ex:valid }
WHERE
  { ?p ex:name ?n }`,
    rdfData: `@prefix ex:  <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

ex:Widget rdf:type ex:Product ; ex:name "Widget" ; ex:sku ex:SKU-1 .
ex:Gadget rdf:type ex:Product ; ex:name 42 ; ex:sku ex:SKU-2 .`,
    shapesGraph: `@prefix sh:  <http://www.w3.org/ns/shacl#> .
@prefix ex:  <http://example.org/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

# Widget conforms; Gadget fails (ex:name 42 is not a string).
ex:ProductShape a sh:NodeShape ;
  sh:targetClass ex:Product ;
  sh:property [ sh:path ex:name ; sh:datatype xsd:string ] ;
  sh:property [ sh:path ex:sku ; sh:nodeKind sh:IRI ] .`,
  },
  {
    id: 'pattern-in-hasvalue',
    title: 'Pattern / IN / hasValue Gate',
    description: 'Conform via sh:pattern (regex) and sh:in (enumerated values)',
    category: 'shape-targeting',
    srlCode: `PREFIX ex: <http://example.org/>

RULE ex:approve FOR ?o IN ex:OrderShape
  { ?o ex:approved true }
WHERE
  { ?o ex:code ?c }`,
    rdfData: `@prefix ex:  <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

ex:o1 rdf:type ex:Order ; ex:code "AB-123" ; ex:region ex:EU .
ex:o2 rdf:type ex:Order ; ex:code "bad" ; ex:region ex:EU .
ex:o3 rdf:type ex:Order ; ex:code "CD-456" ; ex:region ex:XX .`,
    shapesGraph: `@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix ex: <http://example.org/> .

# o1 conforms; o2 fails the pattern; o3 fails the region set.
ex:OrderShape a sh:NodeShape ;
  sh:targetClass ex:Order ;
  sh:property [ sh:path ex:code ; sh:pattern "^[A-Z]{2}-[0-9]+$" ] ;
  sh:property [ sh:path ex:region ; sh:in ( ex:EU ex:US ) ] .`,
  },
  {
    id: 'cardinality-gate',
    title: 'Cardinality Gate',
    description: 'Conform only when a property occurs the required number of times',
    category: 'shape-targeting',
    srlCode: `PREFIX ex: <http://example.org/>

# Fires only for teams with 2–3 members.
RULE ex:validTeam FOR ?t IN ex:TeamShape
  { ?t ex:status ex:staffed }
WHERE
  { ?t ex:member ?m }`,
    rdfData: `@prefix ex:  <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

ex:t1 rdf:type ex:Team ; ex:member ex:a , ex:b .
ex:t2 rdf:type ex:Team ; ex:member ex:c .
ex:t3 rdf:type ex:Team ; ex:member ex:d , ex:e , ex:f , ex:g .`,
    shapesGraph: `@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix ex: <http://example.org/> .

# t1 (2 members) conforms; t2 (1) and t3 (4) fail.
ex:TeamShape a sh:NodeShape ;
  sh:targetClass ex:Team ;
  sh:property [ sh:path ex:member ; sh:minCount 2 ; sh:maxCount 3 ] .`,
  },
  {
    id: 'logical-shapes',
    title: 'Logical Shapes (or / not)',
    description: 'Conform via sh:or branches while sh:not excludes a sub-shape',
    category: 'shape-targeting',
    srlCode: `PREFIX ex: <http://example.org/>

# Contactable = has an email OR a phone, and is NOT opted out.
RULE ex:contactable FOR ?p IN ex:ContactableShape
  { ?p ex:status ex:contactable }
WHERE
  { ?p ex:name ?n }`,
    rdfData: `@prefix ex:  <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

ex:Ann rdf:type ex:Person ; ex:name "Ann" ; ex:email "ann@x.org" .
ex:Ben rdf:type ex:Person ; ex:name "Ben" ; ex:phone "555-0100" ; ex:optOut true .
ex:Cat rdf:type ex:Person ; ex:name "Cat" .`,
    shapesGraph: `@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix ex: <http://example.org/> .

# Ann conforms; Ben is opted out (sh:not); Cat has neither email nor phone.
ex:ContactableShape a sh:NodeShape ;
  sh:targetClass ex:Person ;
  sh:or (
    [ sh:path ex:email ; sh:minCount 1 ]
    [ sh:path ex:phone ; sh:minCount 1 ]
  ) ;
  sh:not [ sh:path ex:optOut ; sh:hasValue true ] .`,
  },
  {
    id: 'inferred-membership',
    title: 'Sees Inferred Membership',
    description: 'A plain rule infers ex:age; the FOR gate reads it in a higher stratum',
    category: 'shape-targeting',
    srlCode: `PREFIX ex: <http://example.org/>

# Plain rule: derive age from birth year.
RULE { ?x ex:age 40 } WHERE { ?x ex:bornYear ?y }

# Targeted rule: gated on AdultShape, which reads ex:age. The stratifier places
# this ABOVE the plain rule, so the gate sees the inferred age.
RULE ex:adultStatus FOR ?this IN ex:AdultShape
  { ?this ex:status ex:adult }
WHERE
  { ?this ex:age ?a }`,
    rdfData: `@prefix ex:  <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

# Dana has no age in the data — it is inferred by the plain rule.
ex:Dana rdf:type ex:Person ; ex:bornYear 1980 .`,
    shapesGraph: `@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix ex: <http://example.org/> .

ex:AdultShape a sh:NodeShape ;
  sh:targetClass ex:Person ;
  sh:property [ sh:path ex:age ; sh:minCount 1 ; sh:minInclusive 18 ] .`,
  },
  {
    id: 'if-then-chained',
    title: 'IF..THEN + Chained Gates',
    description: 'IF/THEN FOR form; one targeted rule feeds another shape\'s predicate',
    category: 'shape-targeting',
    srlCode: `PREFIX ex: <http://example.org/>

# IF..THEN surface form with a naming IRI + FOR clause.
IF { ?this ex:bornYear ?y }
THEN ex:setAge FOR ?this IN ex:PersonShape { ?this ex:age 40 }

# Gated on AdultShape (reads ex:age) — runs after setAge in a higher stratum.
RULE ex:adultStatus FOR ?this IN ex:AdultShape
  { ?this ex:status ex:adult }
WHERE
  { ?this ex:age ?a }`,
    rdfData: `@prefix ex:  <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

ex:Erin rdf:type ex:Person ; ex:bornYear 1980 .`,
    shapesGraph: `@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix ex: <http://example.org/> .

ex:PersonShape a sh:NodeShape ; sh:targetClass ex:Person .

ex:AdultShape a sh:NodeShape ;
  sh:targetClass ex:Person ;
  sh:property [ sh:path ex:age ; sh:minCount 1 ; sh:minInclusive 18 ] .`,
  },
```

- [ ] **Step 3: Verify the build typechecks**

Run: `npm -w playground run build`
Expected: SUCCESS (0 TypeScript errors, static export completes). The new field + category + examples are pure data, so this only confirms the types line up.

- [ ] **Step 4: Commit**

```bash
git add apps/playground/src/lib/examples/examples.ts
git commit -m "feat(playground): add shape-targeting examples + shapesGraph field"
```

---

## Task 2: Engine hook wiring (validation + execution)

**Files:**
- Modify: `apps/playground/src/lib/validation/useValidation.ts`
- Modify: `apps/playground/src/lib/rules/useRuleExecution.ts`

**Interfaces:**
- Consumes: `srl-engine` `validateSRL(code, options?)`, `buildAST(code, options?)`, `executeRules(rs, data, options?)` — all accept `{ extensions?, shapesGraph? }`.
- Produces: `useValidation().validate(code: string, shapesGraph?: string)`; `useRuleExecution().execute(srlCode: string, rdfData: string, shapesGraph?: string)`.

- [ ] **Step 1: Wire `useValidation`**

In `apps/playground/src/lib/validation/useValidation.ts`, change the `validate` callback signature and the `validateSRL` call:

```ts
  const validate = useCallback((code: string, shapesGraph?: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    setIsValidating(true);

    debounceRef.current = setTimeout(() => {
      const validationResult = validateSRL(code, { extensions: true, shapesGraph });
      setResult(validationResult);
      setIsValidating(false);
    }, DEBOUNCE_DELAY);
  }, []);
```

(The rest of the hook is unchanged.)

- [ ] **Step 2: Wire `useRuleExecution`**

In `apps/playground/src/lib/rules/useRuleExecution.ts`, update the interface method signature:

```ts
  execute: (srlCode: string, rdfData: string, shapesGraph?: string) => void;
```

Update the `execute` callback signature and the two engine calls:

```ts
  const execute = useCallback((srlCode: string, rdfData: string, shapesGraph?: string) => {
    const executionId = ++executionIdRef.current;

    setIsExecuting(true);
    setError(null);

    setTimeout(() => {
      if (executionId !== executionIdRef.current) {
        return;
      }

      try {
        const parsedRuleSet = buildAST(srlCode, { extensions: true });
        setRuleSet(parsedRuleSet);

        const executionResult = executeRules(parsedRuleSet, rdfData, {
          maxIterations: 100,
          extensions: true,
          shapesGraph,
        });

        if (executionId === executionIdRef.current) {
          setResult(executionResult);

          if (executionResult.errors.length > 0) {
            setError(executionResult.errors.join('; '));
          }
        }
      } catch (e) {
        if (executionId === executionIdRef.current) {
          const errorMessage = e instanceof Error ? e.message : String(e);
          setError(errorMessage);
          setResult(null);
        }
      } finally {
        if (executionId === executionIdRef.current) {
          setIsExecuting(false);
        }
      }
    }, 0);
  }, []);
```

(The `reset` callback and the returned object are unchanged; `execute` in the return object still refers to this callback.)

- [ ] **Step 3: Verify the build typechecks**

Run: `npm -w playground run build`
Expected: SUCCESS. Note: `Playground.tsx` still calls `execute(srlCode, rdfData)` (2-arg) and `validate(srlCode)` (1-arg) — both remain valid because `shapesGraph` is optional, so this task builds green on its own. Task 3 adds the third argument.

- [ ] **Step 4: Commit**

```bash
git add apps/playground/src/lib/validation/useValidation.ts apps/playground/src/lib/rules/useRuleExecution.ts
git commit -m "feat(playground): pass extensions + shapesGraph to engine hooks"
```

---

## Task 3: Playground shapes state + Data/Shapes tabbed panel

**Files:**
- Modify: `apps/playground/src/components/Playground.tsx`

**Interfaces:**
- Consumes: `useValidation().validate(code, shapesGraph?)` and `useRuleExecution().execute(srl, rdf, shapesGraph?)` (Task 2); `Example.shapesGraph` (Task 1); the existing `RDFEditor`, `ResizablePanels`.
- Produces: no new exports — internal state + a tabbed left panel.

- [ ] **Step 1: Add shapes state + default**

In `Playground.tsx`, after the `DEFAULT_RDF` constant, add a default shapes graph:

```ts
const DEFAULT_SHAPES = `@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix ex: <http://example.org/> .

# SHACL shapes for FOR ?v IN <shape> rules (opt-in extension).
# Select a "Shape Targeting" example to see this in action.
ex:AdultShape a sh:NodeShape ;
  sh:targetClass ex:Person ;
  sh:property [ sh:path ex:age ; sh:minCount 1 ; sh:minInclusive 18 ] .
`;
```

Inside the `Playground` component, add state (next to `srlCode`/`rdfData`):

```ts
  const [shapesGraph, setShapesGraph] = useState(DEFAULT_SHAPES);
  const [activeDataTab, setActiveDataTab] = useState<'data' | 'shapes'>('data');
```

- [ ] **Step 2: Thread shapesGraph into validate + execute**

Update the validation effect to pass shapes (re-validates when either changes):

```ts
  useEffect(() => {
    validate(srlCode, shapesGraph);
  }, [srlCode, shapesGraph, validate]);
```

Update `handleRunRules`:

```ts
  const handleRunRules = useCallback(() => {
    setActiveRightTab('inferred');
    execute(srlCode, rdfData, shapesGraph);
  }, [srlCode, rdfData, shapesGraph, execute]);
```

Update `handleSelectExample` to load the example's shapes (falling back to the default so a non-FOR example resets to a harmless skeleton):

```ts
  const handleSelectExample = useCallback((example: Example) => {
    setSrlCode(example.srlCode);
    if (example.rdfData) {
      setRdfData(example.rdfData);
    }
    setShapesGraph(example.shapesGraph ?? DEFAULT_SHAPES);
    resetExecution();
  }, [resetExecution]);
```

- [ ] **Step 3: Build the tabbed left panel**

Replace the `leftPanel={ <RDFEditor value={rdfData} onChange={setRdfData} theme={theme} /> }` prop passed to `ResizablePanels` with a tabbed wrapper. Define it inline (single-line `className` strings per the hydration gotcha):

```tsx
                leftPanel={
                  <div className="h-full flex flex-col">
                    <div role="tablist" aria-label="Graph editors" className="shrink-0 flex border-b border-border bg-surface-2">
                      <button
                        role="tab"
                        aria-selected={activeDataTab === 'data'}
                        onClick={() => setActiveDataTab('data')}
                        className={activeDataTab === 'data' ? 'px-3 py-1.5 text-xs font-medium text-ink border-b-2 border-blue-500' : 'px-3 py-1.5 text-xs font-medium text-ink-muted hover:text-ink'}
                      >
                        Data
                      </button>
                      <button
                        role="tab"
                        aria-selected={activeDataTab === 'shapes'}
                        onClick={() => setActiveDataTab('shapes')}
                        className={activeDataTab === 'shapes' ? 'px-3 py-1.5 text-xs font-medium text-ink border-b-2 border-blue-500' : 'px-3 py-1.5 text-xs font-medium text-ink-muted hover:text-ink'}
                      >
                        Shapes
                      </button>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      {activeDataTab === 'data' ? (
                        <RDFEditor value={rdfData} onChange={setRdfData} theme={theme} />
                      ) : (
                        <RDFEditor value={shapesGraph} onChange={setShapesGraph} theme={theme} />
                      )}
                    </div>
                  </div>
                }
```

Also update the `leftTitle` on `ResizablePanels` from `"Data Graph (Turtle)"` to `"Data / Shapes (Turtle)"` so the panel header reflects the tabs.

Note: both branches render an `RDFEditor` with swapped `value`/`onChange`. React keeps a single editor mount because the element type + position match — switching tabs re-renders it with the other tab's content (per-tab scroll/focus is not preserved, which is acceptable).

- [ ] **Step 4: Verify the build typechecks**

Run: `npm -w playground run build`
Expected: SUCCESS. The 3-arg `execute` / 2-arg `validate` calls now match the Task 2 signatures.

- [ ] **Step 5: Commit**

```bash
git add apps/playground/src/components/Playground.tsx
git commit -m "feat(playground): Data/Shapes editor tabs + thread shapes graph"
```

---

## Task 4: Monaco `FOR` keyword support

**Files:**
- Modify: `apps/playground/src/lib/monaco/srl-language.ts`

**Interfaces:**
- Produces: `FOR` recognized as a keyword (highlighting), a hover doc entry, and a completion item.

- [ ] **Step 1: Add `FOR` to the tokenizer keyword list**

In `apps/playground/src/lib/monaco/srl-language.ts`, in the `keywords` array (the one containing `"IN"`, `"TRANSITIVE"`, `"SYMMETRIC"` near line 48-61), add `"FOR"`:

```ts
      "IN",
      "FOR",
      "TRANSITIVE",
```

- [ ] **Step 2: Add a `FOR` hover doc**

In the `keywordDocs` record (near line 508-590, alongside the `IN` / `TRANSITIVE` / `SYMMETRIC` entries), add:

```ts
        FOR: {
          description:
            "Targets a rule to a SHACL shape (opt-in extension). The rule fires once per focus node that conforms to the shape, with the focus variable pre-bound.",
          syntax: "RULE iri? FOR ?var IN <shape> { … } WHERE { … }",
        },
```

Match the exact shape of the surrounding entries (they use `description` and `syntax` keys — verify against the `IN`/`SYMMETRIC` entries and mirror their structure exactly).

- [ ] **Step 3: Add `FOR` to the completion keyword list**

In the completion provider's `keywords` array (near line 690-703, the second list containing `"IN"`, `"TRANSITIVE"`), add `"FOR"`:

```ts
        "IN",
        "FOR",
        "TRANSITIVE",
```

Optionally, add a `FOR … IN` snippet completion alongside the `TRANSITIVE`/`SYMMETRIC` snippet entries (near line 834-861). Only add this if the surrounding snippet entries make it a clean fit; the plain keyword completion from the list above is sufficient:

```ts
        {
          label: "FOR ?var IN shape",
          insertText: "FOR ?${1:this} IN ${2:shape}",
          documentation: "Shape-targeting clause (opt-in extension)",
        },
```

(Match the exact object shape / `insertTextRules` used by the neighboring snippet entries — inspect them first and mirror; do not invent fields.)

- [ ] **Step 4: Verify the build typechecks**

Run: `npm -w playground run build`
Expected: SUCCESS.

- [ ] **Step 5: Commit**

```bash
git add apps/playground/src/lib/monaco/srl-language.ts
git commit -m "feat(playground): FOR keyword highlighting, hover, completion in Monaco"
```

---

## Task 5: End-to-end verification (dev smoke)

**Files:** none (verification only).

- [ ] **Step 1: Production build gate**

Run: `npm -w playground run build`
Expected: SUCCESS — 0 TypeScript errors, static export to `apps/playground/out/` completes.

- [ ] **Step 2: Dev smoke — FOR examples**

Run: `npm run dev` (from repo root; serves the playground at http://localhost:3000).

For EACH of the 8 `shape-targeting` examples (from the "Shape Targeting (FOR … IN)" sidebar category), confirm:
- It loads (SRL + Data + Shapes tab all populate).
- The Validation panel shows **valid** (green — no "opt-in extension" error).
- Clicking **Run Rules** produces the expected inferred triples with no execution error:
  - `adult-gate`: `ex:Alice ex:status ex:adult` present; `ex:Bob ex:status ex:adult` absent.
  - `target-kinds`: `ex:Ada ex:role ex:author` and `ex:Grace ex:role ex:author` present; `ex:Reader` absent.
  - `datatype-nodekind-gate`: `ex:Widget ex:status ex:valid` present; `ex:Gadget` absent.
  - `pattern-in-hasvalue`: `ex:o1 ex:approved true` present; `ex:o2`, `ex:o3` absent.
  - `cardinality-gate`: `ex:t1 ex:status ex:staffed` present; `ex:t2`, `ex:t3` absent.
  - `logical-shapes`: `ex:Ann ex:status ex:contactable` present; `ex:Ben`, `ex:Cat` absent.
  - `inferred-membership`: both `ex:Dana ex:age 40` and `ex:Dana ex:status ex:adult` present.
  - `if-then-chained`: both `ex:Erin ex:age 40` and `ex:Erin ex:status ex:adult` present.
- The `FOR` keyword highlights in the SRL editor; hovering it shows the doc.

If any example's actual output differs, fix the example's shapes/data/rules in `examples.ts` (they must stay within the supported SHACL Core subset) and re-run — do not weaken the expectation.

- [ ] **Step 3: Backward-compat smoke — non-FOR examples**

Load 3 pre-existing examples from other categories (e.g. `child-of`, `ancestor`, `concat-names`). Confirm each still validates and Run Rules infers as before (the always-on `extensions: true` must not change plain-rule behavior).

- [ ] **Step 4: Commit (if any example fixes were needed)**

```bash
git add apps/playground/src/lib/examples/examples.ts
git commit -m "fix(playground): correct shape-targeting example content per dev smoke"
```

If no fixes were needed, there is nothing to commit for this task — record the verification result in the task report instead.

---

## Notes for the implementer

- **No app test runner** — `npm -w playground run build` (Next build = tsc + static export) is the per-task gate; Task 5 is the behavioral gate via `npm run dev`. Do not look for or add a Vitest/Jest setup for the app.
- **`className` single-line rule** is real (React 19 hydration) — the tab buttons in Task 3 use single-line ternary `className` strings on purpose; keep them single-line.
- **Example correctness** is anchored to the engine's supported subset and its oracle tests (`packages/srl-engine/test/shape-targeting.test.ts`, GUIDE §14). The `adult-gate`, `inferred-membership`, and `if-then-chained` examples mirror the oracle's `test_targeted_rule_fires_only_for_conforming_focus_nodes`, `..._sees_inferred_target_membership`, and `..._head_feeds_another_targeted_gate` respectively.
- **Always-on extensions** cannot break non-FOR examples: `extensions: true` only *enables* the `FOR` grammar/evaluation; with no `FOR` clause, `targetedRules` is empty and the shapes graph is never consulted.
- If `npm run dev` isn't feasible in the execution environment, the implementer should say so and rely on the production build gate + a note that manual dev smoke remains outstanding — do not silently skip Step 2 and claim it passed.
