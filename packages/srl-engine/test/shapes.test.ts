import { describe, it, expect } from 'vitest';
import { SRLLexer } from '../src/index';

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
