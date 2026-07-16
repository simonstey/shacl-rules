# srl-engine

Parser, validator, and inference engine for **SHACL 1.2 Rules** written in
**SRL (Shape Rules Language)**. Pure TypeScript; depends only on
[`chevrotain`](https://chevrotain.io) (lexer/parser) and
[`n3`](https://github.com/rdfjs/N3.js) (RDF store). No DOM, no framework.

## Install

```bash
npm install srl-engine
```

## Usage

```ts
import { buildAST, validateSRL, executeRules } from 'srl-engine';

const srl = `PREFIX : <http://example/>
RULE { :x :q ?o } WHERE { :s :p ?o }`;

const data = `PREFIX : <http://example/>
:s :p :o .`;

// 1. Validate (lexer/parser errors + §4.2 well-formedness + stratification)
const report = validateSRL(srl);
if (!report.isValid) throw new Error(report.messages[0].message);

// 2. Build the typed RuleSet AST
const ruleSet = buildAST(srl);

// 3. Run the rules against RDF data → inferred triples with provenance
const result = executeRules(ruleSet, data);
for (const t of result.inferredTriples) {
  console.log(t.quadString, '←', t.sourceRule.name);
}
```

## API

| Export | Purpose |
|--------|---------|
| `parseSRL(text)` | Lex + CST parse; returns `{ tokens, cst, errors }`. |
| `buildAST(text)` | Parse and walk the CST into a typed `RuleSet`. |
| `validateSRL(text)` | Full diagnostics: lexer/parser, well-formedness (§4.2), stratification. |
| `executeRules(ruleSet, rdfData, options?)` | Fixed-point inference; returns inferred triples + provenance. |
| `stratifyRules(rules)` / `isStratifiable(rules)` | Open/closed dependency stratification. |
| `expandDeclarations(decls, prefixes)` | Rewrite `TRANSITIVE`/`SYMMETRIC`/`INVERSE` into rules. |
| `formatTripleForDisplay(quad, prefixes)` | Prefix-collapsed S/P/O strings for UIs. |

All AST, result, and validation types are exported. See `src/index.ts` for the
complete surface.

## Scope

Implements the current W3C SHACL 1.2 Rules surface syntax and semantics.
**Deferred:** RDF-1.2 rich terms (reification `<< >>`/`<<( )>>`, collections
`( )`/`[ ]`, annotations `{| |}`) and extended property paths (`*`/`+`/`?`/`|`,
negated property sets). Built-ins are restricted to the spec `[121]` set.

## Development

```bash
npm -w srl-engine run build       # tsup → dist/ (ESM + CJS + .d.ts)
npm -w srl-engine test            # vitest (facade smoke + W3C fixtures)
npm -w srl-engine run typecheck   # tsc --noEmit
```

Releasing to npm: see [`../../RELEASING.md`](../../RELEASING.md).
