// 03 — Negation (NOT) and computed values (SET)
//
// Combines closed-world negation with a computed assignment: compute a
// :displayName from given + family name, but ONLY for people not flagged with
// an explicit :hasCustomName. The negated property (:hasCustomName) is DISTINCT
// from the head property (:displayName) — a rule that negated its own output
// property would form a closed self-cycle and fail stratification (that case is
// shown in 05-validation-diagnostics).
//
// Run:  node examples/03-negation-and-set.mjs

import { validateSRL, buildAST, executeRules } from 'srl-engine';

const srl = `PREFIX : <http://example.org/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

RULE { ?x :displayName ?DN } WHERE {
    ?x rdf:type :Person .
    NOT { ?x :hasCustomName true } .
    ?x :givenName ?gn ;
       :familyName ?fn .
    SET(?DN := CONCAT(?gn, " ", ?fn))
}`;

const data = `@prefix : <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

:john rdf:type :Person ;
    :givenName "John" ;
    :familyName "Doe" .

# Jane opted out of the auto-generated display name.
:jane rdf:type :Person ;
    :givenName "Jane" ;
    :familyName "Smith" ;
    :hasCustomName true .`;

const report = validateSRL(srl);
if (!report.isValid) {
  console.error('Validation failed:', report.messages);
  process.exit(1);
}

const result = executeRules(buildAST(srl), data);

console.log(`Inferred ${result.inferredTriples.length} triple(s):`);
for (const t of result.inferredTriples) console.log(`  ${t.quadString}`);
// Expected: exactly ONE triple — :john :displayName "John Doe".
// Jane is skipped because NOT { ?x :hasCustomName true } fails for her.
