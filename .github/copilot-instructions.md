# SHACL Rules Playground - Copilot Instructions

## Project Overview

A Next.js 16 + React 19 web playground for authoring and validating **SHACL 1.2 Rules** using the **SRL (Shape Rules Language)**. Features dual Monaco editors for RDF data (Turtle) and SRL rules, with real-time syntax validation and semantic analysis.

**File extension**: `.srl` | **Media type**: `text/shape-rules`

## Architecture

### Key Data Flow

```
SRL Editor → Lexer (tokens.ts) → Parser (parser.ts) → Validator (validator.ts) → Monaco Markers
                                                    ↓
                                          Semantic Analysis (prefix/variable checks)
```

### Core Modules

| Path                              | Purpose                                                                                |
| --------------------------------- | -------------------------------------------------------------------------------------- |
| `src/lib/srl/tokens.ts`           | Chevrotain lexer - defines all SRL tokens (keywords, operators, literals)              |
| `src/lib/srl/parser.ts`           | Chevrotain CST parser - grammar rules matching SHACL 1.2 spec                          |
| `src/lib/validation/validator.ts` | Combines parse errors + semantic warnings (undefined prefixes, unbound head variables) |
| `src/lib/monaco/srl-language.ts`  | Monaco syntax highlighting, hover docs, and code completion for SRL                    |
| `src/components/Playground.tsx`   | Main UI orchestrator - manages editor state, validation, and panel layout              |

---

## SRL Language Specification (SHACL 1.2)

### Rule Syntax (Three Equivalent Forms)

```srl
# Form 1: RULE ... WHERE
RULE { ?x :childOf ?y } WHERE { ?y :parentOf ?x }

# Form 2: IF ... THEN
IF { ?y :parentOf ?x } THEN { ?x :childOf ?y }

# Form 3: Datalog-style (head :- body)
{ ?x :childOf ?y } :- { ?y :parentOf ?x }
```

### Core Grammar (Selected Productions)

| #   | Production     | Definition                                                                             |
| --- | -------------- | -------------------------------------------------------------------------------------- |
| 1   | RuleSet        | `( Prologue ( Rule \| Data ) )*`                                                       |
| 2   | Prologue       | `( BaseDecl \| PrefixDecl \| VersionDecl \| ImportsDecl )*`                            |
| 8   | Rule           | `Rule1 \| Rule2 \| Rule3 \| Declaration`                                               |
| 9   | Rule1          | `'RULE' HeadTemplate 'WHERE' BodyPattern`                                              |
| 10  | Rule2          | `'IF' BodyPattern 'THEN' HeadTemplate`                                                 |
| 11  | Rule3          | `HeadTemplate ':-' BodyPattern`                                                        |
| 12  | Declaration    | `'TRANSITIVE' '(' iri ')' \| 'SYMMETRIC' '(' iri ')' \| 'INVERSE' '(' iri ',' iri ')'` |
| 13  | Data           | `'DATA' TriplesTemplateBlock`                                                          |
| 15  | BodyPattern    | `'{' BodyPattern1 '}'`                                                                 |
| 17  | BodyNotTriples | `Filter \| Negation \| Assignment`                                                     |
| 19  | Negation       | `'NOT' '{' BodyBasic '}'`                                                              |
| 26  | Assignment     | `'BIND' '(' Expression 'AS' Var ')'`                                                   |
| 29  | Filter         | `'FILTER' Constraint`                                                                  |
| 65  | ReifiedTriple  | `'<<' Subject Verb Object '>>'`                                                        |
| 75  | Var            | `VAR1 ('?name') \| VAR2 ('$name')`                                                     |

### Abstract Syntax Elements

| Element                  | Description                                            |
| ------------------------ | ------------------------------------------------------ |
| **variable**             | Represents a possible RDF term (`?x` or `$x`)          |
| **triple template**      | 3-tuple in head - each element is variable or RDF term |
| **triple pattern**       | 3-tuple in body - matched against data graph           |
| **condition expression** | Boolean filter (`FILTER(?x > 0)`)                      |
| **assignment**           | Variable binding (`BIND(expr AS ?var)`)                |
| **negation element**     | Negation-as-failure (`NOT { pattern }`)                |
| **rule head**            | Sequence of triple templates to generate               |
| **rule body**            | Sequence of patterns, filters, assignments             |

### Well-Formedness Conditions

Rules must satisfy these conditions (enforced by `validator.ts`):

1. **Head variables must be bound**: Every variable in head triple templates must appear in body triple patterns OR in a BIND assignment
2. **Expression variables in scope**: Every variable in an expression at position `i` must occur in a triple pattern or assignment at position `j < i`
3. **Unique assignment variables**: Each assignment variable used in only one BIND
4. **No forward references**: Assignment variable at position `i` cannot appear in triple pattern at position `j > i`

### Shorthand Declarations

```srl
# Expands to: RULE { ?a :prop ?c } WHERE { ?a :prop ?b . ?b :prop ?c }
TRANSITIVE(:ancestorOf)

# Expands to: RULE { ?b :prop ?a } WHERE { ?a :prop ?b }
SYMMETRIC(:friendOf)

# Declares inverse relationship
INVERSE(:parentOf, :childOf)
```

---

## Rule Evaluation Algorithm

### Evaluation Definitions

| Term                     | Definition                                                    |
| ------------------------ | ------------------------------------------------------------- |
| **solution mapping (μ)** | Partial function `V → T` mapping variables to RDF terms       |
| **base graph**           | Input RDF graph                                               |
| **evaluation graph**     | Base graph + all inferred triples                             |
| **graphMatch(G, TP)**    | Returns all solutions μ where `subst(μ, TP)` is a triple in G |
| **compatible(μ1, μ2)**   | True if μ1 and μ2 agree on shared variables                   |
| **merge(μ1, μ2)**        | Combined solution when compatible                             |

### Rule Evaluation Algorithm

```
Input: Rule R = (Head H, Body B), Graph G
Output: Set of inferred triples

1. SEQ = { μ0 }  // Start with empty solution

2. For each body element in B:
   - If triple pattern TP:
     X = graphMatch(G, TP)
     SEQ = { merge(μ1, μ2) | μ1 ∈ X, μ2 ∈ SEQ, compatible(μ1, μ2) }

   - If condition FILTER(F):
     SEQ = { μ ∈ SEQ | eval(μ, F) = true }

   - If assignment BIND(expr AS ?v):
     SEQ = { μ ∪ {?v → eval(expr, μ)} | μ ∈ SEQ }

3. Generate head triples:
   Result = { subst(μ, TT) | μ ∈ SEQ, TT ∈ H }
```

### Rule Set Evaluation (Fixed-Point)

```
Input: Base graph G0, Rule set RS
Output: Inferred graph GI

1. Apply stratification to RS → layers L
2. GI = G0
3. For each layer in L:
     repeat:
       finished = true
       for each rule R in layer:
         X = eval(R, GI)
         Y = { t ∈ X | t ∉ GI }  // New triples only
         if Y not empty:
           finished = false
           GI = GI ∪ Y
     until finished
4. Return GI \ G0  // Inferred triples only
```

### Stratification (for Negation)

Rules with negation require stratification to ensure correct evaluation order:

1. **Layer 0** = base graph predicates
2. **Rule dependency**: R1 depends on R2 if R1's body can match R2's head predicates
3. **Negation constraint**: Negated predicates must have lower layer than the rule
4. **Algorithm**: Iteratively assign layer labels based on dependencies

---

## Development Commands

```bash
npm run dev   # Start dev server at http://localhost:3000
npm run build # Production build
npm run lint  # ESLint check
```

## Key Patterns

### Adding New SRL Keywords

1. Add token to `src/lib/srl/tokens.ts` - order matters (put in `allTokens` array at correct priority)
2. Add grammar rule to `src/lib/srl/parser.ts` using Chevrotain's fluent API
3. Add Monaco highlighting in `srl-language.ts` keywords array
4. Add completion/hover docs in `registerSRLLanguage()`

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

- **Chevrotain**: Parser/lexer toolkit for SRL grammar
- **N3.js**: RDF/Turtle parsing for data graph
- **Monaco Editor**: Code editing with custom SRL language support
- **shacl-engine**: SHACL validation (future rule execution)
- **react-resizable-panels**: UI layout

## Planned Features (from plans/)

The `plans/plan-runRules.prompt.md` outlines future work:

- AST transformer (`src/lib/srl/ast.ts`)
- Rule execution engine with fixed-point iteration (`src/lib/rules/executor.ts`)
- Pattern matching via N3.Store (`src/lib/rules/pattern-matcher.ts`)
- Provenance tracking for inferred triples

## Conventions

- Client components use `'use client'` directive
- Dynamic imports for Monaco editors (no SSR)
- Theme-aware styling via `theme` prop ('light' | 'dark')
- Validation runs on every SRL edit (debounced via `useValidation` hook)
