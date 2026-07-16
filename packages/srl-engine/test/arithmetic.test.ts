import { describe, it, expect } from 'vitest';
import { buildAST, executeRules } from '../src/index';

// Regression tests for operator-precedence / left-associativity in SET expression
// arithmetic, and for unary +/-. These guard a fixed bug where:
//   - `a + b - c` folded as (a+b)+c (the '-' was mis-read as '+'), and
//   - unary `-?x` / `+?x` dropped the sign entirely (returned the bare operand).

/** Build the SET expression AST for `?r := <expr>` over three bound vars. */
function setExpr(expr: string) {
  const src = `PREFIX ex: <http://example.org/>
RULE { ex:s ex:r ?r } WHERE { ex:s ex:a ?a . ex:s ex:b ?b . ex:s ex:c ?c . SET(?r := ${expr}) }`;
  const rs = buildAST(src);
  const assign = rs.rules[0].body.elements.find(e => 'type' in e && e.type === 'assignment');
  // @ts-expect-error narrowed at runtime
  return assign.expression;
}

/** Execute `?r := <expr>` with a=first, b=second, c=third and return the result literal. */
function evalExpr(expr: string, a: number, b: number, c: number): string | undefined {
  const src = `PREFIX ex: <http://example.org/>
RULE { ex:s ex:r ?r } WHERE { ex:s ex:a ?a . ex:s ex:b ?b . ex:s ex:c ?c . SET(?r := ${expr}) }`;
  const data = `@prefix ex: <http://example.org/> .
ex:s ex:a ${a} ; ex:b ${b} ; ex:c ${c} .`;
  const res = executeRules(buildAST(src), data);
  return res.inferredTriples.find(t => t.quadString.includes('/r>'))?.quad.object.value;
}

describe('arithmetic operator associativity/precedence', () => {
  it('a + b - c parses left-associatively as (a + b) - c', () => {
    const e = setExpr('?a + ?b - ?c');
    expect(e).toMatchObject({
      type: 'binary',
      operator: '-',
      left: { type: 'binary', operator: '+' },
      right: { type: 'variable', name: 'c' },
    });
  });

  it('a - b + c parses as (a - b) + c', () => {
    const e = setExpr('?a - ?b + ?c');
    expect(e).toMatchObject({
      type: 'binary',
      operator: '+',
      left: { type: 'binary', operator: '-' },
    });
  });

  it('a * b / c parses as (a * b) / c', () => {
    const e = setExpr('?a * ?b / ?c');
    expect(e).toMatchObject({
      type: 'binary',
      operator: '/',
      left: { type: 'binary', operator: '*' },
    });
  });

  it('unary -?a is a unary - expression', () => {
    const e = setExpr('-?a');
    expect(e).toMatchObject({ type: 'unary', operator: '-', operand: { type: 'variable', name: 'a' } });
  });

  it('unary +?a is a unary + expression', () => {
    const e = setExpr('+?a');
    expect(e).toMatchObject({ type: 'unary', operator: '+', operand: { type: 'variable', name: 'a' } });
  });

  it('evaluates 10 + 5 - 3 = 12 (not 18)', () => {
    expect(evalExpr('?a + ?b - ?c', 10, 5, 3)).toBe('12');
  });

  it('evaluates 2 * 6 / 3 = 4 (not 36)', () => {
    expect(evalExpr('?a * ?b / ?c', 2, 6, 3)).toBe('4');
  });

  it('evaluates 20 - 4 - 6 = 10 (left-assoc, not 22)', () => {
    expect(evalExpr('?a - ?b - ?c', 20, 4, 6)).toBe('10');
  });
});
