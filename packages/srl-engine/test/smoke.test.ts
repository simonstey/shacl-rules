import { describe, it, expect } from 'vitest';
import {
  buildAST,
  parseSRL,
  validateSRL,
  executeRules,
  stratifyRules,
  SRLLexer,
  formatTripleForDisplay,
} from '../src/index';

const RULES = `PREFIX : <http://example/>

RULE { :x :q ?o } WHERE { :s :p ?o }`;

const DATA = `PREFIX : <http://example/>

:s :p :o .`;

describe('srl-engine facade', () => {
  it('exports the core entry points as callables', () => {
    for (const fn of [buildAST, parseSRL, validateSRL, executeRules, stratifyRules, formatTripleForDisplay]) {
      expect(typeof fn).toBe('function');
    }
    expect(SRLLexer).toBeDefined();
  });

  it('parses a well-formed ruleset without errors', () => {
    const parsed = parseSRL(RULES);
    expect(parsed.errors).toHaveLength(0);
  });

  it('validates a well-formed ruleset as valid', () => {
    const result = validateSRL(RULES);
    expect(result.isValid).toBe(true);
  });

  it('builds an AST with one rule', () => {
    const ast = buildAST(RULES);
    expect(ast.rules).toHaveLength(1);
  });

  it('executes and infers the expected triple', () => {
    const ast = buildAST(RULES);
    const result = executeRules(ast, DATA);
    const inferred = result.inferredTriples.map(t => t.quadString);
    // quadToString format: "<subject> <predicate> <object>" — pin the exact triple
    expect(inferred).toContain('<http://example/x> <http://example/q> <http://example/o>');
  });

  it('flags an unbound head variable as invalid', () => {
    const bad = `PREFIX : <http://example/>

RULE { :x :q ?missing } WHERE { :s :p ?o }`;
    const result = validateSRL(bad);
    expect(result.isValid).toBe(false);
  });
});
