<div align="center">

# SHACL Rules Playground

**A web-based playground for authoring and executing [SHACL 1.2 Rules](https://w3c.github.io/shacl/shacl-rules/) using SRL (Shape Rules Language)**

[![Build Status](https://img.shields.io/github/actions/workflow/status/simonstey/shacl-rules/ci.yml?style=flat-square)](https://github.com/simonstey/shacl-rules/actions)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

[Features](#features) • [Getting Started](#getting-started) • [SRL Language](#srl-language-reference) • [Supported Features](#supported-features) • [Roadmap](#roadmap)

</div>

---

## Overview

SHACL Rules Playground is an interactive editor for writing and testing **SHACL 1.2 Rules** — a W3C specification for defining inference rules over RDF graphs. The playground provides:

- **Dual Monaco editors** for RDF data (Turtle) and SRL rules side-by-side
- **Real-time syntax validation** with error highlighting and semantic analysis
- **Rule execution engine** with fixed-point evaluation and stratification
- **Inferred triples panel** showing provenance for each derived fact
- **Built-in examples** covering common inference patterns

## Features

- **Full SRL Parser** — Complete Chevrotain-based lexer and parser for the Shape Rules Language
- **Spec well-formedness** — AST-based checks (SHACL 1.2 Rules §4.2): FILTER/SET variable scoping, single-assignment `SET`, non-leaking `NOT` scope, head variables bound by the body, ground `DATA` blocks, and the [121] built-in set
- **Rule Execution** — Fixed-point iteration with open/closed-dependency stratification and run-once rules
- **Monaco Integration** — Syntax highlighting, hover documentation, and code completion for SRL
- **Two Rule Forms** — `RULE iri? { head } WHERE { body }` (optional naming IRI) and `IF { body } THEN { head }`
- **Shorthand Declarations** — `TRANSITIVE(:p)`, postfix `(:p) SYMMETRIC`, and `INVERSE(:p, :q)` property declarations
- **Light & Dark Themes** — Token-based theming (CSS variables) that persists your choice and seeds from your OS preference on first load
- **Responsive Layout** — Resizable panels that stack vertically on narrow viewports; the examples sidebar auto-collapses
- **Accessible** — WCAG 2.1 AA: sufficient contrast in both themes, keyboard-operable controls with visible focus, ARIA labels/roles, and `prefers-reduced-motion` support

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 20 or later
- npm, yarn, pnpm, or bun

### Installation

```bash
# Clone the repository
git clone https://github.com/simonstey/shacl-rules.git
cd shacl-rules

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the playground.

### Available Commands

| Command         | Description                              |
| --------------- | ---------------------------------------- |
| `npm run dev`   | Start development server with hot reload |
| `npm run build` | Build for production                     |
| `npm run start` | Start production server                  |
| `npm run lint`  | Run ESLint                               |

## SRL Language Reference

SRL (Shape Rules Language) is the syntax for expressing SHACL 1.2 Rules. It supports two equivalent forms:

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

### Shorthand Declarations

```sparql
TRANSITIVE(:ancestorOf)      # Transitive closure
(:friendOf) SYMMETRIC        # Symmetric relationship — note the postfix syntax
INVERSE(:parentOf, :childOf) # Inverse properties
```

### Body Elements

| Element        | Syntax               | Description                                            |
| -------------- | -------------------- | ------------------------------------------------------ |
| Triple Pattern | `?s :p ?o`           | Match triples in the graph                             |
| Property Path  | `?s :p1/:p2 ?o`      | Sequence (`/`) and inverse (`^`) paths (body only)     |
| Filter         | `FILTER(?x > 0)`     | Boolean condition                                      |
| Assignment     | `SET(?var := expr)`  | Assign a **new** variable; an eval error drops the row |
| Negation       | `NOT { pattern }`    | Negation-as-failure (triple patterns + `FILTER` only)  |

## Supported Features

### Parser & Grammar

| Feature                          | Status      | Notes                                       |
| -------------------------------- | ----------- | ------------------------------------------- |
| Rule forms (RULE/WHERE, IF/THEN) | ✅ Supported | The datalog `:-` form was removed from spec |
| Rule naming (`RULE iri? …`)      | ✅ Supported | Optional identifying IRI                    |
| Triple patterns                  | ✅ Supported | Subject-predicate-object                    |
| Property paths (`/`, `^`)        | ✅ Supported | Sequence and inverse, body only             |
| FILTER expressions               | ✅ Supported | Full expression syntax                      |
| SET assignments                  | ✅ Supported | `SET(?var := expr)`, single-assignment      |
| NOT negation                     | ✅ Supported | Triple patterns + FILTER only               |
| IN / NOT IN                      | ✅ Supported | Set membership in expressions               |
| TRANSITIVE declaration           | ✅ Supported | Shorthand                                   |
| SYMMETRIC declaration (postfix)  | ✅ Supported | `(:p) SYMMETRIC`                            |
| INVERSE declaration              | ✅ Supported | Shorthand                                   |
| PREFIX/BASE/VERSION/IMPORTS      | ✅ Supported | Interspersed prologue allowed               |
| DATA blocks                      | ✅ Supported | Ground triples only                         |

### Expression Functions

The built-in set is exactly SHACL 1.2 Rules production `[121]`. `BOUND`, `RAND`, `COALESCE`, and the hash functions (`MD5`/`SHA*`) are **not** part of the language and are rejected.

| Category            | Functions                                                                                                          | Status      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------- |
| **Type Checking**   | `isIRI`, `isURI`, `isBLANK`, `isLITERAL`, `isNUMERIC`, `sameTerm`, `hasLANG`, `hasLANGDIR`, `isTRIPLE`             | ✅ Supported |
| **String**          | `STR`, `STRLEN`, `SUBSTR`, `UCASE`, `LCASE`, `CONTAINS`, `STRSTARTS`, `STRENDS`, `STRBEFORE`, `STRAFTER`, `CONCAT`, `REPLACE`, `REGEX`, `ENCODE_FOR_URI` | ✅ Supported |
| **Numeric**         | `ABS`, `ROUND`, `CEIL`, `FLOOR`                                                                                    | ✅ Supported |
| **DateTime**        | `NOW`, `YEAR`, `MONTH`, `DAY`, `HOURS`, `MINUTES`, `SECONDS`, `TIMEZONE`, `TZ`                                     | ✅ Supported |
| **Conditional**     | `IF`                                                                                                               | ✅ Supported |
| **Constructors**    | `IRI`, `URI`, `BNODE`, `STRDT`, `STRLANG`, `UUID`, `STRUUID`                                                       | ✅ Supported |
| **Type/Language**   | `DATATYPE`, `LANG`, `LANGMATCHES`                                                                                  | ✅ Supported |

### Execution Engine

| Feature               | Status      | Notes                                                     |
| --------------------- | ----------- | --------------------------------------------------------- |
| Fixed-point iteration | ✅ Supported | General rules iterate per stratum until no new triples    |
| Stratification        | ✅ Supported | Open/closed dependency edges; rejects closed-edge cycles  |
| Run-once rules        | ✅ Supported | `SET` or blank-node-head rules fire once before the loop  |
| DATA seeding (GI)     | ✅ Supported | DATA triples not in the base graph count as inferred      |
| `NOW()` pinning       | ✅ Supported | Constant across a single rule-set evaluation              |
| Solution mapping/join | ✅ Supported | Pattern matching                                          |
| Provenance tracking   | ✅ Supported | Source rule info                                          |

## Not Yet Implemented

The parser and engine cover the core SHACL 1.2 Rules grammar. The following are
deferred (they parse to errors today) and tracked as backlog:

### RDF 1.2 rich terms

| Feature                       | Syntax            | Notes                                                        |
| ----------------------------- | ----------------- | ------------------------------------------------------------ |
| RDF collections               | `( 1 2 3 )`       | List syntax in triple positions                              |
| Blank-node property lists     | `[ :p :o ]`       | Anonymous nodes with inline predicates                       |
| Reified triples               | `<< :s :p :o >>`  | RDF-star quoted triples as terms                             |
| Triple terms                  | `<<( :s :p :o )>>`| RDF-star triple terms                                        |
| Reifiers / annotation blocks  | `~`, `{\| … \|}`  | RDF-star reification and annotations                         |

### Property paths

Only sequence (`/`) and inverse (`^`) — the paths that expand into triple
patterns — are supported (per spec). Zero-or-more (`*`), one-or-more (`+`),
optional (`?`), alternative (`\|`), and negated property sets (`!`) are **not**
part of SHACL 1.2 Rules and are rejected.

### Out of scope for the language

- **Out-of-spec functions**: `BOUND`, `RAND`, `COALESCE`, `MD5`/`SHA*`, and SPARQL aggregates (`COUNT`/`SUM`/`MIN`/`MAX`/`AVG`/`SAMPLE`/`GROUP_CONCAT`) are not in production `[121]` and are rejected.
- **Rule-to-shape targeting** (`FOR ?v IN <shape>`) and **rule tuples** (`TUPLE(…)`) — spec-optional / at-risk extensions.

> [!NOTE]
> This project tracks the [SHACL 1.2 Rules specification](https://w3c.github.io/shacl/shacl-rules/) and the [`w3c/data-shapes`](https://github.com/w3c/data-shapes) test suite. Syntax and semantics are validated against those rules fixtures.

## Architecture

```
src/
├── app/                    # Next.js app router
├── components/             # React components
│   ├── Playground.tsx      # Main UI orchestrator
│   ├── SRLEditor.tsx       # SRL Monaco editor
│   ├── RDFEditor.tsx       # Turtle Monaco editor
│   └── InferredTriplesPanel.tsx
├── lib/
│   ├── srl/                # SRL language implementation
│   │   ├── tokens.ts       # Chevrotain lexer
│   │   ├── parser.ts       # Chevrotain CST parser
│   │   └── ast.ts          # AST builder
│   ├── rules/              # Rule execution
│   │   ├── executor.ts     # Fixed-point engine
│   │   ├── pattern-matcher.ts
│   │   ├── expression-evaluator.ts
│   │   └── stratifier.ts
│   ├── validation/         # Semantic analysis
│   ├── monaco/             # Monaco language support
│   ├── examples/           # Built-in examples
│   └── useMediaQuery.ts    # SSR-safe responsive breakpoint hook
├── app/
│   └── globals.css         # Theme tokens (CSS variables) + base styles
PRODUCT.md                  # Strategic design context (register, users, brand)
DESIGN.md                   # Visual design system (tokens, typography, components)
```

## Built With

- [Next.js 16](https://nextjs.org/) — React framework
- [React 19](https://react.dev/) — UI library
- [Chevrotain](https://chevrotain.io/) — Parser toolkit
- [N3.js](https://github.com/rdfjs/N3.js) — RDF/Turtle parsing
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) — Code editor
- [Tailwind CSS](https://tailwindcss.com/) — Styling
- [react-resizable-panels](https://github.com/bvaughn/react-resizable-panels) — Layout

## Resources

- [SHACL 1.2 Rules Specification](https://w3c.github.io/shacl/shacl-rules/) — W3C draft
- [SHACL Core Specification](https://www.w3.org/TR/shacl/) — W3C recommendation
- [SPARQL 1.1 Query Language](https://www.w3.org/TR/sparql11-query/) — Expression functions reference
