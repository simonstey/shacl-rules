// 04 — Property paths (sequence `/` and inverse `^`)
//
// The engine supports sequence and inverse paths (the two the spec keeps for
// SRL bodies). This finds grandparents via a sequence path and colleagues via
// an inverse+sequence combination.
//
// Run:  node examples/04-property-paths.mjs

import { buildAST, executeRules, formatTripleForDisplay } from 'srl-engine';

const srl = `PREFIX : <http://example.org/>

# Grandparent: parentOf followed by parentOf
RULE { ?gc :grandparentOf ?gp } WHERE {
    ?gc ^:parentOf/^:parentOf ?gp
}

# Colleagues: worksFor, then the inverse of worksFor back to a different person
RULE { ?a :colleagueOf ?b } WHERE {
    ?a :worksFor/^:worksFor ?b .
    FILTER(?a != ?b)
}`;

const data = `@prefix : <http://example.org/> .

:alice :parentOf :bob .
:bob :parentOf :carol .

:john :worksFor :acme .
:jane :worksFor :acme .
:pat  :worksFor :globex .`;

const ruleSet = buildAST(srl);
const result = executeRules(ruleSet, data);

console.log(`Inferred ${result.inferredTriples.length} triple(s):`);
for (const t of result.inferredTriples) {
  const { subject, predicate, object } = formatTripleForDisplay(t.quad, ruleSet.prefixes);
  console.log(`  ${subject} ${predicate} ${object}`);
}
// Expected: :carol :grandparentOf :alice, plus the symmetric colleague pairs
// :john/:jane (but NOT pat, who works elsewhere; and nobody is their own colleague).
