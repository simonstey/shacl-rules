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
- **Semantic Validation** — Checks for undefined prefixes, unbound head variables, and well-formedness conditions
- **Rule Execution** — Fixed-point iteration with proper stratification for rules with negation
- **Monaco Integration** — Syntax highlighting, hover documentation, and code completion for SRL
- **Multiple Rule Forms** — Support for `RULE...WHERE`, `IF...THEN`, and datalog-style (`:-`) syntax
- **Shorthand Declarations** — `TRANSITIVE`, `SYMMETRIC`, and `INVERSE` property declarations
- **Theme Support** — Light and dark themes with resizable panels

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

SRL (Shape Rules Language) is the syntax for expressing SHACL 1.2 Rules. It supports three equivalent forms:

```sparql
PREFIX : <http://example.org/>

# Form 1: RULE ... WHERE
RULE { ?x :childOf ?y } WHERE { ?y :parentOf ?x }

# Form 2: IF ... THEN  
IF { ?y :parentOf ?x } THEN { ?x :childOf ?y }

# Form 3: Datalog-style
{ ?x :childOf ?y } :- { ?y :parentOf ?x }
```

### Shorthand Declarations

```sparql
TRANSITIVE(:ancestorOf)     # Transitive closure
SYMMETRIC(:friendOf)        # Symmetric relationship
INVERSE(:parentOf, :childOf) # Inverse properties
```

### Body Elements

| Element        | Syntax               | Description                |
| -------------- | -------------------- | -------------------------- |
| Triple Pattern | `?s :p ?o`           | Match triples in the graph |
| Filter         | `FILTER(?x > 0)`     | Boolean condition          |
| Bind           | `BIND(expr AS ?var)` | Variable assignment        |
| Negation       | `NOT { pattern }`    | Negation-as-failure        |

## Supported Features

### Parser & Grammar

| Feature                                | Status      | Notes                    |
| -------------------------------------- | ----------- | ------------------------ |
| Rule forms (RULE/WHERE, IF/THEN, `:-`) | ✅ Supported | All three forms          |
| Triple patterns                        | ✅ Supported | Subject-predicate-object |
| FILTER expressions                     | ✅ Supported | Full expression syntax   |
| BIND assignments                       | ✅ Supported | Variable binding         |
| NOT negation                           | ✅ Supported | Negation-as-failure      |
| TRANSITIVE declaration                 | ✅ Supported | Shorthand                |
| SYMMETRIC declaration                  | ✅ Supported | Shorthand                |
| INVERSE declaration                    | ✅ Supported | Shorthand                |
| PREFIX/BASE declarations               | ✅ Supported | Standard Turtle prefixes |
| DATA blocks                            | ✅ Supported | Inline RDF data          |
| Reified triples (`<< >>`)              | ⚠️ Parsed    | AST not yet implemented  |
| Collections `( )`                      | ⚠️ Parsed    | Limited support          |

### Expression Functions

| Category            | Functions                                                                                            | Status      |
| ------------------- | ---------------------------------------------------------------------------------------------------- | ----------- |
| **Type Checking**   | `BOUND`, `ISIRI`, `ISBLANK`, `ISLITERAL`, `ISNUMERIC`                                                | ✅ Supported |
| **String**          | `STR`, `STRLEN`, `SUBSTR`, `UCASE`, `LCASE`, `CONTAINS`, `STRSTARTS`, `STRENDS`, `CONCAT`, `REPLACE` | ✅ Supported |
| **Numeric**         | `ABS`, `ROUND`, `CEIL`, `FLOOR`                                                                      | ✅ Supported |
| **DateTime**        | `NOW`, `YEAR`, `MONTH`, `DAY`, `HOURS`, `MINUTES`, `SECONDS`                                         | ✅ Supported |
| **Conditional**     | `IF`, `COALESCE`                                                                                     | ✅ Supported |
| **Type Conversion** | `DATATYPE`, `LANG`                                                                                   | ✅ Supported |

### Execution Engine

| Feature               | Status      | Notes                 |
| --------------------- | ----------- | --------------------- |
| Fixed-point iteration | ✅ Supported | Until no new triples  |
| Stratification        | ✅ Supported | For negation handling |
| Solution mapping/join | ✅ Supported | Pattern matching      |
| Triple instantiation  | ✅ Supported | Head generation       |
| Provenance tracking   | ✅ Supported | Source rule info      |

## Not Yet Implemented

The following features from the SHACL 1.2 Rules specification are not yet implemented:

### Grammar & Parser

| Feature                | Spec Reference | Description                                            | Priority |
| ---------------------- | -------------- | ------------------------------------------------------ | -------- |
| Path expressions       | `[47-51]`      | Property paths (`^`, `/`, `\|`, `*`, `+`, `?`)         | 🔴 High   |
| IN / NOT IN            | `[35]`         | Set membership operators in expressions                | 🔴 High   |
| EXISTS / NOT EXISTS    | `[44]`         | Pattern existence tests in expressions                 | 🔴 High   |
| REFLEXIVE declaration  | `[12]`         | Reflexive property shorthand                           | 🔴 High   |
| FunctionCall with IRIs | `[45]`         | User-defined functions via IRI (e.g., `ex:myFunc(?x)`) | 🟡 Medium |
| Triple Terms           | `[68-73]`      | RDF-star quoted triples as terms                       | 🟢 Low    |
| Reifiers               | `[27, 58-61]`  | RDF-star reification blocks                            | 🟢 Low    |
| Annotations            | `[62-64]`      | RDF-star triple annotations                            | 🟢 Low    |

### Expression Functions

| Function         | Category    | Description                     | Priority |
| ---------------- | ----------- | ------------------------------- | -------- |
| `ENCODE_FOR_URI` | String      | URI-encode a string             | 🟡 Medium |
| `REGEX`          | String      | Regular expression matching     | 🟡 Medium |
| `LANGMATCHES`    | String      | Language tag matching           | 🟡 Medium |
| `SAMETERM`       | Comparison  | RDF term identity check         | 🟡 Medium |
| `RAND`           | Numeric     | Random number generation        | 🟡 Medium |
| `TIMEZONE`       | DateTime    | Extract timezone as duration    | 🟡 Medium |
| `TZ`             | DateTime    | Extract timezone as string      | 🟡 Medium |
| `MD5`            | Hash        | MD5 hash function               | 🟡 Medium |
| `SHA1`           | Hash        | SHA-1 hash function             | 🟡 Medium |
| `SHA256`         | Hash        | SHA-256 hash function           | 🟡 Medium |
| `SHA384`         | Hash        | SHA-384 hash function           | 🟡 Medium |
| `SHA512`         | Hash        | SHA-512 hash function           | 🟡 Medium |
| `UUID`           | Identifier  | Generate UUID as IRI            | 🟡 Medium |
| `STRUUID`        | Identifier  | Generate UUID as string         | 🟡 Medium |
| `BNODE`          | Constructor | Create deterministic blank node | 🟡 Medium |
| `IRI` / `URI`    | Constructor | Construct IRI from string       | 🟡 Medium |
| `STRDT`          | Constructor | Create typed literal            | 🟡 Medium |
| `STRLANG`        | Constructor | Create language-tagged literal  | 🟡 Medium |
| `STRBEFORE`      | String      | Substring before match          | 🟡 Medium |
| `STRAFTER`       | String      | Substring after match           | 🟡 Medium |

### Aggregates

| Function       | Description                | Priority |
| -------------- | -------------------------- | -------- |
| `COUNT`        | Count solutions            | 🟡 Medium |
| `SUM`          | Sum numeric values         | 🟡 Medium |
| `MIN`          | Minimum value              | 🟡 Medium |
| `MAX`          | Maximum value              | 🟡 Medium |
| `AVG`          | Average value              | 🟡 Medium |
| `SAMPLE`       | Arbitrary value from group | 🟡 Medium |
| `GROUP_CONCAT` | Concatenate group values   | 🟡 Medium |

> [!NOTE]
> This project follows the [SHACL 1.2 Rules specification](https://w3c.github.io/shacl/shacl-rules/). Some features may deviate slightly for improved usability (e.g., allowing BIND inside negation blocks).

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
│   └── examples/           # Built-in examples
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
