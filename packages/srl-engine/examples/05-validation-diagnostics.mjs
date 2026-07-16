// 05 — Validation diagnostics
//
// validateSRL never throws — it returns located messages. This shows a valid
// ruleset and three flavours of invalid one (unbound head var, undefined
// prefix warning, and an out-of-spec built-in function), and how to read the
// message positions.
//
// Run:  node examples/05-validation-diagnostics.mjs

import { validateSRL } from 'srl-engine';

const cases = {
  'valid': `PREFIX : <http://example.org/>
RULE { ?x :childOf ?y } WHERE { ?y :parentOf ?x }`,

  'unbound head variable (error)': `PREFIX : <http://example.org/>
RULE { :x :q ?missing } WHERE { :s :p ?o }`,

  'undefined prefix (warning, still valid)': `PREFIX : <http://example.org/>
RULE { ?x :childOf ?y } WHERE { ?y foaf:knows ?x }`,

  'non-spec builtin (error)': `PREFIX : <http://example.org/>
RULE { ?x :flag true } WHERE { ?x :n ?n . FILTER(RAND() > 0.5) }`,
};

for (const [label, srl] of Object.entries(cases)) {
  const r = validateSRL(srl);
  console.log(`\n=== ${label} ===`);
  console.log(`isValid: ${r.isValid}  (parsed in ${r.parseTime.toFixed(2)}ms)`);
  for (const m of r.messages) {
    console.log(`  [${m.type}] ${m.startLine}:${m.startColumn}-${m.endLine}:${m.endColumn}  ${m.message}`);
  }
}
// Note: the undefined-prefix case is a WARNING, so isValid stays true.
// RAND is not in the spec [121] built-in set → error → isValid false.
