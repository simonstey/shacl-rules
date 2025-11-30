import { Term, Literal, NamedNode, DataFactory } from 'n3';
import { Expression, BinaryOperator, UnaryOperator } from '../srl/ast';
import { SolutionMapping } from './pattern-matcher';

const { namedNode, literal } = DataFactory;

export type EvalResult = Term | boolean | number | string | null;

const XSD = 'http://www.w3.org/2001/XMLSchema#';

export function isNumeric(term: Term): boolean {
  if (term.termType !== 'Literal') return false;
  const lit = term as Literal;
  const dt = lit.datatype?.value;
  return dt === `${XSD}integer` || dt === `${XSD}decimal` || dt === `${XSD}double` || dt === `${XSD}float`;
}

export function toNumber(term: Term): number | null {
  if (term.termType !== 'Literal') return null;
  const lit = term as Literal;
  const num = parseFloat(lit.value);
  return isNaN(num) ? null : num;
}

export function toBoolean(value: EvalResult): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value.length > 0;
  if (value === null) return false;
  if (value && 'termType' in value) {
    if (value.termType === 'Literal') {
      const lit = value as Literal;
      if (lit.datatype?.value === `${XSD}boolean`) {
        return lit.value === 'true';
      }
      return lit.value.length > 0;
    }
    return true;
  }
  return false;
}

export function toString(value: EvalResult): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value === null) return '';
  if (value && 'termType' in value) {
    if (value.termType === 'Literal') {
      return (value as Literal).value;
    }
    return value.value;
  }
  return '';
}

function isTerm(value: EvalResult): value is Term {
  return value !== null && typeof value === 'object' && 'termType' in value;
}

function getNumberFromResult(value: EvalResult): number | null {
  if (typeof value === 'number') return value;
  if (isTerm(value)) return toNumber(value);
  return null;
}

export function resultToTerm(value: EvalResult): Term | null {
  if (value === null) return null;
  if (typeof value === 'string') {
    return literal(value);
  }
  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return literal(String(value), namedNode(`${XSD}integer`));
    }
    return literal(String(value), namedNode(`${XSD}decimal`));
  }
  if (typeof value === 'boolean') {
    return literal(String(value), namedNode(`${XSD}boolean`));
  }
  if (isTerm(value)) {
    return value;
  }
  return null;
}

export function evaluateExpression(expr: Expression, solution: SolutionMapping): EvalResult {
  switch (expr.type) {
    case 'variable':
      return solution[expr.name] ?? null;
      
    case 'literal':
      if (typeof expr.value === 'boolean') {
        return literal(String(expr.value), namedNode(`${XSD}boolean`));
      }
      if (typeof expr.value === 'number') {
        if (Number.isInteger(expr.value)) {
          return literal(String(expr.value), namedNode(`${XSD}integer`));
        }
        return literal(String(expr.value), namedNode(`${XSD}decimal`));
      }
      if (expr.language) {
        return literal(String(expr.value), expr.language);
      }
      if (expr.datatype) {
        return literal(String(expr.value), namedNode(expr.datatype));
      }
      return literal(String(expr.value));
      
    case 'iri':
      return namedNode(expr.value);
      
    case 'binary':
      return evaluateBinary(expr.operator, expr.left, expr.right, solution);
      
    case 'unary':
      return evaluateUnary(expr.operator, expr.operand, solution);
      
    case 'function':
      return evaluateFunction(expr.name, expr.args, solution);
      
    default:
      return null;
  }
}

function evaluateBinary(
  op: BinaryOperator,
  left: Expression,
  right: Expression,
  solution: SolutionMapping
): EvalResult {
  const leftVal = evaluateExpression(left, solution);
  const rightVal = evaluateExpression(right, solution);
  
  switch (op) {
    case '||':
      return toBoolean(leftVal) || toBoolean(rightVal);
      
    case '&&':
      return toBoolean(leftVal) && toBoolean(rightVal);
      
    case '=':
      return termsEqual(leftVal, rightVal);
      
    case '!=':
      return !termsEqual(leftVal, rightVal);
      
    case '<':
    case '>':
    case '<=':
    case '>=':
      return compareTerms(leftVal, rightVal, op);
      
    case '+':
    case '-':
    case '*':
    case '/':
      return arithmeticOp(leftVal, rightVal, op);
      
    default:
      return null;
  }
}

function evaluateUnary(op: UnaryOperator, operand: Expression, solution: SolutionMapping): EvalResult {
  const val = evaluateExpression(operand, solution);
  
  switch (op) {
    case '!':
      return !toBoolean(val);
      
    case '+':
      if (isTerm(val)) {
        const num = toNumber(val);
        return num !== null ? num : null;
      }
      return typeof val === 'number' ? val : null;
      
    case '-':
      if (isTerm(val)) {
        const num = toNumber(val);
        return num !== null ? -num : null;
      }
      return typeof val === 'number' ? -val : null;
      
    default:
      return null;
  }
}

function termsEqual(left: EvalResult, right: EvalResult): boolean {
  if (left === null || right === null) return false;
  
  if (typeof left === 'boolean' || typeof right === 'boolean') {
    return toBoolean(left) === toBoolean(right);
  }
  
  if (typeof left === 'number' && typeof right === 'number') {
    return left === right;
  }
  
  if (typeof left === 'string' && typeof right === 'string') {
    return left === right;
  }
  
  const leftIsTerm = typeof left === 'object' && left !== null && 'termType' in left;
  const rightIsTerm = typeof right === 'object' && right !== null && 'termType' in right;
  
  if (leftIsTerm && rightIsTerm) {
    const leftTerm = left as Term;
    const rightTerm = right as Term;
    if (leftTerm.termType !== rightTerm.termType) return false;
    
    if (leftTerm.termType === 'Literal' && rightTerm.termType === 'Literal') {
      const l1 = leftTerm as Literal;
      const l2 = rightTerm as Literal;
      
      if (isNumeric(l1) && isNumeric(l2)) {
        return toNumber(l1) === toNumber(l2);
      }
      
      return l1.value === l2.value &&
             l1.datatype?.value === l2.datatype?.value &&
             l1.language === l2.language;
    }
    
    return leftTerm.value === rightTerm.value;
  }
  
  return toString(left) === toString(right);
}

function compareTerms(left: EvalResult, right: EvalResult, op: '<' | '>' | '<=' | '>='): boolean {
  const leftNum = getNumberFromResult(left);
  const rightNum = getNumberFromResult(right);
  
  if (leftNum !== null && rightNum !== null) {
    switch (op) {
      case '<': return leftNum < rightNum;
      case '>': return leftNum > rightNum;
      case '<=': return leftNum <= rightNum;
      case '>=': return leftNum >= rightNum;
    }
  }
  
  const leftStr = toString(left);
  const rightStr = toString(right);
  
  switch (op) {
    case '<': return leftStr < rightStr;
    case '>': return leftStr > rightStr;
    case '<=': return leftStr <= rightStr;
    case '>=': return leftStr >= rightStr;
  }
}

function arithmeticOp(left: EvalResult, right: EvalResult, op: '+' | '-' | '*' | '/'): EvalResult {
  const leftNum = getNumberFromResult(left);
  const rightNum = getNumberFromResult(right);
  
  if (leftNum === null || rightNum === null) return null;
  
  switch (op) {
    case '+': return leftNum + rightNum;
    case '-': return leftNum - rightNum;
    case '*': return leftNum * rightNum;
    case '/': return rightNum !== 0 ? leftNum / rightNum : null;
  }
}

function evaluateFunction(name: string, args: Expression[], solution: SolutionMapping): EvalResult {
  const evalArgs = args.map(a => evaluateExpression(a, solution));
  
  switch (name.toUpperCase()) {
    case 'BOUND':
      return evalArgs[0] !== null;
      
    case 'STR':
      return toString(evalArgs[0]);
      
    case 'STRLEN':
      return toString(evalArgs[0]).length;
      
    case 'CONCAT': {
      const parts = evalArgs.map(a => toString(a));
      return parts.join('');
    }
    
    case 'SUBSTR': {
      const str = toString(evalArgs[0]);
      const start = getNumberFromResult(evalArgs[1]);
      const length = evalArgs[2] !== undefined ? getNumberFromResult(evalArgs[2]) : undefined;
      
      if (start === null) return null;
      const startIdx = start - 1;
      if (length !== undefined && length !== null) {
        return str.substring(startIdx, startIdx + length);
      }
      return str.substring(startIdx);
    }
    
    case 'UCASE':
      return toString(evalArgs[0]).toUpperCase();
      
    case 'LCASE':
      return toString(evalArgs[0]).toLowerCase();
      
    case 'CONTAINS':
      return toString(evalArgs[0]).includes(toString(evalArgs[1]));
      
    case 'STRSTARTS':
      return toString(evalArgs[0]).startsWith(toString(evalArgs[1]));
      
    case 'STRENDS':
      return toString(evalArgs[0]).endsWith(toString(evalArgs[1]));
      
    case 'REPLACE': {
      const str = toString(evalArgs[0]);
      const pattern = toString(evalArgs[1]);
      const replacement = toString(evalArgs[2]);
      return str.replace(new RegExp(pattern, 'g'), replacement);
    }
    
    case 'ABS': {
      const num = getNumberFromResult(evalArgs[0]);
      return num !== null ? Math.abs(num) : null;
    }
    
    case 'ROUND': {
      const num = getNumberFromResult(evalArgs[0]);
      return num !== null ? Math.round(num) : null;
    }
    
    case 'CEIL': {
      const num = getNumberFromResult(evalArgs[0]);
      return num !== null ? Math.ceil(num) : null;
    }
    
    case 'FLOOR': {
      const num = getNumberFromResult(evalArgs[0]);
      return num !== null ? Math.floor(num) : null;
    }
    
    case 'IF': {
      const condition = toBoolean(evalArgs[0]);
      return condition ? evalArgs[1] : evalArgs[2];
    }
    
    case 'COALESCE': {
      for (const arg of evalArgs) {
        if (arg !== null) return arg;
      }
      return null;
    }
    
    case 'ISIRI':
    case 'ISURI':
      return isTerm(evalArgs[0]) && evalArgs[0].termType === 'NamedNode';
      
    case 'ISBLANK':
      return isTerm(evalArgs[0]) && evalArgs[0].termType === 'BlankNode';
      
    case 'ISLITERAL':
      return isTerm(evalArgs[0]) && evalArgs[0].termType === 'Literal';
      
    case 'ISNUMERIC': {
      if (!isTerm(evalArgs[0])) {
        return typeof evalArgs[0] === 'number';
      }
      return isNumeric(evalArgs[0]);
    }
    
    case 'LANG': {
      if (isTerm(evalArgs[0]) && evalArgs[0].termType === 'Literal') {
        return (evalArgs[0] as Literal).language || '';
      }
      return '';
    }
    
    case 'DATATYPE': {
      if (isTerm(evalArgs[0]) && evalArgs[0].termType === 'Literal') {
        const dt = (evalArgs[0] as Literal).datatype;
        return dt ? namedNode(dt.value) : namedNode(`${XSD}string`);
      }
      return null;
    }
    
    case 'NOW':
      return literal(new Date().toISOString(), namedNode(`${XSD}dateTime`));
      
    case 'YEAR':
    case 'MONTH':
    case 'DAY':
    case 'HOURS':
    case 'MINUTES':
    case 'SECONDS': {
      const dateStr = toString(evalArgs[0]);
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return null;
      
      switch (name.toUpperCase()) {
        case 'YEAR': return date.getFullYear();
        case 'MONTH': return date.getMonth() + 1;
        case 'DAY': return date.getDate();
        case 'HOURS': return date.getHours();
        case 'MINUTES': return date.getMinutes();
        case 'SECONDS': return date.getSeconds();
      }
      return null;
    }
    
    default:
      console.warn(`Unknown function: ${name}`);
      return null;
  }
}

export function evaluateFilter(expr: Expression, solution: SolutionMapping): boolean {
  const result = evaluateExpression(expr, solution);
  return toBoolean(result);
}
