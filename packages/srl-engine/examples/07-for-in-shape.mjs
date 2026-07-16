// 07 — FOR ?v IN <shape>  (opt-in extension)
//
// Demonstrates SHACL shape targeting: a rule fires only for focus nodes that
// conform to a named SHACL shape.  The focus variable (?this) is pre-bound to
// each conforming node; the body and head see it as already set.
//
// This feature is NOT part of W3C SHACL 1.2 Rules — it requires
// { extensions: true } in every API call that touches FOR clauses.
//
// Run with:  node examples/07-for-in-shape.mjs
// (build first: npm -w srl-engine run build)

import { buildAST, validateSRL, executeRules } from 'srl-engine';

// ── Shapes graph ─────────────────────────────────────────────────────────────
// ex:AdultShape targets instances of ex:Person that have ex:age >= 18.
const shapes = `
  @prefix sh:  <http://www.w3.org/ns/shacl#> .
  @prefix ex:  <http://example.org/> .

  ex:AdultShape a sh:NodeShape ;
    sh:targetClass ex:Person ;
    sh:property [
      sh:path         ex:age ;
      sh:minCount     1 ;
      sh:minInclusive 18
    ] .`;

// ── SRL rules ─────────────────────────────────────────────────────────────────
// The FOR clause seeds ?this with every node conforming to ex:AdultShape.
// The body then matches ?this ex:age ?a (already bound, so it just verifies
// the age triple exists), and the head asserts ex:status ex:adult.
const srl = `PREFIX ex: <http://example.org/>

RULE ex:adultStatus FOR ?this IN ex:AdultShape
  { ?this ex:status ex:adult }
WHERE
  { ?this ex:age ?a }`;

// ── RDF data ──────────────────────────────────────────────────────────────────
// Alice (age 30) conforms to AdultShape; Bob (age 10) does not.
const data = `
  @prefix ex:  <http://example.org/> .
  @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

  ex:Alice rdf:type ex:Person ; ex:age 30 .
  ex:Bob   rdf:type ex:Person ; ex:age 10 .`;

// ── Pipeline ──────────────────────────────────────────────────────────────────

// 1. Validate — extensions:true is required for FOR clauses.
const report = validateSRL(srl, { extensions: true });
if (!report.isValid) {
  for (const m of report.messages) {
    console.error(`${m.type} ${m.startLine}:${m.startColumn} — ${m.message}`);
  }
  process.exit(1);
}

// 2. Parse.
const ruleSet = buildAST(srl, { extensions: true });

// 3. Execute — supply the shapes graph as a Turtle string via shapesGraph.
//    (Alternatively pass a pre-parsed n3 Store as shapesStore.)
const result = executeRules(ruleSet, data, {
  extensions:  true,
  shapesGraph: shapes,
});

console.log(`Inferred ${result.inferredTriples.length} triple(s):`);
for (const t of result.inferredTriples) {
  console.log(`  ${t.quadString}   ← ${t.sourceRule.name}`);
}

if (result.errors.length) {
  console.error('Errors:', result.errors);
}

// Expected output:
//   Inferred 1 triple(s):
//   <http://example.org/Alice> <http://example.org/status> <http://example.org/adult>   ← Rule: adultStatus
//
// Bob is NOT in the output — age 10 < 18, so Bob does not conform to
// ex:AdultShape and the rule never fires for him.
