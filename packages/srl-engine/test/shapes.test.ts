import { describe, it, expect } from 'vitest';
import { SRLLexer, parseSRL, buildAST, ExtensionError } from '../src/index';
import { Store, Parser, DataFactory } from 'n3';
import { rdfList, pyValue, termKey, localName, SH } from '../src/shapes/rdf-helpers';

const { namedNode, literal, blankNode } = DataFactory;

function storeFrom(ttl: string): Store {
  const s = new Store();
  s.addQuads(new Parser().parse(ttl));
  return s;
}

describe('rdf-helpers', () => {
  it('reads an RDF list in order', () => {
    const store = storeFrom(`@prefix ex: <http://example.org/> .
ex:s ex:list ( ex:a ex:b ex:c ) .`);
    const listHead = store.getQuads(namedNode('http://example.org/s'), namedNode('http://example.org/list'), null, null)[0].object;
    const members = rdfList(store, listHead).map(t => t.value);
    expect(members).toEqual(['http://example.org/a', 'http://example.org/b', 'http://example.org/c']);
  });

  it('returns [] for a non-list node', () => {
    const store = storeFrom(`@prefix ex: <http://example.org/> .\nex:s ex:p ex:o .`);
    expect(rdfList(store, namedNode('http://example.org/o'))).toEqual([]);
  });

  it('coerces xsd:integer literals to numbers', () => {
    expect(pyValue(literal('30', namedNode('http://www.w3.org/2001/XMLSchema#integer')))).toBe(30);
  });

  it('gives value-based term keys that differentiate type, datatype, and language', () => {
    // Same term → same key (stable)
    expect(termKey(namedNode('http://example.org/x'))).toBe(termKey(namedNode('http://example.org/x')));
    // Same .value, different term type → different keys
    expect(termKey(namedNode('x'))).not.toBe(termKey(literal('x')));
    expect(termKey(namedNode('x'))).not.toBe(termKey(blankNode('x')));
    expect(termKey(literal('x'))).not.toBe(termKey(blankNode('x')));
    // Same lexical value, different datatype → different keys
    expect(termKey(literal('a', namedNode('http://example.org/dt1'))))
      .not.toBe(termKey(literal('a', namedNode('http://example.org/dt2'))));
    // Same lexical value, different language → different keys
    expect(termKey(literal('a', 'en'))).not.toBe(termKey(literal('a', 'fr')));
  });

  it('extracts SHACL local names', () => {
    expect(localName(`${SH}minCount`)).toBe('minCount');
    expect(localName('http://example.org/x')).toBeNull();
  });
});

describe('FOR token', () => {
  it('lexes FOR as a keyword token, not an identifier', () => {
    const result = SRLLexer.tokenize('FOR ?this IN');
    expect(result.errors).toHaveLength(0);
    expect(result.tokens[0].tokenType.name).toBe('For');
  });

  it('does not mis-lex FOR as the prefix of an identifier', () => {
    const result = SRLLexer.tokenize('FORMAT');
    expect(result.tokens[0].tokenType.name).not.toBe('For');
  });
});

const FOR_RULE = `PREFIX ex: <http://example.org/>
RULE ex:r FOR ?this IN ex:AdultShape { ?this ex:status ex:adult } WHERE { ?this ex:age ?a }`;

describe('FOR clause grammar', () => {
  it('parses a rule1 with a FOR clause without parser errors', () => {
    const result = parseSRL(FOR_RULE);
    expect(result.errors).toHaveLength(0);
  });

  it('parses an IF..THEN with a naming IRI and FOR clause', () => {
    const src = `PREFIX ex: <http://example.org/>
IF { ?this ex:age ?a } THEN ex:r FOR ?this IN ex:AdultShape { ?this ex:status ex:adult }`;
    const result = parseSRL(src);
    expect(result.errors).toHaveLength(0);
  });
});

describe('TargetedRule AST + gating', () => {
  it('rejects a FOR clause when extensions are off (default)', () => {
    expect(() => buildAST(FOR_RULE)).toThrow(ExtensionError);
  });

  it('builds a TargetedRule when extensions are on', () => {
    const rs = buildAST(FOR_RULE, { extensions: true });
    expect(rs.rules).toHaveLength(0);
    expect(rs.targetedRules).toHaveLength(1);
    const tr = rs.targetedRules[0];
    expect(tr.focusVar).toBe('this');
    expect(tr.shape).toBe('http://example.org/AdultShape');
    expect(tr.rule.head.patterns).toHaveLength(1);
  });

  it('rejects a rule2 naming IRI without FOR when extensions are off', () => {
    const src = `PREFIX ex: <http://example.org/>
IF { ?s ex:p ?o } THEN ex:r { ?s ex:q ?o }`;
    expect(() => buildAST(src)).toThrow(ExtensionError);
  });

  it('leaves a spec-pure rule set unchanged with empty targetedRules', () => {
    const rs = buildAST(`PREFIX ex: <http://example.org/>
RULE { ?s ex:q ?o } WHERE { ?s ex:p ?o }`);
    expect(rs.rules).toHaveLength(1);
    expect(rs.targetedRules).toHaveLength(0);
  });

  it('allows a named rule1 without FOR with extensions off (backward compat)', () => {
    const rs = buildAST(`PREFIX ex: <http://example.org/>
RULE ex:r { ?s ex:q ?o } WHERE { ?s ex:p ?o }`);
    expect(rs.rules).toHaveLength(1);
    expect(rs.rules[0].name).toBe('http://example.org/r');
    expect(rs.targetedRules).toHaveLength(0);
  });
});

import { loadShape, UnsupportedShapeFeatureError, TARGET_PREDS } from '../src/shapes/model';

const SHAPES_TTL = `@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix ex: <http://example.org/> .
ex:AdultShape a sh:NodeShape ; sh:targetClass ex:Person ;
  sh:property [ sh:path ex:age ; sh:minCount 1 ; sh:minInclusive 18 ] .`;

describe('loadShape', () => {
  it('parses targets and property shapes', () => {
    const store = storeFrom(SHAPES_TTL);
    const shape = loadShape(store, namedNode('http://example.org/AdultShape'));
    expect(shape.targets).toContainEqual(['targetClass', namedNode('http://example.org/Person')]);
    expect(shape.propertyShapes).toHaveLength(1);
    const ps = shape.propertyShapes[0];
    expect(ps.path).toEqual(namedNode('http://example.org/age'));
    expect(ps.constraints.map(c => c.kind).sort()).toEqual(['minCount', 'minInclusive']);
  });

  it('throws on an unsupported feature', () => {
    const store = storeFrom(`@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix ex: <http://example.org/> .
ex:S a sh:NodeShape ; sh:closed true .`);
    expect(() => loadShape(store, namedNode('http://example.org/S'))).toThrow(UnsupportedShapeFeatureError);
  });

  it('exposes the target predicate set', () => {
    expect(TARGET_PREDS.has('targetClass')).toBe(true);
  });
});

import { conforms } from '../src/shapes/validate';
import { focusNodes } from '../src/shapes/targets';

describe('focusNodes', () => {
  it('selects targetClass instances', () => {
    const shapesStore = storeFrom(SHAPES_TTL);
    const dataStore = storeFrom(`@prefix ex: <http://example.org/> .
ex:Alice a ex:Person . ex:Bob a ex:Person . ex:Widget a ex:Thing .`);
    const shape = loadShape(shapesStore, namedNode('http://example.org/AdultShape'));
    const nodes = focusNodes(shape, dataStore, shapesStore).map(t => t.value).sort();
    expect(nodes).toEqual(['http://example.org/Alice', 'http://example.org/Bob']);
  });

  it('selects targetClass instances via transitive subClassOf', () => {
    const shapesStore = storeFrom(`@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix ex: <http://example.org/> .
ex:S a sh:NodeShape ; sh:targetClass ex:Animal .`);
    const dataStore = storeFrom(`@prefix ex: <http://example.org/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
ex:Dog rdfs:subClassOf ex:Animal . ex:Rex a ex:Dog .`);
    const shape = loadShape(shapesStore, namedNode('http://example.org/S'));
    expect(focusNodes(shape, dataStore, shapesStore).map(t => t.value)).toContain('http://example.org/Rex');
  });
});

function dataAndShape(shapesTtl: string, dataTtl: string, shapeIri: string) {
  const shapesStore = storeFrom(shapesTtl);
  const dataStore = storeFrom(dataTtl);
  const shape = loadShape(shapesStore, namedNode(shapeIri));
  return { shape, dataStore, shapesStore };
}

describe('checkConstraint: value/cardinality/range/string', () => {
  const SH_PFX = '@prefix sh: <http://www.w3.org/ns/shacl#> .\n@prefix ex: <http://example.org/> .\n@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .\n';

  it('minInclusive + minCount: Alice (30) conforms, Bob (10) fails', () => {
    const shapes = SH_PFX + `ex:S a sh:NodeShape ; sh:property [ sh:path ex:age ; sh:minCount 1 ; sh:minInclusive 18 ] .`;
    const data = `@prefix ex: <http://example.org/> .\nex:Alice ex:age 30 . ex:Bob ex:age 10 .`;
    const { shape, dataStore, shapesStore } = dataAndShape(shapes, data, 'http://example.org/S');
    expect(conforms(namedNode('http://example.org/Alice'), shape, dataStore, shapesStore)).toBe(true);
    expect(conforms(namedNode('http://example.org/Bob'), shape, dataStore, shapesStore)).toBe(false);
  });

  it('datatype: string value conforms, integer fails', () => {
    const shapes = SH_PFX + `ex:S a sh:NodeShape ; sh:property [ sh:path ex:name ; sh:datatype xsd:string ] .`;
    const data = `@prefix ex: <http://example.org/> .\nex:A ex:name "hi" . ex:B ex:name 5 .`;
    const { shape, dataStore, shapesStore } = dataAndShape(shapes, data, 'http://example.org/S');
    expect(conforms(namedNode('http://example.org/A'), shape, dataStore, shapesStore)).toBe(true);
    expect(conforms(namedNode('http://example.org/B'), shape, dataStore, shapesStore)).toBe(false);
  });

  it('nodeKind sh:IRI, maxCount, pattern', () => {
    const shapes = SH_PFX + `ex:S a sh:NodeShape ;
      sh:property [ sh:path ex:knows ; sh:nodeKind sh:IRI ; sh:maxCount 2 ] ;
      sh:property [ sh:path ex:code ; sh:pattern "^[A-Z]+$" ] .`;
    const data = `@prefix ex: <http://example.org/> .\nex:A ex:knows ex:B ; ex:code "ABC" .`;
    const { shape, dataStore, shapesStore } = dataAndShape(shapes, data, 'http://example.org/S');
    expect(conforms(namedNode('http://example.org/A'), shape, dataStore, shapesStore)).toBe(true);
  });

  it('hasValue + in', () => {
    const shapes = SH_PFX + `ex:S a sh:NodeShape ;
      sh:property [ sh:path ex:role ; sh:hasValue ex:admin ] ;
      sh:property [ sh:path ex:color ; sh:in ( ex:red ex:green ) ] .`;
    const data = `@prefix ex: <http://example.org/> .
ex:Good ex:role ex:admin ; ex:color ex:red .
ex:BadRole ex:role ex:guest ; ex:color ex:red .
ex:BadColor ex:role ex:admin ; ex:color ex:blue .`;
    const { shape, dataStore, shapesStore } = dataAndShape(shapes, data, 'http://example.org/S');
    expect(conforms(namedNode('http://example.org/Good'), shape, dataStore, shapesStore)).toBe(true);
    expect(conforms(namedNode('http://example.org/BadRole'), shape, dataStore, shapesStore)).toBe(false);
    expect(conforms(namedNode('http://example.org/BadColor'), shape, dataStore, shapesStore)).toBe(false);
  });
});

describe('checkConstraint: list family + language', () => {
  const SH_PFX = '@prefix sh: <http://www.w3.org/ns/shacl#> .\n@prefix ex: <http://example.org/> .\n';

  it('sh:maxListLength', () => {
    const shapes = SH_PFX + `ex:S a sh:NodeShape ; sh:property [ sh:path ex:items ; sh:maxListLength 2 ] .`;
    const data = `@prefix ex: <http://example.org/> .\nex:A ex:items ( ex:x ex:y ) . ex:B ex:items ( ex:x ex:y ex:z ) .`;
    const { shape, dataStore, shapesStore } = dataAndShape(shapes, data, 'http://example.org/S');
    expect(conforms(namedNode('http://example.org/A'), shape, dataStore, shapesStore)).toBe(true);
    expect(conforms(namedNode('http://example.org/B'), shape, dataStore, shapesStore)).toBe(false);
  });

  it('sh:languageIn', () => {
    const shapes = SH_PFX + `ex:S a sh:NodeShape ; sh:property [ sh:path ex:label ; sh:languageIn ( "en" "de" ) ] .`;
    const data = `@prefix ex: <http://example.org/> .\nex:A ex:label "hi"@en . ex:B ex:label "salut"@fr .`;
    const { shape, dataStore, shapesStore } = dataAndShape(shapes, data, 'http://example.org/S');
    expect(conforms(namedNode('http://example.org/A'), shape, dataStore, shapesStore)).toBe(true);
    expect(conforms(namedNode('http://example.org/B'), shape, dataStore, shapesStore)).toBe(false);
  });
});

describe('checkConstraint: logical + shape-based + paths', () => {
  const SH_PFX = '@prefix sh: <http://www.w3.org/ns/shacl#> .\n@prefix ex: <http://example.org/> .\n';

  it('sh:not — node WITHOUT ex:banned conforms', () => {
    const shapes = SH_PFX + `ex:S a sh:NodeShape ; sh:not ex:BannedShape .
ex:BannedShape a sh:NodeShape ; sh:property [ sh:path ex:banned ; sh:minCount 1 ] .`;
    const data = `@prefix ex: <http://example.org/> .\nex:Clean ex:ok true . ex:Bad ex:banned true .`;
    const { shape, dataStore, shapesStore } = dataAndShape(shapes, data, 'http://example.org/S');
    expect(conforms(namedNode('http://example.org/Clean'), shape, dataStore, shapesStore)).toBe(true);
    expect(conforms(namedNode('http://example.org/Bad'), shape, dataStore, shapesStore)).toBe(false);
  });

  it('sh:inversePath — value nodes reached backwards', () => {
    const shapes = SH_PFX + `ex:S a sh:NodeShape ; sh:property [ sh:path [ sh:inversePath ex:parent ] ; sh:minCount 1 ] .`;
    const data = `@prefix ex: <http://example.org/> .\nex:Child ex:parent ex:Parent .`;
    const { shape, dataStore, shapesStore } = dataAndShape(shapes, data, 'http://example.org/S');
    expect(conforms(namedNode('http://example.org/Parent'), shape, dataStore, shapesStore)).toBe(true);
    expect(conforms(namedNode('http://example.org/Child'), shape, dataStore, shapesStore)).toBe(false);
  });

  it('sh:or — conforms if any branch holds', () => {
    const shapes = SH_PFX + `ex:S a sh:NodeShape ; sh:or ( ex:A ex:B ) .
ex:A a sh:NodeShape ; sh:property [ sh:path ex:a ; sh:minCount 1 ] .
ex:B a sh:NodeShape ; sh:property [ sh:path ex:b ; sh:minCount 1 ] .`;
    const data = `@prefix ex: <http://example.org/> .\nex:X ex:b 1 .`;
    const { shape, dataStore, shapesStore } = dataAndShape(shapes, data, 'http://example.org/S');
    expect(conforms(namedNode('http://example.org/X'), shape, dataStore, shapesStore)).toBe(true);
  });
});
