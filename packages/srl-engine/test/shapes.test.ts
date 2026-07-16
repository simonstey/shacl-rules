import { describe, it, expect } from 'vitest';
import { SRLLexer, parseSRL, buildAST, ExtensionError } from '../src/index';

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
});
