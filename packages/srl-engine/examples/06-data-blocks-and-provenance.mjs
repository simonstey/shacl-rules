// 06 — DATA blocks, provenance, and the full output graph
//
// Shows: (a) a DATA { … } block seeding ground triples into the inference
// output (attributed to the synthetic "DATA block" rule), (b) reading
// per-triple provenance, and (c) assembling the complete output graph
// (base G0 + inferred GI), since inferredTriples excludes base triples.
//
// Run:  node examples/06-data-blocks-and-provenance.mjs

import { buildAST, executeRules, quadToString } from 'srl-engine';

const srl = `PREFIX : <http://example.org/>

# Seed some ground facts directly from the ruleset
DATA {
    :mercury :orbits :sun .
    :venus :orbits :sun .
}

# Anything orbiting the sun is a planet
RULE { ?body :type :Planet } WHERE { ?body :orbits :sun }`;

const data = `@prefix : <http://example.org/> .

:earth :orbits :sun .`;

const ruleSet = buildAST(srl);
const result = executeRules(ruleSet, data);

console.log('Provenance of each inferred triple:');
for (const t of result.inferredTriples) {
  console.log(`  [iter ${t.iteration}] ${t.quadString}`);
  console.log(`           ↳ ${t.sourceRule.name}`);
}

console.log(`\nStore summary: ${result.baseTriples.length} base + ` +
  `${result.inferredTriples.length} inferred = ${result.totalTriples} total`);

// Full output graph = base ∪ inferred (inferredTriples never includes base).
const outputGraph = [
  ...result.baseTriples.map(quadToString),
  ...result.inferredTriples.map(t => t.quadString),
].sort();

console.log('\nComplete output graph:');
for (const line of outputGraph) console.log(`  ${line}`);
// mercury/venus come from the DATA block (source "DATA block"); earth from the
// data arg; all three get :type :Planet from the rule.
