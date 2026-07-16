// 02 — Transitive closure & shorthand declarations
//
// TRANSITIVE / SYMMETRIC / INVERSE declarations expand into synthetic rules at
// run time. This shows a transitive property computed to a fixed point plus a
// symmetric one (note the POSTFIX `(:prop) SYMMETRIC` syntax).
//
// Run:  node examples/02-transitive-and-declarations.mjs

import { buildAST, executeRules, formatTripleForDisplay } from 'srl-engine';

const srl = `PREFIX : <http://example.org/>

# Direct ancestor = parent
RULE { ?x :ancestorOf ?y } WHERE { ?x :parentOf ?y }

# Transitive closure of ancestorOf
TRANSITIVE(:ancestorOf)

# siblingOf is symmetric — the IRI comes BEFORE the keyword
(:siblingOf) SYMMETRIC`;

const data = `@prefix : <http://example.org/> .

:greatgrandpa :parentOf :grandpa .
:grandpa :parentOf :dad .
:dad :parentOf :me .
:me :siblingOf :sister .`;

const ruleSet = buildAST(srl);
const result = executeRules(ruleSet, data);

// Prefix-collapsed output, grouped by the rule that produced each triple.
const byRule = new Map();
for (const t of result.inferredTriples) {
  const { subject, predicate, object } = formatTripleForDisplay(t.quad, ruleSet.prefixes);
  const line = `${subject} ${predicate} ${object}`;
  byRule.set(t.sourceRule.name, [...(byRule.get(t.sourceRule.name) ?? []), line]);
}

console.log(`Inferred ${result.inferredTriples.length} triple(s) across ${result.iterations} iteration(s):\n`);
for (const [rule, lines] of byRule) {
  console.log(`${rule}`);
  for (const l of lines) console.log(`   ${l}`);
  console.log();
}
// You should see the full ancestor chain (me→dad→grandpa→greatgrandpa closed
// transitively) plus :sister :siblingOf :me from the symmetric expansion.
