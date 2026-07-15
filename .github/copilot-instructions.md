# SHACL Rules Playground - Copilot Instructions

## Project Overview

A Next.js 16 + React 19 web playground for authoring and validating **SHACL 1.2 Rules** using the **SRL (Shape Rules Language)**. Features dual Monaco editors for RDF data (Turtle) and SRL rules, with real-time syntax validation and semantic analysis.

**File extension**: `.srl` | **Media type**: `application/shape-rules` (per spec §8)

## Architecture

### Key Data Flow

```
SRL Editor → Lexer (tokens.ts) → Parser (parser.ts) → buildAST (ast.ts) → Validator (validator.ts) → Monaco Markers
                                                                        ↘ (Run Rules) executeRules (executor.ts) → Inferred triples
```

### Core Modules

| Path                              | Purpose                                                                                 |
| --------------------------------- | --------------------------------------------------------------------------------------- |
| `src/lib/srl/tokens.ts`           | Chevrotain lexer - defines all SRL tokens (keywords, operators, literals)               |
| `src/lib/srl/parser.ts`           | Chevrotain CST parser - grammar rules matching SHACL 1.2 spec                           |
| `src/lib/srl/ast.ts`              | CST → typed `RuleSet` AST (`buildAST`)                                                   |
| `src/lib/validation/validator.ts` | Parse errors + prefix notices (token scan) + AST-based §4.2 well-formedness/stratification |
| `src/lib/rules/executor.ts`       | Fixed-point engine (stratifier + pattern-matcher + expression-evaluator)                |
| `src/lib/monaco/srl-language.ts`  | Monaco syntax highlighting, hover docs, and code completion for SRL                     |
| `src/components/Playground.tsx`   | Main UI orchestrator - manages editor state, validation, and panel layout               |

---

## SRL Language Specification (SHACL 1.2)

### Rule Syntax (Two Equivalent Forms)

```srl
# Form 1: RULE iri? ... WHERE   (optional IRI names the rule)
RULE { ?x :childOf ?y } WHERE { ?y :parentOf ?x }
RULE :childRule { ?x :childOf ?y } WHERE { ?y :parentOf ?x }

# Form 2: IF ... THEN
IF { ?y :parentOf ?x } THEN { ?x :childOf ?y }
```

The datalog `{ head } :- { body }` form was **removed** from the spec and no
longer parses.

### Core Grammar (Selected Productions — spec numbering)

| #    | Production                | Definition                                                                             |
| ---- | ------------------------- | -------------------------------------------------------------------------------------- |
| 1    | RuleSet                   | `Prologue ( RuleOrData+ ( Prologue1 RuleOrData? )* )?` (interspersed prologue allowed) |
| 5    | Prologue1                 | `BaseDecl \| PrefixDecl \| VersionDecl \| ImportsDecl`                                 |
| 11   | Rule                      | `Rule1 \| Rule2 \| Declaration`                                                        |
| 12   | Rule1                     | `'RULE' iri? HeadTemplate 'WHERE' BodyPattern`                                         |
| 13   | Rule2                     | `'IF' BodyPattern 'THEN' HeadTemplate`                                                 |
| 27   | Declaration               | `'TRANSITIVE' '(' iri ')' \| '(' iri ')' 'SYMMETRIC' \| 'INVERSE' '(' iri ',' iri ')'` |
| 14   | Data                      | `'DATA' '{' TriplesTemplate? '}'` (ground triples only)                                |
| 15   | HeadTemplate              | `'{' TriplesTemplate? '}'` (template family — no property paths)                       |
| 16   | BodyPattern               | `'{' BodyTriplesBlock? ( BodyNotTriples '.'? BodyTriplesBlock? )* '}'` (dot optional)  |
| 17   | BodyNotTriples            | `Filter \| Negation \| Assignment`                                                     |
| 23   | Negation                  | `'NOT' '{' BodyBasic '}'` (triple patterns + FILTER only)                              |
| 26   | Assignment                | `'SET' '(' Var ':=' Expression ')'`                                                    |
| 18   | Filter                    | `'FILTER' Constraint`                                                                  |
| 87–91| Path                      | sequence (`/`) and inverse (`^`) only — no `*`,`+`,`?`,`\|`, no negated set            |
| —    | Var                       | `VAR1 ('?name') \| VAR2 ('$name')`                                                     |

Head and DATA use the **template** triple family (predicate is an IRI, variable,
or `a` — no paths). Bodies use the **pattern** family (predicate may be a property
path or a variable).

### Abstract Syntax Elements

| Element                   | Description                                            |
| ------------------------- | ------------------------------------------------------ |
| **variable**              | Represents a possible RDF term (`?x` or `$x`)          |
| **triple template**       | 3-tuple in head/DATA — each element is variable or RDF term |
| **triple pattern**        | 3-tuple in body — matched against data graph           |
| **condition expression**  | Boolean filter (`FILTER(?x > 0)`)                      |
| **assignment**            | Variable assignment (`SET(?var := expr)`)              |
| **negation element**      | Negation-as-failure (`NOT { pattern }`)                |
| **rule head**             | Sequence of triple templates to generate               |
| **rule body**             | Sequence of patterns, filters, assignments             |

### Well-Formedness Conditions (spec §4.2, AST-based in `validator.ts`)

Processing the body left-to-right with `V_{i-1}` = variables defined by strictly-earlier elements:

1. **FILTER**: every variable it references is in `V_{i-1}`
2. **SET**: expression variables are in `V_{i-1}`, and the assigned variable is **new** (not already in `V_{i-1}`) — single-assignment, no forward reference
3. **NOT**: its body is a well-formed sequence given `V_{i-1}`; variables bound only inside the negation do **not** leak out
4. **Head**: every head-template variable is in `V_all` (the whole body's bound set)
5. **DATA** blocks must be ground; expression function names must be in the spec `[121]` built-in set

### Shorthand Declarations

```srl
# Expands to: RULE { ?a :prop ?c } WHERE { ?a :prop ?b . ?b :prop ?c }
TRANSITIVE(:ancestorOf)

# Postfix syntax — the IRI precedes the keyword.
# Expands to: RULE { ?b :prop ?a } WHERE { ?a :prop ?b }
(:friendOf) SYMMETRIC

# Declares inverse relationship (expands to two rules)
INVERSE(:parentOf, :childOf)
```

There is **no** `REFLEXIVE` declaration in SHACL 1.2 Rules.

---

## Rule Evaluation Algorithm

### Evaluation Definitions

| Term                     | Definition                                                    |
| ------------------------ | ------------------------------------------------------------- |
| **solution mapping (μ)** | Partial function `V → T` mapping variables to RDF terms       |
| **G0 (base graph)**      | Input RDF graph                                               |
| **GE (evaluation graph)**| `G0 ∪ DATA ∪ inferred` — used for matching                    |
| **GI (inference graph)** | `{ t ∈ DATA \| t ∉ G0 } ∪ inferred` — the output             |
| **graphMatch(G, TP)**    | Returns all solutions μ where `subst(μ, TP)` is a triple in G |
| **compatible(μ1, μ2)**   | True if μ1 and μ2 agree on shared variables                   |
| **merge(μ1, μ2)**        | Combined solution when compatible                             |

### Rule Evaluation Algorithm (spec §6.4)

```
Input: Rule R = (Head H, Body B), Graph GE
Output: Set of inferred triples

1. SEQ = { μ0 }  // Start with the empty solution

2. For each body element in B (left-to-right):
   - triple pattern TP:  X = graphMatch(GE, TP)
                         SEQ = { merge(μ1, μ2) | μ1 ∈ X, μ2 ∈ SEQ, compatible(μ1, μ2) }
   - FILTER F:           SEQ = { μ ∈ SEQ | EBV(eval(F, μ)) = true }
   - NOT N:              SEQ = { μ ∈ SEQ | evalRuleElements(N, {μ}, GE) is empty }
   - SET(?v := expr):    for each μ, x = eval(expr, μ);
                         if x is not an error: SEQ keeps μ ∪ {?v → x}
                         if x IS an error:     μ is dropped
   If SEQ becomes empty, return ∅.

3. Head instantiation: Result = { subst(μ, TT) | μ ∈ SEQ, TT ∈ H }
```

### Rule Set Evaluation — Fixed-Point (spec §6.5)

```
Input: Base graph G0, resolved rule set RS
Output: Inference graph GI

GE = G0 ∪ DATA
GI = { t ∈ DATA | t ∉ G0 }
for each stratum ST in stratification(RS):        // in order
    for each run-once rule R in ST.once:          // exactly once, first
        Y = eval(R, GE) \ GE; GI ∪= Y; GE ∪= Y
    repeat:                                        // general rules to fixpoint
        finished = true
        for each general rule R in ST.general:
            Y = eval(R, GE) \ GE
            if Y not empty: finished = false; GI ∪= Y; GE ∪= Y
    until finished (or maxIterations)
return GI
```

A **run-once rule** has a `SET` assignment or a blank node in its head; it runs
exactly once per stratum (so blank-node-head rules don't mint fresh bnodes forever).

### Stratification — Open/Closed Dependencies (spec §4.3–4.4)

1. **Dependency**: R1 → R2 when a head template of R2 could match a body triple pattern of R1.
2. **Closed edge** when: the matching pattern is inside a `NOT` of R1, **or** R1 has a `SET`, **or** R1's head contains a blank node. Otherwise **open**.
3. **Condition**: reject any cycle containing a closed edge (throws `StratificationError`).
4. **Layer numbers**: open `p→q` ⇒ stratum(p) ≥ stratum(q); closed ⇒ stratum(p) > stratum(q). Iterate to a fixpoint with a `numRules+1` guard.

---

## Development Commands

```bash
npm run dev   # Start dev server at http://localhost:3000
npm run build # Production build
npm run lint  # ESLint check
```

## Key Patterns

### Adding New SRL Keywords

1. Add token to `src/lib/srl/tokens.ts` - order matters (put in `allTokens` array at correct priority; give keywords a `(?![\w:-])` boundary lookahead)
2. Add grammar rule to `src/lib/srl/parser.ts` using Chevrotain's fluent API + register it in `RULE_CATEGORIES`
3. Add CST-visitor handling + AST type in `src/lib/srl/ast.ts`
4. Add runtime semantics (`executor.ts`/`expression-evaluator.ts`/`stratifier.ts`) and any well-formedness check in `validator.ts`
5. Add Monaco highlighting/hover/completion in `srl-language.ts`

### Validation Message Types

```typescript
// Defined in validator.ts - ValidationMessage
type: "error"; // Parse failures - blocks execution
type: "warning"; // Semantic issues (undefined prefix, unbound variable)
type: "info"; // Hints (duplicate prefix declarations)
```

### Adding Examples

Add to `src/lib/examples/examples.ts` following the `Example` interface - include `srlCode` and optional `rdfData`.

## Dependencies

- **Chevrotain** (v11): Parser/lexer toolkit for SRL grammar
- **N3.js**: RDF/Turtle parsing + `Store` for pattern matching
- **Monaco Editor**: Code editing with custom SRL language support
- **react-resizable-panels**: UI layout

## Backlog

Deferred (parse to errors today): RDF-1.2 rich terms (collections `( )`,
blank-node lists `[ ]`, reified triples `<< >>`, triple terms `<<( )>>`,
reifiers/annotations `~` / `{| |}`), and extended property paths
(`*`/`+`/`?`/`|`, negated property sets). See README "Not Yet Implemented".

## Conventions

- Client components use `'use client'` directive
- Dynamic imports for Monaco editors (no SSR)
- Theme-aware styling via `theme` prop ('light' | 'dark')
- Validation runs on every SRL edit (debounced via `useValidation` hook)
