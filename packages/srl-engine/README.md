# srl-engine

**Parser, validator, and inference engine for [SHACL 1.2 Rules](https://w3c.github.io/shacl/shacl-rules/) written in SRL (Shape Rules Language).**

[![npm](https://img.shields.io/npm/v/srl-engine?style=flat-square)](https://www.npmjs.com/package/srl-engine)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](../../LICENSE)

Pure TypeScript. Two runtime dependencies — [`chevrotain`](https://chevrotain.io)
(lexer/parser) and [`n3`](https://github.com/rdfjs/N3.js) (RDF store). **No DOM,
no framework** — runs in Node, a Web Worker, or any bundler target. Ships dual
ESM + CJS builds with full type declarations.

Given SRL rules and an RDF data graph, the engine computes the triples the rules
infer — running to a fixed point — and returns each inferred triple with the
rule that produced it (provenance).

## Install

```bash
npm install srl-engine
```

## Usage

```ts
import { validateSRL, buildAST, executeRules } from 'srl-engine';

const srl = `PREFIX : <http://example.org/>
RULE { ?x :childOf ?y } WHERE { ?y :parentOf ?x }`;

const data = `@prefix : <http://example.org/> .
:john :parentOf :mary .`;

// 1. Validate — lexer/parser errors + §4.2 well-formedness + stratification.
const report = validateSRL(srl);
if (!report.isValid) throw new Error(report.messages[0].message);

// 2. Build the typed RuleSet AST (throws on parse error).
const ruleSet = buildAST(srl);

// 3. Run the rules against the RDF data → inferred triples with provenance.
const result = executeRules(ruleSet, data);
for (const t of result.inferredTriples) {
  console.log(t.quadString, '←', t.sourceRule.name);
}
// → <http://example.org/mary> <http://example.org/childOf> <http://example.org/john>  ← Rule 1: childOf
```

CommonJS works too: `const { validateSRL } = require('srl-engine');`

## Features

- **Full SRL front end** — Chevrotain lexer + CST parser + typed AST builder for
  the current W3C SHACL 1.2 Rules grammar.
- **Two rule forms** — `RULE iri? { head } WHERE { body }` and
  `IF { body } THEN { head }`.
- **Shorthand declarations** — `TRANSITIVE(:p)`, postfix `(:p) SYMMETRIC`,
  `INVERSE(:p, :q)` (expanded into rules at run time).
- **Property paths** — sequence (`/`) and inverse (`^`) in rule bodies.
- **§4.2 well-formedness** — variable scoping, single-assignment `SET`,
  non-leaking `NOT`, head-var binding, ground `DATA`, `[121]` built-ins.
- **Fixed-point engine** — open/closed-dependency stratification, run-once vs
  general layers, `DATA`-block seeding, pinned `NOW()`, per-triple provenance.
- **Fully typed** — every AST, result, and diagnostic type is exported.

## API

Values:

| Export | Purpose |
| ------ | ------- |
| `parseSRL(text)` | Lex + CST parse; returns `{ tokens, cst, errors }` (never throws). |
| `buildAST(text)` | Parse + walk the CST into a typed `RuleSet` (**throws** on parse error). |
| `validateSRL(text)` | Full diagnostics: lexer/parser, §4.2 well-formedness, stratification (never throws). |
| `executeRules(ruleSet, rdfData, options?)` | Fixed-point inference → inferred triples + provenance (never throws; collects `errors`). |
| `stratifyRules(rules)` / `isStratifiable(rules)` | Open/closed dependency stratification. |
| `expandDeclarations(decls, prefixes)` | Rewrite `TRANSITIVE`/`SYMMETRIC`/`INVERSE` into ordinary rules. |
| `formatTripleForDisplay(quad, prefixes)` | Prefix-collapsed S/P/O strings for UIs. |
| `getSerializedGrammar()` / `getGrammarRuleNames()` | Grammar introspection (railroad diagrams etc.). |
| `SRLLexer`, `allTokens` | The Chevrotain lexer + token list. |
| RDF helpers | `PatternMatcher`, `termToN3`, `n3TermToRDFTerm`, `termsEqual`, `quadToString`, `termToString`, `triplePatternToString`, `isVariable`, `isRDFTerm`, `isTriplePattern`, `getPatternVariables`. |

Types (all exported): `RuleSet`, `Rule`, `RuleHead`, `RuleBody`, `TriplePattern`,
`BodyElement`, `FilterElement`, `AssignmentElement`, `NegationElement`, `RDFTerm`
and its variants, `Declaration` (+ `Transitive`/`Symmetric`/`Inverse`),
`DataBlock`, `Expression`, `PathExpression`, `SourceLocation`, `ParseResult`,
`GrammarRuleInfo`, `ExecutionResult`, `InferredTriple`, `RuleInfo`,
`ExecutorOptions`, `StratificationLayer`, `StratifiedRule`, `StratificationCheck`,
`ValidationResult`, `ValidationMessage`, `SolutionMapping`, `EvalResult`.

See [`src/index.ts`](src/index.ts) for the complete surface.

## Learn more

- **[How-To Guide](docs/GUIDE.md)** — the full pipeline (validate → build →
  execute), semantics, an SRL cheat-sheet, recipes, and gotchas.
- **[Examples](examples/)** — six runnable scripts (`node examples/01-….mjs`),
  from basic inference to provenance.
- **[Publishing](PUBLISHING.md)** — step-by-step npm release procedure.
- **[Backlog](../../docs/BACKLOG.md)** — known bugs, deferred features, and
  release follow-ups.

## SHACL shape targeting (opt-in extension)

The engine includes an opt-in extension — **not part of W3C SHACL 1.2 Rules** —
that ties a rule to a [SHACL](https://www.w3.org/TR/shacl/) shape so the rule
fires only for the shape's conforming focus nodes.

**Off by default.** Without `{ extensions: true }`, `FOR` is a syntax error and
`executeRules` ignores any targeted rules — spec-conformant code is unaffected.

### Syntax

```srl
PREFIX ex: <http://example.org/>

RULE ex:adultStatus FOR ?this IN ex:AdultShape
  { ?this ex:status ex:adult }
WHERE
  { ?this ex:age ?a }
```

`FOR ?this IN ex:AdultShape` pre-binds `?this` to each node that **conforms**
to `ex:AdultShape` in the supplied shapes graph. The body and head are the
standard rule machinery — they see `?this` as already bound.

### API

```ts
import { buildAST, validateSRL, executeRules } from 'srl-engine';

// 1. Parse with extension syntax enabled.
const ruleSet = buildAST(srl, { extensions: true });

// 2. Validate (optional but recommended).
const report = validateSRL(srl, { extensions: true });

// 3. Execute — supply the shapes graph as a Turtle string (shapesGraph)
//    or a pre-parsed n3 Store (shapesStore).
const result = executeRules(ruleSet, data, {
  extensions: true,
  shapesGraph: shapesTurtle,   // or: shapesStore: myStore
});
```

### Example

```ts
const shapes = `
  @prefix sh: <http://www.w3.org/ns/shacl#> .
  @prefix ex: <http://example.org/> .
  ex:AdultShape a sh:NodeShape ;
    sh:targetClass ex:Person ;
    sh:property [ sh:path ex:age ; sh:minCount 1 ; sh:minInclusive 18 ] .`;

const srl = `PREFIX ex: <http://example.org/>
RULE ex:adultStatus FOR ?this IN ex:AdultShape
  { ?this ex:status ex:adult }
WHERE
  { ?this ex:age ?a }`;

const data = `
  @prefix ex: <http://example.org/> .
  @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
  ex:Alice rdf:type ex:Person ; ex:age 30 .
  ex:Bob   rdf:type ex:Person ; ex:age 10 .`;

const result = executeRules(buildAST(srl, { extensions: true }), data, {
  extensions: true,
  shapesGraph: shapes,
});
// Inferred: ex:Alice ex:status ex:adult   (Alice age 30 ≥ 18 → conforms)
// NOT inferred for Bob (age 10 < 18 → does not conform to AdultShape)
```

The supported SHACL Core subset is documented in
[`docs/shacl-core-support-matrix.md`](docs/shacl-core-support-matrix.md).
For a full worked example see [`examples/07-for-in-shape.mjs`](examples/07-for-in-shape.mjs)
and the [How-To Guide §14](docs/GUIDE.md#14-shacl-shape-targeting-opt-in-extension).

## Scope

Implements the current W3C SHACL 1.2 Rules surface syntax and semantics.
**Deferred** (parse to errors today): RDF-1.2 rich terms (reification
`<< >>`/`<<( )>>`, collections `( )`/`[ ]`, annotations `{| |}`) and extended
property paths (`*`/`+`/`?`/`|`, negated property sets). Built-ins are restricted
to the spec `[121]` set. The complete list of deferred features and known issues
lives in [`docs/BACKLOG.md`](../../docs/BACKLOG.md).

Syntax and semantics are validated against the
[`w3c/data-shapes`](https://github.com/w3c/data-shapes) rules test suite.

## Development

Run from the monorepo root:

```bash
npm -w srl-engine run build       # tsup → dist/ (ESM + CJS + .d.ts + .d.cts)
npm -w srl-engine test            # vitest (facade smoke + W3C fixtures)
npm -w srl-engine run typecheck   # tsc --noEmit
```

Releasing to npm: see [`PUBLISHING.md`](PUBLISHING.md) (detailed) or
[`../../RELEASING.md`](../../RELEASING.md) (condensed + CI/changesets/UMD).

## License

MIT.
