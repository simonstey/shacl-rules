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
