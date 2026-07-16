<div align="center">

# SHACL Rules

**Author, validate, and execute [SHACL 1.2 Rules](https://w3c.github.io/shacl/shacl-rules/) written in SRL (Shape Rules Language) — a standalone engine plus a web playground.**

[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org)

</div>

---

This is an **npm-workspaces monorepo** with two pieces:

| Workspace | Package | What it is |
| --------- | ------- | ---------- |
| [`packages/srl-engine`](packages/srl-engine/) | `srl-engine` | The standalone, publishable **rule engine** — lexer/parser, AST, validator, inference executor, stratifier. Pure TypeScript; depends only on `chevrotain` + `n3`. No DOM, no framework. |
| [`apps/playground`](apps/playground/) | `playground` | The **web playground** — a Next.js 16 / React 19 UI with dual Monaco editors, live validation, and an inferred-triples panel. Consumes `srl-engine`. |

The engine is the reusable core; the playground is one consumer of it.

## What are SHACL 1.2 Rules / SRL?

[SHACL 1.2 Rules](https://w3c.github.io/shacl/shacl-rules/) is a W3C specification
for defining **inference rules over RDF graphs** — "if these triples match,
derive these new triples." **SRL (Shape Rules Language)** is the surface syntax.
A rule looks like:

```sparql
PREFIX : <http://example.org/>

# If ?y is a parent of ?x, then ?x is a child of ?y
RULE { ?x :childOf ?y } WHERE { ?y :parentOf ?x }
```

Feed that rule plus an RDF data graph to the engine and it computes the derived
triples to a fixed point, with provenance for each.

## Quick start

Requires [Node.js](https://nodejs.org/) 20+.

```bash
git clone https://github.com/simonstey/shacl-rules.git
cd shacl-rules
npm install            # installs all workspaces

# Run the playground UI
npm run dev            # → http://localhost:3000

# Or use the engine directly
npm -w srl-engine run build
node packages/srl-engine/examples/01-basic-inference.mjs
```

## Commands

The repo root has no scripts of its own — target a workspace with `npm -w`:

| Command | Description |
| ------- | ----------- |
| `npm run dev` | Start the playground dev server (root convenience alias for the app) |
| `npm -w playground run build` | Production build of the playground (static export) |
| `npm -w playground run lint` | Lint the playground |
| `npm -w srl-engine run build` | Build the engine → `dist/` (ESM + CJS + `.d.ts`) |
| `npm -w srl-engine test` | Run the engine's Vitest suite (facade smoke + W3C fixtures) |
| `npm -w srl-engine run typecheck` | Type-check the engine |

> `npm install` at the root links the workspaces together, so the playground
> always builds against the local engine source.

## Documentation map

| Doc | Where | Covers |
| --- | ----- | ------ |
| Engine README | [`packages/srl-engine/README.md`](packages/srl-engine/README.md) | Install, API surface, scope |
| Engine how-to guide | [`packages/srl-engine/docs/GUIDE.md`](packages/srl-engine/docs/GUIDE.md) | Full pipeline, SRL cheat-sheet, recipes, gotchas |
| Engine examples | [`packages/srl-engine/examples/`](packages/srl-engine/examples/) | Six runnable scripts |
| Publishing guide | [`packages/srl-engine/PUBLISHING.md`](packages/srl-engine/PUBLISHING.md) | Step-by-step npm release |
| Playground README | [`apps/playground/README.md`](apps/playground/README.md) | UI features, SRL reference, support matrix |
| Backlog | [`docs/BACKLOG.md`](docs/BACKLOG.md) | Known bugs, deferred features, release follow-ups |
| Releasing / ops | [`RELEASING.md`](RELEASING.md) | Publish, CI, changesets, UMD, scoping |
| Product & design | [`PRODUCT.md`](PRODUCT.md), [`DESIGN.md`](DESIGN.md) | Strategic + visual design system |

## Repository layout

```
shacl-rules/
├── package.json              # workspaces root (private) + dependency overrides
├── packages/
│   └── srl-engine/           # the publishable engine
│       ├── src/{srl,rules,validation}/   lexer/parser/AST · engine · validator
│       ├── src/index.ts                  curated public facade
│       ├── test/                         Vitest + vendored W3C fixtures
│       ├── examples/                     runnable .mjs demos
│       └── docs/GUIDE.md
├── apps/
│   └── playground/           # the Next.js playground
│       └── src/{app,components,lib}/
├── docs/                     # BACKLOG.md, superpowers specs & plans
├── RELEASING.md
├── PRODUCT.md · DESIGN.md    # design intent
└── CLAUDE.md                 # guidance for AI coding agents
```

## Scope

Implements the current W3C SHACL 1.2 Rules surface syntax and semantics.
**Deferred** (parse to errors today): RDF-1.2 rich terms (reification `<< >>` /
`<<( )>>`, collections `( )` / `[ ]`, annotations `{| |}`) and extended property
paths (`*` / `+` / `?` / `|`, negated property sets). Built-ins are restricted to
the spec `[121]` set. The full list of open items is in
[`docs/BACKLOG.md`](docs/BACKLOG.md).

Syntax and semantics are validated against the
[`w3c/data-shapes`](https://github.com/w3c/data-shapes) rules test suite.

## License

MIT.
