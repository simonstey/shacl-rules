import { describe, it, expect } from 'vitest';
import { Store, Parser, DataFactory } from 'n3';
import { buildAST, stratifyRules } from '../src/index';
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
});
