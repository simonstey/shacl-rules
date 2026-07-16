# `FOR ?v IN <shape>` Clause Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the opt-in `FOR ?v IN <shape>` rule-to-shape targeting clause end-to-end in `srl-engine` — parsing, AST, an in-house SHACL Core conformance subset, execution, stratification gate, and validation.

**Architecture:** Port py-srl's `src/srl/shapes/` (model + targets + validate) to TypeScript over the n3 `Store`, adding zero dependencies. Wire a `FOR` clause through tokens → parser → AST (`TargetedRule` wrapping a `Rule`) → executor (conformance-gated seed) → stratifier (closed gate edge) → validator. Everything is gated behind an `extensions` flag defaulting **off**, so spec-conformant documents are byte-for-byte unaffected.

**Tech Stack:** TypeScript, Chevrotain (lexer/parser), n3 (`Store`/`DataFactory`/`Parser`), Vitest.

## Global Constraints

- **Zero new dependencies.** Engine depends only on `chevrotain` + `n3`. Do not add `rdf-validate-shacl`, `@rdfjs/*`, or any package.
- **n3 pinned at `^1.26`.** Do not bump to n3 v2. Use only `Store.getQuads`, `DataFactory`, `Parser`, `Quad`.
- **`extensions` flag defaults `false` everywhere.** Every existing call site (`buildAST(code)`, `executeRules(rs, data)`, `validateSRL(code)`, `stratifyRules(rules)`) must keep working unchanged. All pre-existing tests run extensions-off and must stay green.
- **Donor is py-srl**, `../py-srl/src/srl/shapes/` and `../py-srl/tests/test_shape_targeting.py`. Port behavior verbatim; py-srl's tests are the correctness oracle.
- **n3 `Term`s are not reference-unique.** All set/dedup/equality over terms must compare by `termType` + `value` (+ datatype/language for literals). Never use `Set<Term>` identity or `===`.
- **Commit after every task.** TDD: failing test first, then minimal implementation.
- **Run tests with:** `npm -w srl-engine test` (Vitest). Typecheck with `npm -w srl-engine typecheck`. Build with `npm -w srl-engine build`.
- SHACL namespace IRI: `http://www.w3.org/ns/shacl#`. rdf:type: `http://www.w3.org/1999/02/22-rdf-syntax-ns#type`. rdfs:subClassOf: `http://www.w3.org/2000/01/rdf-schema#subClassOf`. rdf:first/rdf:rest/rdf:nil under the rdf-syntax-ns namespace.

---

## File Structure

**Created:**
- `packages/srl-engine/src/shapes/rdf-helpers.ts` — term keys/equality, `rdfList`, `pyValue`, SHACL/RDF IRI constants.
- `packages/srl-engine/src/shapes/model.ts` — `NodeShape`/`PropertyShape`/`Constraint` types, support sets, `loadShape`, `UnsupportedShapeFeatureError`.
- `packages/srl-engine/src/shapes/targets.ts` — `focusNodes`.
- `packages/srl-engine/src/shapes/validate.ts` — `conforms` + `checkConstraint`.
- `packages/srl-engine/src/shapes/index.ts` — barrel.
- `packages/srl-engine/docs/shacl-core-support-matrix.md` — supported-feature doc (drift-tested).
- `packages/srl-engine/test/shapes.test.ts` — ported conformance/target unit tests.
- `packages/srl-engine/test/shape-targeting.test.ts` — ported end-to-end `FOR` tests.
- `packages/srl-engine/test/support-matrix.test.ts` — drift test.

**Modified:**
- `packages/srl-engine/src/srl/tokens.ts` — `For` keyword + `allTokens`.
- `packages/srl-engine/src/srl/parser.ts` — `forClause` production, `rule1`/`rule2` wiring, `RULE_CATEGORIES`.
- `packages/srl-engine/src/srl/ast.ts` — `TargetedRule`, `RuleSet.targetedRules`, `ExtensionError`, `buildAST` options, gating.
- `packages/srl-engine/src/rules/executor.ts` — `ExecutorOptions` fields, targeted-rule evaluation.
- `packages/srl-engine/src/rules/stratifier.ts` — `shapeReferencedPredicates`, targeted vertices + gate edges, `targeted[]` layer slot.
- `packages/srl-engine/src/validation/validator.ts` — options threading, `V₀ = {focusVar}` basis.
- `packages/srl-engine/src/index.ts` — new exports.
- `packages/srl-engine/README.md`, `docs/GUIDE.md`, repo `docs/BACKLOG.md` — docs.

---

## PHASE 0 — Syntax scaffolding + gating

### Task 0.1: `For` token

**Files:**
- Modify: `packages/srl-engine/src/srl/tokens.ts`
- Test: `packages/srl-engine/test/shapes.test.ts` (new)

**Interfaces:**
- Produces: `export const For` (Chevrotain token) added to `allTokens`.

- [ ] **Step 1: Write the failing test**

Create `packages/srl-engine/test/shapes.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { SRLLexer } from '../src/index';

describe('FOR token', () => {
  it('lexes FOR as a keyword token, not an identifier', () => {
    const result = SRLLexer.tokenize('FOR ?this IN');
    expect(result.errors).toHaveLength(0);
    expect(result.tokens[0].tokenType.name).toBe('For');
  });

  it('does not mis-lex FOR as the prefix of an identifier', () => {
    const result = SRLLexer.tokenize('FORMAT');
    expect(result.tokens[0].tokenType.name).not.toBe('For');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm -w srl-engine test -- shapes`
Expected: FAIL — `tokenType.name` is `Identifier`, not `For` (token doesn't exist).

- [ ] **Step 3: Add the token**

In `packages/srl-engine/src/srl/tokens.ts`, after the `Inverse` keyword line (`export const Inverse = keyword('Inverse', 'INVERSE');`):

```ts
export const For = keyword('For', 'FOR');
```

In the `allTokens` array, in the keyword region, immediately after `Inverse,`:

```ts
  Inverse,
  For,
  In,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm -w srl-engine test -- shapes`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/srl-engine/src/srl/tokens.ts packages/srl-engine/test/shapes.test.ts
git commit -m "feat(srl): add FOR keyword token"
```

---

### Task 0.2: `forClause` grammar + rule1/rule2 wiring

**Files:**
- Modify: `packages/srl-engine/src/srl/parser.ts`
- Test: `packages/srl-engine/test/shapes.test.ts`

**Interfaces:**
- Consumes: `For` token (Task 0.1); existing `variable`, `iriRef`, `headTemplate` productions.
- Produces: `forClause` CST node with children `{ variable, iriRef }`; `rule1`/`rule2` optionally contain a `forClause` child; `rule2` optionally contains an `iriRef` child (naming IRI).

- [ ] **Step 1: Write the failing test**

Append to `packages/srl-engine/test/shapes.test.ts`:

```ts
import { parseSRL } from '../src/index';

const FOR_RULE = `PREFIX ex: <http://example.org/>
RULE ex:r FOR ?this IN ex:AdultShape { ?this ex:status ex:adult } WHERE { ?this ex:age ?a }`;

describe('FOR clause grammar', () => {
  it('parses a rule1 with a FOR clause without parser errors', () => {
    const result = parseSRL(FOR_RULE);
    expect(result.errors).toHaveLength(0);
  });

  it('parses an IF..THEN with a naming IRI and FOR clause', () => {
    const src = `PREFIX ex: <http://example.org/>
IF { ?this ex:age ?a } THEN ex:r FOR ?this IN ex:AdultShape { ?this ex:status ex:adult }`;
    const result = parseSRL(src);
    expect(result.errors).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm -w srl-engine test -- shapes`
Expected: FAIL — parser errors (unexpected `For` token).

- [ ] **Step 3: Import `For` and add the production**

In `packages/srl-engine/src/srl/parser.ts`, add `For,` to the import list from `./tokens` (near `In,`).

Add a new production immediately after the `rule2` production (after line ~140):

```ts
  // ForClause = 'FOR' Var 'IN' iri  — opt-in rule-to-shape targeting extension.
  // Always parsed; rejected at AST-build time when extensions are off.
  private forClause = this.RULE('forClause', () => {
    this.CONSUME(For);
    this.SUBRULE(this.variable);
    this.CONSUME(In);
    this.SUBRULE(this.iriRef);
  });
```

- [ ] **Step 4: Wire into rule1 and rule2**

Replace the `rule1` production body:

```ts
  // Rule1 = 'RULE' iri? ForClause? HeadTemplate 'WHERE' BodyPattern
  private rule1 = this.RULE('rule1', () => {
    this.CONSUME(Rule);
    this.OPTION(() => this.SUBRULE(this.iriRef));
    this.OPTION2(() => this.SUBRULE(this.forClause));
    this.SUBRULE(this.headTemplate);
    this.CONSUME(Where);
    this.SUBRULE(this.bodyPattern);
  });
```

Replace the `rule2` production body:

```ts
  // Rule2 = 'IF' BodyPattern 'THEN' iri? ForClause? HeadTemplate
  // Base spec rule2 has no naming IRI; the iri?/ForClause? here are extension
  // surface, gated at AST-build time (a bare naming IRI without FOR is rejected
  // when extensions are off).
  private rule2 = this.RULE('rule2', () => {
    this.CONSUME(If);
    this.SUBRULE(this.bodyPattern);
    this.CONSUME(Then);
    this.OPTION(() => this.SUBRULE(this.iriRef));
    this.OPTION2(() => this.SUBRULE(this.forClause));
    this.SUBRULE(this.headTemplate);
  });
```

- [ ] **Step 5: Add `forClause` to RULE_CATEGORIES**

In the `RULE_CATEGORIES` map (near line 762), add:

```ts
  forClause: 'rules',
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm -w srl-engine test -- shapes`
Expected: PASS. Then `npm -w srl-engine test` — all pre-existing tests still green (no grammar ambiguity introduced).

- [ ] **Step 7: Commit**

```bash
git add packages/srl-engine/src/srl/parser.ts packages/srl-engine/test/shapes.test.ts
git commit -m "feat(srl): parse optional FOR clause in rule1/rule2"
```

---

### Task 0.3: `TargetedRule` AST + `ExtensionError` + gating

**Files:**
- Modify: `packages/srl-engine/src/srl/ast.ts`
- Test: `packages/srl-engine/test/shapes.test.ts`

**Interfaces:**
- Consumes: `forClause` CST (Task 0.2).
- Produces:
  - `interface TargetedRule { type: 'targetedRule'; rule: Rule; focusVar: string; shape: string; direction: 'rule-to-shape'; location?: SourceLocation }`
  - `RuleSet.targetedRules: TargetedRule[]`
  - `class ExtensionError extends Error`
  - `buildAST(code: string, options?: { extensions?: boolean }): RuleSet`

- [ ] **Step 1: Write the failing test**

Append to `packages/srl-engine/test/shapes.test.ts`:

```ts
import { buildAST, ExtensionError } from '../src/index';

describe('TargetedRule AST + gating', () => {
  it('rejects a FOR clause when extensions are off (default)', () => {
    expect(() => buildAST(FOR_RULE)).toThrow(ExtensionError);
  });

  it('builds a TargetedRule when extensions are on', () => {
    const rs = buildAST(FOR_RULE, { extensions: true });
    expect(rs.rules).toHaveLength(0);
    expect(rs.targetedRules).toHaveLength(1);
    const tr = rs.targetedRules[0];
    expect(tr.focusVar).toBe('this');
    expect(tr.shape).toBe('http://example.org/AdultShape');
    expect(tr.rule.head.patterns).toHaveLength(1);
  });

  it('rejects a rule2 naming IRI without FOR when extensions are off', () => {
    const src = `PREFIX ex: <http://example.org/>
IF { ?s ex:p ?o } THEN ex:r { ?s ex:q ?o }`;
    expect(() => buildAST(src)).toThrow(ExtensionError);
  });

  it('leaves a spec-pure rule set unchanged with empty targetedRules', () => {
    const rs = buildAST(`PREFIX ex: <http://example.org/>
RULE { ?s ex:q ?o } WHERE { ?s ex:p ?o }`);
    expect(rs.rules).toHaveLength(1);
    expect(rs.targetedRules).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm -w srl-engine test -- shapes`
Expected: FAIL — `ExtensionError` not exported; `targetedRules` undefined.

- [ ] **Step 3: Add types + `ExtensionError`**

In `packages/srl-engine/src/srl/ast.ts`, after the `Rule` interface (line ~80):

```ts
/**
 * A rule tied to a SHACL shape by a `FOR ?v IN <shape>` clause (opt-in extension).
 * Wraps a Rule — all existing rule machinery runs on `.rule`.
 */
export interface TargetedRule {
  type: 'targetedRule';
  rule: Rule;
  focusVar: string;
  shape: string;
  direction: 'rule-to-shape';
  location?: SourceLocation;
}

/** Thrown when an opt-in extension construct is used with extensions disabled. */
export class ExtensionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExtensionError';
  }
}
```

Add `targetedRules` to the `RuleSet` interface:

```ts
export interface RuleSet {
  base?: string;
  prefixes: Map<string, string>;
  rules: Rule[];
  targetedRules: TargetedRule[];
  declarations: Declaration[];
  dataBlocks: DataBlock[];
}
```

- [ ] **Step 4: Thread the `extensions` flag through the builder**

In the `ASTBuilder` class, add a field and accept options in `buildRuleSet`:

```ts
export class ASTBuilder {
  private prefixes: Map<string, string> = new Map();
  private base?: string;
  private extensions = false;

  public buildRuleSet(code: string, options?: { extensions?: boolean }): RuleSet {
    this.extensions = options?.extensions ?? false;
    const parseResult = parseSRL(code);

    if (parseResult.errors.length > 0) {
      throw new Error(`Parse errors: ${parseResult.errors.map(e => e.message).join(', ')}`);
    }

    const cst = parseResult.cst as CstNode;
    return this.visitRuleSet(cst);
  }
```

- [ ] **Step 5: Collect targeted rules in `visitRuleSet`**

Replace the `rules` collection block and the return in `visitRuleSet`. Add a `targetedRules` array and route by result type:

```ts
    const rules: Rule[] = [];
    const targetedRules: TargetedRule[] = [];
    const declarations: Declaration[] = [];
    const dataBlocks: DataBlock[] = [];
```

Replace the `if (children.rule)` loop with:

```ts
    if (children.rule) {
      for (const ruleNode of children.rule) {
        const built = this.visitRule(ruleNode as CstNode);
        if (built.type === 'targetedRule') {
          targetedRules.push(built);
        } else {
          rules.push(built);
        }
      }
    }
```

Update the return object to include `targetedRules`:

```ts
    return {
      base: this.base,
      prefixes: new Map(this.prefixes),
      rules,
      targetedRules,
      declarations,
      dataBlocks,
    };
```

- [ ] **Step 6: Change `visitRule`/`buildRule` return type + build the TargetedRule**

Change `visitRule` signature to `private visitRule(node: CstNode): Rule | TargetedRule` and keep its body (it delegates to `visitRule1`/`visitRule2`). Change `visitRule1`/`visitRule2` to `: Rule | TargetedRule` returning `this.buildRule(...)`.

Replace `buildRule` with:

```ts
  private buildRule(node: CstNode): Rule | TargetedRule {
    const children = node.children as CSTChildren;
    const headNode = children.headTemplate?.[0] as CstNode;
    const bodyNode = children.bodyPattern?.[0] as CstNode;
    const nameNode = children.iriRef?.[0] as CstNode | undefined;
    const forNode = children.forClause?.[0] as CstNode | undefined;

    const rule: Rule = {
      type: 'rule',
      name: nameNode ? this.visitIriRef(nameNode) : undefined,
      head: this.visitHeadTemplate(headNode),
      body: this.visitBodyPattern(bodyNode),
      location: getLocationFromNode(node),
    };

    if (forNode) {
      if (!this.extensions) {
        throw new ExtensionError(
          "The 'FOR ?v IN <shape>' clause is an opt-in extension; enable it with { extensions: true }."
        );
      }
      const forChildren = forNode.children as CSTChildren;
      const focusVar = this.visitVariable(forChildren.variable[0] as CstNode).value;
      const shape = this.visitIriRef(forChildren.iriRef[0] as CstNode);
      return {
        type: 'targetedRule',
        rule,
        focusVar,
        shape,
        direction: 'rule-to-shape',
        location: getLocationFromNode(node),
      };
    }

    // A rule2 naming IRI without a FOR clause is extension-only surface.
    // Detect rule2 by absence of the 'Rule' keyword child (rule1 consumes it).
    const isRule2 = !('Rule' in children) && !!nameNode;
    if (nameNode && isRule2 && !this.extensions) {
      throw new ExtensionError(
        "A naming IRI on an 'IF..THEN' rule requires extensions: { extensions: true }."
      );
    }

    return rule;
  }
```

Note: `visitRule1`/`visitRule2` currently pass the inner rule1/rule2 CST node to `buildRule`. The rule1 node contains the `Rule` token child; the rule2 node does not. The `isRule2` check relies on that. Verify by inspecting `children` keys during Step 8 if the test for the bare rule2 IRI misbehaves.

- [ ] **Step 7: Update the `buildAST` free function**

```ts
export function buildAST(code: string, options?: { extensions?: boolean }): RuleSet {
  const builder = new ASTBuilder();
  return builder.buildRuleSet(code, options);
}
```

- [ ] **Step 8: Export from index + run tests**

In `packages/srl-engine/src/index.ts`, add to the `./srl/ast` export block: `TargetedRule` (type) and `ExtensionError` (value). Since the block mixes `buildAST` (value) and types, add:

```ts
export { buildAST, ExtensionError } from './srl/ast';
```

and add `TargetedRule,` to the `export type { ... } from './srl/ast';` list.

Run: `npm -w srl-engine test -- shapes` → PASS. Then `npm -w srl-engine test` (all green) and `npm -w srl-engine typecheck`.

**Note:** adding `targetedRules` to `RuleSet` may surface typecheck errors anywhere a `RuleSet` literal is constructed. The only constructor is `visitRuleSet`; if typecheck flags others, add `targetedRules: []`.

- [ ] **Step 9: Commit**

```bash
git add packages/srl-engine/src/srl/ast.ts packages/srl-engine/src/index.ts packages/srl-engine/test/shapes.test.ts
git commit -m "feat(srl): TargetedRule AST node + extensions gating"
```

---

## PHASE 1 — Shapes subsystem foundation

### Task 1.1: `rdf-helpers.ts`

**Files:**
- Create: `packages/srl-engine/src/shapes/rdf-helpers.ts`
- Test: `packages/srl-engine/test/shapes.test.ts`

**Interfaces:**
- Produces:
  - IRI constants `SH`, `RDF_TYPE`, `RDFS_SUBCLASSOF`, `RDF_FIRST`, `RDF_REST`, `RDF_NIL`.
  - `termKey(term: Term): string` — value-based identity key.
  - `rdfList(store: Store, node: Term): Term[]` — members of an RDF list, `[]` if not a list.
  - `pyValue(term: Term): number | string | boolean | Term` — comparable JS value for a literal.
  - `localName(iri: string): string | null` — SHACL local name or null.

- [ ] **Step 1: Write the failing test**

Append to `packages/srl-engine/test/shapes.test.ts`:

```ts
import { Store, Parser, DataFactory } from 'n3';
import { rdfList, pyValue, termKey, localName, SH } from '../src/shapes/rdf-helpers';

const { namedNode, literal } = DataFactory;

function storeFrom(ttl: string): Store {
  const s = new Store();
  s.addQuads(new Parser().parse(ttl));
  return s;
}

describe('rdf-helpers', () => {
  it('reads an RDF list in order', () => {
    const store = storeFrom(`@prefix ex: <http://example.org/> .
ex:s ex:list ( ex:a ex:b ex:c ) .`);
    const listHead = store.getQuads(namedNode('http://example.org/s'), namedNode('http://example.org/list'), null, null)[0].object;
    const members = rdfList(store, listHead).map(t => t.value);
    expect(members).toEqual(['http://example.org/a', 'http://example.org/b', 'http://example.org/c']);
  });

  it('returns [] for a non-list node', () => {
    const store = storeFrom(`@prefix ex: <http://example.org/> .\nex:s ex:p ex:o .`);
    expect(rdfList(store, namedNode('http://example.org/o'))).toEqual([]);
  });

  it('coerces xsd:integer literals to numbers', () => {
    expect(pyValue(literal('30', namedNode('http://www.w3.org/2001/XMLSchema#integer')))).toBe(30);
  });

  it('gives value-based term keys', () => {
    expect(termKey(namedNode('http://example.org/x'))).toBe(termKey(namedNode('http://example.org/x')));
  });

  it('extracts SHACL local names', () => {
    expect(localName(`${SH}minCount`)).toBe('minCount');
    expect(localName('http://example.org/x')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm -w srl-engine test -- shapes`
Expected: FAIL — module `../src/shapes/rdf-helpers` not found.

- [ ] **Step 3: Implement `rdf-helpers.ts`**

Create `packages/srl-engine/src/shapes/rdf-helpers.ts`:

```ts
import { Store, Term, Literal, NamedNode, BlankNode } from 'n3';

export const SH = 'http://www.w3.org/ns/shacl#';
export const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
export const RDFS = 'http://www.w3.org/2000/01/rdf-schema#';
export const XSD = 'http://www.w3.org/2001/XMLSchema#';
export const RDF_TYPE = `${RDF}type`;
export const RDFS_SUBCLASSOF = `${RDFS}subClassOf`;
export const RDF_FIRST = `${RDF}first`;
export const RDF_REST = `${RDF}rest`;
export const RDF_NIL = `${RDF}nil`;

/** Value-based identity key for an n3 Term (terms are not reference-unique). */
export function termKey(term: Term): string {
  if (term.termType === 'Literal') {
    const lit = term as Literal;
    return `L:${lit.value}${lit.datatype?.value ?? ''}${lit.language ?? ''}`;
  }
  if (term.termType === 'NamedNode') return `N:${term.value}`;
  if (term.termType === 'BlankNode') return `B:${term.value}`;
  return `${term.termType}:${term.value}`;
}

/** Members of an RDF list starting at `node`, or [] if `node` is not a list head. */
export function rdfList(store: Store, node: Term): Term[] {
  if (node.termType === 'NamedNode' && node.value === RDF_NIL) return [];
  if (node.termType !== 'BlankNode' && node.termType !== 'NamedNode') return [];
  const members: Term[] = [];
  const seen = new Set<string>();
  let cur: Term = node;
  while (!(cur.termType === 'NamedNode' && cur.value === RDF_NIL)) {
    if (seen.has(termKey(cur))) break; // cycle guard
    seen.add(termKey(cur));
    const first = store.getQuads(cur as NamedNode | BlankNode, `${RDF_FIRST}` as unknown as NamedNode, null, null);
    if (first.length === 0) return members.length ? members : [];
    members.push(first[0].object);
    const rest = store.getQuads(cur as NamedNode | BlankNode, `${RDF_REST}` as unknown as NamedNode, null, null);
    if (rest.length === 0) break;
    cur = rest[0].object;
  }
  return members;
}

/** Comparable JS value for a literal (number/boolean/string); other terms pass through. */
export function pyValue(term: Term): number | string | boolean | Term {
  if (term.termType !== 'Literal') return term;
  const lit = term as Literal;
  const dt = lit.datatype?.value ?? '';
  if (dt === `${XSD}integer` || dt === `${XSD}decimal` || dt === `${XSD}double` ||
      dt === `${XSD}float` || dt === `${XSD}long` || dt === `${XSD}int`) {
    const n = Number(lit.value);
    return Number.isNaN(n) ? lit.value : n;
  }
  if (dt === `${XSD}boolean`) return lit.value === 'true' || lit.value === '1';
  return lit.value;
}

/** SHACL local name for an IRI in the sh: namespace, else null. */
export function localName(iri: string): string | null {
  return iri.startsWith(SH) ? iri.slice(SH.length) : null;
}
```

**n3 API note:** `store.getQuads(subject, predicate, object, graph)` accepts either `Term` objects or IRI strings for predicate; passing a string is supported by n3. The `as unknown as NamedNode` casts satisfy TypeScript where the typings are strict — verify against `@types/n3` during typecheck and switch to `DataFactory.namedNode(RDF_FIRST)` if the cast is rejected.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm -w srl-engine test -- shapes`
Expected: PASS. Run `npm -w srl-engine typecheck`; if the string-predicate cast is rejected, replace `` `${RDF_FIRST}` as unknown as NamedNode `` with `namedNode(RDF_FIRST)` (import `DataFactory`).

- [ ] **Step 5: Commit**

```bash
git add packages/srl-engine/src/shapes/rdf-helpers.ts packages/srl-engine/test/shapes.test.ts
git commit -m "feat(shapes): RDF helpers (term keys, rdfList, pyValue)"
```

---

### Task 1.2: `model.ts` + support-matrix doc

**Files:**
- Create: `packages/srl-engine/src/shapes/model.ts`
- Create: `packages/srl-engine/docs/shacl-core-support-matrix.md`
- Test: `packages/srl-engine/test/shapes.test.ts`

**Interfaces:**
- Consumes: `SH`, `RDF_TYPE`, `localName` (Task 1.1).
- Produces:
  - `class UnsupportedShapeFeatureError extends Error`
  - `interface Constraint { kind: string; value: Term }`
  - `interface PropertyShape { path: Term | null; constraints: Constraint[] }`
  - `interface NodeShape { iri: Term; targets: Array<[string, Term]>; constraints: Constraint[]; propertyShapes: PropertyShape[] }`
  - sets `TARGET_PREDS`, `NODE_CONSTRAINTS`, `PROP_CONSTRAINTS`
  - `loadShape(store: Store, shapeIri: Term): NodeShape`

- [ ] **Step 1: Write the failing test**

Append to `packages/srl-engine/test/shapes.test.ts`:

```ts
import { loadShape, UnsupportedShapeFeatureError, TARGET_PREDS } from '../src/shapes/model';

const SHAPES_TTL = `@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix ex: <http://example.org/> .
ex:AdultShape a sh:NodeShape ; sh:targetClass ex:Person ;
  sh:property [ sh:path ex:age ; sh:minCount 1 ; sh:minInclusive 18 ] .`;

describe('loadShape', () => {
  it('parses targets and property shapes', () => {
    const store = storeFrom(SHAPES_TTL);
    const shape = loadShape(store, namedNode('http://example.org/AdultShape'));
    expect(shape.targets).toContainEqual(['targetClass', namedNode('http://example.org/Person')]);
    expect(shape.propertyShapes).toHaveLength(1);
    const ps = shape.propertyShapes[0];
    expect(ps.path).toEqual(namedNode('http://example.org/age'));
    expect(ps.constraints.map(c => c.kind).sort()).toEqual(['minCount', 'minInclusive']);
  });

  it('throws on an unsupported feature', () => {
    const store = storeFrom(`@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix ex: <http://example.org/> .
ex:S a sh:NodeShape ; sh:closed true .`);
    expect(() => loadShape(store, namedNode('http://example.org/S'))).toThrow(UnsupportedShapeFeatureError);
  });

  it('exposes the target predicate set', () => {
    expect(TARGET_PREDS.has('targetClass')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm -w srl-engine test -- shapes`
Expected: FAIL — `../src/shapes/model` not found.

- [ ] **Step 3: Implement `model.ts`** (port of py-srl `model.py`)

Create `packages/srl-engine/src/shapes/model.ts`:

```ts
import { Store, Term, NamedNode, BlankNode } from 'n3';
import { SH, RDF_TYPE, localName } from './rdf-helpers';

export class UnsupportedShapeFeatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedShapeFeatureError';
  }
}

export interface Constraint {
  kind: string;
  value: Term;
}

export interface PropertyShape {
  path: Term | null;
  constraints: Constraint[];
}

export interface NodeShape {
  iri: Term;
  targets: Array<[string, Term]>;
  constraints: Constraint[];
  propertyShapes: PropertyShape[];
}

export const TARGET_PREDS = new Set([
  'targetClass', 'targetNode', 'targetSubjectsOf', 'targetObjectsOf', 'targetWhere', 'shape',
]);

export const NODE_CONSTRAINTS = new Set([
  'class', 'datatype', 'nodeKind', 'hasValue', 'in', 'node',
  'and', 'or', 'not', 'xone', 'rootClass', 'someValue', 'subsetOf',
]);

export const PROP_CONSTRAINTS = new Set([
  ...NODE_CONSTRAINTS,
  'minCount', 'maxCount', 'pattern', 'flags',
  'minInclusive', 'maxInclusive', 'minExclusive', 'maxExclusive',
  'minLength', 'maxLength', 'languageIn', 'uniqueLang',
  'memberShape', 'minListLength', 'maxListLength', 'uniqueMembers',
  'reifierShape', 'reificationRequired',
]);

const IGNORED = new Set(['path']); // structural, handled explicitly

function predicateObjects(store: Store, subject: Term): Array<[Term, Term]> {
  return store.getQuads(subject as NamedNode | BlankNode, null, null, null).map(q => [q.predicate, q.object]);
}

function value(store: Store, subject: Term, predicate: string): Term | null {
  const q = store.getQuads(subject as NamedNode | BlankNode, predicate, null, null);
  return q.length ? q[0].object : null;
}

function loadProperty(store: Store, node: Term): PropertyShape {
  const path = value(store, node, `${SH}path`);
  const constraints: Constraint[] = [];
  for (const [pred, obj] of predicateObjects(store, node)) {
    const name = localName(pred.value);
    if (name === null) continue;
    if (IGNORED.has(name)) continue;
    if (!PROP_CONSTRAINTS.has(name)) {
      throw new UnsupportedShapeFeatureError(`sh:${name} on a property shape is not supported`);
    }
    constraints.push({ kind: name, value: obj });
  }
  return { path, constraints };
}

export function loadShape(store: Store, shapeIri: Term): NodeShape {
  const targets: Array<[string, Term]> = [];
  const constraints: Constraint[] = [];
  const propertyShapes: PropertyShape[] = [];

  for (const [pred, obj] of predicateObjects(store, shapeIri)) {
    if (pred.value === RDF_TYPE) continue;
    const name = localName(pred.value);
    if (name === null) continue;
    if (TARGET_PREDS.has(name)) {
      targets.push([name, obj]);
    } else if (name === 'property') {
      propertyShapes.push(loadProperty(store, obj));
    } else if (NODE_CONSTRAINTS.has(name)) {
      constraints.push({ kind: name, value: obj });
    } else {
      throw new UnsupportedShapeFeatureError(`sh:${name} on a node shape is not supported`);
    }
  }

  return { iri: shapeIri, targets, constraints, propertyShapes };
}
```

- [ ] **Step 4: Create the support-matrix doc**

Create `packages/srl-engine/docs/shacl-core-support-matrix.md`. Port the content from `../py-srl/docs/shacl-core-support-matrix.md` verbatim, replacing the intro pointer at the top with:

```markdown
# SHACL Core support matrix (opt-in `FOR ?v IN <shape>` targeting)

> **Not part of the SHACL 1.2 Rules spec.** This in-house SHACL 1.2 Core subset
> backs the opt-in rule-to-shape targeting extension, reachable only with
> `{ extensions: true }`. With extensions off, none of this is reachable.

The authoritative source of what is supported is the three sets in
[`src/shapes/model.ts`](../src/shapes/model.ts): `TARGET_PREDS`,
`NODE_CONSTRAINTS`, `PROP_CONSTRAINTS`. The `support-matrix.test.ts` drift test
asserts every entry in those sets appears in this document.
```

Then copy the "## Supported" and "## Not supported yet" tables verbatim from the py-srl doc (they list every `sh:` feature by local name — the drift test greps for `sh:<name>`).

- [ ] **Step 5: Run test to verify it passes**

Run: `npm -w srl-engine test -- shapes`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/srl-engine/src/shapes/model.ts packages/srl-engine/docs/shacl-core-support-matrix.md packages/srl-engine/test/shapes.test.ts
git commit -m "feat(shapes): loadShape + SHACL Core support matrix"
```

---

### Task 1.3: `targets.ts` + `conforms` stub + `index.ts`

**Files:**
- Create: `packages/srl-engine/src/shapes/targets.ts`
- Create: `packages/srl-engine/src/shapes/validate.ts` (initial: node-constraint loop calling a `checkConstraint` that handles no kinds yet — throws)
- Create: `packages/srl-engine/src/shapes/index.ts`
- Test: `packages/srl-engine/test/shapes.test.ts`

**Interfaces:**
- Consumes: `loadShape`, `NodeShape` (Task 1.2); `RDF_TYPE`, `RDFS_SUBCLASSOF`, `SH`, `termKey` (Task 1.1).
- Produces:
  - `focusNodes(shape: NodeShape, dataStore: Store, shapesStore: Store): Term[]` (value-deduped)
  - `conforms(node: Term, shape: NodeShape, dataStore: Store, shapesStore: Store): boolean`
  - `checkConstraint(kind, value, focusNode, valueNodes, dataStore, shapesStore, flags?): boolean`

- [ ] **Step 1: Write the failing test**

Append to `packages/srl-engine/test/shapes.test.ts`:

```ts
import { focusNodes } from '../src/shapes/targets';

describe('focusNodes', () => {
  it('selects targetClass instances', () => {
    const shapesStore = storeFrom(SHAPES_TTL);
    const dataStore = storeFrom(`@prefix ex: <http://example.org/> .
ex:Alice a ex:Person . ex:Bob a ex:Person . ex:Widget a ex:Thing .`);
    const shape = loadShape(shapesStore, namedNode('http://example.org/AdultShape'));
    const nodes = focusNodes(shape, dataStore, shapesStore).map(t => t.value).sort();
    expect(nodes).toEqual(['http://example.org/Alice', 'http://example.org/Bob']);
  });

  it('selects targetClass instances via transitive subClassOf', () => {
    const shapesStore = storeFrom(`@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix ex: <http://example.org/> .
ex:S a sh:NodeShape ; sh:targetClass ex:Animal .`);
    const dataStore = storeFrom(`@prefix ex: <http://example.org/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
ex:Dog rdfs:subClassOf ex:Animal . ex:Rex a ex:Dog .`);
    const shape = loadShape(shapesStore, namedNode('http://example.org/S'));
    expect(focusNodes(shape, dataStore, shapesStore).map(t => t.value)).toContain('http://example.org/Rex');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm -w srl-engine test -- shapes`
Expected: FAIL — `../src/shapes/targets` not found.

- [ ] **Step 3: Implement `validate.ts` initial skeleton**

Create `packages/srl-engine/src/shapes/validate.ts` (constraint bodies land in Phases 2–4; this skeleton makes an empty-constraint shape conform):

```ts
import { Store, Term } from 'n3';
import { NodeShape, PropertyShape, UnsupportedShapeFeatureError } from './model';

export function checkConstraint(
  kind: string,
  _value: Term,
  _focusNode: Term,
  _valueNodes: Term[],
  _dataStore: Store,
  _shapesStore: Store,
  _flags?: string,
): boolean {
  throw new UnsupportedShapeFeatureError(`sh:${kind} is not yet evaluable`);
}

function checkProperty(focusNode: Term, prop: PropertyShape, dataStore: Store, shapesStore: Store): boolean {
  const valueNodes = valueNodesOf(focusNode, prop.path, dataStore);
  const flags = prop.constraints.find(c => c.kind === 'flags')?.value.value;
  for (const c of prop.constraints) {
    if (c.kind === 'flags') continue;
    if (!checkConstraint(c.kind, c.value, focusNode, valueNodes, dataStore, shapesStore, flags)) {
      return false;
    }
  }
  return true;
}

// Placeholder until path evaluation lands in Phase 3. Simple IRI path only.
export function valueNodesOf(node: Term, path: Term | null, dataStore: Store): Term[] {
  if (path === null) return [];
  if (path.termType === 'NamedNode') {
    return dataStore.getQuads(node as never, path as never, null, null).map(q => q.object);
  }
  throw new UnsupportedShapeFeatureError('Complex SHACL property paths are not yet supported');
}

export function conforms(node: Term, shape: NodeShape, dataStore: Store, shapesStore: Store): boolean {
  const nodeValues: Term[] = [node];
  const nodeFlags = shape.constraints.find(c => c.kind === 'flags')?.value.value;
  for (const c of shape.constraints) {
    if (c.kind === 'flags') continue;
    if (!checkConstraint(c.kind, c.value, node, nodeValues, dataStore, shapesStore, nodeFlags)) {
      return false;
    }
  }
  for (const prop of shape.propertyShapes) {
    if (!checkProperty(node, prop, dataStore, shapesStore)) return false;
  }
  return true;
}
```

- [ ] **Step 4: Implement `targets.ts`** (port of py-srl `targets.py`)

Create `packages/srl-engine/src/shapes/targets.ts`:

```ts
import { Store, Term } from 'n3';
import { RDF_TYPE, RDFS_SUBCLASSOF, SH, termKey } from './rdf-helpers';
import { NodeShape, loadShape } from './model';
import { conforms } from './validate';

// Subjects of (?, predicate, obj) — used for the class-hierarchy walk.
function subjectsWithObject(store: Store, predicate: string, obj: Term): Term[] {
  return store.getQuads(null, predicate as never, obj as never, null).map(q => q.subject);
}

function subclassInstances(cls: Term, store: Store): Term[] {
  const classes = new Set<string>();
  const classTerms: Term[] = [];
  const frontier: Term[] = [cls];
  while (frontier.length) {
    const cur = frontier.pop() as Term;
    if (classes.has(termKey(cur))) continue;
    classes.add(termKey(cur));
    classTerms.push(cur);
    for (const sub of subjectsWithObject(store, RDFS_SUBCLASSOF, cur)) frontier.push(sub);
  }
  const out: Term[] = [];
  const seen = new Set<string>();
  for (const c of classTerms) {
    for (const inst of subjectsWithObject(store, RDF_TYPE, c)) {
      if (!seen.has(termKey(inst))) { seen.add(termKey(inst)); out.push(inst); }
    }
  }
  return out;
}

function dataNodes(store: Store): Term[] {
  const out: Term[] = [];
  const seen = new Set<string>();
  for (const q of store.getQuads(null, null, null, null)) {
    for (const t of [q.subject, q.object]) {
      if (!seen.has(termKey(t))) { seen.add(termKey(t)); out.push(t); }
    }
  }
  return out;
}

export function focusNodes(shape: NodeShape, dataStore: Store, shapesStore: Store): Term[] {
  const result: Term[] = [];
  const seen = new Set<string>();
  const add = (t: Term) => { if (!seen.has(termKey(t))) { seen.add(termKey(t)); result.push(t); } };

  for (const [name, obj] of shape.targets) {
    if (name === 'targetClass') {
      subclassInstances(obj, dataStore).forEach(add);
    } else if (name === 'targetNode') {
      add(obj);
    } else if (name === 'targetSubjectsOf') {
      // Subjects of any triple whose PREDICATE is `obj`.
      for (const q of dataStore.getQuads(null, obj as never, null, null)) add(q.subject);
    } else if (name === 'targetObjectsOf') {
      // Objects of any triple whose PREDICATE is `obj`.
      for (const q of dataStore.getQuads(null, obj as never, null, null)) add(q.object);
    } else if (name === 'targetWhere') {
      const inline = loadShape(shapesStore, obj);
      for (const candidate of dataNodes(dataStore)) {
        if (conforms(candidate, inline, dataStore, shapesStore)) add(candidate);
      }
    }
  }
  // sh:shape is an implicit target: any data node n with `n sh:shape <shapeIri>`.
  for (const n of subjectsWithObject(dataStore, `${SH}shape`, shape.iri)) add(n);
  return result;
}
```

- [ ] **Step 5: Create the barrel `index.ts`**

Create `packages/srl-engine/src/shapes/index.ts`:

```ts
export {
  NodeShape, PropertyShape, Constraint, UnsupportedShapeFeatureError,
  loadShape, TARGET_PREDS, NODE_CONSTRAINTS, PROP_CONSTRAINTS,
} from './model';
export { focusNodes } from './targets';
export { conforms, checkConstraint, valueNodesOf } from './validate';
export { SH } from './rdf-helpers';
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm -w srl-engine test -- shapes`
Expected: PASS (empty-constraint shapes conform; focus selection works). `npm -w srl-engine typecheck`.

- [ ] **Step 7: Commit**

```bash
git add packages/srl-engine/src/shapes/
git add packages/srl-engine/test/shapes.test.ts
git commit -m "feat(shapes): focusNodes + conforms scaffold + barrel"
```

---

## PHASE 2 — Value-type / cardinality / range / string constraints

### Task 2: `checkConstraint` core constraint kinds

**Files:**
- Modify: `packages/srl-engine/src/shapes/validate.ts`
- Test: `packages/srl-engine/test/shapes.test.ts`

**Interfaces:**
- Consumes: `pyValue`, `rdfList`, `termKey`, `RDF_TYPE`, `RDFS_SUBCLASSOF`, `SH`, `XSD` (Task 1.1).
- Produces: `checkConstraint` handling `minCount`, `maxCount`, `class`, `datatype`, `nodeKind`, `hasValue`, `in`, the four range kinds, `minLength`, `maxLength`, `pattern`.

- [ ] **Step 1: Write the failing test**

Append to `packages/srl-engine/test/shapes.test.ts`:

```ts
import { conforms } from '../src/shapes/validate';

function dataAndShape(shapesTtl: string, dataTtl: string, shapeIri: string) {
  const shapesStore = storeFrom(shapesTtl);
  const dataStore = storeFrom(dataTtl);
  const shape = loadShape(shapesStore, namedNode(shapeIri));
  return { shape, dataStore, shapesStore };
}

describe('checkConstraint: value/cardinality/range/string', () => {
  const SH_PFX = '@prefix sh: <http://www.w3.org/ns/shacl#> .\n@prefix ex: <http://example.org/> .\n@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .\n';

  it('minInclusive + minCount: Alice (30) conforms, Bob (10) fails', () => {
    const shapes = SH_PFX + `ex:S a sh:NodeShape ; sh:property [ sh:path ex:age ; sh:minCount 1 ; sh:minInclusive 18 ] .`;
    const data = `@prefix ex: <http://example.org/> .\nex:Alice ex:age 30 . ex:Bob ex:age 10 .`;
    const { shape, dataStore, shapesStore } = dataAndShape(shapes, data, 'http://example.org/S');
    expect(conforms(namedNode('http://example.org/Alice'), shape, dataStore, shapesStore)).toBe(true);
    expect(conforms(namedNode('http://example.org/Bob'), shape, dataStore, shapesStore)).toBe(false);
  });

  it('datatype: string value conforms, integer fails', () => {
    const shapes = SH_PFX + `ex:S a sh:NodeShape ; sh:property [ sh:path ex:name ; sh:datatype xsd:string ] .`;
    const data = `@prefix ex: <http://example.org/> .\nex:A ex:name "hi" . ex:B ex:name 5 .`;
    const { shape, dataStore, shapesStore } = dataAndShape(shapes, data, 'http://example.org/S');
    expect(conforms(namedNode('http://example.org/A'), shape, dataStore, shapesStore)).toBe(true);
    expect(conforms(namedNode('http://example.org/B'), shape, dataStore, shapesStore)).toBe(false);
  });

  it('nodeKind sh:IRI, hasValue, in, maxCount, pattern', () => {
    const shapes = SH_PFX + `ex:S a sh:NodeShape ;
      sh:property [ sh:path ex:knows ; sh:nodeKind sh:IRI ; sh:maxCount 2 ] ;
      sh:property [ sh:path ex:code ; sh:pattern "^[A-Z]+$" ] .`;
    const data = `@prefix ex: <http://example.org/> .\nex:A ex:knows ex:B ; ex:code "ABC" .`;
    const { shape, dataStore, shapesStore } = dataAndShape(shapes, data, 'http://example.org/S');
    expect(conforms(namedNode('http://example.org/A'), shape, dataStore, shapesStore)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm -w srl-engine test -- shapes`
Expected: FAIL — `checkConstraint` throws `UnsupportedShapeFeatureError` for `minCount`.

- [ ] **Step 3: Implement the constraint kinds** (port of py-srl `validate.py` value/cardinality/range/string branches)

Replace the body of `checkConstraint` in `packages/srl-engine/src/shapes/validate.ts`. Add imports at the top:

```ts
import { pyValue, rdfList, termKey, RDF_TYPE, RDFS_SUBCLASSOF, SH, XSD } from './rdf-helpers';
import { NamedNode } from 'n3';
```

Add these helpers above `checkConstraint`:

```ts
function subclassOf(sub: Term, sup: Term, store: Store): boolean {
  if (termKey(sub) === termKey(sup)) return true;
  const seen = new Set<string>();
  const frontier: Term[] = [sub];
  while (frontier.length) {
    const cur = frontier.pop() as Term;
    if (seen.has(termKey(cur))) continue;
    seen.add(termKey(cur));
    for (const q of store.getQuads(cur as never, RDFS_SUBCLASSOF as never, null, null)) {
      if (termKey(q.object) === termKey(sup)) return true;
      frontier.push(q.object);
    }
  }
  return false;
}

function isInstance(node: Term, cls: Term, store: Store): boolean {
  return store.getQuads(node as never, RDF_TYPE as never, null, null)
    .some(q => subclassOf(q.object, cls, store));
}

const NODEKINDS: Record<string, (t: Term) => boolean> = {
  [`${SH}IRI`]: t => t.termType === 'NamedNode',
  [`${SH}BlankNode`]: t => t.termType === 'BlankNode',
  [`${SH}Literal`]: t => t.termType === 'Literal',
  [`${SH}BlankNodeOrIRI`]: t => t.termType === 'BlankNode' || t.termType === 'NamedNode',
  [`${SH}BlankNodeOrLiteral`]: t => t.termType === 'BlankNode' || t.termType === 'Literal',
  [`${SH}IRIOrLiteral`]: t => t.termType === 'NamedNode' || t.termType === 'Literal',
};

function regexFlags(flags?: string): string {
  let out = '';
  if (!flags) return out;
  const map: Record<string, string> = { i: 'i', s: 's', m: 'm', x: '' };
  for (const ch of flags) if (map[ch] !== undefined) out += map[ch];
  return out;
}
```

Replace `checkConstraint`:

```ts
export function checkConstraint(
  kind: string,
  value: Term,
  focusNode: Term,
  valueNodes: Term[],
  dataStore: Store,
  shapesStore: Store,
  flags?: string,
): boolean {
  // Cardinality
  if (kind === 'minCount') return valueNodes.length >= Number(pyValue(value));
  if (kind === 'maxCount') return valueNodes.length <= Number(pyValue(value));

  // Value type
  if (kind === 'class') return valueNodes.every(vn => isInstance(vn, value, dataStore));
  if (kind === 'datatype') {
    return valueNodes.every(vn => {
      if (vn.termType !== 'Literal') return false;
      const lit = vn as import('n3').Literal;
      let dt = lit.datatype?.value;
      if (!dt && !lit.language) dt = `${XSD}string`;
      return dt === value.value;
    });
  }
  if (kind === 'nodeKind') {
    const pred = NODEKINDS[value.value];
    if (!pred) throw new UnsupportedShapeFeatureError(`sh:nodeKind ${value.value} is not supported`);
    return valueNodes.every(pred);
  }

  // Value
  if (kind === 'hasValue') return valueNodes.some(vn => termKey(vn) === termKey(value));
  if (kind === 'in') {
    const allowed = new Set(rdfList(dataStore, value).map(termKey));
    // sh:in list is authored in the shapes graph, not data — read from shapesStore.
    const allowedShapes = new Set(rdfList(shapesStore, value).map(termKey));
    return valueNodes.every(vn => allowed.has(termKey(vn)) || allowedShapes.has(termKey(vn)));
  }

  // Range (numeric)
  if (kind === 'minInclusive' || kind === 'maxInclusive' || kind === 'minExclusive' || kind === 'maxExclusive') {
    const bound = pyValue(value);
    return valueNodes.every(vn => {
      const v = pyValue(vn);
      if (typeof v !== 'number' || typeof bound !== 'number') return false;
      if (kind === 'minInclusive') return v >= bound;
      if (kind === 'maxInclusive') return v <= bound;
      if (kind === 'minExclusive') return v > bound;
      return v < bound;
    });
  }

  // String
  if (kind === 'minLength' || kind === 'maxLength') {
    const bound = Number(pyValue(value));
    return valueNodes.every(vn => {
      if (vn.termType === 'BlankNode') return false;
      const len = vn.value.length;
      return kind === 'minLength' ? len >= bound : len <= bound;
    });
  }
  if (kind === 'pattern') {
    const re = new RegExp(value.value, regexFlags(flags));
    return valueNodes.every(vn => vn.termType !== 'BlankNode' && re.test(vn.value));
  }

  throw new UnsupportedShapeFeatureError(`sh:${kind} is not yet evaluable`);
}
```

**Note on `sh:in`:** in SHACL, `sh:in` values live in the shapes graph. py-srl reads from `graph` (the data graph in its signature) because it merges graphs; here we check both stores to be safe. Keep the dual-store lookup.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm -w srl-engine test -- shapes`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/srl-engine/src/shapes/validate.ts packages/srl-engine/test/shapes.test.ts
git commit -m "feat(shapes): value-type/cardinality/range/string constraints"
```

---

## PHASE 3 — Logical + shape-based constraints + property paths

### Task 3: logical, shape-based, path conversion, rootClass/subsetOf

**Files:**
- Modify: `packages/srl-engine/src/shapes/validate.ts`
- Test: `packages/srl-engine/test/shapes.test.ts`

**Interfaces:**
- Consumes: `evaluatePath`-equivalent — reuse the engine's `PathExpression` + a local `shaclPathToAst`; the engine's path evaluator is not exported, so implement a small local `valueNodesViaPath` using n3 `getQuads` for IRI + inverse + sequence (mirrors `pattern-matcher.ts`).
- Produces: `checkConstraint` handling `node`, `someValue`, `and`, `or`, `xone`, `not`, `rootClass`, `subsetOf`; `valueNodesOf` upgraded to support `sh:inversePath` + RDF-list sequence paths.

- [ ] **Step 1: Write the failing test**

Append to `packages/srl-engine/test/shapes.test.ts`:

```ts
describe('checkConstraint: logical + shape-based + paths', () => {
  const SH_PFX = '@prefix sh: <http://www.w3.org/ns/shacl#> .\n@prefix ex: <http://example.org/> .\n';

  it('sh:not — node WITHOUT ex:banned conforms', () => {
    const shapes = SH_PFX + `ex:S a sh:NodeShape ; sh:not ex:BannedShape .
ex:BannedShape a sh:NodeShape ; sh:property [ sh:path ex:banned ; sh:minCount 1 ] .`;
    const data = `@prefix ex: <http://example.org/> .\nex:Clean ex:ok true . ex:Bad ex:banned true .`;
    const { shape, dataStore, shapesStore } = dataAndShape(shapes, data, 'http://example.org/S');
    expect(conforms(namedNode('http://example.org/Clean'), shape, dataStore, shapesStore)).toBe(true);
    expect(conforms(namedNode('http://example.org/Bad'), shape, dataStore, shapesStore)).toBe(false);
  });

  it('sh:inversePath — value nodes reached backwards', () => {
    const shapes = SH_PFX + `ex:S a sh:NodeShape ; sh:property [ sh:path [ sh:inversePath ex:parent ] ; sh:minCount 1 ] .`;
    const data = `@prefix ex: <http://example.org/> .\nex:Child ex:parent ex:Parent .`;
    const { shape, dataStore, shapesStore } = dataAndShape(shapes, data, 'http://example.org/S');
    expect(conforms(namedNode('http://example.org/Parent'), shape, dataStore, shapesStore)).toBe(true);
    expect(conforms(namedNode('http://example.org/Child'), shape, dataStore, shapesStore)).toBe(false);
  });

  it('sh:or — conforms if any branch holds', () => {
    const shapes = SH_PFX + `ex:S a sh:NodeShape ; sh:or ( ex:A ex:B ) .
ex:A a sh:NodeShape ; sh:property [ sh:path ex:a ; sh:minCount 1 ] .
ex:B a sh:NodeShape ; sh:property [ sh:path ex:b ; sh:minCount 1 ] .`;
    const data = `@prefix ex: <http://example.org/> .\nex:X ex:b 1 .`;
    const { shape, dataStore, shapesStore } = dataAndShape(shapes, data, 'http://example.org/S');
    expect(conforms(namedNode('http://example.org/X'), shape, dataStore, shapesStore)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm -w srl-engine test -- shapes`
Expected: FAIL — `sh:not` unsupported; inversePath path throws.

- [ ] **Step 3: Add path handling + shape-ref recursion**

In `packages/srl-engine/src/shapes/validate.ts`, add above `checkConstraint`:

```ts
import { rdfList as listOf } from './rdf-helpers';
import { loadShape } from './model';

function conformsShapeRef(node: Term, ref: Term, dataStore: Store, shapesStore: Store): boolean {
  return conforms(node, loadShape(shapesStore, ref), dataStore, shapesStore);
}

// SHACL RDF path → value nodes reachable from `node` (IRI / sh:inversePath / list-sequence).
function valueNodesViaPath(node: Term, path: Term, dataStore: Store, shapesStore: Store): Term[] {
  if (path.termType === 'NamedNode') {
    return dataStore.getQuads(node as never, path as never, null, null).map(q => q.object);
  }
  // sh:inversePath
  const inv = shapesStore.getQuads(path as never, `${SH}inversePath` as never, null, null);
  if (inv.length) {
    const innerPath = inv[0].object;
    if (innerPath.termType === 'NamedNode') {
      return dataStore.getQuads(null, innerPath as never, node as never, null).map(q => q.subject);
    }
    // nested inverse/sequence: recurse by walking backwards is uncommon; support IRI inverse only.
    throw new UnsupportedShapeFeatureError('Nested inverse SHACL paths are not supported');
  }
  // RDF-list sequence path
  const members = listOf(shapesStore, path);
  if (members.length) {
    let current: Term[] = [node];
    for (const step of members) {
      const next: Term[] = [];
      for (const t of current) next.push(...valueNodesViaPath(t, step, dataStore, shapesStore));
      current = next;
    }
    return current;
  }
  throw new UnsupportedShapeFeatureError(`Unsupported SHACL property path: ${path.value}`);
}
```

Upgrade `valueNodesOf` (replace the earlier stub):

```ts
export function valueNodesOf(node: Term, path: Term | null, dataStore: Store, shapesStore: Store): Term[] {
  if (path === null) return [];
  return valueNodesViaPath(node, path, dataStore, shapesStore);
}
```

Update the two call sites (`checkProperty`) to pass `shapesStore`:

```ts
  const valueNodes = valueNodesOf(focusNode, prop.path, dataStore, shapesStore);
```

- [ ] **Step 4: Add logical + shape-based + rootClass/subsetOf branches**

Insert into `checkConstraint`, just before the final `throw`:

```ts
  // Shape-based
  if (kind === 'node') return valueNodes.every(vn => conformsShapeRef(vn, value, dataStore, shapesStore));
  if (kind === 'someValue') return valueNodes.some(vn => conformsShapeRef(vn, value, dataStore, shapesStore));

  // Logical
  if (kind === 'and') {
    const shapes = listOf(shapesStore, value);
    return valueNodes.every(vn => shapes.every(s => conformsShapeRef(vn, s, dataStore, shapesStore)));
  }
  if (kind === 'or') {
    const shapes = listOf(shapesStore, value);
    return valueNodes.every(vn => shapes.some(s => conformsShapeRef(vn, s, dataStore, shapesStore)));
  }
  if (kind === 'xone') {
    const shapes = listOf(shapesStore, value);
    return valueNodes.every(vn => shapes.filter(s => conformsShapeRef(vn, s, dataStore, shapesStore)).length === 1);
  }
  if (kind === 'not') {
    return valueNodes.every(vn => !conformsShapeRef(vn, value, dataStore, shapesStore));
  }

  // 1.2 additions
  if (kind === 'rootClass') {
    return valueNodes.every(vn => subclassOf(vn, value, dataStore));
  }
  if (kind === 'subsetOf') {
    const superset = new Set(valueNodesViaPath(focusNode, value, dataStore, shapesStore).map(termKey));
    return valueNodes.every(vn => superset.has(termKey(vn)));
  }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm -w srl-engine test -- shapes`
Expected: PASS. `npm -w srl-engine typecheck`.

- [ ] **Step 6: Commit**

```bash
git add packages/srl-engine/src/shapes/validate.ts packages/srl-engine/test/shapes.test.ts
git commit -m "feat(shapes): logical, shape-based, path, rootClass/subsetOf"
```

---

## PHASE 4 — List family + language + reifier + drift test

### Task 4: remaining constraint kinds + support-matrix drift test

**Files:**
- Modify: `packages/srl-engine/src/shapes/validate.ts`
- Create: `packages/srl-engine/test/support-matrix.test.ts`
- Test: `packages/srl-engine/test/shapes.test.ts`

**Interfaces:**
- Produces: `checkConstraint` handling `languageIn`, `uniqueLang`, `memberShape`, `minListLength`, `maxListLength`, `uniqueMembers`, `reifierShape`, `reificationRequired`.

- [ ] **Step 1: Write the failing tests**

Append to `packages/srl-engine/test/shapes.test.ts`:

```ts
describe('checkConstraint: list family + language', () => {
  const SH_PFX = '@prefix sh: <http://www.w3.org/ns/shacl#> .\n@prefix ex: <http://example.org/> .\n';

  it('sh:maxListLength', () => {
    const shapes = SH_PFX + `ex:S a sh:NodeShape ; sh:property [ sh:path ex:items ; sh:maxListLength 2 ] .`;
    const data = `@prefix ex: <http://example.org/> .\nex:A ex:items ( ex:x ex:y ) . ex:B ex:items ( ex:x ex:y ex:z ) .`;
    const { shape, dataStore, shapesStore } = dataAndShape(shapes, data, 'http://example.org/S');
    expect(conforms(namedNode('http://example.org/A'), shape, dataStore, shapesStore)).toBe(true);
    expect(conforms(namedNode('http://example.org/B'), shape, dataStore, shapesStore)).toBe(false);
  });

  it('sh:languageIn', () => {
    const shapes = SH_PFX + `ex:S a sh:NodeShape ; sh:property [ sh:path ex:label ; sh:languageIn ( "en" "de" ) ] .`;
    const data = `@prefix ex: <http://example.org/> .\nex:A ex:label "hi"@en . ex:B ex:label "salut"@fr .`;
    const { shape, dataStore, shapesStore } = dataAndShape(shapes, data, 'http://example.org/S');
    expect(conforms(namedNode('http://example.org/A'), shape, dataStore, shapesStore)).toBe(true);
    expect(conforms(namedNode('http://example.org/B'), shape, dataStore, shapesStore)).toBe(false);
  });
});
```

Create `packages/srl-engine/test/support-matrix.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TARGET_PREDS, NODE_CONSTRAINTS, PROP_CONSTRAINTS } from '../src/shapes/model';

describe('SHACL Core support matrix', () => {
  it('documents every supported feature', () => {
    const path = fileURLToPath(new URL('../docs/shacl-core-support-matrix.md', import.meta.url));
    const doc = readFileSync(path, 'utf-8');
    const supported = new Set([...TARGET_PREDS, ...NODE_CONSTRAINTS, ...PROP_CONSTRAINTS]);
    const missing = [...supported].filter(name => !doc.includes(`sh:${name}`));
    expect(missing).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm -w srl-engine test -- shapes support-matrix`
Expected: FAIL — `maxListLength`/`languageIn` unsupported. Support-matrix test should PASS already if the doc was ported completely in Task 1.2 (if it fails, the doc is missing entries — add them).

- [ ] **Step 3: Add the remaining branches**

Insert into `checkConstraint`, before the final `throw`. Add `import { XSD } from './rdf-helpers';` if not present:

```ts
  // String (language)
  if (kind === 'languageIn') {
    const langs = listOf(shapesStore, value).map(t => t.value.toLowerCase());
    const matches = (tag: string | undefined) => {
      if (!tag) return false;
      const t = tag.toLowerCase();
      return langs.some(p => t === p || t.startsWith(p + '-'));
    };
    return valueNodes.every(vn => vn.termType === 'Literal' && matches((vn as import('n3').Literal).language));
  }
  if (kind === 'uniqueLang') {
    if (pyValue(value) !== true) return true;
    const seen = new Set<string>();
    for (const vn of valueNodes) {
      if (vn.termType === 'Literal') {
        const lang = (vn as import('n3').Literal).language;
        if (lang) { if (seen.has(lang)) return false; seen.add(lang); }
      }
    }
    return true;
  }

  // List family
  if (kind === 'memberShape') {
    return valueNodes.every(vn =>
      listOf(dataStore, vn).every(m => conformsShapeRef(m, value, dataStore, shapesStore)));
  }
  if (kind === 'minListLength' || kind === 'maxListLength') {
    const bound = Number(pyValue(value));
    return valueNodes.every(vn => {
      const count = listOf(dataStore, vn).length;
      return kind === 'minListLength' ? count >= bound : count <= bound;
    });
  }
  if (kind === 'uniqueMembers') {
    if (pyValue(value) !== true) return true;
    return valueNodes.every(vn => {
      const members = listOf(dataStore, vn).map(termKey);
      return members.length === new Set(members).size;
    });
  }

  // Reification (best-effort; n3 lacks first-class triple terms — vacuously true)
  if (kind === 'reifierShape' || kind === 'reificationRequired') return true;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm -w srl-engine test -- shapes support-matrix`
Expected: PASS. Full parity with py-srl's support matrix reached.

- [ ] **Step 5: Commit**

```bash
git add packages/srl-engine/src/shapes/validate.ts packages/srl-engine/test/shapes.test.ts packages/srl-engine/test/support-matrix.test.ts
git commit -m "feat(shapes): list family, language constraints, drift test"
```

---

## PHASE 5 — Engine wiring (executor + stratifier + validator)

### Task 5.1: Stratifier gate

**Files:**
- Modify: `packages/srl-engine/src/rules/stratifier.ts`
- Test: `packages/srl-engine/test/shape-targeting.test.ts` (new)

**Interfaces:**
- Consumes: `TargetedRule` (ast); `NodeShape`, `loadShape`, `shapeReferencedPredicates`; `Store`.
- Produces:
  - `shapeReferencedPredicates(shape: NodeShape): Set<string>`
  - `StratifiedTargetedRule { targetedRule: TargetedRule; originalIndex: number }`
  - `StratificationLayer.targeted: StratifiedTargetedRule[]`
  - `stratifyRules(rules: Rule[], targetedRules?: TargetedRule[], shapesStore?: Store): StratificationLayer[]`

- [ ] **Step 1: Write the failing test**

Create `packages/srl-engine/test/shape-targeting.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { Store, Parser, DataFactory } from 'n3';
import { buildAST, stratifyRules } from '../src/index';
import { loadShape } from '../src/shapes/model';
import { shapeReferencedPredicates } from '../src/rules/stratifier';

const { namedNode } = DataFactory;
function storeFrom(ttl: string): Store {
  const s = new Store(); s.addQuads(new Parser().parse(ttl)); return s;
}

const SHAPES = `@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix ex: <http://example.org/> .
ex:AdultShape a sh:NodeShape ; sh:targetClass ex:Person ;
  sh:property [ sh:path ex:age ; sh:minCount 1 ; sh:minInclusive 18 ] .`;

describe('shapeReferencedPredicates', () => {
  it('collects rdf:type (targetClass) and the property path IRI', () => {
    const shape = loadShape(storeFrom(SHAPES), namedNode('http://example.org/AdultShape'));
    const preds = shapeReferencedPredicates(shape);
    expect(preds.has('http://www.w3.org/1999/02/22-rdf-syntax-ns#type')).toBe(true);
    expect(preds.has('http://example.org/age')).toBe(true);
  });
});

describe('stratifyRules with a targeted gate', () => {
  it('places a targeted rule above a plain rule that feeds its shape predicate', () => {
    // r1 infers ex:age; targeted rule gated on AdultShape (reads ex:age) must be higher.
    const src = `PREFIX ex: <http://example.org/>
RULE { ?x ex:age 40 } WHERE { ?x ex:bornYear ?y }
RULE ex:r FOR ?this IN ex:AdultShape { ?this ex:status ex:adult } WHERE { ?this ex:age ?a }`;
    const rs = buildAST(src, { extensions: true });
    const shapesStore = storeFrom(SHAPES);
    const layers = stratifyRules(rs.rules, rs.targetedRules, shapesStore);
    // find the layer index holding the targeted rule and the plain rule
    let targetedLayer = -1, plainLayer = -1;
    layers.forEach((l, i) => {
      if (l.targeted.length) targetedLayer = i;
      if (l.general.length || l.once.length) plainLayer = Math.max(plainLayer, i);
    });
    expect(targetedLayer).toBeGreaterThan(0);
    expect(targetedLayer).toBeGreaterThanOrEqual(plainLayer);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm -w srl-engine test -- shape-targeting`
Expected: FAIL — `shapeReferencedPredicates` not exported; `stratifyRules` arity/`.targeted` missing.

- [ ] **Step 3: Extend the stratifier**

In `packages/srl-engine/src/rules/stratifier.ts`:

Add imports at top:

```ts
import { Store } from 'n3';
import { TargetedRule } from '../srl/ast';
import { NodeShape, loadShape } from '../shapes/model';
```

Add near the other exported types:

```ts
export interface StratifiedTargetedRule {
  targetedRule: TargetedRule;
  originalIndex: number;
}
```

Change `StratificationLayer`:

```ts
export interface StratificationLayer {
  once: StratifiedRule[];
  general: StratifiedRule[];
  targeted: StratifiedTargetedRule[];
}
```

Add the predicate-reader helper (port of `shape_referenced_predicates`):

```ts
const RDF_TYPE_IRI = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

export function shapeReferencedPredicates(shape: NodeShape): Set<string> {
  const preds = new Set<string>();
  for (const [name, obj] of shape.targets) {
    if (name === 'targetClass') preds.add(RDF_TYPE_IRI);
    else if (name === 'targetSubjectsOf' || name === 'targetObjectsOf') {
      if (obj.termType === 'NamedNode') preds.add(obj.value);
    }
  }
  for (const c of shape.constraints) if (c.kind === 'class') preds.add(RDF_TYPE_IRI);
  for (const ps of shape.propertyShapes) {
    if (ps.path && ps.path.termType === 'NamedNode') preds.add(ps.path.value);
    for (const c of ps.constraints) if (c.kind === 'class') preds.add(RDF_TYPE_IRI);
  }
  return preds;
}
```

Add a helper mirroring py-srl `_head_predicate_iris`:

```ts
function headPredicateIris(rule: Rule): { iris: Set<string>; hasVar: boolean } {
  const iris = new Set<string>();
  let hasVar = false;
  for (const p of rule.head.patterns) {
    const pred = p.predicate;
    if (isRDFTerm(pred)) {
      if (pred.termType === 'iri') iris.add(pred.value);
      else if (pred.termType === 'variable') hasVar = true;
    } else {
      // path in head is not valid in template family; treat as var-like
      hasVar = true;
    }
  }
  return { iris, hasVar };
}
```

Replace `stratifyRules` with an overloaded version that appends targeted vertices and gate edges:

```ts
export function stratifyRules(
  rules: Rule[],
  targetedRules: TargetedRule[] = [],
  shapesStore?: Store,
): StratificationLayer[] {
  const n = rules.length;
  const m = targetedRules.length;
  if (n === 0 && m === 0) return [];

  const edges = buildDependencyGraph(rules);

  // Targeted rules occupy vertices n..n+m-1. A targeted rule's own body may
  // depend (open/closed) on plain-rule heads; and the gate adds a closed edge
  // from each targeted rule to any rule whose head asserts a shape-read predicate.
  if (m > 0) {
    for (let t = 0; t < m; t++) {
      const tvertex = n + t;
      const tr = targetedRules[t];
      // Body dependencies of the wrapped rule on plain rules.
      const bodyDeps = bodyPatternDependencies(tr.rule);
      const forceClosed = hasAssignment(tr.rule) || headHasBlankNode(tr.rule);
      for (const { pattern, label } of bodyDeps) {
        const lbl: EdgeLabel = forceClosed ? CLOSED : label;
        for (let j = 0; j < n; j++) {
          if (patternDependsOnRule(pattern, rules[j])) edges.push({ from: tvertex, to: j, label: lbl });
        }
      }
      // Gate edges.
      if (shapesStore) {
        const shape = loadShape(shapesStore, /* Term */ termForShape(tr.shape));
        const refs = shapeReferencedPredicates(shape);
        if (refs.size) {
          for (let j = 0; j < n; j++) {
            const { iris, hasVar } = headPredicateIris(rules[j]);
            if (hasVar || [...iris].some(i => refs.has(i))) {
              edges.push({ from: tvertex, to: j, label: CLOSED });
            }
          }
          for (let t2 = 0; t2 < m; t2++) {
            if (t2 === t) continue;
            const { iris, hasVar } = headPredicateIris(targetedRules[t2].rule);
            if (hasVar || [...iris].some(i => refs.has(i))) {
              edges.push({ from: tvertex, to: n + t2, label: CLOSED });
            }
          }
        }
      }
    }
  }

  const total = n + m;
  const stratum = assignStratumNumbers(total, edges);
  const maxStratum = stratum.length ? Math.max(...stratum) : 0;

  const layers: StratificationLayer[] = Array.from({ length: maxStratum + 1 }, () => ({
    once: [], general: [], targeted: [],
  }));

  for (let i = 0; i < n; i++) {
    const entry: StratifiedRule = { rule: rules[i], originalIndex: i };
    if (isRunOnce(rules[i])) layers[stratum[i]].once.push(entry);
    else layers[stratum[i]].general.push(entry);
  }
  for (let t = 0; t < m; t++) {
    layers[stratum[n + t]].targeted.push({ targetedRule: targetedRules[t], originalIndex: t });
  }

  return layers;
}
```

Add a small helper to turn the shape IRI string into an n3 Term (needed for `loadShape`):

```ts
import { DataFactory } from 'n3';
function termForShape(iri: string) {
  return DataFactory.namedNode(iri);
}
```

**Note:** `buildDependencyGraph` returns `Edge[]`; `assignStratumNumbers` accepts `(n, edges)`. Both remain unchanged. `bodyPatternDependencies`, `patternDependsOnRule`, `hasAssignment`, `headHasBlankNode`, `isRunOnce`, `CLOSED`, `EdgeLabel`, `isRDFTerm` are already in-module (import `isRDFTerm` from pattern-matcher is already present at top).

- [ ] **Step 4: Fix `isStratifiable` + existing single-arg callers**

`isStratifiable(rules)` calls `stratifyRules(rules)` — still valid (targetedRules defaults to `[]`). No change needed. `executor.ts` calls `stratifyRules(allRules)` — still valid. `validator.ts` calls `isStratifiable(allRules)` — still valid. Existing tests that iterate `layer.once`/`layer.general` are unaffected; any that construct a `StratificationLayer` literal must add `targeted: []` (grep for `once:` in tests).

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm -w srl-engine test -- shape-targeting`
Expected: PASS. Then `npm -w srl-engine test` (all green) + `npm -w srl-engine typecheck`.

- [ ] **Step 6: Commit**

```bash
git add packages/srl-engine/src/rules/stratifier.ts packages/srl-engine/test/shape-targeting.test.ts
git commit -m "feat(engine): stratifier gate for targeted rules"
```

---

### Task 5.2: Executor seed

**Files:**
- Modify: `packages/srl-engine/src/rules/executor.ts`
- Test: `packages/srl-engine/test/shape-targeting.test.ts`

**Interfaces:**
- Consumes: `focusNodes`, `conforms`, `loadShape` (shapes); `TargetedRule` (ast); `stratifyRules` with targeted args (Task 5.1); the store-building path already in `executeRules`.
- Produces: `ExecutorOptions` gains `extensions?: boolean`, `shapesGraph?: string`, `shapesStore?: Store`. `executeRules` evaluates `ruleSet.targetedRules` per stratum.

- [ ] **Step 1: Write the failing test**

Append to `packages/srl-engine/test/shape-targeting.test.ts` (this is the ported py-srl oracle):

```ts
import { executeRules } from '../src/index';

const DATA = `@prefix ex: <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
ex:Alice rdf:type ex:Person ; ex:age 30 .
ex:Bob rdf:type ex:Person ; ex:age 10 .`;

const RULE_SRC = `PREFIX ex: <http://example.org/>
RULE ex:r FOR ?this IN ex:AdultShape { ?this ex:status ex:adult } WHERE { ?this ex:age ?a }`;

describe('executeRules with targeted rules (py-srl oracle)', () => {
  it('fires only for conforming focus nodes', () => {
    const rs = buildAST(RULE_SRC, { extensions: true });
    const result = executeRules(rs, DATA, { extensions: true, shapesGraph: SHAPES });
    const inferred = result.inferredTriples.map(t => t.quadString);
    expect(inferred).toContain('<http://example.org/Alice> <http://example.org/status> <http://example.org/adult>');
    expect(inferred).not.toContain('<http://example.org/Bob> <http://example.org/status> <http://example.org/adult>');
  });

  it('errors (not throws) when a targeted rule set has no shapes graph', () => {
    const rs = buildAST(RULE_SRC, { extensions: true });
    const result = executeRules(rs, DATA, { extensions: true });
    expect(result.errors.join(' ')).toMatch(/shapes graph/i);
  });

  it('sees inferred target membership across strata', () => {
    const src = `PREFIX ex: <http://example.org/>
RULE { ?x ex:age 40 } WHERE { ?x ex:bornYear ?y }
RULE ex:r FOR ?this IN ex:AdultShape { ?this ex:status ex:adult } WHERE { ?this ex:age ?a }`;
    const data = `@prefix ex: <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
ex:Dana rdf:type ex:Person ; ex:bornYear 1980 .`;
    const rs = buildAST(src, { extensions: true });
    const result = executeRules(rs, data, { extensions: true, shapesGraph: SHAPES });
    const inferred = result.inferredTriples.map(t => t.quadString);
    expect(inferred).toContain('<http://example.org/Dana> <http://example.org/age> "40"^^<http://www.w3.org/2001/XMLSchema#integer>');
    expect(inferred).toContain('<http://example.org/Dana> <http://example.org/status> <http://example.org/adult>');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm -w srl-engine test -- shape-targeting`
Expected: FAIL — targeted rules never evaluated; no status triple inferred.

- [ ] **Step 3: Extend `ExecutorOptions` + build the shapes store**

In `packages/srl-engine/src/rules/executor.ts`:

Add imports:

```ts
import { focusNodes } from '../shapes/targets';
import { conforms } from '../shapes/validate';
import { loadShape } from '../shapes/model';
import { DataFactory } from 'n3';
import { TargetedRule } from '../srl/ast';
```

Extend the interface + defaults:

```ts
export interface ExecutorOptions {
  maxIterations?: number;
  includeBaseTriples?: boolean;
  extensions?: boolean;
  shapesGraph?: string;
  shapesStore?: Store;
}
```

(`DEFAULT_OPTIONS` unchanged — new fields default undefined/false.)

- [ ] **Step 4: Build the shapes store + targeted RuleInfos**

In `executeRules`, after the base store `G0` is populated and before `stratifyRules`, add:

```ts
  // Resolve the shapes graph (opt-in targeting). shapesStore wins if both given.
  let shapesStore: Store | undefined = opts.shapesStore;
  if (!shapesStore && opts.shapesGraph) {
    try {
      shapesStore = new Store();
      shapesStore.addQuads(new N3Parser().parse(opts.shapesGraph));
    } catch (e) {
      errors.push(`Failed to parse shapes graph: ${e instanceof Error ? e.message : String(e)}`);
      shapesStore = undefined;
    }
  }
  const targetedRules = ruleSet.targetedRules ?? [];
  if (targetedRules.length > 0 && !shapesStore) {
    errors.push('Targeted rules (FOR ?v IN <shape>) require a shapes graph; pass options.shapesGraph or options.shapesStore.');
  }
```

Change the `stratifyRules` call to pass targeted rules + shapes store:

```ts
  let stratified: StratificationLayer[] = [];
  try {
    stratified = stratifyRules(allRules, shapesStore ? targetedRules : [], shapesStore);
  } catch (e) {
    errors.push(`Stratification failed: ${e instanceof Error ? e.message : String(e)}`);
  }
```

Add targeted RuleInfos after the existing `ruleInfos` array is built:

```ts
  const targetedRuleInfos = new Map<TargetedRule, RuleInfo>();
  targetedRules.forEach((tr, t) => {
    targetedRuleInfos.set(tr, {
      index: allRules.length + 1 + t,
      name: tr.rule.name ?? `Targeted rule ${t + 1} (FOR ?${tr.focusVar})`,
      location: tr.location,
      head: tr.rule.head.patterns,
      originalRule: tr.rule,
    });
  });
```

- [ ] **Step 5: Add the targeted-rule application inside the stratum loop**

Add a helper next to `applyRule` (inside `executeRules`, so it closes over `store`/`seenTriples`/`inferredTriples`/`errors`):

```ts
  const applyTargetedRule = (tr: TargetedRule): boolean => {
    if (!shapesStore) return false;
    const ruleInfo = targetedRuleInfos.get(tr)!;
    let produced = false;
    try {
      const shape = loadShape(shapesStore, DataFactory.namedNode(tr.shape));
      const candidates = focusNodes(shape, store, shapesStore);
      for (const node of candidates) {
        if (!conforms(node, shape, store, shapesStore)) continue;
        const seed: SolutionMapping = { [tr.focusVar]: node };
        const solutions = evaluateElements(tr.rule.body.elements, [seed], store);
        for (const solution of solutions) {
          for (const headPattern of tr.rule.head.patterns) {
            const quad = instantiateTriple(headPattern, solution);
            if (quad) {
              const quadStr = quadToString(quad);
              if (!seenTriples.has(quadStr)) {
                seenTriples.add(quadStr);
                store.addQuad(quad);
                inferredTriples.push({ quad, quadString: quadStr, sourceRule: ruleInfo, iteration: totalIterations });
                produced = true;
              }
            }
          }
        }
      }
    } catch (e) {
      errors.push(`Error evaluating targeted rule "${ruleInfo.name}": ${e instanceof Error ? e.message : String(e)}`);
    }
    return produced;
  };
```

**Note:** `evaluateElements` is module-private in executor.ts — the helper is defined inside `executeRules`, which is in the same module, so it can call it directly. Confirm `evaluateElements` is in scope (it is a top-level function in the file).

In the stratum loop, run targeted rules. A targeted rule whose wrapped rule `isRunOnce` fires once with the run-once rules; otherwise it iterates with the general rules. Simplest correct placement: fire run-once targeted rules in the once-phase, and iterate the rest in the general loop. Modify the loop:

```ts
  for (const layer of stratified) {
    totalIterations++;
    for (const stratRule of layer.once) applyRule(stratRule);
    for (const st of layer.targeted) {
      if (isRunOnce(st.targetedRule.rule)) applyTargetedRule(st.targetedRule);
    }

    const generalTargeted = layer.targeted.filter(st => !isRunOnce(st.targetedRule.rule));
    let layerIteration = 0;
    let changed = layer.general.length > 0 || generalTargeted.length > 0;

    while (changed && layerIteration < (opts.maxIterations || 100)) {
      changed = false;
      layerIteration++;
      totalIterations++;
      for (const stratRule of layer.general) if (applyRule(stratRule)) changed = true;
      for (const st of generalTargeted) if (applyTargetedRule(st.targetedRule)) changed = true;
    }
  }
```

Import `isRunOnce` from the stratifier (add to the existing `stratifier` import): `import { stratifyRules, StratificationLayer, StratifiedRule, isRunOnce } from './stratifier';`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm -w srl-engine test -- shape-targeting`
Expected: PASS (all three). Then `npm -w srl-engine test` (all green) + `npm -w srl-engine typecheck`.

- [ ] **Step 7: Commit**

```bash
git add packages/srl-engine/src/rules/executor.ts packages/srl-engine/test/shape-targeting.test.ts
git commit -m "feat(engine): conformance-gated evaluation of targeted rules"
```

---

### Task 5.3: Validator basis + index exports

**Files:**
- Modify: `packages/srl-engine/src/validation/validator.ts`
- Modify: `packages/srl-engine/src/index.ts`
- Test: `packages/srl-engine/test/shape-targeting.test.ts`

**Interfaces:**
- Consumes: `buildAST` with `{ extensions }`; `checkWellFormedSequence` (already accepts `v0`); `TargetedRule`.
- Produces: `validateSRL(code, options?: { extensions?: boolean; shapesGraph?: string; shapesStore?: Store })`; exports of shapes API + `focusNodes`/`conforms`/`loadShape`.

- [ ] **Step 1: Write the failing test**

Append to `packages/srl-engine/test/shape-targeting.test.ts`:

```ts
import { validateSRL } from '../src/index';

describe('validateSRL for targeted rules', () => {
  it('reports a FOR clause as invalid when extensions are off', () => {
    const result = validateSRL(RULE_SRC);
    expect(result.isValid).toBe(false);
    expect(result.messages.some(m => /extension/i.test(m.message))).toBe(true);
  });

  it('accepts a targeted rule as valid when extensions are on (focus var bound)', () => {
    const result = validateSRL(RULE_SRC, { extensions: true });
    expect(result.isValid).toBe(true);
  });

  it('flags an unbound head variable in a targeted rule (focus var does not cover it)', () => {
    const bad = `PREFIX ex: <http://example.org/>
RULE ex:r FOR ?this IN ex:AdultShape { ?this ex:status ?missing } WHERE { ?this ex:age ?a }`;
    const result = validateSRL(bad, { extensions: true });
    expect(result.isValid).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm -w srl-engine test -- shape-targeting`
Expected: FAIL — `validateSRL` ignores options / targeted rules not validated.

- [ ] **Step 3: Thread options + validate targeted rules**

In `packages/srl-engine/src/validation/validator.ts`:

Import the type + `ExtensionError` handling is automatic (buildAST throws it; the existing try/catch around buildAST catches and reports). Add `TargetedRule` to the ast import and `Store` from n3:

```ts
import { buildAST, RuleSet, Rule, BodyElement, TriplePattern, Expression, SourceLocation, TargetedRule } from '../srl/ast';
```

Refactor `checkRuleWellFormedness` to accept an initial bound set:

```ts
function checkRuleWellFormedness(rule: Rule, messages: ValidationMessage[], v0: Set<string> = new Set()): void {
  const vAll = checkWellFormedSequence(rule.body.elements, v0, messages);

  const headVars = new Set<string>();
  for (const template of rule.head.patterns) {
    for (const v of variablesInPattern(template)) headVars.add(v);
  }
  for (const v of headVars) {
    if (!vAll.has(v)) {
      messages.push(locToMessage('error', `Variable '?${v}' in rule head is not bound in rule body`, rule.location));
    }
  }
}
```

In `checkAstSemantics`, validate targeted rules with `v0 = { focusVar }` and include them in the stratification set:

```ts
function checkAstSemantics(ruleSet: RuleSet, shapesStore?: import('n3').Store): ValidationMessage[] {
  const messages: ValidationMessage[] = [];

  for (const rule of ruleSet.rules) {
    checkRuleWellFormedness(rule, messages);
  }
  for (const tr of ruleSet.targetedRules) {
    checkRuleWellFormedness(tr.rule, messages, new Set([tr.focusVar]));
  }

  // DATA blocks must be ground.
  for (const block of ruleSet.dataBlocks) {
    for (const triple of block.patterns) {
      if (variablesInPattern(triple).size > 0) {
        messages.push(locToMessage('error', 'DATA blocks must be ground (no variables allowed)', triple.location ?? block.location));
      }
    }
  }

  const expanded = expandDeclarations(ruleSet.declarations, ruleSet.prefixes);
  const allRules = [...ruleSet.rules, ...expanded];
  const strat = isStratifiable(allRules);
  if (!strat.stratifiable) {
    messages.push(locToMessage('error', strat.reason ?? 'Rule set is not stratifiable'));
  }

  return messages;
}
```

Update `validateSRL` signature + the `buildAST` call:

```ts
export function validateSRL(
  code: string,
  options?: { extensions?: boolean; shapesGraph?: string; shapesStore?: import('n3').Store },
): ValidationResult {
```

and inside, change:

```ts
      try {
        const ruleSet = buildAST(code, { extensions: options?.extensions });
        messages.push(...checkAstSemantics(ruleSet));
      } catch (e) {
```

The existing catch reports the `ExtensionError` message as an error, so an off-extensions `FOR` becomes an invalid result — exactly the first test's expectation.

- [ ] **Step 4: Add public exports**

In `packages/srl-engine/src/index.ts`, add a shapes section:

```ts
// ── Shapes (opt-in FOR ?v IN <shape> targeting) ─────────────────────
export {
  loadShape, focusNodes, conforms,
  UnsupportedShapeFeatureError,
  type NodeShape, type PropertyShape, type Constraint,
} from './shapes';
```

Add `shapeReferencedPredicates` to the stratifier export block and `StratifiedTargetedRule` to its type exports.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm -w srl-engine test -- shape-targeting`
Expected: PASS. Then `npm -w srl-engine test` (all green) + `npm -w srl-engine typecheck`.

- [ ] **Step 6: Commit**

```bash
git add packages/srl-engine/src/validation/validator.ts packages/srl-engine/src/index.ts packages/srl-engine/test/shape-targeting.test.ts
git commit -m "feat(engine): validate targeted rules with focus-var basis + export shapes API"
```

---

## PHASE 6 — Docs, examples, final verification

### Task 6: docs + build gate

**Files:**
- Modify: `packages/srl-engine/README.md`, `packages/srl-engine/docs/GUIDE.md`, repo `docs/BACKLOG.md`
- Create: `packages/srl-engine/examples/for-in-shape.srl` (+ a shapes/data companion if the examples dir has that convention)

- [ ] **Step 1: Update BACKLOG.md**

In `docs/BACKLOG.md`, in the "Extension: `FOR ?v IN <shape>`" section, mark X1–X6 done and note X7 (RDF surface + Monaco) still deferred. Add a one-line pointer to the design + plan docs and to `packages/srl-engine/src/shapes/`.

- [ ] **Step 2: Update README + GUIDE**

In `packages/srl-engine/README.md`: add a "SHACL shape targeting (opt-in extension)" subsection documenting `buildAST(code, { extensions: true })`, `executeRules(rs, data, { extensions: true, shapesGraph })`, and that it is off by default. In `docs/GUIDE.md`: add a worked example (the AdultShape/Alice/Bob case from the tests).

- [ ] **Step 3: Add an example file**

Create `packages/srl-engine/examples/for-in-shape.srl`:

```
PREFIX ex: <http://example.org/>
RULE ex:r FOR ?this IN ex:AdultShape
  { ?this ex:status ex:adult }
WHERE
  { ?this ex:age ?a }
```

- [ ] **Step 4: Full verification gate**

Run all three, confirm each succeeds:

```bash
npm -w srl-engine typecheck
npm -w srl-engine test
npm -w srl-engine build
```

Expected: typecheck 0 errors; all test files pass (`shapes.test.ts`, `shape-targeting.test.ts`, `support-matrix.test.ts`, plus pre-existing `smoke`/`fixtures`); build emits `dist/` cleanly.

- [ ] **Step 5: Commit**

```bash
git add packages/srl-engine/README.md packages/srl-engine/docs/GUIDE.md docs/BACKLOG.md packages/srl-engine/examples/for-in-shape.srl
git commit -m "docs(srl-engine): document FOR ?v IN <shape> extension + example"
```

---

## Notes for the implementer

- **py-srl is the oracle.** When behavior is ambiguous, match `../py-srl/src/srl/shapes/*.py` and `../py-srl/tests/test_shape_targeting.py`. The RDF-roundtrip test (`test_targeted_rule_rdf_roundtrip`) is intentionally **not** ported — it needs an RDF-SRL serializer, which is out of scope (backlog X7).
- **n3 term comparison** is the single biggest porting hazard. rdflib gives term hashing for free; here every set/dedup goes through `termKey`. If a test shows duplicate or missing focus nodes, suspect a raw `Set<Term>` or `===`.
- **n3 string-vs-Term predicates:** `store.getQuads` accepts IRI strings for the predicate slot at runtime, but `@types/n3` may type it as `Term | null`. Where TypeScript objects, wrap with `DataFactory.namedNode(...)`. The plan uses `as never` casts in a few spots; prefer `namedNode(...)` if the cast reads poorly.
- **Regex `x` flag:** SHACL/XPath `x` (verbose) has no JS equivalent; it is dropped in `regexFlags` (documented divergence, matches practical behavior).
- **Do not reorder `allTokens`** beyond inserting `For` among the keywords — token order is priority order for the lexer.
