// 01 — Basic inference
//
// The "hello world" of the engine: one rule, one data triple, one inferred
// fact. Run with:  node examples/01-basic-inference.mjs
//
// Requires a built package: `npm -w srl-engine run build` first (the examples
// import the package by name, which resolves to dist/).

import { validateSRL, buildAST, executeRules } from 'srl-engine';

const srl = `PREFIX : <http://example.org/>

# A person is a child of their parent (derive the inverse direction)
RULE { ?x :childOf ?y } WHERE { ?y :parentOf ?x }`;

const data = `@prefix : <http://example.org/> .

:john :parentOf :mary .
:mary :parentOf :tom .`;

// 1. Validate.
const report = validateSRL(srl);
if (!report.isValid) {
  for (const m of report.messages) {
    console.error(`${m.type} ${m.startLine}:${m.startColumn} — ${m.message}`);
  }
  process.exit(1);
}

// 2. Build + 3. Execute.
const result = executeRules(buildAST(srl), data);

console.log(`Inferred ${result.inferredTriples.length} triple(s):`);
for (const t of result.inferredTriples) {
  console.log(`  ${t.quadString}   ← ${t.sourceRule.name}`);
}
// Expected:
//   <http://example.org/mary> <http://example.org/childOf> <http://example.org/john>
//   <http://example.org/tom>  <http://example.org/childOf> <http://example.org/mary>
