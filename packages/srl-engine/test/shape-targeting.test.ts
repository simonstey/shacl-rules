import { describe, it, expect } from 'vitest';
import { Store, Parser, DataFactory } from 'n3';
import { buildAST, stratifyRules, executeRules } from '../src/index';
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

  it('places a targeted rule above another targeted rule that feeds its shape', () => {
    const shapes = `@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix ex: <http://example.org/> .
ex:PersonShape a sh:NodeShape ; sh:targetClass ex:Person .
ex:AdultShape a sh:NodeShape ; sh:targetClass ex:Person ;
  sh:property [ sh:path ex:age ; sh:minCount 1 ; sh:minInclusive 18 ] .`;
    const src = `PREFIX ex: <http://example.org/>
RULE ex:r2 FOR ?this IN ex:AdultShape { ?this ex:status ex:adult } WHERE { ?this ex:age ?a }
RULE ex:r1 FOR ?this IN ex:PersonShape { ?this ex:age 40 } WHERE { ?this ex:bornYear ?y }`;
    const rs = buildAST(src, { extensions: true });
    const shapesStore = storeFrom(shapes);
    const layers = stratifyRules(rs.rules, rs.targetedRules, shapesStore);
    // r2 (targeted on AdultShape, reads ex:age) must be strictly above r1 (targeted, infers ex:age).
    let r1Layer = -1, r2Layer = -1;
    layers.forEach((l, i) => {
      for (const st of l.targeted) {
        if (st.targetedRule.rule.name === 'http://example.org/r1') r1Layer = i;
        if (st.targetedRule.rule.name === 'http://example.org/r2') r2Layer = i;
      }
    });
    expect(r1Layer).toBeGreaterThanOrEqual(0);
    expect(r2Layer).toBeGreaterThan(r1Layer);
  });
});

// ---------------------------------------------------------------------------
// py-srl oracle: executeRules with targeted rules
// ---------------------------------------------------------------------------

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
