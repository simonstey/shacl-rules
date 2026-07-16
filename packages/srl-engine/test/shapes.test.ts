import { describe, it, expect } from 'vitest';
import { SRLLexer, parseSRL } from '../src/index';

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
