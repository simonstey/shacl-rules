<div align="center">

# SHACL Rules Playground

**A web-based playground for authoring and executing [SHACL 1.2 Rules](https://w3c.github.io/shacl/shacl-rules/) using SRL (Shape Rules Language)**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](../../LICENSE)

[Features](#features) • [Getting Started](#getting-started) • [SRL Language](#srl-language-reference) • [Supported Features](#supported-features) • [Not Yet Implemented](#not-yet-implemented)

</div>

---

> **Monorepo note:** this is the **playground app** (`apps/playground`). The SRL
> parser, validator, and inference engine live in the sibling package
> [`srl-engine`](../../packages/srl-engine/) and are imported as `srl-engine` —
> not from `@/lib/*`. This app holds the UI: Monaco editors, React hooks, and
> the examples. See the [repo root README](../../README.md) for the whole
> monorepo, and [`RELEASING.md`](../../RELEASING.md) for publishing the engine.

## Overview

SHACL Rules Playground is an interactive editor for writing and testing
**SHACL 1.2 Rules** — a W3C specification for defining inference rules over RDF
graphs. It provides:

- **Dual Monaco editors** for RDF data (Turtle) and SRL rules side-by-side
- **Real-time syntax validation** with error highlighting and semantic analysis
- **Rule execution** with fixed-point evaluation and stratification (via `srl-engine`)
- **Inferred-triples panel** showing provenance for each derived fact
- **Built-in examples** covering common inference patterns
- **Syntax-diagram panel** rendering the live grammar as railroad diagrams

All parsing, validation, and execution is delegated to the
[`srl-engine`](../../packages/srl-engine/) package; the app is a thin,
client-side UI over it.

## Features

- **Powered by `srl-engine`** — the full Chevrotain-based lexer/parser, AST-based
  §4.2 well-formedness, and fixed-point inference engine, imported as a library
- **Live validation** — errors, warnings (undefined prefixes), and info notices
  as Monaco markers, debounced on every keystroke
- **Monaco integration** — syntax highlighting, hover docs, and code completion
  for SRL (kept in sync with the engine grammar)
- **Two rule forms** — `RULE iri? { head } WHERE { body }` (optional naming IRI)
  and `IF { body } THEN { head }`
- **Shorthand declarations** — `TRANSITIVE(:p)`, postfix `(:p) SYMMETRIC`, and
  `INVERSE(:p, :q)`
- **Light & dark themes** — token-based theming (CSS variables) that persists your
  choice and seeds from your OS preference on first load
- **Responsive layout** — resizable panels that stack vertically on narrow
  viewports; the examples sidebar auto-collapses
- **Accessible** — WCAG 2.1 AA: sufficient contrast in both themes,
  keyboard-operable controls with visible focus, ARIA labels/roles, and
  `prefers-reduced-motion` support

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 20 or later
- npm (workspaces)

### Installation

Run from the **repo root** (the app is a workspace — installing at the root links
it to the local `srl-engine`):

```bash
git clone https://github.com/simonstey/shacl-rules.git
cd shacl-rules
npm install            # installs all workspaces

npm run dev            # start the playground dev server
```

Open [http://localhost:3000](http://localhost:3000).

### Available commands

Run these from the repo root. `npm run dev` is a root convenience alias; the rest
are workspace-scoped with `-w playground`.

| Command | Description |
| ------- | ----------- |
| `npm run dev` | Development server with hot reload |
| `npm -w playground run build` | Production build → static export in `apps/playground/out/` |
| `npm -w playground run lint` | Run ESLint |

> `next.config.ts` sets `output: "export"` (static site) and
> `transpilePackages: ['srl-engine']` (so dev reads the engine's TypeScript
> source directly). `npm run start` exists but is unused — serve `out/`
> statically instead.

## SRL Language Reference

SRL (Shape Rules Language) is the syntax for expressing SHACL 1.2 Rules. Two
equivalent rule forms:

```sparql
PREFIX : <http://example.org/>

# Form 1: RULE ... WHERE  (an optional IRI right after RULE names the rule)
RULE { ?x :childOf ?y } WHERE { ?y :parentOf ?x }
RULE :childRule { ?x :childOf ?y } WHERE { ?y :parentOf ?x }

# Form 2: IF ... THEN
IF { ?y :parentOf ?x } THEN { ?x :childOf ?y }
```

The head is a **template** (variables and IRIs, no property paths); the body is a
**pattern** (variables, IRIs, and sequence/inverse property paths). `DATA` blocks
must be **ground** (no variables).

> For a full walkthrough of the language and engine semantics, see the
> **[engine how-to guide](../../packages/srl-engine/docs/GUIDE.md)** and the
> **[runnable examples](../../packages/srl-engine/examples/)**.

### Shorthand declarations

```sparql
TRANSITIVE(:ancestorOf)      # Transitive closure
(:friendOf) SYMMETRIC        # Symmetric relationship — note the POSTFIX syntax
INVERSE(:parentOf, :childOf) # Inverse properties
```

### Body elements

| Element | Syntax | Description |
| ------- | ------ | ----------- |
| Triple pattern | `?s :p ?o` | Match triples in the graph |
| Property path | `?s :p1/:p2 ?o` | Sequence (`/`) and inverse (`^`) paths (body only) |
| Filter | `FILTER(?x > 0)` | Boolean condition |
| Assignment | `SET(?var := expr)` | Assign a **new** variable; an eval error drops the row |
| Negation | `NOT { pattern }` | Negation-as-failure (triple patterns + `FILTER` only) |

## Supported Features

### Parser & grammar

| Feature | Status | Notes |
| ------- | ------ | ----- |
| Rule forms (RULE/WHERE, IF/THEN) | ✅ | The datalog `:-` form was removed from spec |
| Rule naming (`RULE iri? …`) | ✅ | Optional identifying IRI |
| Triple patterns | ✅ | Subject-predicate-object |
| Property paths (`/`, `^`) | ✅ | Sequence and inverse, body only |
| FILTER expressions | ✅ | Full expression syntax |
| SET assignments | ✅ | `SET(?var := expr)`, single-assignment |
| NOT negation | ✅ | Triple patterns + FILTER only |
| IN / NOT IN | ✅ | Set membership in expressions |
| TRANSITIVE / SYMMETRIC (postfix) / INVERSE | ✅ | Shorthand declarations |
| PREFIX / BASE / VERSION / IMPORTS | ✅ | Interspersed prologue allowed |
| DATA blocks | ✅ | Ground triples only |

### Expression functions

The built-in set is exactly SHACL 1.2 Rules production `[121]`. `BOUND`, `RAND`,
`COALESCE`, and the hash functions (`MD5`/`SHA*`) are **not** part of the language
and are rejected.

| Category | Functions |
| -------- | --------- |
| **Type checking** | `isIRI`, `isURI`, `isBLANK`, `isLITERAL`, `isNUMERIC`, `sameTerm`, `hasLANG`, `hasLANGDIR`, `isTRIPLE` |
| **String** | `STR`, `STRLEN`, `SUBSTR`, `UCASE`, `LCASE`, `CONTAINS`, `STRSTARTS`, `STRENDS`, `STRBEFORE`, `STRAFTER`, `CONCAT`, `REPLACE`, `REGEX`, `ENCODE_FOR_URI` |
| **Numeric** | `ABS`, `ROUND`, `CEIL`, `FLOOR` |
| **DateTime** | `NOW`, `YEAR`, `MONTH`, `DAY`, `HOURS`, `MINUTES`, `SECONDS`, `TIMEZONE`, `TZ` |
| **Conditional** | `IF` |
| **Constructors** | `IRI`, `URI`, `BNODE`, `STRDT`, `STRLANG`, `UUID`, `STRUUID` |
| **Type/Language** | `DATATYPE`, `LANG`, `LANGMATCHES` |

### Execution engine

| Feature | Notes |
| ------- | ----- |
| Fixed-point iteration | General rules iterate per stratum until no new triples |
| Stratification | Open/closed dependency edges; rejects closed-edge cycles |
| Run-once rules | `SET` or blank-node-head rules fire once before the loop |
| DATA seeding (GI) | DATA triples not in the base graph count as inferred |
| `NOW()` pinning | Constant across a single rule-set evaluation |
| Provenance tracking | Each inferred triple carries its source rule |

## Not Yet Implemented

The parser and engine cover the core SHACL 1.2 Rules grammar. The following are
deferred (they parse to errors today) — the authoritative, actionable list lives
in [`docs/BACKLOG.md`](../../docs/BACKLOG.md).

### RDF 1.2 rich terms

| Feature | Syntax |
| ------- | ------ |
| RDF collections | `( 1 2 3 )` |
| Blank-node property lists | `[ :p :o ]` |
| Reified triples | `<< :s :p :o >>` |
| Triple terms | `<<( :s :p :o )>>` |
| Reifiers / annotation blocks | `~`, `{\| … \|}` |

### Property paths

Only sequence (`/`) and inverse (`^`) — the paths that expand into triple
patterns — are supported (per spec). Zero-or-more (`*`), one-or-more (`+`),
optional (`?`), alternative (`|`), and negated property sets (`!`) are **not**
part of SHACL 1.2 Rules and are rejected.

### Out of scope for the language

- **Out-of-spec functions**: `BOUND`, `RAND`, `COALESCE`, `MD5`/`SHA*`, and SPARQL
  aggregates (`COUNT`/`SUM`/`MIN`/`MAX`/`AVG`/`SAMPLE`/`GROUP_CONCAT`) are not in
  production `[121]` and are rejected.
- **Rule-to-shape targeting** (`FOR ?v IN <shape>`) and **rule tuples**
  (`TUPLE(…)`) — spec-optional / at-risk extensions.

> [!NOTE]
> This project tracks the [SHACL 1.2 Rules specification](https://w3c.github.io/shacl/shacl-rules/)
> and the [`w3c/data-shapes`](https://github.com/w3c/data-shapes) test suite.

## Architecture

The app is UI only — the language and engine live in `srl-engine`.

```
apps/playground/src/
├── app/                    # Next.js app router
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css         # theme tokens (CSS variables) + base styles
├── components/             # React components
│   ├── Playground.tsx      # top-level orchestrator
│   ├── SRLEditor.tsx       # SRL Monaco editor
│   ├── RDFEditor.tsx       # Turtle Monaco editor
│   ├── ValidationPanel.tsx
│   ├── InferredTriplesPanel.tsx
│   ├── SyntaxBreakdown.tsx
│   └── SyntaxDiagramPanel.tsx
└── lib/                    # UI-side glue (NOT the engine)
    ├── monaco/             # SRL Monaco language support + syntax diagrams
    ├── examples/           # built-in example rulesets
    ├── validation/         # useValidation hook (calls srl-engine)
    ├── rules/              # useRuleExecution hook (calls srl-engine)
    └── useMediaQuery.ts    # SSR-safe responsive breakpoint hook

packages/srl-engine/        # ← the parser / validator / engine (separate package)
```

The two React hooks are thin wrappers: `useValidation` calls `validateSRL`, and
`useRuleExecution` calls `buildAST` + `executeRules` — all from `srl-engine`.

## Built With

- [Next.js 16](https://nextjs.org/) — React framework (static export)
- [React 19](https://react.dev/) — UI library
- [`srl-engine`](../../packages/srl-engine/) — SRL parser, validator, engine
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) — code editors
- [Tailwind CSS](https://tailwindcss.com/) — styling
- [react-resizable-panels](https://github.com/bvaughn/react-resizable-panels) — layout

The engine's own dependencies ([Chevrotain](https://chevrotain.io/),
[N3.js](https://github.com/rdfjs/N3.js)) come in transitively via `srl-engine`;
the app also uses Chevrotain directly for the railroad syntax diagrams.

## Resources

- [SHACL 1.2 Rules Specification](https://w3c.github.io/shacl/shacl-rules/) — W3C draft
- [SHACL Core Specification](https://www.w3.org/TR/shacl/) — W3C recommendation
- [SPARQL 1.1 Query Language](https://www.w3.org/TR/sparql11-query/) — expression functions reference
