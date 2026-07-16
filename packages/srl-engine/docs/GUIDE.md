# `srl-engine` — How-To Guide

A practical guide to using the **SHACL 1.2 Rules** engine as a standalone
library. If you just want the API reference, see the package
[`README.md`](../README.md). This document walks through the full pipeline —
parse, validate, execute — with runnable snippets and the semantics behind each
step.

> Runnable versions of every snippet below live in
> [`../examples/`](../examples/). See [that README](../examples/README.md) to
> run them.

---

## Table of contents

1. [What the engine does](#1-what-the-engine-does)
2. [Install & import](#2-install--import)
3. [The pipeline at a glance](#3-the-pipeline-at-a-glance)
4. [Validating SRL](#4-validating-srl)
5. [Building the AST](#5-building-the-ast)
6. [Executing rules](#6-executing-rules)
7. [Reading the results](#7-reading-the-results)
8. [SRL language cheat-sheet](#8-srl-language-cheat-sheet)
9. [Working with the RDF store directly](#9-working-with-the-rdf-store-directly)
10. [Stratification](#10-stratification)
11. [Error handling](#11-error-handling)
12. [Recipes](#12-recipes)
13. [Gotchas & limits](#13-gotchas--limits)

---

## 1. What the engine does

Given a set of **SRL rules** and an **RDF data graph** (Turtle), the engine
computes the triples the rules infer — running to a fixed point — and returns
each inferred triple together with the rule that produced it (provenance).

```
  SRL text ──▶ validateSRL ──▶ diagnostics (errors / warnings / info)
  SRL text ──▶ buildAST ─────▶ typed RuleSet
  RuleSet + RDF ──▶ executeRules ──▶ inferred triples (+ provenance)
```

It is pure TypeScript with two runtime dependencies: `chevrotain` (lexer +
parser) and `n3` (RDF store). No DOM, no framework — it runs in Node, a Web
Worker, or any bundler target.

---

## 2. Install & import

```bash
npm install srl-engine
```

ESM:

```ts
import { validateSRL, buildAST, executeRules } from 'srl-engine';
```

CommonJS:

```js
const { validateSRL, buildAST, executeRules } = require('srl-engine');
```

The package ships dual ESM + CJS builds with TypeScript declarations, so both
import styles get full types.

---

## 3. The pipeline at a glance

The three entry points are independent — you can call any one of them alone —
but the typical flow validates first, then builds, then executes:

```ts
import { validateSRL, buildAST, executeRules } from 'srl-engine';

const srl = `PREFIX : <http://example.org/>
RULE { ?x :childOf ?y } WHERE { ?y :parentOf ?x }`;

const data = `@prefix : <http://example.org/> .
:john :parentOf :mary .`;

// 1. Validate — cheap, safe to run on every keystroke.
const report = validateSRL(srl);
if (!report.isValid) {
  for (const m of report.messages) {
    console.error(`${m.type} @ ${m.startLine}:${m.startColumn} — ${m.message}`);
  }
  process.exit(1);
}

// 2. Build the typed AST (only meaningful once validation is clean).
const ruleSet = buildAST(srl);

// 3. Execute against the data graph.
const result = executeRules(ruleSet, data);
console.log(`${result.inferredTriples.length} triples inferred`);
// → :mary :childOf :john
```

**Why validate before executing?** `executeRules` never throws for rule-level
problems (it collects them into `result.errors`), but a ruleset that fails
validation — an unbound head variable, a non-stratifiable cycle — will infer
nothing useful. Validation gives you precise, located diagnostics first.

---

## 4. Validating SRL

`validateSRL(text: string): ValidationResult` runs the full diagnostic stack:

1. **Lexer errors** — illegal characters / tokens.
2. **Parser errors** — grammar violations (with token positions).
3. **Prefix checks** — undefined-prefix warnings, duplicate-prefix notices.
4. **Well-formedness (spec §4.2)** — on the AST, only when the parse is clean.
5. **Stratification** — rejects cycles that contain a "closed" dependency edge.

```ts
interface ValidationResult {
  messages: ValidationMessage[];
  parseTime: number;   // ms
  isValid: boolean;    // true ⇔ zero messages of type 'error'
}

interface ValidationMessage {
  type: 'error' | 'warning' | 'info';
  message: string;
  startLine: number;   // 1-based
  startColumn: number; // 1-based
  endLine: number;
  endColumn: number;
}
```

`isValid` is `true` only when there are **no `error` messages**; warnings
(e.g. an undefined prefix) and info notices (e.g. a duplicate prefix) do not
flip it to `false`.

The §4.2 well-formedness rules the validator enforces:

- **Head variables** must be bound by a body pattern or a `SET`.
- **`FILTER` / `SET` expression variables** must be in scope from a
  strictly-earlier body element (left-to-right).
- **`SET` variables** are single-assignment — a new variable, no forward
  reference.
- **`NOT`-scoped variables** don't leak into the outer scope.
- **`DATA` blocks** must be ground (no variables).
- **Function names** must be in the spec `[121]` built-in set.

```ts
const bad = `PREFIX : <http://example.org/>
RULE { :x :q ?missing } WHERE { :s :p ?o }`;   // ?missing not bound in body

const r = validateSRL(bad);
console.log(r.isValid);                          // false
console.log(r.messages[0].message);
// → "Variable '?missing' in rule head is not bound in rule body"
```

---

## 5. Building the AST

`buildAST(text: string): RuleSet` lexes, parses, and walks the CST into a typed
`RuleSet`. It **throws** on a parse error — always validate first, or wrap it in
`try/catch`.

```ts
interface RuleSet {
  prefixes: Map<string, string>;          // prefix → namespace IRI ('' = default)
  base?: string;
  rules: Rule[];
  declarations: Declaration[];            // TRANSITIVE / SYMMETRIC / INVERSE
  dataBlocks: DataBlock[];                // DATA { … } ground triples
  imports?: string[];
  version?: string;
}
```

Every node carries a `location: SourceLocation` (`startLine`/`startColumn`/
`endLine`/`endColumn`) so you can map anything back to source.

If you only need the concrete syntax tree or the token stream (e.g. for
highlighting), use `parseSRL(text)` instead — it returns
`{ tokens, cst, errors }` and does not throw.

---

## 6. Executing rules

`executeRules(ruleSet: RuleSet, rdfData: string, options?: ExecutorOptions):
ExecutionResult`

```ts
interface ExecutorOptions {
  maxIterations?: number;      // fixed-point cap per stratum (default 100)
  includeBaseTriples?: boolean; // ⚠ currently INERT — see Gotchas
}
```

What it does, in order:

1. **Parses `rdfData`** (Turtle) into an N3 store — this is `G0`, the base
   graph. Parse failures are collected into `result.errors`, not thrown.
2. **Expands declarations** — `TRANSITIVE` / `SYMMETRIC` / `INVERSE` become
   ordinary synthetic rules (`INVERSE` expands to two).
3. **Seeds `DATA` blocks** — ground `DATA` triples not already in `G0` are
   recorded as inferred output, attributed to a synthetic rule named
   **`"DATA block"`**.
4. **Stratifies** the rule set and, per stratum, runs "run-once" rules once,
   then iterates the general rules to a fixed point (capped at
   `maxIterations`).
5. Returns every newly inferred triple with the rule that produced it.

```ts
const result = executeRules(ruleSet, data);

interface ExecutionResult {
  inferredTriples: InferredTriple[];  // NEW triples only (not in G0)
  baseTriples: Quad[];                // the parsed G0 triples
  totalTriples: number;               // store size after inference
  iterations: number;                 // total iterations across all strata
  executionTime: number;              // ms
  ruleInfos: RuleInfo[];              // every rule (incl. expanded + DATA)
  errors: string[];                   // per-rule / parse errors (never thrown)
}
```

Base triples are **not** included in `inferredTriples` — only genuinely new
facts. Grab the full output graph from the base + inferred, or read
`totalTriples` for the count.

---

## 7. Reading the results

Each `InferredTriple` carries the quad, a stringified form, its source rule, and
the iteration it appeared in:

```ts
interface InferredTriple {
  quad: Quad;              // n3 Quad
  quadString: string;      // "<s> <p> <o>" (IRIs in angle brackets)
  sourceRule: RuleInfo;    // which rule produced it
  iteration: number;       // 0 = DATA block / first pass
}

interface RuleInfo {
  index: number;
  name: string;            // rule name, or a generated "Rule N: <localName>"
  location?: SourceLocation;
  head: TriplePattern[];
  originalRule: Rule;
}
```

Group inferred triples by the rule that produced them:

```ts
const byRule = new Map<string, string[]>();
for (const t of result.inferredTriples) {
  const list = byRule.get(t.sourceRule.name) ?? [];
  list.push(t.quadString);
  byRule.set(t.sourceRule.name, list);
}
for (const [rule, triples] of byRule) {
  console.log(`${rule}:`);
  for (const s of triples) console.log(`  ${s}`);
}
```

For human-readable, prefix-collapsed output use `formatTripleForDisplay`:

```ts
import { formatTripleForDisplay } from 'srl-engine';

for (const t of result.inferredTriples) {
  const { subject, predicate, object } =
    formatTripleForDisplay(t.quad, ruleSet.prefixes);
  console.log(`${subject} ${predicate} ${object}`);   // :mary :childOf :john
}
```

---

## 8. SRL language cheat-sheet

The engine accepts the current W3C SHACL 1.2 Rules surface syntax. Quick
reference (see the [W3C spec](https://w3c.github.io/shacl/shacl-rules/) for the
full grammar):

| Construct | Syntax |
|-----------|--------|
| Rule (WHERE form) | `RULE { head } WHERE { body }` |
| Rule (IF form) | `IF { body } THEN { head }` |
| Named rule | `RULE :ruleIri { head } WHERE { body }` |
| Prefix | `PREFIX : <http://example.org/>` |
| Filter | `FILTER( ?x > 10 )` |
| Negation | `NOT { … }` |
| Assignment | `SET( ?v := <expr> )` |
| Ground data | `DATA { :s :p :o . }` |
| Transitive | `TRANSITIVE(:prop)` |
| Symmetric (postfix!) | `(:prop) SYMMETRIC` |
| Inverse | `INVERSE(:p1, :p2)` |
| Path — sequence | `?s :a/:b ?o` |
| Path — inverse | `?s ^:p ?o` |
| `rdf:type` shorthand | `?s a :Type` |

Body elements are evaluated **left to right**: a `FILTER` or `SET` only sees
variables bound by strictly-earlier elements. A `SET` whose expression errors
drops that solution.

Built-in functions are restricted to the spec `[121]` set (e.g. `STR`, `CONCAT`,
`SUBSTR`, `REGEX`, `LANG`, `LANGMATCHES`, `STRDT`, `STRLANG`, `IF`, `NOW`,
`ABS`, `ROUND`, `ISIRI`, …). `BOUND`, `RAND`, `COALESCE`, `MD5`/`SHA*`, and
aggregates are **not** built-ins and are rejected by the validator.

---

## 9. Working with the RDF store directly

The engine parses Turtle for you, but the term-conversion and matching helpers
are exported if you need to build tooling on top of it:

```ts
import {
  termToN3,          // AST RDFTerm → n3 Term
  n3TermToRDFTerm,   // n3 Term → AST RDFTerm
  termsEqual,        // structural term equality
  quadToString,      // Quad → "<s> <p> <o>"
  termToString,      // Term → its N-Triples-ish string
  triplePatternToString,
  isVariable, isRDFTerm, isTriplePattern, getPatternVariables,
  PatternMatcher,    // graph matching over an n3 Store
} from 'srl-engine';
```

`PatternMatcher` wraps an n3 `Store` and joins triple patterns into solution
mappings — useful if you want to run the engine's pattern matching without the
full rule loop.

---

## 10. Stratification

Recursive rules with negation must be **stratifiable** — you can't have a rule
whose output feeds a `NOT` that gates the same rule (that's a paradox). The
engine models this as open/closed dependency edges and rejects any cycle that
contains a closed edge.

```ts
import { isStratifiable, stratifyRules } from 'srl-engine';

const check = isStratifiable(ruleSet.rules);
if (!check.stratifiable) {
  console.error(check.reason);   // e.g. cycle through a NOT / SET / bnode head
}

// The layers the executor uses internally:
const layers = stratifyRules(ruleSet.rules);
// layers[i] = { once: StratifiedRule[]; general: StratifiedRule[] }
```

An edge R1→R2 is **closed** when R2's head could match a pattern inside a `NOT`
of R1, **or** R1 has a `SET`, **or** R1's head contains a blank node.
`validateSRL` runs this check and surfaces a non-stratifiable set as an error.

**Common trap — self-negation.** A rule whose head writes property `:p` and
whose body has `NOT { ?x :p … }` negates its own output — a closed self-cycle
that fails stratification ("a recursive dependency involves a closed
dependency"). If you want a "default value only when absent" pattern, gate on a
*different* property than the one you write (e.g. head writes `:displayName`,
`NOT` checks `:hasCustomName`). See `examples/03-negation-and-set.mjs`.

> Note: `validateSRL` bundles the stratification check into its single
> `isValid` verdict. A rule set that is well-formed per §4.2 but
> non-stratifiable reports `isValid: false`. See
> [`../../../docs/BACKLOG.md`](../../../docs/BACKLOG.md) if you need §4.2-only
> well-formedness separated from stratifiability.

---

## 11. Error handling

| Function | On bad input |
|----------|--------------|
| `validateSRL` | Never throws. Returns messages; `isValid` reflects them. |
| `parseSRL` | Never throws. Errors in the returned `errors` array. |
| `buildAST` | **Throws** on parse error. Validate first or wrap in try/catch. |
| `executeRules` | Never throws for rule/parse problems — collects into `result.errors`. A malformed `rdfData` string yields a parse error there, not an exception. |

Defensive pattern:

```ts
function run(srl: string, data: string) {
  const report = validateSRL(srl);
  if (!report.isValid) return { ok: false as const, messages: report.messages };

  const result = executeRules(buildAST(srl), data);
  if (result.errors.length) return { ok: false as const, errors: result.errors };

  return { ok: true as const, inferred: result.inferredTriples };
}
```

---

## 12. Recipes

**Compute the full output graph (base + inferred) as Turtle-ish strings:**

```ts
const result = executeRules(ruleSet, data);
const all = [
  ...result.baseTriples.map(quadToString),
  ...result.inferredTriples.map(t => t.quadString),
];
```

**Only run rules if the source is valid:**

```ts
const report = validateSRL(srl);
const inferred = report.isValid
  ? executeRules(buildAST(srl), data).inferredTriples
  : [];
```

**Cap runaway recursion:**

```ts
executeRules(ruleSet, data, { maxIterations: 25 });
```

**Inspect what a declaration expands into:**

```ts
import { expandDeclarations } from 'srl-engine';
const synthetic = expandDeclarations(ruleSet.declarations, ruleSet.prefixes);
// e.g. TRANSITIVE(:p) → one recursive rule; INVERSE(:a,:b) → two rules
```

---

## 13. Gotchas & limits

- **`ExecutorOptions.includeBaseTriples` is currently inert** — it is declared
  and defaulted but never read; `inferredTriples` always excludes base triples.
  Tracked in [`docs/BACKLOG.md`](../../../docs/BACKLOG.md). To get base +
  inferred, concatenate `baseTriples` and `inferredTriples` yourself (see
  Recipes).
- **`DATA` block provenance** — triples seeded from `DATA { … }` are attributed
  to a synthetic `RuleInfo` whose `name` is the literal string `"DATA block"`
  and whose `iteration` is `0`.
- **`buildAST` throws** — the other entry points don't. Don't call it on
  unvalidated input without a try/catch.
- **Deferred syntax** — RDF-1.2 rich terms (reification `<< >>`/`<<( )>>`,
  collections `( )`/`[ ]`, annotations `{| |}`, reifier `~`) and extended
  property paths (`*`/`+`/`?`/`|`, negated property sets) are **not** parsed —
  they produce validation errors. See
  [`docs/BACKLOG.md`](../../../docs/BACKLOG.md) for the full deferred list.
- **`NOT`-body `FILTER` needs a separating dot** — inside a `NOT { … }`, an
  inline `FILTER` after a triple pattern currently requires a `.` before it,
  stricter than the spec grammar. Tracked in the backlog.
- **`parserInstance` is a stateful singleton** — the engine is single-threaded
  by design (fine for the browser/Node request model). Don't call `parseSRL` /
  `buildAST` concurrently from multiple threads sharing one module instance.
